"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PaymentModal, type CheckoutResult } from "./payment-modal";

/**
 * UpgradePlanDialog — the plan-picker that replaces the old mailto on
 * Settings › Billing. Lists the purchasable plans (GET /v1/billing/plans,
 * priced in the buyer's own currency by the server), lets the user pick one,
 * then POSTs /v1/billing/checkout and hands the returned gateway payload to
 * PaymentModal — which renders Stripe/Razorpay/PayU on-site. The gateway is
 * chosen server-side from the org's country, so there's nothing region-
 * specific here.
 */

interface PurchasablePlan {
  tier: string;
  name: string;
  tagline?: string;
  products: string[];
  amount: number;
  yearly: number | null;
  currency: string;
  interval: "month";
  trialDays: number;
  taxIncluded: boolean;
  recommended: boolean;
  isCurrent: boolean;
}
interface PlansResponse {
  country: string;
  purchasable: boolean;
  plans: PurchasablePlan[];
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function UpgradePlanDialog({
  open,
  onOpenChange,
  onPurchased,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Fired after a successful payment so the host can refresh billing state. */
  onPurchased?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);

  const plansQ = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => api.get<PlansResponse>("/v1/billing/plans"),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const checkoutMut = useMutation({
    mutationFn: (tier: string) =>
      api.post<CheckoutResult>("/v1/billing/checkout", { tier }),
    onSuccess: (res) => setCheckout(res),
    onError: (e: Error) => toast.error(e.message ?? "Couldn't start checkout"),
  });

  const plans = plansQ.data?.plans ?? [];
  const purchasable = plansQ.data?.purchasable ?? true;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose a plan</DialogTitle>
            <DialogDescription>
              {purchasable
                ? "Pick a plan to upgrade — you'll pay securely on the next step."
                : "Payments aren't available in your country yet. We'll let you know as soon as they are."}
            </DialogDescription>
          </DialogHeader>

          {plansQ.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : plansQ.isError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Couldn&apos;t load plans. Please try again.
            </p>
          ) : plans.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No plans available right now.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => {
                const active = selected === p.tier;
                const disabled = p.isCurrent || !purchasable;
                return (
                  <button
                    key={p.tier}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelected(p.tier)}
                    className={cn(
                      "relative rounded-lg border p-4 text-left transition",
                      active
                        ? "border-primary ring-1 ring-primary"
                        : "hover:border-foreground/30",
                      disabled && "cursor-not-allowed opacity-60",
                    )}
                  >
                    {p.recommended && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Sparkles className="size-3" />
                        Popular
                      </span>
                    )}
                    <div className="font-medium">{p.name}</div>
                    {p.tagline && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {p.tagline}
                      </div>
                    )}
                    <div className="mt-2 text-lg font-semibold">
                      {formatPrice(p.amount, p.currency)}
                      <span className="text-xs font-normal text-muted-foreground">
                        /mo
                      </span>
                    </div>
                    {p.trialDays > 0 && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400">
                        {p.trialDays}-day free trial
                      </div>
                    )}
                    {p.isCurrent && (
                      <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                        Current plan
                      </span>
                    )}
                    {active && !disabled && (
                      <Check className="absolute bottom-3 right-3 size-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selected || !purchasable || checkoutMut.isPending}
              onClick={() => selected && checkoutMut.mutate(selected)}
            >
              {checkoutMut.isPending ? "Starting…" : "Continue to payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentModal
        checkout={checkout}
        onOpenChange={(o) => {
          if (!o) setCheckout(null);
        }}
        onSuccess={() => {
          setCheckout(null);
          onOpenChange(false);
          onPurchased?.();
        }}
      />
    </>
  );
}
