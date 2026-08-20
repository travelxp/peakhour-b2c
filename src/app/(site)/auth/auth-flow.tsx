"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Mail, ShieldAlert, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { sendMagicLink } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { SITE, cn } from "@/lib/utils";
import type { PlatformSignupMode } from "@/lib/catalog";
import { PeaksGlyph } from "@/components/peaks/peaks-glyph";
import { AuthScenes } from "@/components/marketing/auth-scenes";
import {
  PILLAR_CONSOLE_ROWS,
  PILLAR_CONSOLE_LABEL,
  PILLAR_CONSOLE_ROW_CLASS,
  SIGNUP_PROMISES,
  PRELAUNCH_PROMISES,
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

// Proof points beside the form. The Peaks figure is catalog data resolved
// server-side (see page.tsx), not a number kept in sync by hand.
function signupStats(freePeaks: string) {
  return [
    { value: "5", label: "modules, one login" },
    { value: "0", label: "credit cards required" },
    // "+" and "free plan": the figure is the floor across free plans, and
    // paid/Agency/Enterprise carry far more. Without both, this reads as a cap.
    { value: `${freePeaks}+`, label: "free Peaks a month, every free plan" },
  ];
}

// Landing CTAs route here with ?intent=waitlist|invite when the platform is
// pre-launch (driven by cfg_platform_stage.signupMode), so the heading matches
// the button the visitor clicked. Framing only — it does NOT decide what the
// page promises; `signupMode` does (see page.tsx). The magic-link flow itself
// is unchanged.
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
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-center text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:translate-y-0 aria-disabled:focus-visible:translate-y-0";

/** Underlined inline link, used in the legal/help microcopy. */
const LEGAL_LINK =
  "underline underline-offset-2 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

/** Quiet secondary button — outlined, gains a foreground border on hover. */
const GHOST_BUTTON =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-2 text-center text-sm font-bold transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      // cn() so a caller passing a non-colour class (spacing, say) keeps the
      // default colour, and one passing a colour overrides it cleanly rather
      // than emitting two competing text-* classes.
      className={cn(
        "inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label",
        className,
      )}
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

/**
 * Which outcome card a status renders, or null while the form is showing.
 *
 * An exhaustive switch rather than a chain of ternaries: this drives the focus
 * move, and the failure mode of missing a case is silent — focus lands on
 * <body> and only a screen-reader user notices. The `never` default makes
 * adding a Status kind a compile error here instead.
 */
type OutcomeBranch = "cooldown" | "waitlisted" | "notEligible" | null;

function outcomeOf(status: Status): OutcomeBranch {
  switch (status.kind) {
    case "waitlisted":
    case "notEligible":
      return status.kind;
    case "sent":
    case "resending":
      return "cooldown";
    case "idle":
    case "submitting":
    case "error":
      return null;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
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

export function AuthFlow({
  signupMode,
  /** Pre-formatted so the client bundle carries no pricing logic. */
  freePeaks,
}: {
  signupMode: PlatformSignupMode;
  freePeaks: string;
}) {
  // Anything other than "open" means access is gated behind approval, so the
  // page must not promise same-day access.
  const isPreLaunch = signupMode !== "open";
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
  /**
   * Params the embedded Shopify app puts in the fragment (`email`, `next`).
   *
   * ★CAPTURED ONCE, because the layout effect below erases the hash. Recomputed
   * per render it survived exactly one: `prefillEmail` was safe (it is captured
   * into useState) but `next` was not, so the first re-render — typing in the
   * field, or the status change that reveals the "check your email" card — read
   * an empty hash and dropped the destination. Every resend went out with no
   * returnTo, and any merchant who corrected the prefilled address landed on
   * /dashboard/overview instead of the page they came from.
   */
  const [shopifyFrag] = useState<URLSearchParams | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.hash.slice(1)),
  );
  // `?next=` — where to return after verify (server sanitizes it to same-origin).
  // Only same-origin relative paths are forwarded.
  const next = (() => {
    // Fragment first: the embedded app's dashboard link puts `email` and `next`
    // there. Reading only the query dropped every deep link from that app onto
    // /dashboard/overview.
    const raw = shopifyFrag?.get("next") ?? searchParams.get("next");
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
  /**
   * Prefilled address, carried in the fragment by the embedded Shopify app's
   * "Open Peakhour Dashboard" — the org's own account email, so there is
   * nothing to type. Only ever a PREFILL: the link goes to whatever address is
   * submitted, so a wrong guess costs a correction, never access, and the field
   * stays editable. Trimmed and length-capped so a junk value can't be pushed
   * straight into the request.
   *
   * In the fragment because it is personal data and a fragment never reaches a
   * server — it stays out of the b2c edge log and ours.
   */
  const prefillEmail = (() => {
    const raw = shopifyFrag?.get("email")?.trim() ?? "";
    return raw.length > 0 && raw.length <= 256 && raw.includes("@") ? raw : "";
  })();

  // Drop the fragment once it has been read into state: the address is personal
  // data and this page lingers on the "check your email" screen, into history
  // and session restore. Layout effect so it runs before paint; the values are
  // already captured above, so nothing downstream re-reads the hash.
  useIsomorphicLayoutEffect(() => {
    if ((shopifyFrag?.has("email") || shopifyFrag?.has("next")) && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    // Once, on mount: the values this guards are read during the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NOTE: computed from the fragment at hydration while the server render saw
  // "". React excludes `value` from hydration diffing, so this is safe — but it
  // is a deliberate reliance, not an accident.
  const [email, setEmail] = useState(prefillEmail);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Tick once per second while a cooldown is running so the button
  // label re-renders. A single shared timestamp + Math.ceil derives
  // the displayed countdown without per-second state updates competing
  // with the status transitions. The effect's cleanup is keyed on
  // isCoolingDown so the interval stops once status leaves the
  // cooldown states (sent / resending) or the component unmounts.
  const [now, setNow] = useState<number>(() => Date.now());
  // The ONLY guard against a double send — neither button uses the native
  // `disabled` any more (it blurs the element and throws focus to <body>), so
  // nothing else refuses a second press. Mutated synchronously at the top of
  // submit(), before any await, so Enter-mashing and duplicate click events
  // both hit it. Cleared in a finally so a network failure still re-enables
  // future submissions.
  const inFlightRef = useRef(false);
  // Bumped by handleReset so a request still in flight can't write its result
  // over a form the user has already moved on from. "Use a different email"
  // stays live during a resend, so the old sequence was: reset → form mounts →
  // the pending promise resolves → the cooldown card springs back with the
  // PREVIOUS email. Now that entering that card also moves focus, it would
  // additionally yank the caret out of the input the user is typing into.
  const attemptRef = useRef(0);
  // Set when a *resend* succeeds, so the sr-only live region can confirm it.
  // A resend that SUCCEEDS stays on the same card, so no focus move happens
  // (a resend that comes back waitlisted/notEligible does swap the card, and
  // outcomeBranch handles that) — the region is the only announcement it
  // produces, and without it the next thing heard would be the cooldown
  // expiring a minute later. Cleared when a new attempt starts or on reset.
  const [resendNotice, setResendNotice] = useState("");

  const isCoolingDown =
    status.kind === "sent" || status.kind === "resending";

  // Submitting swaps the whole column from the form to an outcome card, which
  // unmounts the button the user just pressed and drops focus to <body>. For a
  // keyboard or screen-reader user that is silence plus a lost place in the
  // document, on the screen where confirmation matters most. Moving focus to
  // the new card's heading both restores the position and makes the outcome
  // the next thing announced.
  const outcomeHeadingRef = useRef<HTMLHeadingElement>(null);
  // Keyed on WHICH card is showing, not on a boolean "is an outcome showing".
  // A boolean misses resending → waitlisted / notEligible: submit() branches to
  // those for a resend as well as a first send, so the card swaps underneath a
  // focused Resend button while the boolean stays true — the effect wouldn't
  // re-run and focus would land on <body>, the exact bug this exists to fix.
  // outcomeOf() is an exhaustive switch, so a new Status kind is a compile
  // error there rather than a silently skipped focus move.
  const outcomeBranch = outcomeOf(status);
  const prevBranchRef = useRef(outcomeBranch);
  useEffect(() => {
    const entered = outcomeBranch !== null && outcomeBranch !== prevBranchRef.current;
    prevBranchRef.current = outcomeBranch;
    // preventScroll: the card is freshly mounted at the top of a fresh layout,
    // so scrolling the heading into view buys nothing and would push the icon
    // tile above it off-screen if the column ever does overflow.
    if (entered) outcomeHeadingRef.current?.focus({ preventScroll: true });
  }, [outcomeBranch]);
  const cooldownSecondsLeft = isCoolingDown
    ? Math.max(0, Math.ceil((status.cooldownEndsAt - now) / 1000))
    : 0;
  const resendBlocked = status.kind === "resending" || cooldownSecondsLeft > 0;
  // Flips exactly twice per cooldown (on entry, and when it expires), so it
  // is a stable effect dependency despite deriving from a per-second value.
  const needsCooldownTick = isCoolingDown && cooldownSecondsLeft > 0;

  useEffect(() => {
    // Also gated on there being time left: `isCoolingDown` stays true for the
    // whole life of the `sent` state, so keying on it alone left a 1 Hz
    // re-render running for as long as the card stayed open.
    if (!needsCooldownTick) return;
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
  }, [needsCooldownTick]);

  async function submit(targetEmail: string, mode: "send" | "resend") {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    // Generation this attempt belongs to; handleReset bumps it to abandon us.
    const attempt = attemptRef.current;
    const abandoned = () => attemptRef.current !== attempt;
    // Re-anchor the countdown clock before any cooldown is created. `now` is
    // seeded at mount and only advanced by the interval, which runs *while*
    // cooling down — so on the first render of `sent` it is as stale as the
    // time the visitor spent reading the page, and a 90-second read showed
    // "Resend in 150s" until the next tick corrected it.
    setNow(Date.now());
    setResendNotice("");
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
      if (abandoned()) return;
      if (res.outcome === "waitlisted") {
        setStatus({ kind: "waitlisted", email: targetEmail });
        return;
      }
      if (res.outcome === "not_found") {
        setStatus({ kind: "notEligible", email: targetEmail });
        return;
      }
      if (mode === "resend") {
        setResendNotice(`New sign-in link sent to ${targetEmail}.`);
      }
      setStatus({
        kind: "sent",
        email: targetEmail,
        cooldownEndsAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
      });
    } catch (err) {
      if (abandoned()) return;
      let message = `We couldn’t send your link. Try again in a moment — if it keeps failing, email ${SITE.contactGeneral}.`;
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
      if (!abandoned()) inFlightRef.current = false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    await submit(trimmed, "send");
  }

  function handleReset() {
    // Abandon any in-flight attempt: its result belongs to an email the user
    // has just discarded. inFlightRef is released too so the fresh form isn't
    // stuck refusing submits until the old request lands.
    attemptRef.current += 1;
    inFlightRef.current = false;
    setEmail("");
    setResendNotice("");
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
      <section className="relative hidden flex-col justify-between gap-8 overflow-hidden bg-ink p-10 text-on-ink lg:flex lg:w-1/2 xl:w-[55%] xl:p-14">
        {/* Single warm bloom — the only decoration on the panel. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-56 -right-36 size-115 rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklch, var(--brand) 30%, transparent), transparent 68%)",
          }}
        />

        {/* ★THE PANEL CHANGES NOW. It held one promise for as long as someone
            took to type an email — the right layout, standing still. Five
            scenes, one per module, each on its own generated ground.

            Deliberately not headings: this panel disappears below lg, so an h1
            here would leave small screens with no h1 at all. The state heading
            in the form column is the h1 at every breakpoint. */}
        <AuthScenes />

        <div className="relative z-10">
          <p className="max-w-md text-on-ink-dim">
            Commerce, Content, Growth, Support and Presence — five modules on
            one account, each with a free plan.
          </p>
        </div>

        {/* Pillar console — same device as the landing hero. */}
        <div
          className="relative z-10"
          role="img"
          aria-label={PILLAR_CONSOLE_LABEL}
        >
          <div className="flex items-center justify-between px-1 pb-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-on-ink-dim">
            <span>Your business, at a glance</span>
            <span className="flex items-center gap-1.5 text-success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              live
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {PILLAR_CONSOLE_ROWS.map((row) => (
              <div
                key={row.name}
                className={PILLAR_CONSOLE_ROW_CLASS}
              >
                <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />
                <span className="w-20 shrink-0 font-bold text-on-ink">{row.name}</span>
                <span className="min-w-0 flex-1 truncate text-on-ink-dim">{row.status}</span>
                <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-success">
                  Free
                </span>
              </div>
            ))}
          </div>
          {/* Peaks is always the coin glyph, never a generic bolt. */}
          <p className="flex items-center gap-1.5 px-1 pt-3 text-xs text-on-ink-dim">
            Metered in
            <PeaksGlyph size={16} />
            <span className="font-bold text-brand-gradient">Peaks</span>
          </p>
        </div>

        <div className="relative z-10 flex gap-8 border-t border-ink-line pt-6">
          {signupStats(freePeaks).map((stat) => (
            <div key={stat.label}>
              <div
                className="text-2xl font-bold tabular-nums text-brand-gradient"
                style={NUMERIC_FONT}
              >
                {stat.value}
              </div>
              <div className="mt-1.5 max-w-[15ch] text-xs leading-snug text-on-ink-dim">
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
            // Measured: at 375×553 (iPhone SE with the browser bars showing)
            // this banner was the one thing tipping /auth into scrolling. The
            // tighter padding and type keep it to a single line there.
            className="border-b bg-brand-soft px-4 py-2.5 text-xs font-medium text-brand-ink sm:px-8 sm:py-3 sm:text-sm dark:bg-brand/12 dark:text-brand-soft"
          >
            <div className="mx-auto flex max-w-md items-center gap-2">
              <Sparkles className="size-4 shrink-0" aria-hidden />
              {/* Says only what the ?ref= flow actually does — the code credits
                  the inviter on signup. Don't promise the invitee a bonus we
                  don't grant. */}
              <span>A friend invited you — claim your spot.</span>
            </div>
          </div>
        ) : null}

        {/* Vertical padding steps up only once there's room for it. At mobile
            widths the dark panel is hidden, so this column is the whole page
            and desktop-sized padding was pushing it past the viewport. */}
        <div className="flex flex-1 items-center justify-center px-4 py-4 sm:px-8 sm:py-12">
          {status.kind === "waitlisted" ? (
            <div className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-7">
              <GoldTile icon={Clock} />
              <h1
                ref={outcomeHeadingRef}
                tabIndex={-1}
                className="mt-5 text-2xl font-extrabold tracking-tight focus-visible:outline-none"
              >
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
            <div className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-7">
              <GoldTile icon={ShieldAlert} />
              <h1
                ref={outcomeHeadingRef}
                tabIndex={-1}
                className="mt-5 text-2xl font-extrabold tracking-tight focus-visible:outline-none"
              >
                We don&rsquo;t have this email yet
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {SITE.name} is invite-only while we onboard launch partners.
                Apply and you&rsquo;ll get all five modules free, plus a setup
                call.
              </p>
              <div className="mt-5">
                <EmailChip email={status.email} />
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:gap-2.5">
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
              <div className="rounded-2xl border bg-card p-6 sm:p-7">
                <GoldTile icon={Mail} />
                <h1
                  ref={outcomeHeadingRef}
                  tabIndex={-1}
                  className="mt-5 text-2xl font-extrabold tracking-tight focus-visible:outline-none"
                >
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
                    className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive-on-tint sm:p-3 sm:text-sm"
                  >
                    {status.resendError}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    className={GOLD_BUTTON}
                    // aria-disabled, not disabled: a disabled element is blurred
                    // by the browser, so pressing Resend would throw focus to
                    // <body> and the live region below would announce into
                    // nowhere. aria-disabled keeps the button focusable and
                    // announced as unavailable; the click is refused in the
                    // handler instead.
                    aria-disabled={resendBlocked}
                    onClick={() => {
                      if (resendBlocked) return;
                      submit(status.email, "resend");
                    }}
                    // Both: the wait explains WHY it's dimmed (static, so it is
                    // read on focus), the status carries the events.
                    aria-describedby="resend-wait resend-status"
                  >
                    {/* The label deliberately does NOT carry the countdown.
                        The button keeps focus through the cooldown now (it is
                        aria-disabled, not disabled), and a label that rewrites
                        itself every second would both chatter in screen
                        readers that re-announce the focused element's name and,
                        if hidden behind an aria-label to stop that, break WCAG
                        2.5.3 — the accessible name would no longer contain the
                        visible text a voice-control user reads aloud. Keeping
                        the label stable lets the visible text BE the name, and
                        the remaining seconds live in their own line below. */}
                    {status.kind === "resending" ? "Resending…" : "Resend link"}
                  </button>
                  {/* Static, NOT a live region: tabbing onto a dimmed button
                      and hearing only "Resend link, unavailable" — with no
                      reason and no idea for how long — is worse than the
                      ticking label it replaced. This is announced as the
                      button's description whenever it takes focus. */}
                  <span id="resend-wait" className="sr-only">
                    {resendBlocked
                      ? "Available about a minute after the last link was sent."
                      : ""}
                  </span>
                  {cooldownSecondsLeft > 0 && status.kind !== "resending" && (
                    // aria-hidden: this ticks once a second and is a visual
                    // convenience. The live region below is what tells a
                    // screen-reader user when the wait is over.
                    <p aria-hidden className="text-center text-xs text-muted-foreground">
                      You can resend in {cooldownSecondsLeft}s
                    </p>
                  )}
                  {/* Only the three moments that are genuinely events — the
                      resend starting, a new link landing, and the cooldown
                      expiring — and empty in between. It mounts with the card
                      rather than alongside its text, because a live region
                      inserted together with its content does not announce. */}
                  <span id="resend-status" className="sr-only" aria-live="polite">
                    {status.kind === "resending"
                      ? "Sending a new link…"
                      : cooldownSecondsLeft > 0
                        ? resendNotice
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
              <p className="mt-2.5 text-sm text-muted-foreground sm:text-base">
                {intentCopy?.subtitle ??
                  "We’ll send a link that signs you straight in. If you’re new, that same link creates your account."}
              </p>

              <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:mt-8 sm:gap-4">
                {status.kind === "error" && (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive-on-tint sm:p-3 sm:text-sm"
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
                  // aria-disabled for the same reason as Resend above: a real
                  // `disabled` is blurred by the browser, so the primary path —
                  // which every visitor takes and few ever leave — would throw
                  // focus to <body> for the whole network round trip, and again
                  // on failure. inFlightRef already refuses a double submit
                  // synchronously, so nothing depends on the native block.
                  aria-disabled={status.kind === "submitting"}
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

              <ul className="mt-4 flex flex-wrap justify-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground sm:mt-6 sm:gap-x-4 sm:text-sm">
                {(isPreLaunch ? PRELAUNCH_PROMISES : SIGNUP_PROMISES).map((tick) => (
                  <li key={tick} className="flex items-center gap-1.5">
                    <Check className="size-3.5 shrink-0 text-brand-label" strokeWidth={3} aria-hidden />
                    {tick}
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-center text-xs text-muted-foreground sm:mt-8">
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
      </div>
    </div>
  );
}
