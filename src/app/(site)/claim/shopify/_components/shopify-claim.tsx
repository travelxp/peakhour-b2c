"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertCircle, AlertTriangle, ShoppingBag } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fetchShopifyClaimCandidates,
  claimShopifyStore,
  type ClaimResult,
  type ShopifyClaimCandidates,
} from "@/lib/api/shopify-claim";
import { LoadingScreen } from "@/components/molecules/loading-screen";
import { BRAND_CONFIRM, KEEP_SEPARATE_CODES, businessOption, claimOutcome, doneCopy, errCopy } from "./claim-copy";

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
  const { isAuthenticated, isLoading, switchOrg, switchBusiness } = useAuth();

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
        // ★KEEPING IT SEPARATE IS THE DEFAULT WHEN IT IS ON OFFER. Joining an
        //  existing business is the choice that needs a reason; a store left in
        //  the wrong business is the Table Story report.
        if (d.canKeepSeparate) setSelectedTarget(SEPARATE);
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
  }, [ready, store, token]);

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
      const res = await claimShopifyStore(store, token, { orgId: selectedOrg, businessId, confirmed });
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
        setConfirmPrompt(message || "This store may be a different brand from that workspace.");
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

  const optionClass = (selected: boolean) =>
    `flex w-full flex-col items-start rounded-md border p-3 text-left text-sm hover:bg-muted/40 ${
      selected ? "border-primary ring-1 ring-primary" : ""
    }`;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" aria-hidden />
            Claim your Shopify store
          </CardTitle>
          {ready && fetchState === "choose" && data?.store?.shopDomain && (
            <CardDescription>{data.store.shopDomain}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {showLoading && (
            <LoadingScreen message="Loading your store…" />
          )}

          {showMissing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="size-5" aria-hidden />
                Invalid claim link
              </div>
              <p className="text-sm text-muted-foreground">
                This link is missing information. Open the Peakhour app in your Shopify admin and use
                the “Claim this store” button there.
              </p>
            </div>
          )}

          {showSignIn && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to finish linking <span className="font-medium text-foreground">this store</span> to
                your Peakhour account. We&apos;ll bring you right back here — no need to return to Shopify.
              </p>
              <Button asChild>
                <Link href={signInHref}>Sign in to continue</Link>
              </Button>
            </div>
          )}

          {ready && fetchState === "choose" && data && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
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
                    Set up your Peakhour account from{" "}
                    <span className="font-medium text-foreground">{storeName}</span>.
                    Your catalog and Commerce plan are already in place — nothing to configure.
                  </p>
                  <Button onClick={handleAdopt} className="w-full">
                    Create my account with this store
                  </Button>
                </div>
              ) : (
                <>
                  {separateNotice && (
                    <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm" role="alert">
                      {separateNotice}
                    </div>
                  )}

                  {data.canKeepSeparate && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTarget(SEPARATE);
                          setConfirmPrompt(null);
                        }}
                        className={optionClass(selectedTarget === SEPARATE)}
                      >
                        <span className="font-medium">Keep {storeName} as its own account</span>
                        <span className="text-xs text-muted-foreground">
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
                                }}
                                className={`flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted/40 ${
                                  selected ? "border-primary ring-1 ring-primary" : ""
                                }`}
                              >
                                <span className="font-medium">{o.name}</span>
                                <span className="text-xs text-muted-foreground">{o.role}</span>
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
                            className={optionClass(selectedTarget === NEW_BUSINESS)}
                          >
                            <span className="font-medium">A separate brand</span>
                            <span className="text-xs text-muted-foreground">
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
                                className={`${optionClass(selectedTarget === b.businessId)} ${
                                  blocked ? "cursor-not-allowed opacity-60 hover:bg-transparent" : ""
                                }`}
                              >
                                <span className="font-medium">Another storefront of {b.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  Added to the {b.name} workspace as a second store of the same business.
                                </span>
                                {note && (
                                  <span className="mt-1 flex items-start gap-1 text-xs text-warning-on-tint">
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
                <div className="space-y-3 rounded-md border border-warning/30 bg-warning/10 p-3" role="alert">
                  <p className="text-sm">{confirmPrompt}</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={() => handleClaim(selectedTarget, true)} className="sm:flex-1">
                      It&apos;s the same business, add it
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const out = data.canKeepSeparate ? SEPARATE : NEW_BUSINESS;
                        setSelectedTarget(out);
                        void handleClaim(out);
                      }}
                      className="sm:flex-1"
                    >
                      {data.canKeepSeparate ? "Keep it as its own account" : "Make it its own workspace"}
                    </Button>
                  </div>
                </div>
              )}

              {data.orgs.length > 0 && !(confirmPrompt && selectedTarget !== NEW_BUSINESS && selectedTarget !== SEPARATE) && (
                <Button
                  onClick={() => handleClaim(selectedTarget)}
                  disabled={
                    selectedTarget === SEPARATE
                      ? false
                      : !selectedOrg ||
                        !!activeOrg?.businesses.find((b) => b.businessId === selectedTarget && businessOption(b).blocked)
                  }
                  className="w-full"
                >
                  {selectedTarget === SEPARATE ? "Keep it as its own account" : "Claim this store"}
                </Button>
              )}
            </div>
          )}

          {ready && fetchState === "claiming" && (
            <LoadingScreen
              message="Setting up your store…"
              steps={[
                "Linking your Shopify store",
                "Bringing your catalog across",
                "Activating Commerce",
              ]}
            />
          )}

          {ready && fetchState === "done" && result && (() => {
            const done = doneCopy(result, result.store?.name || storeName, claimedOrgName || "your account");
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-success-on-tint">
                  <CheckCircle2 className="size-5" aria-hidden />
                  {done.title}
                </div>
                <p className="text-sm text-muted-foreground">{done.body}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild>
                    <Link href="/dashboard">Go to dashboard</Link>
                  </Button>
                  {done.integrationsHint && (
                    <Button asChild variant="outline">
                      <Link href="/dashboard/integrations">See it in Integrations</Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}

          {ready && fetchState === "error" && (() => {
            const ec = errCopy(errCode, errMsg, { canKeepSeparate: data?.canKeepSeparate });
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="size-5" aria-hidden />
                  {ec.title}
                </div>
                <p className="text-sm text-muted-foreground">{ec.body}</p>
                <Button asChild variant="outline">
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
