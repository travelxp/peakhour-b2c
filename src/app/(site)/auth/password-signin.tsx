"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword, isPasswordSignInAvailable } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { landingRoute } from "@/lib/nav-home";

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
 * `POST /v1/auth/test-login` refuses on production, and the environment decides
 * that — there is no opt-in flag on either side. The check below decides only
 * whether the markup renders; if it were ever wrong, the server would still
 * 403. Anyone reasoning about who can use this should read
 * `helpers/test-credentials.ts`, not this file.
 *
 * ── ★★IT ASKS THE API RATHER THAN MIRRORING THE ANSWER
 *
 * A build-time `NEXT_PUBLIC_TEST_LOGIN` used to gate this. It was a second
 * switch that had to stay in step with the API's, and when it drifted the
 * failure was silent: a correctly-deployed dev stack with no form on the page
 * and nothing anywhere saying why. `APP_ENV` is server-only, so asking is the
 * only way this app can know.
 *
 * ★Renders nothing until the answer arrives, and nothing if it cannot be
 * reached. A form that will not work is worse than no form.
 *
 * ── ★COLLAPSED BY DEFAULT
 *
 * Every real visitor on this page wants the magic link. The panel is a details
 * disclosure rather than a second form competing for attention — a reviewer is
 * told where to click by the handoff block the CMS generates, and nobody else
 * needs to see it at all.
 */
export function PasswordSignIn({ next }: { next?: string | null }) {
  const [email, setEmail] = useState("");
  // (state declared before the flag guard so the hook order is unconditional)
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /**
   * ★★A REF, BECAUSE THE COMMENT ON THE BUTTON CLAIMS A SYNCHRONOUS REFUSAL.
   *
   * `submitting` is state: React batches the update, so two submits in the same
   * tick — a double Enter, a click landing on an already-submitting form — both
   * read `false` and both fire. Each one the API counts against the ten-attempt
   * lockout. The sibling magic-link flow uses `inFlightRef` for exactly this;
   * the state stays too, because it is what the button renders.
   */
  const inFlightRef = useRef(false);
  /** null = not yet answered. See the docblock: absent is not "no". */
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isPasswordSignInAvailable().then((v) => {
      if (!cancelled) setAvailable(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await signInWithPassword(email.trim(), password);
      // ★A FULL NAVIGATION, not a client-side push. The grant sets httpOnly
      //  session cookies, and the app's auth provider reads them at load; a
      //  soft navigation would land on the dashboard with the pre-sign-in
      //  React tree still holding "signed out" and bounce straight back here.
      // ★★NORMALISED THROUGH `landingRoute`. The API hardcodes
      //  /dashboard/overview as "the app's home" and cannot know about
      //  NEXT_PUBLIC_OUTCOMES_HOME, which is build-inlined into THIS bundle — so
      //  with that flag on, this would have been the only sign-in entry point
      //  landing on the very screen the flag demotes. `nav-home.ts` records the
      //  same bug being fixed once already, for verify-magic and the WordPress
      //  bridge.
      // ★★A DEEP LINK WINS OVER THE HOME ROUTE. AuthFlow already parses and
      //  same-origin-validates `?next=` (and the Shopify fragment form), and
      //  auth/verify honours it — a visitor sent to /auth?next=/claim/shopify
      //  with a ONE-SHOT claim token who used this panel landed on the dashboard
      //  instead, never spending the token, leaving the store unclaimed and the
      //  token unusable.
      //
      // ★`replace`, not `assign`. Assign pushes a history entry, so Back
      //  returned to /auth with a live session and a bfcache-restored password
      //  field. The magic-link path replaces for the same reason, and replace
      //  keeps the full-reload property the comment above argues for.
      window.location.replace(next || landingRoute(res.redirectTo || "/dashboard/overview"));
    } catch (err) {
      // ★The API answers every failure identically on purpose — unknown email,
      //  wrong password, expired, revoked and locked are one 401 — so there is
      //  nothing to add here and nothing to guess at. Show what it said.
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not sign in. Check the credentials and try again.",
      );
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  // ★★THE GUARD LIVES HERE, not at the call site, so the docblock above is true
  //  of the COMPONENT. A second mount, or a dropped `&&` in a parent, cannot
  //  ship the panel somewhere it does not belong. Placed after the hooks so the
  //  hook order stays unconditional.
  //
  //  ★`!== true` rather than `=== false`: "not yet answered" renders nothing,
  //  the same as "no". A disclosure that pops into existence a moment after the
  //  page settles is worse than one that was never there.
  if (available !== true) return null;

  return (
    <details className="mt-6 rounded-lg border border-border/60 bg-muted/20">
      {/* ★`[&::-webkit-details-marker]:hidden` alongside `list-none`: Safari
          draws its own marker and ignores list-style, as
          feature-comparison.tsx notes one component over. */}
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground sm:text-sm marker:content-none [&::-webkit-details-marker]:hidden">
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
          // already refuses a double submit synchronously (via inFlightRef).
          aria-disabled={submitting}
          // ★`aria-disabled:` and not `disabled:` — the element is never natively
          //  disabled, so the `disabled:` variant matched nothing and the busy
          //  state was invisible. GOLD_BUTTON in auth-flow.tsx does the same.
          className="h-10 rounded-md border border-border bg-background text-sm font-semibold transition-colors hover:bg-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </details>
  );
}
