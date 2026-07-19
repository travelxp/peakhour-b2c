"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * On-site payment overlay for native subscription checkout. The API's
 * /v1/billing/checkout returns a { gateway, embed, summary } payload; this
 * renders the matching gateway's native surface:
 *   • stripe   → embedded Checkout mounted INSIDE our modal (desktop) /
 *                bottom sheet (mobile).
 *   • razorpay → Razorpay Checkout.js overlay (its own full-screen surface).
 *   • payu     → PayU Bolt overlay (its own surface).
 * The buyer-facing `summary` (seller entity + tax label, Phase 6) renders above
 * the Stripe iframe and — for India — in a pre-overlay step that also offers
 * optional GSTIN capture (input credit) before the Razorpay surface opens.
 */

/** Buyer-facing checkout summary from the api — the tax label is derived from
 *  the SAME plan flag that stamps the charge, so copy and money always agree. */
export interface CheckoutSummary {
  tier: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  buyerCountry: string;
  taxIncluded: boolean;
  taxLabel: string;
  sellerName: string;
  sellerCountry: string | null;
  merchantOfRecord: "self" | "stripe";
}

export type CheckoutResult =
  | {
      gateway: "stripe";
      embed: { kind: "stripe"; clientSecret: string; publishableKey: string };
      summary?: CheckoutSummary;
    }
  | {
      gateway: "razorpay";
      embed: {
        kind: "razorpay";
        subscriptionId: string;
        keyId: string;
        prefill?: { name?: string; email?: string };
      };
      summary?: CheckoutSummary;
    }
  | {
      gateway: "payu";
      embed: { kind: "payu"; action: string; params: Record<string, string> };
      summary?: CheckoutSummary;
    };

declare global {
  interface Window {
    // Razorpay Checkout.js + PayU Bolt are external globals — we call a narrow slice.
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
    bolt?: { launch: (data: Record<string, string>, handlers: Record<string, unknown>) => void };
  }
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") return reject(new Error("no document"));
    if (document.getElementById(id)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.id = id;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      // Remove the failed tag so a later attempt actually re-injects instead of
      // seeing a dead tag by id and resolving against a missing global.
      s.remove();
      reject(new Error(`Failed to load ${src}`));
    };
    document.body.appendChild(s);
  });
}

function SummaryLine({ summary }: { summary: CheckoutSummary }) {
  return (
    <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium truncate">{summary.tier}</span>
        <span className="font-semibold whitespace-nowrap">
          {summary.currency} {summary.amount}/{summary.interval === "year" ? "yr" : "mo"}
        </span>
      </div>
      <div className="text-muted-foreground mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span>{summary.taxLabel}</span>
        <span>
          Sold by {summary.sellerName}
          {summary.sellerCountry ? ` (${summary.sellerCountry})` : ""}
        </span>
      </div>
    </div>
  );
}

interface PaymentModalProps {
  checkout: CheckoutResult | null;
  onOpenChange: (open: boolean) => void;
  /** Fired when the buyer completes the gateway flow (Razorpay/PayU handlers);
   *  Stripe redirects to its return_url so it closes via navigation. */
  onSuccess?: () => void;
}

export function PaymentModal({ checkout, onOpenChange, onSuccess }: PaymentModalProps) {
  if (!checkout) return null;
  if (checkout.gateway === "stripe") {
    return (
      <StripeEmbedded
        embed={checkout.embed}
        summary={checkout.summary}
        onOpenChange={onOpenChange}
      />
    );
  }
  return (
    <GatewayLauncher checkout={checkout} onOpenChange={onOpenChange} onSuccess={onSuccess} />
  );
}

// ── Stripe: embedded Checkout inside our responsive shell ────────────────────

