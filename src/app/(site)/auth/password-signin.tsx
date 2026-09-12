"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword } from "@/lib/auth";
import { ApiError } from "@/lib/api";

/**
 * Password sign-in for platform reviewers — LinkedIn, Meta, Google, TikTok,
 * Shopify.
 *
 * Peakhour signs everybody in by magic link. A certification reviewer cannot
 * receive email at our domain, and every one of those platforms asks instead for
 * a username and password a stranger can use in an incognito window.
 *
 * ── ★★THIS IS NOT A SECURITY BOUNDARY, AND MUST NOT BE MISTAKEN FOR ONE
 *
 * `POST /v1/auth/test-login` refuses unless the deployment is non-production AND
 * `TEST_LOGIN_ENABLED=true`. The build-time flag below decides only whether the
 * markup ships, so a production bundle carries no form at all — but if one ever
 * did, the server would still 403. Anyone reasoning about who can use this
 * should read `helpers/test-credentials.ts`, not this file.
 *
 * ── ★COLLAPSED BY DEFAULT
 *
 * Every real visitor on this page wants the magic link. The panel is a details
 * disclosure rather than a second form competing for attention — a reviewer is
 * told where to click by the handoff block the CMS generates, and nobody else
 * needs to see it at all.
 */
export function PasswordSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await signInWithPassword(email.trim(), password);
      // ★A FULL NAVIGATION, not a client-side push. The grant sets httpOnly
      //  session cookies, and the app's auth provider reads them at load; a
      //  soft navigation would land on the dashboard with the pre-sign-in
      //  React tree still holding "signed out" and bounce straight back here.
      window.location.assign(res.redirectTo || "/dashboard/overview");
    } catch (err) {
      // ★The API answers every failure identically on purpose — unknown email,
      //  wrong password, expired, revoked and locked are one 401 — so there is
      //  nothing to add here and nothing to guess at. Show what it said.
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not sign in. Check the credentials and try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <details className="mt-6 rounded-lg border border-border/60 bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground sm:text-sm">
        <KeyRound className="size-3.5 shrink-0" aria-hidden />
        Sign in with password
        <span className="ml-auto text-[11px] font-normal opacity-70">reviewers only</span>
      </summary>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-border/60 p-3">
        <p className="text-xs text-muted-foreground">
          For platform review accounts. Everyone else should use the magic link above.
        </p>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive-on-tint"
          >
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="reviewer-email" className="text-xs font-bold">
            Email
          </Label>
          <Input
            id="reviewer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reviewer-password" className="text-xs font-bold">
            Password
          </Label>
          <Input
            id="reviewer-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-10"
          />
        </div>

        <button
          type="submit"
          // aria-disabled rather than `disabled`, matching the magic-link button
          // above: a real `disabled` is blurred by the browser, throwing focus to
          // <body> for the whole round trip. The `submitting` guard in onSubmit
          // already refuses a double submit synchronously.
          aria-disabled={submitting}
          className="h-10 rounded-md border border-border bg-background text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </details>
  );
}
