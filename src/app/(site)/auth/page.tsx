"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Mail, ShieldAlert, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { SITE } from "@/lib/utils";
import { PeaksGlyph } from "@/components/peaks/peaks-glyph";
import {
  PILLAR_CONSOLE_ROWS,
  PILLAR_CONSOLE_LABEL,
  FREE_PEAKS_PER_MONTH,
} from "@/lib/pillar-console";

// Bounded length + char set so a tampered link can't smuggle arbitrary strings
// into the waitlist payload. Mirrors the referredByCode validator on
// /v1/waitlist/signup (min 4, max 32); the mint alphabet is a stricter subset.
const REFERRAL_CODE_PATTERN = /^[0-9A-Z]{4,32}$/;

/**
 * Mirrors peakhour-cms/src/app/login/login-form.tsx so the b2c
 * customer flow has the same "Resend link" affordance the CMS
 * operator flow does. Modelling every outcome as its own variant keeps
 * the button labels and disabled-state logic readable; without
 * `resending` and `error` as first-class states the JSX has to hunt
 * across booleans.
 */
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | {
      kind: "sent";
      email: string;
      cooldownEndsAt: number;
      // Optional inline error surfaced on the cooldown card when a
      // *resend* fails. Initial-send failures land in the top-level
      // `error` state and bounce the user back to the form — only
      // resends keep them on the card with the previously confirmed
      // email + countdown intact.
      resendError?: string;
    }
  | { kind: "resending"; email: string; cooldownEndsAt: number }
  // Pre-launch invite-only outcomes (no link sent). `waitlisted` = applied
  // but not yet approved; `notEligible` = not on the launch list at all.
  | { kind: "waitlisted"; email: string }
  | { kind: "notEligible"; email: string }
  | { kind: "error"; message: string };

// peakhour-api enforces a hard 60s rate limit between magic-link
// requests for the same user (routes/auth/magic-link.ts). Mirror that
// here so the button enables exactly when the server will accept the
// next request — picking a shorter window only buys an avoidable 429
// + confused user. If the server window changes, update this in
// tandem; treat the API as the source of truth.
const RESEND_COOLDOWN_SECONDS = 60;

// Signup-side proof points. These replaced an ads-era set ("3 ad platforms",
// "12 dimensions of content intelligence") that no longer described the
// product. Every figure here is one the marketing surface already states.
const SIGNUP_STATS = [
  { value: "5", label: "pillars, one login" },
  { value: "0", label: "credit cards required" },
  { value: FREE_PEAKS_PER_MONTH, label: "free Peaks every month" },
] as const;

// Reassurance row under the primary button — the same promises the landing
// hero makes, so the pitch doesn't change at the point of signup.
const TICKS = ["No credit card", "Free plan on every pillar", "Live the same day"] as const;

// Pre-launch (?intent=waitlist|invite) there is no same-day access to promise,
// so the third tick would contradict the heading right above it. Swap it for
// the one thing that is still true on this path.
const PRELAUNCH_TICKS = [
  "No credit card",
  "Free plan on every pillar",
  "We'll email your link",
] as const;

// Landing CTAs route here with ?intent=waitlist|invite when the platform is
// pre-launch (driven by cfg_platform_stage.signupMode), so the heading matches
// the button the visitor clicked. The magic-link flow itself is unchanged —
// only the framing differs.
const INTENT_COPY: Record<string, { eyebrow: string; title: string; subtitle: string }> = {
  waitlist: {
    eyebrow: "Join the waitlist",
    title: "Get your spot in the queue.",
    subtitle:
      "Enter your email and we’ll send your access link as we roll out. No password, no card.",
  },
  invite: {
    eyebrow: "Request an invite",
    title: "Ask for an invite.",
    subtitle:
      "Enter your email and we’ll be in touch with your access link. No password, no card.",
  },
};

// Space Grotesk is the numeric face across the marketing surface (Peaks
// balances, prices). Applied inline via the CSS variable, matching how
// /pricing and /peaks already reach for it — there's no Tailwind utility
// mapped to --font-space-grotesk in globals.css.
const NUMERIC_FONT = { fontFamily: "var(--font-space-grotesk)" } as const;

/**
 * Gold-gradient primary button, matching the header/landing CTA treatment.
 *
 * `ring-offset-background` is load-bearing: the Tailwind default offset colour
 * is white, which paints a halo around every focused button in dark mode.
 */
const GOLD_BUTTON =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60";

/** Underlined inline link, used in the legal/help microcopy. */
const LEGAL_LINK =
  "underline underline-offset-2 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

