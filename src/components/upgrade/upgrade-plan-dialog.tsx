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
import { checkoutAction, type CheckoutPreview } from "@/lib/checkout-preview";
import {
  TERM_LABEL,
  currentOnTerm,
  priceForTerm,
  termOptions,
  termSuffix,
  type BillingTerm,
  type TermPrice,
} from "@/lib/billing-terms";

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
  /** Every term the plan sells, priced as checkout charges it (P3.1a): Suite
   *  monthly and yearly, Agency quarterly and yearly. Absent on an older api. */
  termPrices?: TermPrice[];
  trialDays: number;
  taxIncluded: boolean;
  recommended: boolean;
  isCurrent: boolean;
  /** The term the business holds this plan on (a billed line), or null: the
   *  plan is current on that term only; another term is a plan change (P4.2). */
  heldTerm?: BillingTerm | null;
  /** Will THIS purchase include the plan's free trial? True when the plan offers
   *  trial days AND the org has never held the product (one trial per product,
   *  ever). The trial always collects a card — it runs at the gateway and defers
   *  the first charge; it never skips payment details. */
  trialApplies: boolean;
  /** Priced at 0 WITH a tagline — talk to sales, not a buy button. */
  contactSales?: boolean;
  /** Spans more than one product (Agency/Enterprise). */
  bundle?: boolean;
  /** 0..100 from the org's connected integrations; 0 = not recommended. */
  recommendScore?: number;
  /** e.g. "Works with your Shopify" — the WHY behind the badge. */
  recommendReason?: string;
}
interface PlansResponse {
  country: string;
  purchasable: boolean;
  plans: PurchasablePlan[];
  /** Server-side grouping. Optional so an older api keeps working — the
   *  component falls back to deriving the groups from the flat list. */
  groups?: {
    recommended: PurchasablePlan[];
    others: PurchasablePlan[];
    bundles: PurchasablePlan[];
  };
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
  // The billing term the buyer picked; null = the default below.
  const [termPick, setTermPick] = useState<BillingTerm | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);

  const plansQ = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => api.get<PlansResponse>("/v1/billing/plans"),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  // Checkout has four outcomes:
  //   • a gateway payment surface — first product on this gateway. A trial does
  // NOT skip this step: the card is collected here and the first charge is
  // deferred to trial end (product decision 2026-07-28, no no-card trials).
  //   • "trial_started" — the org already has a live subscription, so the card is
  // already on file. Nothing is collected or charged; the product attaches to
  // that subscription when the trial ends.
  //   • "added" — same, but with no trial left on this product, so the prorated
  // top-up was charged off-session against the saved mandate.
  //   • "invoice_required" — India RBI, total above the auto-mandate cap.
  const checkoutMut = useMutation({
    mutationFn: ({ tier, term }: { tier: string; term: BillingTerm }) =>
      api.post<
        | CheckoutResult
        | { mode: "added"; tier: string; tierLabel?: string }
        | {
            mode: "trial_started";
            tier: string;
            tierLabel?: string;
            trialDays: number;
            trialEndsAt: string;
          }
        | { mode: "invoice_required"; tier: string; tierLabel?: string }
      >("/v1/billing/checkout", { tier, term }),
    onSuccess: (res) => {
      if (res && "mode" in res && res.mode === "trial_started") {
        toast.success(`${res.tierLabel || res.tier} added to your subscription`, {
          description: `Free for ${res.trialDays} days — nothing to pay now. Billed with your other products from ${new Date(res.trialEndsAt).toLocaleDateString()}.`,
        });
        onOpenChange(false);
        onPurchased?.();
        return;
      }
      if (res && "mode" in res && res.mode === "added") {
        toast.success(`${res.tierLabel || res.tier} added to your subscription`);
        onOpenChange(false);
        onPurchased?.();
        return;
      }
      // India RBI: a total above the auto-mandate cap (₹1L) can't be auto-debited,
      // so it's billed by invoice instead of opening a payment surface.
      if (res && "mode" in res && res.mode === "invoice_required") {
        toast.success(`${res.tierLabel || res.tier} — we'll email you an invoice to pay`, {
          description: "This plan is billed by invoice (bank rules cap auto-debit amounts).",
        });
        onOpenChange(false);
        onPurchased?.();
        return;
      }
      setCheckout(res as CheckoutResult);
    },
    onError: (e: Error) => toast.error(e.message ?? "Couldn't start checkout"),
  });

  // NOTE: there is deliberately no separate "start trial" mutation. The old
  // POST /v1/billing/trial granted a gateway-less no-card trial and now returns
  // 410 — a trial is a property of checkout, so both paths run through
  // checkoutMut above and the card is always collected first.

  const plans = plansQ.data?.plans ?? [];
  const purchasable = plansQ.data?.purchasable ?? true;
  const selectedPlan = plans.find((p) => p.tier === selected) ?? null;
  // The terms any plan sells; monthly first when sold, as before terms existed.
  const terms = termOptions(plans);
  const term: BillingTerm = termPick ?? (terms.includes("monthly") ? "monthly" : terms[0] ?? "monthly");
  // What the selected card charges, and so the term checkout sends: Agency
  // under "Monthly" checks out quarterly, the price its card shows.
  const selectedPrice = selectedPlan ? priceForTerm(selectedPlan, term) : null;
  // What checkout would do with the selection (D21): a plain purchase, a
  // switch from the plan held (and when it is first charged), or a refusal.
  // Advisory: checkout decides again, so a failed preview still lets the buyer
  // continue, and checkout's own error is what they then see.
  const previewQ = useQuery({
    queryKey: ["billing-checkout-preview", selectedPlan?.tier, selectedPrice?.term],
    queryFn: () =>
      api.get<CheckoutPreview>("/v1/billing/checkout/preview", {
        tier: selectedPlan!.tier,
        term: selectedPrice!.term,
      }),
    enabled: open && !!selectedPlan && !!selectedPrice,
    refetchOnWindowFocus: false,
  });
  const preview = previewQ.data ?? null;
  // Waiting on THIS selection's answer, so the button never says "Continue"
  // and then turns into a switch. A failed preview is `error`, not pending: it
  // never holds Continue shut.
  const previewWaiting = !!selectedPlan && !!selectedPrice && previewQ.isPending;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const action = checkoutAction(selectedPlan, preview, fmtDate);
  const busy = checkoutMut.isPending;

  // Three sections answering three different questions: what should I add next,
  // what else exists, and what if I've outgrown per-product pricing. Bundles are
  // SEPARATED rather than sorted down — Agency at ₹24,999 next to a ₹1,499
  // product reads as a mistake rather than a choice, which is what the team saw
  // when everything shared one flat grid.
  //
  // The server groups; this falls back to deriving them so an older api (or a
  // cached response) still renders something sensible instead of nothing.
  const groups = plansQ.data?.groups ?? {
    recommended: plans.filter((p) => !p.bundle && (p.recommendScore ?? 0) > 0),
    others: plans.filter((p) => !p.bundle && !((p.recommendScore ?? 0) > 0)),
    bundles: plans.filter((p) => p.bundle),
  };
  const sections = [
    {
      key: "recommended",
      title: "Recommended for you",
      blurb: "Based on what you've already connected.",
      items: groups.recommended,
    },
    {
      key: "others",
      // Only call them "other" when something was recommended above; with no
      // connections there is no "other" to be other than.
      title: groups.recommended.length > 0 ? "Other products" : "Products",
      blurb: undefined as string | undefined,
      items: groups.others,
    },
    {
      key: "bundles",
      title: "For larger teams",
      blurb: "Every product in one plan — for agencies and multi-brand businesses.",
      items: groups.bundles,
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Wide enough for two comfortable columns (plan names run long, e.g.
            "Peakhour.ai Commerce: Paid") and capped in height so a growing
            catalogue scrolls inside the dialog instead of overflowing it. */}
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose a plan</DialogTitle>
            <DialogDescription>
              {purchasable
                ? "Pick a plan to upgrade — you'll add your card securely on the next step. Plans with a free trial aren't charged until the trial ends."
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
            <div className="space-y-5">
              {terms.length > 1 && (
                <div role="radiogroup" aria-label="Billing term" className="inline-flex rounded-lg border p-0.5">
                  {terms.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={term === t}
                      onClick={() => setTermPick(t)}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-medium transition",
                        term === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {TERM_LABEL[t]}
                    </button>
                  ))}
                </div>
              )}
              {sections.map((section) =>
                section.items.length === 0 ? null : (
                  <div key={section.key}>
                    <div className="mb-2">
                      <p className="text-sm font-medium">{section.title}</p>
                      {section.blurb ? (
                        <p className="text-xs text-muted-foreground">{section.blurb}</p>
                      ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {section.items.map((p) => {
                        const active = selected === p.tier;
                        const price = p.contactSales ? null : priceForTerm(p, term);
                        // The plan held on this very term is not for sale again;
                        // the same plan on another term is a switch (D21).
                        const current = currentOnTerm(p, price?.term);
                        // A contact-sales plan has nothing to select — its action
                        // is an email, not a checkout — so it is never disabled
                        // for being unpurchasable, only for being current. A plan
                        // with no sellable term has nothing to check out.
                        const disabled = current || (!purchasable && !p.contactSales) || (!p.contactSales && !price);
                        return (
                          <button
                            key={p.tier}
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              p.contactSales
                                ? window.open(
                                    `mailto:hello@peakhour.ai?subject=${encodeURIComponent(`Enquiry: ${p.name}`)}`,
                                    "_blank",
                                  )
                                : setSelected(p.tier)
                            }
                            className={cn(
                              "flex flex-col rounded-lg border p-4 text-left transition",
                              active
                                ? "border-primary ring-1 ring-primary"
                                : "hover:border-foreground/30",
                              disabled && "cursor-not-allowed opacity-60",
                            )}
                          >
                            {/* Header row: the badges sit INLINE beside the name
                                rather than absolutely positioned, so a long plan
                                name can no longer run underneath them. */}
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium leading-tight">{p.name}</span>
                              <span className="flex shrink-0 items-center gap-1">
                                {/* A reason beats a bare "Popular": the badge is
                                    only credible if it says why. Falls back to the
                                    static flag when nothing is connected. */}
                                {p.recommendReason ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    <Sparkles className="size-3" />
                                    For you
                                  </span>
                                ) : p.recommended ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    <Sparkles className="size-3" />
                                    Popular
                                  </span>
                                ) : null}
                                {active && !disabled && (
                                  <Check className="size-4 text-primary" />
                                )}
                              </span>
                            </div>

                            {p.recommendReason ? (
                              <p className="mt-1 text-xs leading-snug text-primary">
                                {p.recommendReason}
                              </p>
                            ) : p.tagline ? (
                              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                                {p.tagline}
                              </p>
                            ) : null}

                            {/* Price pinned to the bottom so cards of differing
                                tagline length still line their prices up. */}
                            <div className="mt-auto pt-3">
                              <div className="text-lg font-semibold">
                                {p.contactSales ? (
                                  <span className="text-base">Contact sales</span>
                                ) : price ? (
                                  <>
                                    {formatPrice(price.amount, p.currency)}
                                    <span className="text-xs font-normal text-muted-foreground">
                                      {termSuffix(price.term)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-base">Not available</span>
                                )}
                              </div>
                              {/* Not sold on the picked term (Agency is quarterly
                                  and yearly only): say which term this price is. */}
                              {price?.fallback && (
                                <div className="text-xs text-muted-foreground">
                                  Billed {TERM_LABEL[price.term].toLowerCase()}
                                </div>
                              )}
                              {!p.contactSales && p.trialDays > 0 && p.trialApplies && (
                                <div className="text-xs text-success-on-tint">
                                  {p.trialDays}-day free trial · card required
                                </div>
                              )}
                              {current && (
                                <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                                  Current plan
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          {/* ONE action. A trial is not a separate, lower-commitment path any
              more — it runs through the same checkout, which collects the card
              and defers the first charge. The copy states both facts up front so
              the card request on the next step is never a surprise. */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {action.note ? (
              <span
                role={action.refused ? "alert" : undefined}
                className={cn("mr-auto text-xs", action.refused ? "text-destructive" : "text-muted-foreground")}
              >
                {action.note}
              </span>
            ) : null}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selected || !selectedPrice || !purchasable || busy || previewWaiting || action.refused}
              onClick={() => selected && selectedPrice && checkoutMut.mutate({ tier: selected, term: selectedPrice.term })}
            >
              {checkoutMut.isPending ? "Starting…" : action.label}
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
