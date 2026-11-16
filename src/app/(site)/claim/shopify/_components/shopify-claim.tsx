"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ShoppingBag } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { FlowButton, FlowCard, FlowHead, FlowNotice, FlowPage, flowFacts, flowOption } from "@/components/marketing/flow/flow-kit";
import {
  fetchShopifyClaimCandidates,
  claimShopifyStore,
  type ClaimResult,
  type ShopifyClaimCandidates,
} from "@/lib/api/shopify-claim";
import { LoadingScreen } from "@/components/molecules/loading-screen";
import {
  BRAND_CONFIRM,
  KEEP_SEPARATE_CODES,
  businessLimitNotice,
  businessOption,
  claimOutcome,
  doneCopy,
  errCopy,
  intoNotice,
} from "./claim-copy";
import { ClaimDone } from "./claim-done";
import { AddBusinessDialog } from "@/components/upgrade/add-business-dialog";
import { boughtForStore, isBusinessLimit, rememberBoughtForStore, sessionStore } from "@/lib/add-business";

/** Sentinel for "move the store in as a NEW Business" (vs an existing businessId). */
const NEW_BUSINESS = "__new__";
/** Sentinel for "keep the store as its own account" (D14): the store's own
 *  shell account is adopted beside the merchant's other accounts. */
const SEPARATE = "__separate__";

/** Result of the post-auth flow (fetch candidates → choose → claim). The
 *  pre-auth phases (loading auth / missing link / need sign-in) are DERIVED at
 *  render time from props, so the effect never sets state synchronously. */
type FetchState = "loading" | "choose" | "claiming" | "done" | "error";

