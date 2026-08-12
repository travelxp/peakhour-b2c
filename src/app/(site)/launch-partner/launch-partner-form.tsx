"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, Sparkles, Share2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Launch-partner apply form. Applying lands a waitlist_signups row
 * (POST /v1/waitlist/signup). Ops approves in the CMS, which unlocks
 * magic-link sign-in.
 *
 * ONE required field (email) and ONE optional one — the free-text "what would
 * you love Peakhour to take off your plate?", which lands in the existing
 * `businessContext` column. Everything else we want about an early applicant
 * is derived, never asked:
 *
 *   • Product cohort — from `source`. A Shopify link means Commerce, a
 *     WordPress link means Marketing; the API derives it, so the applicant is
 *     never made to choose.
 *   • Country — from the Vercel edge geo header, resolved on the server page
 *     and passed in as a prop.
 *   • Business domain — already sitting in the work email for most applicants.
 *
 * That is the whole rule for this form: a field earns its place only if the
 * answer can't be derived AND it changes what we build. Adding a business/
 * website input or a country dropdown fails both halves.
 */
type SignupSource = "shopify" | "wordpress" | "direct";

/** Friendly product name for a known entry surface, for a light confirmation line. */
const SOURCE_PRODUCT: Partial<Record<SignupSource, string>> = {
  shopify: "Peakhour Commerce",
  wordpress: "Peakhour Marketing",
};

/** Mirrors waitlist_signups.businessContext (max 2048) — the API rejects more. */
const CONTEXT_MAX = 2048;

export function LaunchPartnerForm({
  source = "direct",
  /** ISO-3166 alpha-2 resolved from the edge geo header by the server page. */
  country,
}: {
  source?: SignupSource;
  country?: string;
}) {
  const [email, setEmail] = useState("");
  const [context, setContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    referralCode: string;
    foundingMember: boolean;
    position: number | null;
  } | null>(null);

  async function submit() {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    setSubmitting(true);
    try {
      // The textarea's maxLength already stops typing past the limit, but it
      // does NOT bound a programmatic paste in every browser — and trimming
      // whitespace can only shorten. Belt and braces so an over-long value
      // becomes a truncated application rather than a 400 from the API.
      const trimmedContext = context.trim().slice(0, CONTEXT_MAX);
      const body: Record<string, unknown> = {
        email,
        intent: "general",
        // Direct landing-page application (not an in-app feature gate).
        channel: "direct",
        // Entry surface — the API derives the product cohort from it, so the
        // applicant is never asked to choose Commerce vs Marketing.
        signupSource: source,
        // Optional; omitted entirely when blank so an untouched field doesn't
        // write an empty string into the qualitative dataset.
        ...(trimmedContext ? { businessContext: trimmedContext } : {}),
        // Derived, never asked. Absent in local dev and on any non-Vercel edge.
        ...(country ? { country } : {}),
      };

      const r = await api.post<{
        referralCode: string;
        foundingMember: boolean;
        position: number | null;
        idempotent?: boolean;
      }>("/v1/waitlist/signup", body);

      setSuccess({
        referralCode: r.referralCode,
        foundingMember: r.foundingMember,
        position: r.position,
      });
      toast.success(r.idempotent ? "You're already on the list" : "You're in");
    } catch (err) {
      toast.error((err as Error)?.message || "Could not submit — please retry");
    } finally {
      setSubmitting(false);
    }
  }

  function shareReferral() {
    if (!success) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    // Random suffix defeats exact-URL caching on shares; non-security.
    const nonce = Math.random().toString(36).slice(2, 6);
    const url = `${base}/?ref=${success.referralCode}&n=${nonce}`;
    if (navigator.share) {
      navigator
        .share({
          title: "Peakhour — launch partner",
          text: "I just applied to the Peakhour launch program. Skip the line:",
          url,
        })
        .catch(() => {
          /* user dismissed */
        });
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success("Referral link copied"))
        .catch(() => toast.error("Could not copy — copy it manually below"));
    }
  }

  if (success) {
    return (
      <div className="w-full space-y-4 text-left">
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <div className="mt-0.5 rounded-full bg-success/15 p-2">
            <Check className="size-4 text-success-on-tint" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">You&apos;re on the launch list</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {success.position
                ? `Position #${success.position.toLocaleString()}`
                : "Position will update on your next visit"}
            </p>
            {success.foundingMember ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-warning-on-tint">
                <Sparkles className="size-3" />
                Founding Member — early-access perks locked in
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm">
            We&apos;ve emailed a confirmation to <strong>{email}</strong>. When we
            approve your spot, we&apos;ll email your sign-in link — no password
            needed.
          </p>
        </div>

        <div className="space-y-2 rounded-lg border p-4">
          <p className="text-sm font-medium">Skip 5 spots</p>
          <p className="text-xs text-muted-foreground">
            Invite a friend with your code; both of you move up the line.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-1.5 font-mono text-xs">
              {success.referralCode}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={shareReferral}
              aria-label="Share referral link"
            >
              <Share2 className="mr-1.5 size-3.5" />
              Share
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const productName = SOURCE_PRODUCT[source];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!submitting) submit();
      }}
      className="w-full space-y-5 text-left"
    >
      {productName ? (
        <p className="text-sm text-muted-foreground">
          You&apos;re joining the waitlist for{" "}
          <span className="font-medium text-foreground">{productName}</span>.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="lp-email">Work email</Label>
        <Input
          id="lp-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
        />
      </div>

      {/* The one optional field. Labelled as optional in the label itself (not
          only in a placeholder, which vanishes on focus and is invisible to a
          screen reader), and the submit button never depends on it — a blank
          answer costs the applicant nothing. */}
      <div className="space-y-2">
        <Label htmlFor="lp-context" className="flex flex-wrap items-baseline gap-x-2">
          What would you love Peakhour to take off your plate?
          <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </Label>
        <Textarea
          id="lp-context"
          rows={3}
          maxLength={CONTEXT_MAX}
          placeholder="One line is plenty — e.g. answering the same WhatsApp questions all day."
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className="resize-none"
        />
      </div>

      <Button type="submit" className="h-11 w-full text-base" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Joining…
          </>
        ) : (
          <>
            Join the waitlist
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We&apos;ll email a confirmation now, and your sign-in link when your spot
        is approved.
      </p>
    </form>
  );
}
