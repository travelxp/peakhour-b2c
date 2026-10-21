"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PaymentModal, type CheckoutResult } from "./payment-modal";
import { TERM_LABEL, type BillingTerm } from "@/lib/billing-terms";
import {
  ADDED_BUSINESS_NAME_MAX,
  addBusinessAction,
  addBusinessErrorCopy,
  addBusinessOutcome,
  cleanBusinessName,
  offerLine,
  pickedPlan,
  planChoices,
  priceParts,
  rememberPendingAdd,
  sessionStore,
  type AddBusinessAnswer,
  type AddBusinessPreview,
  type CatalogPlan,
} from "@/lib/add-business";
import { useAddedBusinessArrival } from "@/hooks/use-added-business-arrival";

/**
 * AddBusinessDialog — buy a plan for ANOTHER business (billing plan P3.2, on
 * the api's P3.1b routes): a name, a plan from the catalog, its price, and Pay.
 *
 * One component in every place a second business is added: the workspace
 * menu, the brand-mismatch flag, the Shopify claim's "a separate brand", and
 * onboarding's add-another. Each passes the name it already knows and where to
 * go once the business exists (`nextFor`).
 *
 * - The price is the preview's: priced for the business being ADDED, with the
 *   campaign's own percent and label (`offerLine`). Never `/plans`' figure,
 *   which is the signed-in business's.
 * - Pay is POST /v1/billing/add-business, and its answer is mounted in
 *   `PaymentModal` exactly as `/checkout`'s is: Stripe embedded, or the
 *   Razorpay / PayU overlay.
 * - The business exists once the payment lands; `useAddedBusinessArrival`
 *   waits for it and switches in. Stripe returns to the billing page, which
 *   finishes that wait (`?addedBusiness=`).
 */

interface PlansResponse {
  purchasable?: boolean;
  plans: CatalogPlan[];
}

/** The overlay's formatting (`payment-modal.tsx`'s `fmtAmount`): fractions
 *  kept, so the price here and the amount the payment step states agree. */
