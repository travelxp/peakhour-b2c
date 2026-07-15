"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, Sparkles, Share2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Launch-partner apply form. Applying lands a waitlist_signups row
 * (POST /v1/waitlist/signup). Ops approves in the CMS, which unlocks
 * magic-link sign-in.
 *
 * Deliberately email-only: we don't ask the applicant to pick Commerce vs
 * Marketing or fill in business details. When they arrive from a Shopify /
 * WordPress link the `source` is already known (passed as a prop from the
 * server page's ?source param) and the API derives the product cohort from
 * it — Shopify → Commerce, WordPress → Marketing — so the choice is never
 * put to the user.
 */
type SignupSource = "shopify" | "wordpress" | "direct";

/** Friendly product name for a known entry surface, for a light confirmation line. */
const SOURCE_PRODUCT: Partial<Record<SignupSource, string>> = {
  shopify: "Peakhour Commerce",
  wordpress: "Peakhour Marketing",
};

export function LaunchPartnerForm({ source = "direct" }: { source?: SignupSource }) {
  const [email, setEmail] = useState("");
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
      const body: Record<string, unknown> = {
        email,
        intent: "general",
        // Direct landing-page application (not an in-app feature gate).
        channel: "direct",
        // Entry surface — the API derives the product cohort from it, so the
        // applicant is never asked to choose Commerce vs Marketing.
        signupSource: source,
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
          <div className="mt-0.5 rounded-full bg-green-100 p-2 dark:bg-green-950">
            <Check className="size-4 text-green-700 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">You&apos;re on the launch list</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {success.position
                ? `Position #${success.position.toLocaleString()}`
                : "Position will update on your next visit"}
            </p>
            {success.foundingMember ? (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
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
