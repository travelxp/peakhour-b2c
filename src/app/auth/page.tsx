"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sendMagicLink } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { SITE } from "@/lib/utils";

/**
 * Mirrors peakhour-cms/src/app/login/login-form.tsx so the b2c
 * customer flow has the same "Resend link" affordance the CMS
 * operator flow does. Five states keep the button labels and
 * disabled-state logic readable; without `resending` and `error`
 * as first-class states the JSX has to hunt across booleans.
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
  | { kind: "error"; message: string };

// peakhour-api enforces a hard 60s rate limit between magic-link
// requests for the same user (routes/auth/magic-link.ts). Mirror that
// here so the button enables exactly when the server will accept the
// next request — picking a shorter window only buys an avoidable 429
// + confused user. If the server window changes, update this in
// tandem; treat the API as the source of truth.
const RESEND_COOLDOWN_SECONDS = 60;

const VALUE_PROPS = [
  {
    title: "Add your business in minutes",
    description:
      "Just paste your website URL. Our AI discovers your brand, audience, and creates a marketing strategy instantly.",
  },
  {
    title: "AI creates ads from your content",
    description:
      "Connect your newsletter, blog, or social media. We turn every piece into high-performing ads across LinkedIn, Google, and Meta.",
  },
  {
    title: "Hands-free optimization",
    description:
      "The AI monitors performance hourly, pauses what doesn't work, boosts what does, and rebalances your budget automatically.",
  },
] as const;

const TRUST_STATS = [
  { value: "12", label: "dimensions of content intelligence" },
  { value: "3", label: "ad platforms, one dashboard" },
  { value: "24/7", label: "autonomous optimization" },
] as const;

// Landing CTAs route here with ?intent=waitlist|invite when the platform is
// pre-launch (driven by cfg_platform_stage.signupMode), so the heading matches
// the button the visitor clicked. The magic-link flow itself is unchanged —
// only the framing differs.
const INTENT_COPY: Record<string, { title: string; subtitle: string }> = {
  waitlist: {
    title: "Join the waitlist",
    subtitle: "Enter your email — we'll send your access link as we roll out. No password needed.",
  },
  invite: {
    title: "Request an invite",
    subtitle: "Enter your email to request access. We'll be in touch with your link. No password needed.",
  },
};

function AuthPageInner() {
  const searchParams = useSearchParams();
  const intentCopy = INTENT_COPY[searchParams.get("intent") ?? ""];
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
      await sendMagicLink(targetEmail);
      setStatus({
        kind: "sent",
        email: targetEmail,
        cooldownEndsAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
      });
    } catch (err) {
      let message =
        "Something went wrong. Please try again or contact support.";
      let isRateLimited = false;
      if (err instanceof ApiError) {
        if (err.code === "RATE_LIMITED") {
          // The 60s client cooldown should normally keep us from
          // hitting this — but if a user opened two tabs or the clocks
          // drift, surface a friendly message instead of the raw
          // "magic link sent recently" copy from the API.
          message =
            "Please wait a minute before requesting another link.";
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
      {/* Left panel — value proposition */}
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex lg:w-1/2 xl:w-[55%]">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }} />
        </div>

        <div className="relative z-10 space-y-10">
          <div>
            <h1 className="text-3xl font-bold leading-tight xl:text-4xl">
              Your AI marketing department starts here
            </h1>
            <p className="mt-3 max-w-lg text-primary-foreground/70">
              Stop spending hours on ads. Add your business, connect your
              content, and let AI handle the rest.
            </p>
          </div>

          <div className="space-y-6">
            {VALUE_PROPS.map((prop, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10 text-sm font-semibold">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold">{prop.title}</h3>
                  <p className="mt-1 text-sm text-primary-foreground/60">
                    {prop.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex gap-8 border-t border-primary-foreground/10 pt-6">
            {TRUST_STATS.map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-primary-foreground/50">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          {isCoolingDown ? (
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <svg aria-hidden="true" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                <CardDescription>
                  We sent a sign-in link to <strong>{status.email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to sign in. The link expires in 15
                  minutes.
                </p>
                {status.kind === "sent" && status.resendError && (
                  <div
                    role="alert"
                    className="rounded-md bg-destructive/10 p-3 text-left text-sm text-destructive"
                  >
                    {status.resendError}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  disabled={
                    status.kind === "resending" || cooldownSecondsLeft > 0
                  }
                  onClick={() => submit(status.email, "resend")}
                  // aria-live so a screen reader announces the changing
                  // label as the countdown ticks ("Resend in 42s" → "...
                  // 41s" → ... → "Resend link") without the user having
                  // to refocus the button. polite keeps it from
                  // interrupting other announcements; the value only
                  // changes once per second.
                  aria-live="polite"
                >
                  {status.kind === "resending"
                    ? "Resending…"
                    : cooldownSecondsLeft > 0
                      ? `Resend in ${cooldownSecondsLeft}s`
                      : "Resend link"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleReset}
                >
                  Use a different email
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="w-full max-w-md space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {intentCopy?.title ?? `Welcome to ${SITE.name}`}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {intentCopy?.subtitle ??
                    "Enter your email to sign in or create your account. No password needed."}
                </p>
              </div>

              <Card>
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <CardContent className="space-y-4 pt-6">
                    {status.kind === "error" && (
                      <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {status.message}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">Work email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        autoFocus
                        className="h-11"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4">
                    <Button
                      type="submit"
                      className="h-11 w-full text-base"
                      disabled={status.kind === "submitting"}
                    >
                      {status.kind === "submitting"
                        ? "Sending link…"
                        : "Continue with email"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      We&apos;ll send you a magic link. No password to remember.
                    </p>
                  </CardFooter>
                </form>
              </Card>

              <p className="text-center text-xs text-muted-foreground">
                By continuing, you agree to our{" "}
                <Link href="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy-policy"
                  className="underline hover:text-foreground"
                >
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

// useSearchParams() must be inside a Suspense boundary (Next.js App Router).
export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}