/** Quiet secondary button — outlined, gains a foreground border on hover. */
const GHOST_BUTTON =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 text-sm font-bold transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Eyebrow label — uppercase, gold, with the short gradient rule.
 *
 * `--brand-label` is the one theme-AWARE brand token: deep amber on light
 * grounds, bright gold on dark. That makes it right for the theme-following
 * form column and wrong for the always-dark panel, where a light-theme
 * visitor would get deep amber on near-black (~2.5:1). The panel passes
 * `text-brand` instead, which is theme-stable and ~8:1 on zinc-900.
 */
function Eyebrow({
  children,
  className = "text-brand-label",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] ${className}`}
    >
      <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
      {children}
    </span>
  );
}

/**
 * Gold icon tile used on the outcome cards — the same 11×11 rounded-xl
 * gradient tile the landing page gives each pillar, so these cards read as
 * part of the product rather than generic shadcn alerts.
 */
function GoldTile({ icon: Icon }: { icon: typeof Mail }) {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-inner">
      <Icon className="size-5 text-brand-contrast" strokeWidth={2} aria-hidden />
    </div>
  );
}

/** The email an outcome card refers to, set in the numeric face. */
function EmailChip({ email }: { email: string }) {
  return (
    <p
      className="break-all rounded-lg bg-muted px-3 py-2 text-sm font-semibold"
      style={NUMERIC_FONT}
    >
      {email}
    </p>
  );
}

function AuthPageInner() {
  const searchParams = useSearchParams();
  const intentCopy = INTENT_COPY[searchParams.get("intent") ?? ""];
  // Inviter code from a `?ref=` share link, sanitised — any non-conforming
  // value is dropped so the page behaves as a plain sign-in. null = no inviter.
  const referralCode = (() => {
    const raw = searchParams.get("ref");
    if (!raw) return null;
    const upper = raw.toUpperCase();
    return REFERRAL_CODE_PATTERN.test(upper) ? upper : null;
  })();
  // `?next=` — where to return after verify (server sanitizes it to same-origin).
  // Only same-origin relative paths are forwarded.
  const next = (() => {
    const raw = searchParams.get("next");
    // Same-origin relative only: single leading slash, no protocol-relative
    // form (// or /\ — browsers normalize backslash to slash). The server and
    // the verify page re-validate; this just avoids forwarding a doomed value.
    return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")
      ? raw
      : null;
  })();
  // When `next` is the store-claim page, lift the store+token so the magic-link
  // request can admit a brand-new merchant email through the pre-launch gate
  // (the server re-validates the token). Parsed with a fixed base — no `window`,
  // so it's SSR-safe.
  const shopifyClaim = (() => {
    if (!next) return undefined;
    try {
      const u = new URL(next, "http://internal");
      if (u.pathname !== "/claim/shopify") return undefined;
      const store = u.searchParams.get("store");
      const token = u.searchParams.get("t");
      return store && token ? { store, token } : undefined;
    } catch {
      return undefined;
    }
  })();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Tick once per second while a cooldown is running so the button
  // label re-renders. A single shared timestamp + Math.ceil derives
  // the displayed countdown without per-second state updates competing
  // with the status transitions. The effect's cleanup is keyed on
  // isCoolingDown so the interval stops once status leaves the
  // cooldown states (sent / resending) or the component unmounts.
  const [now, setNow] = useState<number>(() => Date.now());
  // Guards against fast double-submits — Enter-key mashing or
  // duplicate click events during the click → render gap can fire
  // two parallel sendMagicLink() calls before the disabled prop
  // takes effect on the next paint, which results in two magic-link
  // emails. The ref is mutated synchronously inside submit() so the
  // second entry returns immediately. Cleared in a finally so a
  // network failure still re-enables future submissions.
  const inFlightRef = useRef(false);

  const isCoolingDown =
    status.kind === "sent" || status.kind === "resending";
  const cooldownSecondsLeft = isCoolingDown
    ? Math.max(0, Math.ceil((status.cooldownEndsAt - now) / 1000))
    : 0;

  useEffect(() => {
    if (!isCoolingDown) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    // Browsers throttle setInterval to ~1/min on backgrounded tabs, so
    // a long-backgrounded countdown would display a stale value until
    // the next throttled tick. Re-anchor `now` to wall-clock time the
    // moment the tab becomes visible again so the label jumps to the
    // correct remaining seconds (or "Resend link") immediately.
    const onVisibility = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isCoolingDown]);

  async function submit(targetEmail: string, mode: "send" | "resend") {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (mode === "send") {
      setStatus({ kind: "submitting" });
    } else {
      // Preserve the prior cooldown end-time across the in-flight
      // resend so the countdown doesn't briefly reset to 60s while
      // the network round-trips. The fallback only fires if a caller
      // ever invokes submit("resend") from a non-cooldown state — the
      // button can't trigger that today, but keeping a sane default
      // avoids an invalid discriminated-union construction.
      const preserved =
        status.kind === "sent" || status.kind === "resending"
          ? status.cooldownEndsAt
          : Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      setStatus({
        kind: "resending",
        email: targetEmail,
        cooldownEndsAt: preserved,
      });
    }

    // Remember the cooldown anchor BEFORE the await — `status` reads
    // inside the catch are stale closures over the pre-submit value,
    // but we want the cooldown that was active when the user clicked.
    // Only meaningful for resends; on initial send we never read it.
    const cooldownAtAttempt =
      mode === "resend" &&
      (status.kind === "sent" || status.kind === "resending")
        ? status.cooldownEndsAt
        : Date.now() + RESEND_COOLDOWN_SECONDS * 1000;

    try {
      // Referral credit fires alongside (not before) the magic link so a
      // transient signup error can't block sign-in. The waitlist endpoint is
      // idempotent on (email, active), so a resend with the same code is safe;
      // only the initial send attempts it. Best-effort — never surfaced.
      if (referralCode && mode === "send") {
        api
          .post("/v1/waitlist/signup", {
            email: targetEmail,
            intent: "general",
            referredByCode: referralCode,
            channel: "direct",
          })
          .catch(() => {});
      }
      const res = await sendMagicLink(targetEmail, {
        ...(next ? { returnTo: next } : {}),
        ...(shopifyClaim ? { shopifyClaim } : {}),
      });
      // Pre-launch invite gate: the endpoint may return without sending a
      // link. Branch to the matching card instead of the "check your email"
      // cooldown. `sent` (or a legacy response with no `outcome`) falls
      // through to the normal cooldown card.
      if (res.outcome === "waitlisted") {
        setStatus({ kind: "waitlisted", email: targetEmail });
        return;
      }
      if (res.outcome === "not_found") {
        setStatus({ kind: "notEligible", email: targetEmail });
        return;
      }
      setStatus({
        kind: "sent",
        email: targetEmail,
        cooldownEndsAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
      });
    } catch (err) {
      let message = `We couldn’t send your link just now. Try again in a moment — if it keeps failing, email ${SITE.contactGeneral} and we’ll let you in by hand.`;
      let isRateLimited = false;
      if (err instanceof ApiError) {
        if (err.code === "RATE_LIMITED") {
          // The 60s client cooldown should normally keep us from
          // hitting this — but if a user opened two tabs or the clocks
          // drift, surface a friendly message instead of the raw
          // "magic link sent recently" copy from the API.
          message =
            "You asked for a link a moment ago. Give it a minute, then try again — the first one is probably still landing.";
          isRateLimited = true;
        } else if (err.message) {
          message = err.message;
        }
      }

      if (mode === "resend") {
        // Resend failed — keep the "Check your email" card visible with
        // an inline error rather than dropping the user back to the
        // form. Disconnecting the failure from the action that caused
        // it (Resend click) is confusing UX. RATE_LIMITED means the
        // server window is still active, so bump the cooldown anchor
        // forward by a fresh 60s; other errors leave the prior anchor
        // intact so the timer keeps ticking against the original
        // server-side rate-limit window.
        const cooldownEndsAt = isRateLimited
          ? Date.now() + RESEND_COOLDOWN_SECONDS * 1000
          : cooldownAtAttempt;
        setStatus({
          kind: "sent",
          email: targetEmail,
          cooldownEndsAt,
          resendError: message,
        });
        return;
      }

      setStatus({ kind: "error", message });
    } finally {
      inFlightRef.current = false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    await submit(trimmed, "send");
  }

  function handleReset() {
    setEmail("");
    setStatus({ kind: "idle" });
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* ---------------------------------------------------------------
          Left — the always-dark product panel. Fixed zinc tones (not
          theme tokens) so it reads identically on light and dark, exactly
          like the landing hero's console and the free-first panel.
          Hidden below lg; the promise still reaches small screens through
          the tick row in the form column.
         --------------------------------------------------------------- */}
      <section className="relative hidden flex-col justify-between gap-8 overflow-hidden bg-zinc-900 p-10 text-zinc-100 lg:flex lg:w-1/2 xl:w-[55%] xl:p-14">
        {/* Single warm bloom — the only decoration on the panel. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-56 -right-36 size-115 rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklch, var(--brand) 30%, transparent), transparent 68%)",
          }}
        />

        <div className="relative z-10">
          {/* text-brand, not the theme-aware text-brand-label — see Eyebrow. */}
          <Eyebrow className="text-brand">Five pillars · one account</Eyebrow>
          {/* Deliberately not a heading: this panel is decorative brand copy
              that disappears below lg, so making it the h1 would leave small
              screens with no h1 at all. The state heading in the form column
              is the page's h1 at every breakpoint. */}
          <p className="mt-4 max-w-xl text-3xl font-extrabold leading-[1.06] tracking-tight text-pretty xl:text-4xl">
            Your whole business, waiting on the other side.{" "}
            <span className="font-serif font-normal italic text-brand-gradient">
              Free to start.
            </span>
          </p>
          <p className="mt-4 max-w-md text-zinc-400">
            Commerce, Content, Growth, Support and Presence — five pillars on
            one account, each with a free plan.
          </p>
        </div>

        {/* Pillar console — same device as the landing hero. */}
        <div
          className="relative z-10"
          role="img"
          aria-label={PILLAR_CONSOLE_LABEL}
        >
          <div className="flex items-center justify-between px-1 pb-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-zinc-400">
            <span>Your business, at a glance</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
              live
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {PILLAR_CONSOLE_ROWS.map((row) => (
              <div
                key={row.name}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-3.5 py-2.5 text-sm"
              >
                <span className="size-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                <span className="w-20 shrink-0 font-bold text-zinc-100">{row.name}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-400">{row.status}</span>
                <span className="shrink-0 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-emerald-400">
                  Free
                </span>
              </div>
            ))}
          </div>
          {/* Peaks is always the coin glyph, never a generic bolt. */}
          <p className="flex items-center gap-1.5 px-1 pt-3 text-xs text-zinc-400">
            Metered in
            <PeaksGlyph size={16} />
            <span className="font-bold text-brand-gradient">Peaks</span>
          </p>
        </div>

        <div className="relative z-10 flex gap-8 border-t border-white/10 pt-6">
          {SIGNUP_STATS.map((stat) => (
            <div key={stat.label}>
              <div
                className="text-2xl font-bold tabular-nums text-brand-gradient"
                style={NUMERIC_FONT}
              >
                {stat.value}
              </div>
              <div className="mt-1.5 max-w-[15ch] text-xs leading-snug text-zinc-400">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------
          Right — the form column.
         --------------------------------------------------------------- */}
      <div className="flex flex-1 flex-col">
        {referralCode ? (
          <div
            role="status"
            className="border-b bg-brand-soft px-4 py-3 text-sm font-medium text-brand-ink dark:bg-brand/12 dark:text-brand-soft"
          >
            <div className="mx-auto flex max-w-md items-center gap-2">
              <Sparkles className="size-4 shrink-0" aria-hidden />
              {/* Says only what the ?ref= flow actually does — the code credits
                  the inviter on signup. Don't promise the invitee a bonus we
                  don't grant. */}
              <span>A friend invited you — sign up to claim your spot.</span>
            </div>
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
          {status.kind === "waitlisted" ? (
            <div className="w-full max-w-md rounded-2xl border bg-card p-7">
              <GoldTile icon={Clock} />
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
                You&rsquo;re in the queue
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We&rsquo;re onboarding launch partners in batches so every account
                gets set up properly. We&rsquo;ll email your sign-in link the
                moment yours is ready — no need to check back.
              </p>
              <div className="mt-5">
                <EmailChip email={status.email} />
              </div>
              <button type="button" className={`${GHOST_BUTTON} mt-4`} onClick={handleReset}>
                Use a different email
              </button>
            </div>
          ) : status.kind === "notEligible" ? (
            <div className="w-full max-w-md rounded-2xl border bg-card p-7">
              <GoldTile icon={ShieldAlert} />
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
                We don&rsquo;t have this email yet
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {SITE.name} is invite-only while we onboard launch partners.
                Apply and you&rsquo;ll get all five pillars free, plus a setup
                call.
              </p>
              <div className="mt-5">
                <EmailChip email={status.email} />
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                <Link href="/launch-partner" className={GOLD_BUTTON}>
                  Apply as a launch partner
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <button type="button" className={GHOST_BUTTON} onClick={handleReset}>
                  Use a different email
                </button>
              </div>
            </div>
          ) : isCoolingDown ? (
            <div className="w-full max-w-md space-y-4">
              <div className="rounded-2xl border bg-card p-7">
                <GoldTile icon={Mail} />
                <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
                  Your link is on its way
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Open it within 15 minutes and you&rsquo;re in.
                </p>
                <div className="mt-5">
                  <EmailChip email={status.email} />
                </div>
                {status.kind === "sent" && status.resendError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {status.resendError}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-2.5">
                  <button
                    type="button"
                    className={GOLD_BUTTON}
                    disabled={status.kind === "resending" || cooldownSecondsLeft > 0}
                    onClick={() => submit(status.email, "resend")}
                    aria-describedby="resend-status"
                  >
                    {status.kind === "resending"
                      ? "Resending…"
                      : cooldownSecondsLeft > 0
                        ? `Resend in ${cooldownSecondsLeft}s`
                        : "Resend link"}
                  </button>
                  {/* The button label changes every second while the cooldown
                      runs. Marking the button itself aria-live made a screen
                      reader read out all sixty ticks; this region stays empty
                      until the cooldown ends, so it announces exactly once —
                      at the only moment the state actually changed. */}
                  <span id="resend-status" className="sr-only" aria-live="polite">
                    {status.kind === "resending" || cooldownSecondsLeft > 0
                      ? ""
                      : "You can resend the sign-in link now."}
                  </span>
                  <button type="button" className={GHOST_BUTTON} onClick={handleReset}>
                    Use a different email
                  </button>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Nothing yet? Check spam, or add{" "}
                <span className="font-semibold text-foreground">
                  {SITE.contactGeneral}
                </span>{" "}
                to your contacts.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-md">
              <Eyebrow>{intentCopy?.eyebrow ?? "Sign in or sign up"}</Eyebrow>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-pretty sm:text-3xl">
                {intentCopy?.title ?? "One email. No password. Ever."}
              </h1>
              <p className="mt-2.5 text-muted-foreground">
                {intentCopy?.subtitle ??
                  "We’ll send a link that signs you straight in. If you’re new, that same link creates your account."}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
                {status.kind === "error" && (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {status.message}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold">
                    Work email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@yourbusiness.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    className="h-11"
                  />
                </div>
                <button
                  type="submit"
                  className={GOLD_BUTTON}
                  disabled={status.kind === "submitting"}
                >
                  {status.kind === "submitting" ? (
                    "Sending your link…"
                  ) : (
                    <>
                      Continue with email
                      <ArrowRight className="size-4" aria-hidden />
                    </>
                  )}
                </button>
              </form>

              <ul className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {(intentCopy ? PRELAUNCH_TICKS : TICKS).map((tick) => (
                  <li key={tick} className="flex items-center gap-1.5">
                    <Check className="size-3.5 shrink-0 text-brand-label" strokeWidth={3} aria-hidden />
                    {tick}
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-center text-xs text-muted-foreground">
                By continuing, you agree to our{" "}
                <Link href="/terms" className={LEGAL_LINK}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy-policy" className={LEGAL_LINK}>
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          )}
        </div>

        {/* Standing footer for the column. The auth layout drops the marketing
            footer so the dark panel can run the full height, so the legal
            links and the way out of a stuck sign-in live here instead — under
            every state, not just the form. */}
        <div className="px-4 pb-8 text-center text-xs text-muted-foreground sm:px-8">
          <p>
            Trouble signing in?{" "}
            <Link href="/contact" className={LEGAL_LINK}>
              Talk to us
            </Link>
          </p>
          <p className="mt-1.5">
            <Link href="/terms" className={LEGAL_LINK}>
              Terms
            </Link>
            <span aria-hidden className="px-1.5 opacity-40">
              ·
            </span>
            <Link href="/privacy-policy" className={LEGAL_LINK}>
              Privacy
            </Link>
            <span aria-hidden className="px-1.5 opacity-40">
              ·
            </span>
            <Link href="/cookie-policy" className={LEGAL_LINK}>
              Cookies
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// useSearchParams() must be inside a Suspense boundary (Next.js App Router).
// A minimal full-height fallback avoids a blank prerender flash on this entry
// flow before the client fills in the (searchParams-dependent) heading.
export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <div
            className="size-6 animate-spin rounded-full border-2 border-muted border-t-brand"
            aria-hidden
          />
          <span className="sr-only">Loading</span>
        </div>
      }
    >
      <AuthPageInner />
    </Suspense>
  );
}
