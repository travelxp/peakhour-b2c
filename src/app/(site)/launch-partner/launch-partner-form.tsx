"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ShoppingBag,
  Megaphone,
  Loader2,
  Check,
  Sparkles,
  Share2,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Launch-partner apply form. Replaces the old mailto capture — applying now
 * lands a waitlist_signups row (POST /v1/waitlist/signup) tagged with the
 * product cohort(s) the applicant picked. Ops approves in the CMS, which is
 * what unlocks magic-link sign-in. No email address is shown anywhere.
 *
 * Mirrors the waitlist signup + success card from UpgradeDrawer (referral
 * code, founding-member badge, position) so the two surfaces feel identical;
 * the launch-partner-specific bit is the Commerce/Marketing product picker.
 */
type ProductInterest = "commerce" | "marketing";

const PRODUCTS: {
  key: ProductInterest;
  label: string;
  blurb: string;
  Icon: typeof ShoppingBag;
}[] = [
  {
    key: "commerce",
    label: "Peakhour Commerce",
    blurb: "Shopify / WooCommerce / D2C — recover carts, re-engage, grow revenue.",
    Icon: ShoppingBag,
  },
  {
    key: "marketing",
    label: "Peakhour Marketing",
    blurb: "Publishers & brands — create, optimize and automate campaigns.",
    Icon: Megaphone,
  },
];

export function LaunchPartnerForm() {
  const [email, setEmail] = useState("");
  const [products, setProducts] = useState<ProductInterest[]>([]);
  const [businessContext, setBusinessContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    referralCode: string;
    foundingMember: boolean;
    position: number | null;
  } | null>(null);

  function toggleProduct(key: ProductInterest) {
    setProducts((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  async function submit() {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    if (products.length === 0) {
      toast.error("Pick at least one — Commerce or Marketing");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        email,
        intent: "general",
        productInterest: products,
        // Direct landing-page application (not an in-app feature gate).
        channel: "direct",
      };
      if (businessContext) body.businessContext = businessContext;

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
            When we approve your spot, you&apos;ll sign in with{" "}
            <strong>{email}</strong> — we&apos;ll email your link. No password
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!submitting) submit();
      }}
      className="w-full space-y-5 text-left"
    >
      <div className="space-y-2">
        <Label>What are you most interested in?</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRODUCTS.map(({ key, label, blurb, Icon }) => {
            const selected = products.includes(key);
            return (
              <button
                type="button"
                key={key}
                onClick={() => toggleProduct(key)}
                aria-pressed={selected}
                className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-foreground/20 hover:bg-muted/40"
                }`}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-lg border bg-muted/40 text-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-muted-foreground">{blurb}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Pick one or both — you can change your mind later.
        </p>
      </div>

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

      <div className="space-y-2">
        <Label htmlFor="lp-context">
          Tell us about your business
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (optional — helps us prioritize)
          </span>
        </Label>
        <Textarea
          id="lp-context"
          value={businessContext}
          onChange={(e) => setBusinessContext(e.target.value)}
          placeholder="e.g. Shopify store doing ~$40k/mo; we want to recover carts and re-engage customers on WhatsApp."
          maxLength={2048}
          rows={4}
        />
      </div>

      <Button type="submit" className="h-11 w-full text-base" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            Apply to join
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Applying adds you to the waitlist. We&apos;ll email your sign-in link
        when your spot is approved.
      </p>
    </form>
  );
}
