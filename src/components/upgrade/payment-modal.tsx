"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { toast } from "sonner";

import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

/**
 * On-site payment overlay for native subscription checkout. The API's
 * /v1/billing/checkout returns a { gateway, embed } payload; this renders the
 * matching gateway's native surface:
 *   • stripe   → embedded Checkout mounted INSIDE our modal (desktop) /
 *                bottom sheet (mobile).
 *   • razorpay → Razorpay Checkout.js overlay (its own full-screen surface).
 *   • payu     → PayU Bolt overlay (its own surface).
 * Only Stripe renders inside our shell; Razorpay/PayU bring their own overlays,
 * so for those we just launch the SDK and render nothing.
 */

export type CheckoutResult =
  | { gateway: "stripe"; embed: { kind: "stripe"; clientSecret: string; publishableKey: string } }
  | {
      gateway: "razorpay";
      embed: {
        kind: "razorpay";
        subscriptionId: string;
        keyId: string;
        prefill?: { name?: string; email?: string };
      };
    }
  | { gateway: "payu"; embed: { kind: "payu"; action: string; params: Record<string, string> } };

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
    return <StripeEmbedded embed={checkout.embed} onOpenChange={onOpenChange} />;
  }
  return (
    <GatewayLauncher checkout={checkout} onOpenChange={onOpenChange} onSuccess={onSuccess} />
  );
}

// ── Stripe: embedded Checkout inside our responsive shell ────────────────────

function StripeEmbedded({
  embed,
  onOpenChange,
}: {
  embed: Extract<CheckoutResult, { gateway: "stripe" }>["embed"];
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
    <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
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

function GatewayLauncher({
  checkout,
  onOpenChange,
  onSuccess,
}: {
  checkout: Extract<CheckoutResult, { gateway: "razorpay" | "payu" }>;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  // Guard so the overlay is launched exactly once per checkout payload.
  const launched = useRef(false);

  useEffect(() => {
    if (launched.current) return;
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
            name: "Peakhour",
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
  }, [checkout, onOpenChange, onSuccess]);

  // The gateway renders its own overlay; nothing for us to draw.
  return null;
}
