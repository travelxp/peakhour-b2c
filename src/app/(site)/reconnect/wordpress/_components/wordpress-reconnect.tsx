"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Plug, Loader2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { approveWordpressReconnect } from "@/lib/api/wordpress-reconnect";

type Phase = "idle" | "approving" | "done" | "error";

function errCopy(code: string, fallback: string): { title: string; body: string } {
  switch (code) {
    case "RECONNECT_CODE_MISMATCH":
      return { title: "That code doesn't match", body: "Check the code shown in your WordPress plugin and try again." };
    case "RECONNECT_EXPIRED":
      return { title: "This request expired", body: "Open WordPress and click Reconnect again for a fresh code." };
    case "RECONNECT_NONE":
      return { title: "Nothing to reconnect", body: "Open WordPress and click Reconnect first, then enter the code here." };
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
      setErrMsg((e as { message?: string })?.message ?? "Couldn't reconnect the site.");
      setPhase("error");
    }
  }

  const showLoading = isLoading;
  const showMissing = !isLoading && !site;
  const showSignIn = !isLoading && !!site && !isAuthenticated;
  const ready = !isLoading && !!site && isAuthenticated;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="size-5 text-primary" aria-hidden />
            Reconnect your WordPress site
          </CardTitle>
          <CardDescription>
            Enter the code shown in your WordPress plugin to link this site back to your account.
          </CardDescription>
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
                Invalid reconnect link
              </div>
              <p className="text-sm text-muted-foreground">
                This link is missing information. Open Peakhour in your WordPress admin and click
                Reconnect there.
              </p>
            </div>
          )}

          {showSignIn && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to your Peakhour account, then reopen the Reconnect link from your WordPress
                admin.
              </p>
              <Button asChild>
                <Link href="/auth">Sign in</Link>
              </Button>
            </div>
          )}

          {ready && (phase === "idle" || phase === "approving" || phase === "error") && (
            <div className="space-y-4">
              {phase === "error" && (() => {
                const ec = errCopy(errCode, errMsg);
                return (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertCircle className="size-4" aria-hidden />
                      {ec.title}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{ec.body}</p>
                  </div>
                );
              })()}
              <div className="space-y-2">
                <label htmlFor="reconnect-code" className="text-sm font-medium">
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
                  className="uppercase tracking-widest"
                  disabled={phase === "approving"}
                />
              </div>
              <Button
                onClick={handleApprove}
                disabled={!code.trim() || phase === "approving"}
                className="w-full"
              >
                {phase === "approving" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Reconnecting…
                  </span>
                ) : (
                  "Reconnect this site"
                )}
              </Button>
            </div>
          )}

          {ready && phase === "done" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" aria-hidden />
                {adopted ? "Moved to your account!" : "Reconnected!"}
              </div>
              <p className="text-sm text-muted-foreground">
                {adopted
                  ? `${host || "Your site"} is now connected to this account. You can close this tab — WordPress will pick it up automatically.`
                  : `${host || "Your site"} is linked again. You can close this tab — WordPress will pick it up automatically.`}
              </p>
              <Button asChild>
                <Link href="/dashboard/overview">Go to dashboard</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