function StripeEmbedded({
  embed,
  summary,
  onOpenChange,
}: {
  embed: Extract<CheckoutResult, { gateway: "stripe" }>["embed"];
  summary?: CheckoutSummary;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  // useIsMobile resolves false→real inside an effect; gate the first paint on a
  // `mounted` flag so the correct shell (Dialog vs Drawer) is chosen ONCE —
  // otherwise the Stripe embedded iframe mounts in Dialog then remounts in
  // Drawer on mobile ("multiple Embedded Checkout objects").
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Missing keys (e.g. STRIPE_PUBLISHABLE_KEY unset) would make loadStripe('')
  // reject into a blank modal — fail friendly instead.
  const invalid = !embed.publishableKey || !embed.clientSecret;
  useEffect(() => {
    if (invalid) {
      toast.error("Payment isn't available right now. Please try again later.");
      onOpenChange(false);
    }
  }, [invalid, onOpenChange]);

  // loadStripe returns a promise; memoise per publishable key so we don't
  // re-init Stripe.js on every render.
  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (invalid ? null : loadStripe(embed.publishableKey)),
    [invalid, embed.publishableKey],
  );
  const options = useMemo(() => ({ clientSecret: embed.clientSecret }), [embed.clientSecret]);

  if (invalid || !mounted) return null;

  const body = (
    <>
      {summary ? (
        <div className="px-1 pb-3">
          <SummaryLine summary={summary} />
        </div>
      ) : null}
      <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Complete your payment</DrawerTitle>
          </DrawerHeader>
          {/* data-vaul-no-drag: let the Stripe iframe scroll without vaul
              hijacking the touch as a drag-to-dismiss gesture. */}
          <div data-vaul-no-drag className="overflow-y-auto px-2 pb-4">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Complete your payment</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

// ── Razorpay / PayU: launch the gateway's own overlay ────────────────────────
//
// ⚠️ VERIFY(sdk): the Razorpay Checkout.js + PayU Bolt call shapes below follow
// the vendors' documented signatures but are UNTESTED until the IN test keys
// land — round-trip both before enabling. PayU is the IN backup gateway.

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const PAYU_BOLT_SRC = "https://jssdk.payu.in/bolt/bolt.min.js";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

function GatewayLauncher({
  checkout,
  onOpenChange,
  onSuccess,
}: {
  checkout: Extract<CheckoutResult, { gateway: "razorpay" | "payu" }>;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const summary = checkout.summary;
  // India self-MoR: offer optional GSTIN capture (buyer input credit on the GST
  // invoice) BEFORE handing off to the gateway overlay. Skipping is fine — the
  // field also lives in Settings → Billing. Non-IN goes straight to the overlay.
  const needsGstGate = summary?.buyerCountry === "IN" && summary.merchantOfRecord === "self";
  const [gate, setGate] = useState<"checking" | "prompt" | "launch">(
    needsGstGate ? "checking" : "launch",
  );
  const [gstin, setGstin] = useState("");
  const [savingGstin, setSavingGstin] = useState(false);

  useEffect(() => {
    if (!needsGstGate) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<{ billingProfile?: { gstin?: string } }>("/v1/billing/profile");
        if (cancelled) return;
        setGate(r?.billingProfile?.gstin ? "launch" : "prompt");
      } catch {
        if (!cancelled) setGate("launch"); // never block payment on the profile read
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsGstGate]);

  // Guard so the overlay is launched exactly once per checkout payload.
  const launched = useRef(false);

  useEffect(() => {
    if (gate !== "launch" || launched.current) return;
    launched.current = true;

    (async () => {
      try {
        if (checkout.gateway === "razorpay") {
          const { subscriptionId, keyId, prefill } = checkout.embed;
          await loadScript(RAZORPAY_SRC, "razorpay-checkout");
          if (!window.Razorpay) throw new Error("Razorpay SDK unavailable");
          const rzp = new window.Razorpay({
            key: keyId,
            subscription_id: subscriptionId,
            // Seller identity is data-driven from the billing entity's invoice
            // branding (Phase 6) — never hardcoded.
            name: summary?.sellerName || "Peakhour",
            ...(summary ? { description: `${summary.tier} — ${summary.taxLabel}` } : {}),
            ...(prefill ? { prefill } : {}),
            handler: () => {
              onSuccess?.();
              onOpenChange(false);
            },
            modal: { ondismiss: () => onOpenChange(false) },
          });
          rzp.open();
        } else {
          // PayU Bolt: launch with the server-built params (incl. hash).
          await loadScript(PAYU_BOLT_SRC, "payu-bolt");
          if (!window.bolt) throw new Error("PayU Bolt SDK unavailable");
          window.bolt.launch(checkout.embed.params, {
            responseHandler: (res: { response?: { txnStatus?: string } }) => {
              if (res?.response?.txnStatus === "SUCCESS") onSuccess?.();
              onOpenChange(false);
            },
            catchException: () => {
              toast.error("Payment could not be started. Please try again.");
              onOpenChange(false);
            },
          });
        }
      } catch {
        toast.error("Payment could not be started. Please try again.");
        onOpenChange(false);
      }
    })();
  }, [gate, checkout, onOpenChange, onSuccess, summary]);

  const continueToPayment = async () => {
    const value = gstin.trim().toUpperCase();
    if (value) {
      if (!GSTIN_RE.test(value)) {
        toast.error("That GSTIN doesn't look right — it's 15 characters, e.g. 22AAAAA0000A1Z5");
        return;
      }
      setSavingGstin(true);
      try {
        // Merge-PUT: only touches gstin (+ derives place of supply from it).
        await api.put("/v1/billing/profile", { gstin: value, placeOfSupplyState: value.slice(0, 2) });
      } catch {
        toast.error("Couldn't save the GSTIN — you can add it later in Settings → Billing.");
      } finally {
        setSavingGstin(false);
      }
    }
    setGate("launch");
  };

  if (gate === "prompt" && summary) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete your purchase</DialogTitle>
          </DialogHeader>
          <SummaryLine summary={summary} />
          <div className="space-y-1">
            <label htmlFor="checkout-gstin" className="text-xs font-medium text-muted-foreground">
              GSTIN (optional — for your input tax credit)
            </label>
            <Input
              id="checkout-gstin"
              value={gstin}
              placeholder="22AAAAA0000A1Z5"
              onChange={(e) => setGstin(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Businesses: add your GSTIN so it prints on your tax invoice. You can also add it later
              in Settings → Billing.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGate("launch")} disabled={savingGstin}>
              Skip
            </Button>
            <Button onClick={continueToPayment} disabled={savingGstin}>
              {savingGstin ? "Saving…" : "Continue to payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // The gateway renders its own overlay; nothing for us to draw while checking
  // or once launched.
  return null;
}
