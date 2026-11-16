"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Globe } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { FlowButton, FlowCard, FlowHead, FlowNotice, FlowPage, FlowSpinner, flowFacts, flowOption } from "@/components/marketing/flow/flow-kit";
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
      return { title: "This link has expired", body: "Open Peakhour in your WordPress admin and select the new “Claim” link." };
    case "CLAIM_INVALID":
      return { title: "This link is incomplete", body: "Open Peakhour in your WordPress admin and select “Claim”." };
    case "CLAIM_FORBIDDEN_ORG":
      return { title: "No permission", body: "You can only connect a site to an account you own or admin." };
    case "CLAIM_NO_BUSINESS":
      return { title: "Set up a business first", body: "Add a business to that account, then open the claim link again." };
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
      setErrMsg((e as { message?: string })?.message ?? "The site didn't connect. Try again.");
      setFetchState("error");
    }
  }

  // Derived phase: pre-auth states from props, then the async fetchState.
  const showLoading = isLoading || (ready && fetchState === "loading");
  const showMissing = !isLoading && (!site || !token);
  const showSignIn = !isLoading && !!site && !!token && !isAuthenticated;

  return (
    <FlowPage>
      <FlowCard>
        <FlowHead icon={Globe} title="Connect your WordPress site">
          {ready && fetchState === "choose" && data?.site?.host ? data.site.host : null}
        </FlowHead>
        <div className="mt-5 space-y-4">
          {showLoading && (
            <div role="status" className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <FlowSpinner />
              Loading…
            </div>
          )}

          {showMissing && (
            <FlowNotice tone="bad" role="alert">
              <p className="font-bold">This link is incomplete</p>
              <p className="mt-1">
                Open Peakhour in your WordPress admin and select “Claim”.
              </p>
            </FlowNotice>
          )}

          {showSignIn && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to connect this WordPress site to your Peakhour account. Then open the
                “Claim” link from your WordPress admin again.
              </p>
              <FlowButton asChild>
                <Link href="/auth">Sign in</Link>
              </FlowButton>
            </div>
          )}

          {ready && fetchState === "choose" && data && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pick the Peakhour account for this site.
              </p>
              <div className={flowFacts}>
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
                  No account found. Create one in Peakhour, then open this link again.
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
              )}

              <FlowButton onClick={handleClaim} disabled={!selectedOrg || data.orgs.length === 0}>
                Connect this site
              </FlowButton>
            </div>
          )}

          {ready && fetchState === "claiming" && (
            <div role="status" className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <FlowSpinner />
              Connecting…
            </div>
          )}

          {ready && fetchState === "done" && (
            <div className="space-y-3">
              <FlowNotice tone="ok" role="status">
                <p className="font-bold">Site connected</p>
                <p className="mt-1">
                  {data?.site?.host ?? "Your site"} is now linked to <span className="font-bold">{claimedName}</span>.
                </p>
              </FlowNotice>
              <FlowButton asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </FlowButton>
            </div>
          )}

          {ready && fetchState === "error" && (() => {
            const ec = errCopy(errCode, errMsg);
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