export function ShopifyClaim() {
  const params = useSearchParams();
  const store = params.get("store") ?? "";
  const token = params.get("t") ?? "";
  // Back from buying the workspace's plan (P3.2): the business bought for this
  // store, to pick and attach to. ★ONLY ONE THIS TAB BOUGHT FOR THIS STORE
  // (review R1): a link can name any business, and attaching to it skips the
  // "same brand?" question.
  const intoParam = params.get("into") ?? "";
  const into = useMemo(() => (boughtForStore(sessionStore(), intoParam, store, Date.now()) ? intoParam : ""), [intoParam, store]);
  const { isAuthenticated, isLoading, org, switchOrg, switchBusiness } = useAuth();

  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [data, setData] = useState<ShopifyClaimCandidates | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  // A businessId (another storefront of that brand) or NEW_BUSINESS (its own workspace).
  const [selectedTarget, setSelectedTarget] = useState<string>(NEW_BUSINESS);
  const [errCode, setErrCode] = useState<string>("");
  const [errMsg, setErrMsg] = useState<string>("");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [claimedOrgName, setClaimedOrgName] = useState<string>("");
  // The server's 409 CLAIM_BRAND_CONFIRM: this store may be a different brand
  // from the workspace picked. Shown inline, with a confirm and a way out.
  const [confirmPrompt, setConfirmPrompt] = useState<string | null>(null);
  // A refusal whose way forward is keeping the store separate (a different
  // business, or no plan for another workspace): said above the choice, with
  // "keep it as its own account" already picked.
  const [separateNotice, setSeparateNotice] = useState<string | null>(null);
  // ★THE 402 ON "A SEPARATE BRAND" OFFERS ITS PLAN (P3.2; P3.1c's follow-up).
  //  The account's plan covers no other workspace and the store's own has
  //  not paid, so the way on is buying the new workspace's plan, here.
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [openingPurchase, setOpeningPurchase] = useState(false);
  // The business bought for this store, picked on the way back.
  const [boughtNotice, setBoughtNotice] = useState<string | null>(null);

  const ready = !isLoading && isAuthenticated && !!store && !!token;

  useEffect(() => {
    // Only the async candidate fetch lives here; all setState is in the
    // resolved/rejected callbacks (never synchronous in the effect body).
    if (!ready) return;
    let cancelled = false;
    fetchShopifyClaimCandidates(store, token)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (d.orgs.length === 1) setSelectedOrg(d.orgs[0]!.orgId);
        // Back from the purchase: the workspace bought for this store is the
        // choice, in the account that holds it.
        const boughtIn = into ? d.orgs.find((o) => o.businesses.some((b) => b.businessId === into)) : undefined;
        const bought = boughtIn?.businesses.find((b) => b.businessId === into);
        if (boughtIn && bought) {
          setSelectedOrg(boughtIn.orgId);
          setSelectedTarget(bought.businessId);
          setBoughtNotice(intoNotice(bought.name, d.store.name || d.store.shopDomain || "this store"));
          setLimitNotice(null);
        } else if (d.canKeepSeparate) {
          // ★KEEPING IT SEPARATE IS THE DEFAULT WHEN IT IS ON OFFER. Joining an
          //  existing business is the choice that needs a reason; a store left
          //  in the wrong business is the Table Story report.
          setSelectedTarget(SEPARATE);
        }
        setFetchState("choose");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setErrCode((e as { code?: string })?.code ?? "");
        setErrMsg((e as { message?: string })?.message ?? "Something went wrong.");
        setFetchState("error");
      });
    return () => {
      cancelled = true;
    };
    // `into` too: a purchase paid in an overlay comes back to this same page
    // with it, and the new workspace is only in a fresh read.
  }, [ready, store, token, into]);

  const activeOrg = data?.orgs.find((o) => o.orgId === selectedOrg) ?? null;
  const storeName = data?.store.name || data?.store.shopDomain || "This store";

  async function landOn(res: ClaimResult) {
    // Land the merchant on the freshly-claimed store: switch into the target
    // org + business so the dashboard is already scoped to it. Best-effort —
    // the claim already committed, so never surface a switch failure as an error.
    try {
      await switchOrg(res.orgId);
      if (res.businessId) await switchBusiness(res.businessId);
    } catch {
      /* the store is claimed regardless; the switchers will pick it up */
    }
  }

  async function handleClaim(target: string, confirmed = false) {
    if (!data) return;
    if (target !== SEPARATE && !selectedOrg) return;
    setFetchState("claiming");
    try {
      if (target === SEPARATE) {
        const res = await claimShopifyStore(store, token, { mode: "separate" });
        setConfirmPrompt(null);
        setSeparateNotice(null);
        setResult({ ...res, separate: true });
        await landOn(res);
        setFetchState("done");
        return;
      }
      const businessId = target === NEW_BUSINESS ? undefined : target;
      // ★THE WORKSPACE BOUGHT FOR THIS STORE NEEDS NO "SAME BRAND?" (P3.2):
      //  the merchant chose "a separate brand" and paid for this workspace,
      //  which is new and empty, so there is nothing to compare the store
      //  with. A block still refuses; `confirmed` cannot override one.
      const res = await claimShopifyStore(store, token, {
        orgId: selectedOrg,
        businessId,
        confirmed: confirmed || (!!into && businessId === into),
      });
      setConfirmPrompt(null);
      setSeparateNotice(null);
      setResult(claimOutcome(res, businessId, activeOrg?.businesses ?? []));
      setClaimedOrgName(activeOrg?.name ?? "your account");
      await landOn(res);
      setFetchState("done");
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "";
      const message = (e as { message?: string })?.message ?? "";
      if (code === BRAND_CONFIRM) {
        // Nothing moved. Back to the choice, with the question asked (and no
        // stale refusal beside it).
        setSeparateNotice(null);
        setConfirmPrompt(message || "This store may be a different brand from that workspace. Is it the same business?");
        setFetchState("choose");
        return;
      }
      if (isBusinessLimit(e)) {
        // Nothing moved. Back to the choice with the purchase offered, on
        // "a separate brand" whatever was sent (review R2: no dead end).
        setConfirmPrompt(null);
        setSeparateNotice(null);
        setSelectedTarget(NEW_BUSINESS);
        setLimitNotice(businessLimitNotice(storeName, activeOrg?.name ?? "your account", !!data.canKeepSeparate));
        setFetchState("choose");
        return;
      }
      if (KEEP_SEPARATE_CODES.includes(code) && data.canKeepSeparate) {
        // Nothing moved. Back to the choice with the way forward picked.
        setConfirmPrompt(null);
        setSeparateNotice(errCopy(code, message, { canKeepSeparate: true }).body);
        setSelectedTarget(SEPARATE);
        setFetchState("choose");
        return;
      }
      setErrCode(code);
      setErrMsg(message || "Couldn't connect the store.");
      setFetchState("error");
    }
  }

  // The purchase is the signed-in account's (POST /v1/billing/add-business
  // sells to the org in the session), so the account the store is going to
  // is switched in first.
  async function openPurchase() {
    if (!selectedOrg || openingPurchase) return;
    setOpeningPurchase(true);
    try {
      if (org?._id !== selectedOrg) await switchOrg(selectedOrg);
      setBuying(true);
    } catch {
      setLimitNotice("We couldn't open that account. Please try again.");
    } finally {
      setOpeningPurchase(false);
    }
  }

  // One-click path for a merchant with no Peakhour account: adopt the store's
  // auto-provisioned shell org (which already holds the catalog + Commerce plan)
  // as their first workspace — no org to pick, no onboarding, no store URL to
  // type. The server adopts when `orgId` is omitted and the operator owns none.
  async function handleAdopt() {
    if (!store || !token) return;
    setFetchState("claiming");
    try {
      const res = await claimShopifyStore(store, token);
      setResult({ ...res, adopted: true });
      await landOn(res);
      setFetchState("done");
    } catch (e: unknown) {
      setErrCode((e as { code?: string })?.code ?? "");
      setErrMsg((e as { message?: string })?.message ?? "Couldn't set up your account.");
      setFetchState("error");
    }
  }

  // Sign-in that returns the merchant straight back here (with the store+token)
  // after the magic link — no bouncing back to Shopify to re-click. `next` also
  // carries the claim context so the API admits a brand-new merchant email.
  const claimPath = `/claim/shopify?store=${encodeURIComponent(store)}&t=${encodeURIComponent(token)}`;
  const signInHref = `/auth?next=${encodeURIComponent(claimPath)}`;

  // Derived phase: pre-auth states from props, then the async fetchState.
  const showLoading = isLoading || (ready && fetchState === "loading");
  const showMissing = !isLoading && (!store || !token);
  const showSignIn = !isLoading && !!store && !!token && !isAuthenticated;

  return (
    <FlowPage>
      <FlowCard>
        <FlowHead icon={ShoppingBag} title="Claim your Shopify store">
          {ready && fetchState === "choose" && data?.store?.shopDomain ? data.store.shopDomain : null}
        </FlowHead>
        <div className="mt-5 space-y-4">
          {showLoading && (
            <LoadingScreen message="Loading your store…" className="min-h-40 p-4" />
          )}

          {showMissing && (
            <FlowNotice tone="bad" role="alert">
              <p className="font-bold">This link is incomplete</p>
              <p className="mt-1">
                Open the Peakhour app in your Shopify admin and select “Claim this store”.
              </p>
            </FlowNotice>
          )}

          {showSignIn && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to link <span className="font-medium text-foreground">this store</span> to your
                Peakhour account. You&apos;ll come straight back here to finish.
              </p>
              <FlowButton asChild>
                <Link href={signInHref}>Sign in to continue</Link>
              </FlowButton>
            </div>
          )}

          {ready && fetchState === "choose" && data && (
            <div className="space-y-4">
              <div className={flowFacts}>
                <div>
                  Signed in as{" "}
                  <span className="font-medium text-foreground">{data.signedInEmail ?? "your account"}</span>
                </div>
                <div>
                  Store: <span className="font-medium text-foreground">{storeName}</span>
                </div>
              </div>

              {data.orgs.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Create your Peakhour account from{" "}
                    <span className="font-medium text-foreground">{storeName}</span>.
                    Your catalog is already in place.
                  </p>
                  <FlowButton onClick={handleAdopt}>Create my account with this store</FlowButton>
                </div>
              ) : (
                <>
                  {separateNotice && (
                    <FlowNotice tone="warn" role="alert">
                      {separateNotice}
                    </FlowNotice>
                  )}

                  {boughtNotice && selectedTarget === into && (
                    <FlowNotice tone="info" role="status">
                      {boughtNotice}
                    </FlowNotice>
                  )}

                  {limitNotice && selectedTarget === NEW_BUSINESS && (
                    <FlowNotice tone="warn" role="alert">
                      <p>{limitNotice}</p>
                      <FlowButton
                        inline
                        className="mt-3 min-h-10 py-2"
                        onClick={() => void openPurchase()}
                        disabled={openingPurchase || !selectedOrg}
                      >
                        {openingPurchase ? "Opening…" : `Buy a plan for ${storeName}`}
                      </FlowButton>
                    </FlowNotice>
                  )}

                  {data.canKeepSeparate && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTarget(SEPARATE);
                          setConfirmPrompt(null);
                        }}
                        aria-pressed={selectedTarget === SEPARATE}
                        className={flowOption(selectedTarget === SEPARATE)}
                      >
                        <span className="font-medium">Keep {storeName} as its own account</span>
                        <span className="text-sm text-muted-foreground">
                          A separate Peakhour account for this store, with its own workspace and content. Use it
                          when {storeName} is a different business from the ones you already run. You can switch
                          between accounts any time.
                        </span>
                      </button>
                      <p className="pt-2 text-sm text-muted-foreground">Or add it to an account you already have:</p>
                    </div>
                  )}

                  {data.orgs.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Which Peakhour account is this store for?</p>
                      <ul className="space-y-2">
                        {data.orgs.map((o) => {
                          const selected = o.orgId === selectedOrg;
                          return (
                            <li key={o.orgId}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrg(o.orgId);
                                  setSelectedTarget(NEW_BUSINESS);
                                  setConfirmPrompt(null);
                                  setSeparateNotice(null);
                                  // Another account: its plan is its own.
                                  setLimitNotice(null);
                                }}
                                aria-pressed={selected}
                                className={`${flowOption(selected)} flex-row items-center justify-between`}
                              >
                                <span className="font-medium">{o.name}</span>
                                <span className="text-sm text-muted-foreground">{o.role}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {activeOrg && (
                    <div className="space-y-2">
                      {/* ★THE QUESTION THAT DECIDES IT. A workspace is a brand, and
                          is priced as one; "add to an existing workspace" read as
                          "add another workspace", which is the Table Story report. */}
                      <p className="text-sm text-muted-foreground">
                        Is <span className="font-medium text-foreground">{storeName}</span> a separate brand, or
                        another storefront of a brand you already run in{" "}
                        <span className="font-medium text-foreground">{activeOrg.name}</span>?
                      </p>
                      <ul className="space-y-2">
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTarget(NEW_BUSINESS);
                              setConfirmPrompt(null);
                              setSeparateNotice(null);
                            }}
                            aria-pressed={selectedTarget === NEW_BUSINESS}
                            className={flowOption(selectedTarget === NEW_BUSINESS)}
                          >
                            <span className="font-medium">A separate brand</span>
                            <span className="text-sm text-muted-foreground">
                              {storeName} gets its own workspace, with its own content and plan.
                            </span>
                          </button>
                        </li>
                        {activeOrg.businesses.map((b) => {
                          // ★A DIFFERENT BUSINESS CANNOT BE PICKED (D6 revised,
                          //  D13): the api refuses it whatever the merchant says.
                          const { blocked, note } = businessOption(b);
                          return (
                            <li key={b.businessId}>
                              <button
                                type="button"
                                disabled={blocked}
                                aria-disabled={blocked}
                                onClick={() => {
                                  if (blocked) return;
                                  setSelectedTarget(b.businessId);
                                  setConfirmPrompt(null);
                                  setSeparateNotice(null);
                                }}
                                aria-pressed={selectedTarget === b.businessId}
                                className={flowOption(selectedTarget === b.businessId, blocked)}
                              >
                                <span className="font-medium">Another storefront of {b.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  Added to the {b.name} workspace as a second store of the same business.
                                </span>
                                {note && (
                                  <span className="mt-1 flex items-start gap-1 text-sm text-[var(--daylight-warn-ink)]">
                                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                                    {note}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {confirmPrompt && selectedTarget !== NEW_BUSINESS && selectedTarget !== SEPARATE && (
                <FlowNotice tone="warn" role="alert">
                  <p>{confirmPrompt}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <FlowButton onClick={() => handleClaim(selectedTarget, true)} className="sm:flex-1">
                      It&apos;s the same business, add it
                    </FlowButton>
                    <FlowButton
                      variant="ghost"
                      onClick={() => {
                        const out = data.canKeepSeparate ? SEPARATE : NEW_BUSINESS;
                        setSelectedTarget(out);
                        void handleClaim(out);
                      }}
                      className="sm:flex-1"
                    >
                      {data.canKeepSeparate ? "Keep it as its own account" : "Make it its own workspace"}
                    </FlowButton>
                  </div>
                </FlowNotice>
              )}

              {data.orgs.length > 0 && !(confirmPrompt && selectedTarget !== NEW_BUSINESS && selectedTarget !== SEPARATE) && (
                <FlowButton
                  onClick={() => handleClaim(selectedTarget)}
                  disabled={
                    selectedTarget === SEPARATE
                      ? false
                      : !selectedOrg ||
                        !!activeOrg?.businesses.find((b) => b.businessId === selectedTarget && businessOption(b).blocked)
                  }
                >
                  {selectedTarget === SEPARATE ? "Keep it as its own account" : "Claim this store"}
                </FlowButton>
              )}
            </div>
          )}

          {data && (
            <AddBusinessDialog
              open={buying}
              onOpenChange={setBuying}
              defaultName={storeName}
              description={`${storeName} gets its own workspace, with its own plan. Once it's paid for, you'll come back here to finish linking the store to it.`}
              nextFor={(businessId) => `${claimPath}&into=${encodeURIComponent(businessId)}`}
              onPaymentOpened={(businessId) => {
                if (businessId) rememberBoughtForStore(sessionStore(), businessId, store, Date.now());
              }}
            />
          )}

          {ready && fetchState === "claiming" && (
            <LoadingScreen
              className="min-h-40 p-4"
              message="Setting up your store…"
              steps={[
                "Linking your Shopify store",
                "Bringing your catalog across",
                "Activating Commerce",
              ]}
            />
          )}

          {ready && fetchState === "done" && result && (
            <ClaimDone done={doneCopy(result, result.store?.name || storeName, claimedOrgName || "your account")} />
          )}

          {ready && fetchState === "error" && (() => {
            const ec = errCopy(errCode, errMsg, { canKeepSeparate: data?.canKeepSeparate });
            return (
              <div className="space-y-3">
                <FlowNotice tone="bad" role="alert">
                  <p className="font-bold">{ec.title}</p>
                  <p className="mt-1">{ec.body}</p>
                </FlowNotice>
                <FlowButton asChild variant="ghost">
                  <Link href="/dashboard">Go to dashboard</Link>
                </FlowButton>
              </div>
            );
          })()}
        </div>
      </FlowCard>
    </FlowPage>
  );
}
