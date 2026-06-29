"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Globe, Loader2 } from "lucide-react";
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
  fetchClaimCandidates,
  claimWordpressSite,
  type ClaimCandidates,
} from "@/lib/api/wordpress-claim";

/** Result of the post-auth flow (fetch candidates → choose → claim). The
 *  pre-auth phases (loading auth / missing link / need sign-in) are DERIVED at
 *  render time from props, so the effect never sets state synchronously. */
type FetchState = "loading" | "choose" | "claiming" | "done" | "error";

function errCopy(code: string, fallback: string): { title: string; body: string } {
  switch (code) {
    case "CLAIM_ALREADY_CLAIMED":
      return { title: "Already connected", body: "This site is already linked to a Peakhour account." };
    case "CLAIM_EXPIRED":
      return { title: "This link has expired", body: "Open Peakhour in your WordPress admin and use the fresh “Claim” link." };
    case "CLAIM_INVALID":
      return { title: "Invalid claim link", body: "Open Peakhour in your WordPress admin and use the “Claim” link there." };
    case "CLAIM_FORBIDDEN_ORG":
      return { title: "No permission", body: "You can only attach a site to an account you own or admin." };
    case "CLAIM_NO_BUSINESS":
      return { title: "Set up a business first", body: "Create a business in that account, then open the claim link again." };
    case "CLAIM_SITE_NOT_FOUND":
      return { title: "Site not found", body: "This site is no longer available to claim." };
    default:
      return { title: "Something went wrong", body: fallback };
  }
}

export function WordpressClaim() {
  const params = useSearchParams();
  const site = params.get("site") ?? "";
  const token = params.get("t") ?? "";
  const { isAuthenticated, isLoading } = useAuth();

  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [data, setData] = useState<ClaimCandidates | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [errCode, setErrCode] = useState<string>("");
  const [errMsg, setErrMsg] = useState<string>("");
  const [claimedName, setClaimedName] = useState<string>("");

  const ready = !isLoading && isAuthenticated && !!site && !!token;

  useEffect(() => {
    // Only the async candidate fetch lives here; all setState is in the
    // resolved/ rejected callbacks (never synchronous in the effect body).
    if (!ready) return;
    let cancelled = false;
    fetchClaimCandidates(site, token)
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
  }, [ready, site, token]);

  async function handleClaim() {
    if (!selectedOrg || !data) return;
    setFetchState("claiming");
    try {
      await claimWordpressSite(site, token, selectedOrg);
      setClaimedName(data.orgs.find((o) => o.orgId === selectedOrg)?.name ?? "your account");
      setFetchState("done");
    } catch (e: unknown) {
      setErrCode((e as { code?: string })?.code ?? "");
      setErrMsg((e as { message?: string })?.message ?? "Couldn't connect the site.");
      setFetchState("error");
    }
  }

  // Derived phase: pre-auth states from props, then the async fetchState.
  const showLoading = isLoading || (ready && fetchState === "loading");
  const showMissing = !isLoading && (!site || !token);
  const showSignIn = !isLoading && !!site && !!token && !isAuthenticated;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-5 text-primary" aria-hidden />
            Connect your WordPress site
          </CardTitle>
          {ready && fetchState === "choose" && data?.site?.host && (
            <CardDescription>{data.site.host}</CardDescription>
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
                This link is missing information. Open Peakhour in your WordPress admin and use the
                “Claim” link there.
              </p>
            </div>
          )}

          {showSignIn && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to your Peakhour account to connect this WordPress site. After signing in,
                reopen the “Claim” link from your WordPress admin.
              </p>
              <Button asChild>
                <Link href="/auth">Sign in</Link>
              </Button>
            </div>
          )}

          {ready && fetchState === "choose" && data && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose which Peakhour account to attach this site to.
              </p>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div>
                  Signed in as{" "}
                  <span className="font-medium text-foreground">{data.signedInEmail ?? "your account"}</span>
                </div>
                {data.site.adminEmail && (
                  <div>
                    WordPress admin:{" "}
                    <span className="font-medium text-foreground">{data.site.adminEmail}</span>
                  </div>
                )}
              </div>

              {data.orgs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No account found on your sign-in. Create one in Peakhour, then reopen this link.
                </p>
              ) : data.orgs.length === 1 ? (
                <p className="text-sm">
                  Connect to <span className="font-medium">{data.orgs[0]!.name}</span>.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.orgs.map((o) => {
                    const selected = o.orgId === selectedOrg;
                    return (
                      <li key={o.orgId}>
                        <button
                          type="button"
                          onClick={() => setSelectedOrg(o.orgId)}
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

              <Button
                onClick={handleClaim}
                disabled={!selectedOrg || data.orgs.length === 0}
                className="w-full"
              >
                Connect this site
              </Button>
            </div>
          )}

          {ready && fetchState === "claiming" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Connecting…
            </div>
          )}

          {ready && fetchState === "done" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" aria-hidden />
                Connected!
              </div>
              <p className="text-sm text-muted-foreground">
                {data?.site?.host ?? "Your site"} is now linked to{" "}
                <span className="font-medium text-foreground">{claimedName}</span>.
              </p>
              <Button asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          )}

          {ready && fetchState === "error" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="size-5" aria-hidden />
                {errCopy(errCode, errMsg).title}
              </div>
              <p className="text-sm text-muted-foreground">{errCopy(errCode, errMsg).body}</p>
              <Button asChild variant="outline">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