function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function AddBusinessDialog({
  open,
  onOpenChange,
  defaultName = "",
  nextFor,
  freePathHref,
  description,
  onPaymentOpened,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The name the caller already knows (the store's, the brand's). */
  defaultName?: string;
  /** Where to go once the business exists, given its id. */
  nextFor?: (businessId: string) => string;
  /** Where to add a business at no charge, when the plan already covers it. */
  freePathHref?: string;
  /** The line under the title; the caller's reason for being here. */
  description?: string;
  /** The payment surface is opening for this business (the purchase is
   *  committed to a business id). */
  onPaymentOpened?: (businessId: string | null) => void;
}) {
  const [name, setName] = useState(defaultName);
  // The name the preview asks about: settled after typing stops, so a slug
  // check is not sent per keystroke.
  const [askedName, setAskedName] = useState(defaultName);
  useEffect(() => {
    const t = setTimeout(() => setAskedName(name), 400);
    return () => clearTimeout(t);
  }, [name]);
  const [pick, setPick] = useState<{ tier: string | null; term: BillingTerm | null }>({ tier: null, term: null });
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [bought, setBought] = useState<{ businessId: string | null; name: string } | null>(null);
  const [arriving, setArriving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [invoiceNote, setInvoiceNote] = useState<string | null>(null);
  // ★A double click lands twice before React re-renders the disabled button:
  //  this latch refuses the second press synchronously.
  const starting = useRef(false);
  const arrive = useAddedBusinessArrival();

  // ★EACH OPENING STARTS CLEAN (review R1). The instance lives as long as
  //  its page (the switcher's, the whole session): a name typed days ago, an
  //  old refusal, or the name just bought would otherwise greet the next
  //  purchase, one click from a second business of that name. Reset when the
  //  dialog opens, reading the caller's name as it is now.
  const [openSeen, setOpenSeen] = useState(open);
  if (open !== openSeen) {
    setOpenSeen(open);
    if (open) {
      setName(defaultName);
      setAskedName(defaultName);
      setPick({ tier: null, term: null });
      setPayError(null);
      setInvoiceNote(null);
    }
  }

  const plansQ = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => api.get<PlansResponse>("/v1/billing/plans"),
    enabled: open,
    refetchOnWindowFocus: false,
  });
  const { buy, contact } = planChoices(plansQ.data?.plans ?? []);
  const chosen = pickedPlan(buy, pick);
  const chosenPlan = buy.find((p) => p.tier === chosen?.tier) ?? null;
  const cleanName = cleanBusinessName(name);
  const cleanAsked = cleanBusinessName(askedName);

  const previewQ = useQuery({
    queryKey: ["add-business-preview", chosen?.tier, chosen?.term, cleanAsked],
    queryFn: () =>
      api.get<AddBusinessPreview>("/v1/billing/add-business/preview", {
        tier: chosen!.tier,
        term: chosen!.term,
        ...(cleanAsked ? { name: cleanAsked } : {}),
      }),
    enabled: open && !!chosen,
    refetchOnWindowFocus: false,
  });
  const preview = previewQ.data ?? null;
  // ★isPending, never isLoading: a paused (offline) preview is pending and
  //  not fetching, and must still hold Pay shut. A FAILED one is told by
  //  `errorUpdatedAt`, which a refetch never resets.
  const previewWaiting = !!chosen && (previewQ.isPending || name !== askedName);
  const previewFailed = previewQ.data === undefined && previewQ.errorUpdatedAt > 0 && !previewQ.isFetching;

  const buyMut = useMutation({
    mutationFn: (body: { name: string; tier: string; term: BillingTerm }) =>
      api.post<AddBusinessAnswer>("/v1/billing/add-business", body),
  });

  const action = addBusinessAction({
    purchasable: plansQ.data?.purchasable,
    name: cleanName,
    preview,
    previewWaiting,
    previewFailed,
    starting: buyMut.isPending,
    paying: checkout !== null || arriving,
  });

  function pay() {
    if (starting.current || action.disabled || !chosen || !cleanName) return;
    starting.current = true;
    setPayError(null);
    setInvoiceNote(null);
    const forName = cleanName;
    buyMut.mutate(
      { name: forName, tier: chosen.tier, term: chosen.term },
      {
        onSuccess: (res) => {
          const out = addBusinessOutcome(res, forName);
          if (out.kind === "invoice") {
            setInvoiceNote(out.message);
            return;
          }
          if (out.kind === "unknown") {
            setPayError(addBusinessErrorCopy(undefined, undefined));
            return;
          }
          const businessName = out.businessName ?? forName;
          if (out.businessId) {
            rememberPendingAdd(sessionStore(), {
              businessId: out.businessId,
              name: businessName,
              ...(nextFor ? { next: nextFor(out.businessId) } : {}),
              at: Date.now(),
            });
          }
          setBought({ businessId: out.businessId, name: businessName });
          onPaymentOpened?.(out.businessId);
          setCheckout(out.checkout);
        },
        onError: (e: Error) => {
          const code = e instanceof ApiError ? e.code : undefined;
          setPayError(addBusinessErrorCopy(code, e.message));
        },
        onSettled: () => {
          starting.current = false;
        },
      },
    );
  }

  // Razorpay / PayU said the payment went through: wait for the business.
  async function paid() {
    setCheckout(null);
    if (!bought?.businessId) {
      // Paid, with no id to wait on: say so rather than vanish (review R1).
      toast.success("Payment received", {
        description: `${bought?.name || "Your new business"} will appear in the workspace menu in a moment.`,
      });
      setBought(null);
      onOpenChange(false);
      return;
    }
    setArriving(true);
    try {
      await arrive({
        businessId: bought.businessId,
        name: bought.name,
        next: nextFor ? nextFor(bought.businessId) : null,
      });
    } finally {
      setArriving(false);
      setBought(null);
      onOpenChange(false);
    }
  }

  const price = preview?.kind === "new" ? preview.price : undefined;
  const parts = price ? priceParts(price, money) : null;
  const offer = offerLine(price);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          // Never closed under a payment in flight: the wait for the business
          // is what switches the buyer into it.
          if (!o && (arriving || buyMut.isPending)) return;
          onOpenChange(o);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a business</DialogTitle>
            <DialogDescription>
              {description ??
                "Each business has its own plan, content, channels and reporting. You pay for this one now; it's created as soon as the payment goes through."}
            </DialogDescription>
          </DialogHeader>

          {arriving ? (
            <div className="flex items-center gap-3 py-6 text-sm" role="status">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
              <span>Payment received. Setting up {bought?.name || "your business"}…</span>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="add-business-name">Business name</Label>
                <Input
                  id="add-business-name"
                  value={name}
                  maxLength={ADDED_BUSINESS_NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Table Story"
                  disabled={buyMut.isPending || checkout !== null}
                />
              </div>

              {plansQ.isPending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading plans" />
                </div>
              ) : plansQ.data === undefined ? (
                <p className="text-sm text-muted-foreground">Couldn&apos;t load plans. Please try again.</p>
              ) : buy.length === 0 ? (
                <p className="text-sm text-muted-foreground">No plans are on sale right now.</p>
              ) : (
                <div className="space-y-3">
                  <div role="radiogroup" aria-label="Plan" className="grid gap-2">
                    {buy.map((p) => {
                      const active = p.tier === chosen?.tier;
                      return (
                        <button
                          key={p.tier}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={buyMut.isPending || checkout !== null}
                          onClick={() => setPick((prev) => ({ ...prev, tier: p.tier }))}
                          className={cn(
                            "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                            active ? "border-primary ring-1 ring-primary" : "hover:border-foreground/30",
                          )}
                        >
                          <span className="font-medium">{p.name}</span>
                          {p.tagline ? <span className="block text-xs text-muted-foreground">{p.tagline}</span> : null}
                        </button>
                      );
                    })}
                  </div>

                  {chosenPlan && chosenPlan.terms.length > 1 && (
                    <div role="radiogroup" aria-label="Billing term" className="inline-flex rounded-lg border p-0.5">
                      {chosenPlan.terms.map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={chosen?.term === t}
                          disabled={buyMut.isPending || checkout !== null}
                          onClick={() => setPick((prev) => ({ ...prev, term: t }))}
                          className={cn(
                            "rounded-md px-3 py-1 text-xs font-medium transition",
                            chosen?.term === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {TERM_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm" aria-live="polite">
                    {parts ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-semibold">{parts.now}</span>
                          {parts.was ? <s className="text-xs text-muted-foreground">{parts.was}</s> : null}
                        </div>
                        {offer ? <p className="mt-1 text-xs text-success-on-tint">{offer}</p> : null}
                      </>
                    ) : previewWaiting ? (
                      <span className="inline-block h-6 w-28 animate-pulse rounded bg-muted" aria-label="Loading the price" />
                    ) : (
                      <span className="text-muted-foreground">The payment step shows the price before you pay.</span>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      No free trial: a business you add is billed from the day you buy it.
                    </p>
                  </div>

                  {contact.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {contact.map((p, i) => (
                        <span key={p.tier}>
                          {i > 0 ? " · " : ""}
                          {p.name}:{" "}
                          <a
                            className="underline underline-offset-2"
                            href={`mailto:hello@peakhour.ai?subject=${encodeURIComponent(`Enquiry: ${p.name}`)}`}
                          >
                            talk to us
                          </a>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )}

              {invoiceNote ? (
                <p role="alert" className="rounded-md bg-muted px-3 py-2 text-sm">
                  {invoiceNote}
                </p>
              ) : null}
              {payError ? (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {payError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2">
                {action.note ? (
                  <span
                    role={action.refused ? "alert" : undefined}
                    className={cn("mr-auto text-xs", action.refused ? "text-destructive" : "text-muted-foreground")}
                  >
                    {action.note}
                  </span>
                ) : null}
                {action.notNeeded && freePathHref ? (
                  <Button asChild variant="outline">
                    <Link href={freePathHref} onClick={() => onOpenChange(false)}>
                      Add it at no charge
                    </Link>
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={buyMut.isPending}>
                  Cancel
                </Button>
                <Button onClick={pay} disabled={action.disabled}>
                  {action.label}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PaymentModal
        checkout={checkout}
        onOpenChange={(o) => {
          // Dismissed without paying: nothing was bought, and Pay opens again.
          if (!o) {
            setCheckout(null);
            setBought(null);
          }
        }}
        onSuccess={() => void paid()}
      />
    </>
  );
}
