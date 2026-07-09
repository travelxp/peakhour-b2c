"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertCircle, ShoppingBag, Loader2 } from "lucide-react";
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
  type ShopifyClaimCandidates,
} from "@/lib/api/shopify-claim";

/** Sentinel for "move the store in as a NEW Business" (vs an existing businessId). */
const NEW_BUSINESS = "__new__";

/** Result of the post-auth flow (fetch candidates → choose → claim). The
 *  pre-auth phases (loading auth / missing link / need sign-in) are DERIVED at
 *  render time from props, so the effect never sets state synchronously. */
type FetchState = "loading" | "choose" | "claiming" | "done" | "error";

function errCopy(code: string, fallback: string): { title: string; body: string } {
  switch (code) {
    case "CLAIM_ALREADY_CLAIMED":
      return { title: "Already claimed", body: "This store is already linked to a Peakhour account." };
    case "CLAIM_EXPIRED":
      return { title: "This link has expired", body: "Open the Peakhour app in your Shopify admin and use the fresh “Claim this store” button." };
    case "CLAIM_INVALID":
      return { title: "Invalid claim link", body: "Open the Peakhour app in your Shopify admin and use the “Claim this store” button there." };
    case "CLAIM_FORBIDDEN_ORG":
      return { title: "No permission", body: "You can only attach a store to an account you own or admin." };
    case "CLAIM_BUSINESS_LIMIT":
      return { title: "Business limit reached", body: "Your plan's Business limit is reached. Upgrade, or attach the store to one of your existing brands instead." };
    case "CLAIM_ORG_HAS_STORE":
      return { title: "Already connected", body: "That account is already connected to this store." };
    case "CLAIM_BUSINESS_NOT_FOUND":
      return { title: "Business not found", body: "That business isn't in the selected account. Pick another." };
    case "CLAIM_STORE_NOT_FOUND":
      return { title: "Store not found", body: "This store is no longer available to claim." };
    default:
      return { title: "Something went wrong", body: fallback };
  }
}

export function ShopifyClaim() {
  const params = useSearchParams();
  const store = params.get("store") ?? "";
  const token = params.get("t") ?? "";
  const { isAuthenticated, isLoading, switchOrg, switchBusiness } = useAuth();

  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [data, setData] = useState<ShopifyClaimCandidates | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  // A businessId (attach to existing brand) or NEW_BUSINESS (move in as new).
  const [selectedTarget, setSelectedTarget] = useState<string>(NEW_BUSINESS);
  const [errCode, setErrCode] = useState<string>("");
  const [errMsg, setErrMsg] = useState<string>("");
  const [claimedName, setClaimedName] = useState<string>("");

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

  async function handleClaim() {
    if (!selectedOrg || !data) return;
    setFetchState("claiming");
    try {
      const businessId = selectedTarget === NEW_BUSINESS ? undefined : selectedTarget;
      const res = await claimShopifyStore(store, token, selectedOrg, businessId);
      setClaimedName(activeOrg?.name ?? "your account");
      // Land the merchant on the freshly-claimed store: switch into the target
      // org + business so the dashboard is already scoped to it. Best-effort —
      // the claim already committed, so never surface a switch failure as an error.
      try {
        await switchOrg(res.orgId);
        if (res.businessId) await switchBusiness(res.businessId);
      } catch {
        /* the store is claimed regardless; the switchers will pick it up */
      }
      setFetchState("done");
    } catch (e: unknown) {
      setErrCode((e as { code?: string })?.code ?? "");
      setErrMsg((e as { message?: string })?.message ?? "Couldn't connect the store.");
      setFetchState("error");
    }
  }

  // Derived phase: pre-auth states from props, then the async fetchState.
  const showLoading = isLoading || (ready && fetchState === "loading");
  const showMissing = !isLoading && (!store || !token);
  const showSignIn = !isLoading && !!store && !!token && !isAuthenticated;

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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading…
            </div>
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
                Sign in to your Peakhour account to claim this store. After signing in, reopen the
                “Claim this store” button from the Peakhour app in your Shopify admin.
              </p>
              <Button asChild>
                <Link href="/auth">Sign in</Link>
              </Button>
            </div>
          )}

          {ready && fetchState === "choose" && data && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose which Peakhour account to add this store to.
              </p>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div>
                  Signed in as{" "}
                  <span className="font-medium text-foreground">{data.signedInEmail ?? "your account"}</span>
                </div>
                <div>
                  Store:{" "}
                  <span className="font-medium text-foreground">{data.store.name || data.store.shopDomain}</span>
                </div>
              </div>

              {data.orgs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No account found on your sign-in. Create one in Peakhour, then reopen this link.
                </p>
              ) : (
                <>
                  {data.orgs.length > 1 && (
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
                  )}

                  {activeOrg && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Add <span className="font-medium text-foreground">{data.store.name || "this store"}</span> to{" "}
                        <span className="font-medium text-foreground">{activeOrg.name}</span> as:
                      </p>
                      <ul className="space-y-2">
                        <li>
                          <button
                            type="button"
                            onClick={() => setSelectedTarget(NEW_BUSINESS)}
                            className={`flex w-full flex-col items-start rounded-md border p-3 text-left text-sm hover:bg-muted/40 ${
                              selectedTarget === NEW_BUSINESS ? "border-primary ring-1 ring-primary" : ""
                            }`}
                          >
                            <span className="font-medium">A new business</span>
                            <span className="text-xs text-muted-foreground">
                              Keep this store as its own workspace (recommended for a separate brand).
                            </span>
                          </button>
                        </li>
                        {activeOrg.businesses.map((b) => (
                          <li key={b.businessId}>
                            <button
                              type="button"
                              onClick={() => setSelectedTarget(b.businessId)}
                              className={`flex w-full flex-col items-start rounded-md border p-3 text-left text-sm hover:bg-muted/40 ${
                                selectedTarget === b.businessId ? "border-primary ring-1 ring-primary" : ""
                              }`}
                            >
                              <span className="font-medium">{b.name}</span>
                              <span className="text-xs text-muted-foreground">
                                Add Shopify as a channel on this existing brand.
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <Button
                onClick={handleClaim}
                disabled={!selectedOrg || data.orgs.length === 0}
                className="w-full"
              >
                Claim this store
              </Button>
            </div>
          )}

          {ready && fetchState === "claiming" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Claiming…
            </div>
          )}

          {ready && fetchState === "done" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" aria-hidden />
                Claimed!
              </div>
              <p className="text-sm text-muted-foreground">
                {data?.store?.name || "Your store"} is now part of{" "}
                <span className="font-medium text-foreground">{claimedName}</span>. You can manage it
                and connect channels like WhatsApp from your dashboard.
              </p>
              <Button asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          )}

          {ready && fetchState === "error" && (() => {
            const ec = errCopy(errCode, errMsg);
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
