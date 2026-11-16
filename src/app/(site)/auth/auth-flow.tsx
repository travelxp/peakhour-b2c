"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Mail, ShieldAlert, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { sendMagicLink } from "@/lib/auth";
import { PasswordSignIn } from "./password-signin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { SITE } from "@/lib/utils";
import type { PlatformSignupMode } from "@/lib/catalog";
import { FlowButton, FlowCard, FlowHead, FlowNotice, flowLink } from "@/components/marketing/flow/flow-kit";
import { eyebrowCls } from "@/components/marketing/seo/styles";
import { PANEL_BETA, PANEL_HEADLINE, PANEL_LIVE, signupTicks, type PanelItem } from "./auth-copy";

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

// Landing CTAs route here with ?intent=waitlist|invite when the platform is
// pre-launch (driven by cfg_platform_stage.signupMode), so the heading matches
// the button the visitor clicked. Framing only — it does NOT decide what the
// page promises; `signupMode` does (see page.tsx). The magic-link flow itself
// is unchanged.
const INTENT_COPY: Record<string, { eyebrow: string; title: string; subtitle: string }> = {
  waitlist: {
    eyebrow: "Waitlist",
    title: "Get on the list for early access.",
    subtitle:
      "Enter your email. We’ll send your access link when your turn comes. No password needed.",
  },
  invite: {
    eyebrow: "Invite",
    title: "Request an invite.",
    subtitle:
      "Enter your email. We’ll send your access link once you’re approved. No password needed.",
  },
};

// Space Grotesk is the numeric face across the marketing surface (Peaks
// balances, prices). Applied inline via the CSS variable, matching how
// /pricing and /peaks already reach for it — there's no Tailwind utility
// mapped to --font-space-grotesk in globals.css.
const NUMERIC_FONT = { fontFamily: "var(--font-space-grotesk)" } as const;

/**
 * The panel's pillar dots. The colours are the --daylight-dot-* tokens (globals.css); a full class string per key so
 * Tailwind sees each one.
 */
const DOT: Record<PanelItem["dot"], string> = {
  commerce: "bg-[var(--daylight-dot-commerce)]",
  content: "bg-[var(--daylight-dot-content)]",
  growth: "bg-[var(--daylight-dot-growth)]",
  presence: "bg-[var(--daylight-dot-presence)]",
};

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
      className="break-all rounded-xl bg-muted px-3.5 py-2.5 text-sm font-semibold"
      style={NUMERIC_FONT}
    >
      {email}
    </p>
  );
}

