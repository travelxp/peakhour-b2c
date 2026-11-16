"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plug } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Input } from "@/components/ui/input";
import { FlowButton, FlowCard, FlowHead, FlowNotice, FlowPage, FlowSpinner } from "@/components/marketing/flow/flow-kit";
import { approveWordpressReconnect } from "@/lib/api/wordpress-reconnect";
import { HOME_ROUTE } from "@/lib/nav-home";

type Phase = "idle" | "approving" | "done" | "error";

function errCopy(code: string, fallback: string): { title: string; body: string } {
  switch (code) {
    case "RECONNECT_CODE_MISMATCH":
      return { title: "That code doesn't match", body: "Check the code shown in your WordPress plugin and try again." };
    case "RECONNECT_EXPIRED":
      return { title: "This request expired", body: "Select Reconnect in WordPress again to get a new code." };
    case "RECONNECT_NONE":
      return { title: "Nothing to reconnect", body: "Select Reconnect in WordPress first, then enter the code here." };
    case "RECONNECT_FORBIDDEN":
      return { title: "No permission", body: "Sign in to the Peakhour account you want to move this site into, then approve the code again." };
    case "RECONNECT_NO_ACCOUNT":
      return { title: "No account", body: "Sign in to a Peakhour account to move this site into it." };
    case "RECONNECT_NO_BUSINESS":
      return { title: "Set up a business first", body: "Create a business in your account, then approve the code again to move this site in." };
    case "RECONNECT_ORG_HAS_SITE":
      return { title: "Already connected", body: "Your account is already connected to this site." };
    case "INTEGRATION_MISMATCH":
    case "INTEGRATION_NEEDS_CONFIRMATION":
      return { title: "Different brand", body: "This site looks like a different brand from your current workspace. Connect it to its own workspace to keep your content on-message." };
    case "RECONNECT_NOT_FOUND":
      return { title: "Site not found", body: "This site is no longer available to reconnect." };
    default:
      return { title: "Something went wrong", body: fallback };
  }
}

export function WordpressReconnect() {
  const params = useSearchParams();
  const site = params.get("site") ?? "";
  const { isAuthenticated, isLoading } = useAuth();

  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errCode, setErrCode] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [host, setHost] = useState("");
  const [adopted, setAdopted] = useState(false);

  async function handleApprove() {
    const trimmed = code.trim();
    if (!trimmed || !site) return;
    setPhase("approving");
    try {
      const r = await approveWordpressReconnect(site, trimmed);
      setHost(r.host || "");
      setAdopted(!!r.adopted);
      setPhase("done");
    } catch (e: unknown) {
      setErrCode((e as { code?: string })?.code ?? "");
      setErrMsg((e as { message?: string })?.message ?? "The site didn't reconnect. Try again.");
      setPhase("error");
    }
  }

  const showLoading = isLoading;
  const showMissing = !isLoading && !site;
  const showSignIn = !isLoading && !!site && !isAuthenticated;
  const ready = !isLoading && !!site && isAuthenticated;

  return (
    <FlowPage>
      <FlowCard>
        <FlowHead icon={Plug} title="Reconnect your WordPress site">
          Enter the code shown in your WordPress plugin to link this site back to your account.
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
                Open Peakhour in your WordPress admin and select Reconnect.
              </p>
            </FlowNotice>
          )}

          {showSignIn && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to your Peakhour account. Then open the Reconnect link from your WordPress
                admin again.
              </p>
              <FlowButton asChild>
                <Link href="/auth">Sign in</Link>
              </FlowButton>
            </div>
          )}

          {ready && (phase === "idle" || phase === "approving" || phase === "error") && (
            <div className="space-y-4">
              {phase === "error" && (() => {
                const ec = errCopy(errCode, errMsg);
                return (
                  <FlowNotice tone="bad" role="alert">
                    <p className="font-bold">{ec.title}</p>
                    <p className="mt-1">{ec.body}</p>
                  </FlowNotice>
                );
              })()}
              <div className="space-y-2">
                <label htmlFor="reconnect-code" className="text-sm font-bold">
                  Pairing code
                </label>
                <Input
                  id="reconnect-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. AB3K77"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={16}
                  className="h-12 rounded-xl bg-card text-base uppercase tracking-widest"
                  disabled={phase === "approving"}
                />
              </div>
              <FlowButton onClick={handleApprove} disabled={!code.trim() || phase === "approving"}>
                {phase === "approving" ? (
                  <span className="flex items-center gap-2">
                    <FlowSpinner className="size-4 border-brand-contrast/40 border-t-brand-contrast" />
                    Reconnecting…
                  </span>
                ) : (
                  "Reconnect this site"
                )}
              </FlowButton>
            </div>
          )}

          {ready && phase === "done" && (
            <div className="space-y-3">
              <FlowNotice tone="ok" role="status">
                <p className="font-bold">{adopted ? "Site moved to your account" : "Site reconnected"}</p>
                <p className="mt-1">
                  {adopted
                    ? `${host || "Your site"} is now connected to this account. You can close this tab — WordPress will pick it up automatically.`
                    : `${host || "Your site"} is linked again. You can close this tab — WordPress will pick it up automatically.`}
                </p>
              </FlowNotice>
              <FlowButton asChild>
                <Link href={HOME_ROUTE}>Go to dashboard</Link>
              </FlowButton>
            </div>
          )}
        </div>
      </FlowCard>
    </FlowPage>
  );
}