export function AuthFlow({
  signupMode,
  trialSignupMode,
  /** Suite's trial length, resolved server-side so the client bundle carries
   *  no pricing logic. Null when the environment sells no Suite trial: then
   *  the page promises none (`suiteTrialDays`, `hasTrial`). */
  trialDays,
  /**
   * Whether this stack's API allows password sign-in. Resolved on the server in
   * `page.tsx` — see `lib/password-signin-availability.ts` for why it is not a
   * client probe. Defaults to false so a caller that forgets it renders nothing
   * rather than a form that cannot work.
   */
  passwordSignIn = false,
}: {
  signupMode: PlatformSignupMode;
  /** The mode as the catalog gave it, undefined when it could not be read: then no trial line (fail closed). */
  trialSignupMode: PlatformSignupMode | null | undefined;
  trialDays: number | null;
  passwordSignIn?: boolean;
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
      let message = `The link didn’t send. Try again in a moment. If it keeps failing, email ${SITE.contactGeneral}.`;
      let isRateLimited = false;
      if (err instanceof ApiError) {
        if (err.code === "RATE_LIMITED") {
          // The 60s client cooldown should normally keep us from
          // hitting this — but if a user opened two tabs or the clocks
          // drift, surface a friendly message instead of the raw
          // "magic link sent recently" copy from the API.
          message =
            "A link was sent a moment ago. Check your inbox, or try again in a minute.";
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
          Left — what Peakhour does, on the Daylight hero tint. Every line
          is an approved claim (auth-copy.ts), the beta ones say so, and
          nothing here is a number or a made-up status.
          Hidden below lg, where the form column is the whole page; there
          the same cards follow the form in a compact lg:hidden section.
         --------------------------------------------------------------- */}
      <section
        aria-label="What Peakhour does"
        className="hidden flex-col justify-center gap-7 bg-[var(--daylight-hero)] px-10 py-12 lg:flex lg:w-1/2 xl:w-[52%] xl:px-16"
      >
        <div className="mx-auto w-full max-w-xl">
          <p className={eyebrowCls}>What Peakhour does</p>
          {/* Deliberately not a heading: this panel disappears below lg, so an
              h1 here would leave small screens with no h1 at all. The state
              heading in the form column is the h1 at every breakpoint. */}
          <p className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] text-balance xl:text-[2.75rem]">
            {PANEL_HEADLINE.lead}
            <span className="daylight-mark">{PANEL_HEADLINE.mark}</span>
            {PANEL_HEADLINE.tail}
          </p>

          <ul role="list" className="mt-8 grid gap-3">
            {PANEL_LIVE.map((item) => (
              <PanelRow key={item.name} item={item} />
            ))}
          </ul>

          <p className={`${eyebrowCls} mt-8`}>In beta</p>
          <ul role="list" className="mt-3 grid gap-3">
            {PANEL_BETA.map((item) => (
              <PanelRow key={item.name} item={item} />
            ))}
          </ul>
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
            className="border-b bg-brand-soft px-4 py-2.5 text-xs font-medium text-brand-ink sm:px-8 sm:py-3 sm:text-sm"
          >
            <div className="mx-auto flex max-w-md items-center gap-2">
              <Sparkles className="size-4 shrink-0" aria-hidden />
              {/* Says only what the ?ref= flow actually does — the code credits
                  the inviter on signup. Don't promise the invitee a bonus we
                  don't grant. */}
              <span>A friend invited you. Sign in to claim your spot.</span>
            </div>
          </div>
        ) : null}

        {/* Vertical padding steps up only once there's room for it. At mobile
            widths the panel is hidden, so this column is the whole page and
            desktop-sized padding was pushing it past the viewport. */}
        <div className="flex flex-1 items-start justify-center px-4 py-6 sm:items-center sm:px-8 sm:py-12">
          {status.kind === "waitlisted" ? (
            <FlowCard className="max-w-md">
              <FlowHead icon={Clock} title="You’re on the waitlist" headingRef={outcomeHeadingRef} tabIndex={-1}>
                We&rsquo;re approving launch partners in batches. We&rsquo;ll email
                your sign-in link when yours is ready, so you don&rsquo;t need to
                check back.
              </FlowHead>
              <div className="mt-5">
                <EmailChip email={status.email} />
              </div>
              <FlowButton type="button" variant="ghost" className="mt-4" onClick={handleReset}>
                Use a different email
              </FlowButton>
            </FlowCard>
          ) : status.kind === "notEligible" ? (
            <FlowCard className="max-w-md">
              <FlowHead icon={ShieldAlert} title="This email isn’t on the list yet" headingRef={outcomeHeadingRef} tabIndex={-1}>
                Peakhour is invite-only for now. Apply as a launch partner and
                our team will get in touch about early access and hands-on setup.
              </FlowHead>
              <div className="mt-5">
                <EmailChip email={status.email} />
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:gap-2.5">
                <FlowButton asChild>
                  <Link href="/launch-partner">
                    Apply as a launch partner
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </FlowButton>
                <FlowButton type="button" variant="ghost" onClick={handleReset}>
                  Use a different email
                </FlowButton>
              </div>
            </FlowCard>
          ) : isCoolingDown ? (
            <div className="w-full max-w-md space-y-4">
              <FlowCard>
                <FlowHead icon={Mail} title="Your link is on its way" headingRef={outcomeHeadingRef} tabIndex={-1}>
                  Open it within 15 minutes to sign in.
                </FlowHead>
                <div className="mt-5">
                  <EmailChip email={status.email} />
                </div>
                {status.kind === "sent" && status.resendError && (
                  <FlowNotice tone="bad" role="alert" className="mt-4">
                    {status.resendError}
                  </FlowNotice>
                )}
                <div className="mt-4 flex flex-col gap-2 sm:gap-2.5">
                  <FlowButton
                    type="button"
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
                  </FlowButton>
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
                  <FlowButton type="button" variant="ghost" onClick={handleReset}>
                    Use a different email
                  </FlowButton>
                </div>
              </FlowCard>
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
              <p className={eyebrowCls}>{intentCopy?.eyebrow ?? "Sign in"}</p>
              <h1 className="mt-3 text-[1.9rem] font-extrabold leading-[1.06] tracking-[-0.035em] text-balance sm:text-4xl">
                {intentCopy?.title ?? (
                  <>
                    Sign in with <span className="daylight-mark">a link</span> to your email.
                  </>
                )}
              </h1>
              <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">
                {intentCopy?.subtitle ??
                  "We’ll email you a link that signs you in. New here? The same link creates your account."}
              </p>

              <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:mt-7 sm:gap-4">
                {status.kind === "error" && (
                  <FlowNotice tone="bad" role="alert">
                    {status.message}
                  </FlowNotice>
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
                    className="h-12 rounded-xl bg-card text-base"
                  />
                </div>
                <FlowButton
                  type="submit"
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
                      Email me a sign-in link
                      <ArrowRight className="size-4" aria-hidden />
                    </>
                  )}
                </FlowButton>
              </form>

              {/* ★Dev-only, decided by the API and resolved server-side in
                  page.tsx — see lib/password-signin-availability.ts for why it is
                  not a client probe. ★No `&&` here on purpose: a previous
                  revision wrote `{passwordSignIn && <PasswordSignIn
                  available={passwordSignIn} …/>}`, which passes the guard its own
                  operand and makes the component's check unreachable — dead code
                  under a docblock calling it the half that cannot be edited away.
                  One live guard, and it is the one inside the component. Not a
                  security boundary either way: /v1/auth/test-login refuses on
                  production regardless. */}
              <PasswordSignIn available={passwordSignIn} next={next} />

              <ul role="list" className="mt-4 flex flex-wrap justify-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground sm:mt-6 sm:gap-x-4 sm:text-sm">
                {signupTicks(trialDays, isPreLaunch, trialSignupMode).map((tick) => (
                  <li key={tick} className="flex items-center gap-1.5">
                    <Check className="size-3.5 shrink-0 text-brand-strong" strokeWidth={3} aria-hidden />
                    {tick}
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-center text-xs text-muted-foreground sm:mt-7">
                By continuing, you agree to our{" "}
                <Link href="/terms" className={flowLink}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy-policy" className={flowLink}>
                  Privacy Policy
                </Link>
                .
              </p>

              {/* The panel beside the form is hidden below lg; its claims (the same approved ones) follow the form here,
                  compact, so a phone does not end in an empty band. */}
              <section aria-label="What Peakhour does" className="mt-8 border-t pt-6 lg:hidden">
                <p className={eyebrowCls}>What Peakhour does</p>
                <ul role="list" className="mt-3 grid gap-3">
                  {[...PANEL_LIVE, ...PANEL_BETA].map((item) => (
                    <li key={item.name} className="flex gap-3">
                      <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${DOT[item.dot]}`} />
                      <p className="min-w-0 text-sm text-muted-foreground">
                        <b className="font-extrabold text-foreground">{item.name}</b>
                        {item.beta ? <b className="font-bold text-[var(--daylight-warn-ink)]"> (beta)</b> : null}
                        {". "}
                        {item.line}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One line of the panel: the pillar's dot, the capability's name, and what it does. A beta one carries the word. */
function PanelRow({ item }: { item: PanelItem }) {
  return (
    <li className="flex gap-3.5 rounded-2xl border bg-card p-4">
      <span aria-hidden className={`mt-2 size-2.5 shrink-0 rounded-full ${DOT[item.dot]}`} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-extrabold tracking-tight">
          {item.name}
          {item.beta ? (
            <span className="rounded-full bg-[var(--daylight-warn-soft)] px-2 py-0.5 text-micro font-bold uppercase tracking-wider text-[var(--daylight-warn-ink)]">
              Beta
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[15px] text-muted-foreground">{item.line}</p>
      </div>
    </li>
  );
}
