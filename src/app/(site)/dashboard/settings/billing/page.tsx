"use client";

import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/hooks/use-locale";
import { useDashboardOrg, useExtendTrial } from "@/hooks/use-dashboard-org";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { featureLabel } from "@/lib/pricing";
import { useQueryClient } from "@tanstack/react-query";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { TaxAndInvoices } from "@/components/settings-tax-invoices";
import { UpgradePlanDialog } from "@/components/upgrade/upgrade-plan-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBillingSummary, BILLING_SUMMARY_KEY } from "@/hooks/use-billing-summary";

/** Money in the buyer's own currency. Falls back to "CUR 1499" when Intl can't
 *  resolve the code, so a price never renders as a bare number. */
function money(amount: number, currency: string | null): string {
  if (!currency) return String(amount);
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

// Mirrors the navbar PlanBadge tier accents so plan presentation stays
// consistent across surfaces.
const PLAN_STYLES: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  starter:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  growth:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  agency:
    "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  enterprise:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
};

export default function BillingPage() {
  const queryClient = useQueryClient();
  const { formatDate } = useLocale();
  const { data: details, isLoading } = useDashboardOrg();
  const { data: summary } = useBillingSummary();
  const extend = useExtendTrial();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Both billing reads must move together. The page states a combined total and a
  // next-charge date from /billing/summary alongside the product list from
  // /dashboard/org — refreshing one without the other shows a new product against
  // a stale total, which is worse than showing neither.
  const refreshBilling = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["/v1/dashboard/org"] });
    void queryClient.invalidateQueries({ queryKey: [BILLING_SUMMARY_KEY] });
  }, [queryClient]);

  // Reconcile-on-return: Stripe embedded Checkout redirects back to
  // ?checkout=success&session_id=cs_… the instant the session completes — often
  // BEFORE the async webhook has activated the plan. Confirm the session
  // server-side so the plan is live on THIS load (idempotent against the
  // webhook), then strip the params so a refresh can't re-fire it.
  const confirmedRef = useRef(false);
  useEffect(() => {
    if (confirmedRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    confirmedRef.current = true;
    const sessionId = params.get("session_id");

    const stripParams = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    };

    void (async () => {
      try {
        if (sessionId) {
          const res = await api.post<{ activated: boolean; tier?: string }>(
            "/v1/billing/confirm",
            { sessionId },
          );
          toast.success(
            res?.activated
              ? "Payment confirmed — your plan is now active."
              : "Payment received — activating your plan…",
            res?.activated
              ? undefined
              : { description: "This can take a few seconds to reflect." },
          );
        } else {
          toast.success("Payment received — activating your plan…");
        }
      } catch {
        // Best-effort: the webhook remains the backstop. Never alarm the buyer.
      } finally {
        refreshBilling();
        stripParams();
      }
    })();
  }, [refreshBilling]);

  const cronToolbar = (
    <CronToolbar
      crons={["trial-expiry-sweep"]}
      onTriggered={refreshBilling}
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {cronToolbar}
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  // Prefer subscription.plan (canonical); fall back to billing.plan
  // (legacy alias from the endpoint, also derived from subscription
  // but kept on the response for old consumers).
  const plan = details?.subscription?.plan ?? details?.billing?.plan ?? "free";
  const planClass = PLAN_STYLES[plan] ?? PLAN_STYLES.free;
  // Prefer the server-resolved NAME. `plan` is a machine tier key, and this badge
  // used to render it under `capitalize` — which is how customers came to see
  // "Commerce_assistant.Free" as their plan name.
  const planLabel = details?.subscription?.planName ?? plan;
  const trialActive = details?.subscription?.trialActive === true;
  const trialDays = details?.subscription?.trialDaysRemaining ?? 0;
  const trialEndsAt = details?.subscription?.trialEndsAt
    ? new Date(details.subscription.trialEndsAt)
    : null;
  const selfServeExtensionUsed =
    details?.subscription?.selfServeExtensionUsed === true;
  const features = details?.entitlements?.features ?? [];
  // Paid products held beyond the base plan (active/trial portfolio subs). The
  // base plan can be Free while the org owns a purchased product (e.g. Commerce
  // Assistant) — without this, the page reads "Free" and prompts a re-purchase.
  const products = details?.products ?? [];
  const hasProducts = products.length > 0;
  // Per-product price / renewal, keyed by tier, so each row can show what it
  // costs rather than just that it exists.
  const priceByTier = new Map(
    (summary?.products ?? []).map((p) => [p.tier ?? "", p]),
  );

  const handleExtend = () => {
    extend.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(`Trial extended by ${res.addedDays} days`, {
          description: `New end date: ${new Date(res.trialEndsAt).toLocaleDateString()}`,
        });
      },
      onError: (err: ApiError) => {
        const code = err.code;
        if (code === "EXTENSION_ALREADY_USED") {
          toast.error("Extension already used", {
            description: "Reach out to hello@peakhour.ai for further help.",
          });
        } else if (code === "NOT_TRIALING") {
          toast.error("Trial ended", {
            description: "Contact hello@peakhour.ai to discuss next steps.",
          });
        } else if (code === "EXTENSION_RACE") {
          toast.info("State changed", {
            description: "Refreshing the latest trial state…",
          });
        } else {
          toast.error("Could not extend trial", {
            description: err.message ?? "Try again or contact support.",
          });
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {cronToolbar}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground mt-1">
          Manage your plan, usage, and payment details
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Your subscription — ONE subscription, N products, one charge.
            This card used to read "Current Plan: {tier key}", which showed
            customers "Commerce_assistant.Free" and said nothing about the paid
            products they actually hold. The headline is now what they are
            charged; the base plan is a footnote. */}
        <div className="rounded-2xl border bg-muted/30 px-5 pt-4 pb-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">
                {hasProducts ? "Your subscription" : "Current Plan"}
              </h3>
              <Badge
                variant="secondary"
                className={cn("font-medium", planClass)}
              >
                {planLabel}
              </Badge>
              {trialActive && trialDays > 0 ? (
                <Badge variant="outline" className="font-medium">
                  Trial · {trialDays}d left
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Self-serve trial extension — visible only while the
                  trial is active AND the customer hasn't burned their
                  one-shot. After use, the button disappears; the dashboard
                  banner shows a contact link in that window. */}
              {trialActive && !selfServeExtensionUsed ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleExtend}
                  disabled={extend.isPending}
                >
                  {extend.isPending ? "Extending…" : "Extend trial 7 days"}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUpgradeOpen(true)}
              >
                Upgrade plan
              </Button>
            </div>
          </div>
          {/* Fixed labels. An earlier draft flipped the first column between
              "Monthly total" and "Organization" depending on whether a total had
              resolved — a label that changes meaning is worse than an em dash. */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Monthly total</p>
              <p className="text-sm font-medium">
                {summary?.monthlyTotal != null
                  ? `${money(summary.monthlyTotal, summary.currency)}${summary.monthlyTotalComplete ? "" : "+"}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Next charge</p>
              <p className="text-sm font-medium">
                {summary?.nextChargeAt
                  ? formatDate(summary.nextChargeAt)
                  : trialActive && trialEndsAt
                    ? formatDate(trialEndsAt.toISOString())
                    : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Organization</p>
              <p className="text-sm font-medium">{details?.name || "—"}</p>
            </div>
          </div>

          {/* The combined-charge promise, stated only when it is actually true —
              i.e. the server confirmed every product rides one subscription. */}
          {summary?.billedTogether && summary.monthlyTotal != null ? (
            <p className="mt-3 text-xs text-muted-foreground">
              All {summary.products.length} products are billed together as one
              charge of {money(summary.monthlyTotal, summary.currency)}
              {summary.monthlyTotalComplete ? "" : " or more"}
              {summary.nextChargeAt ? ` on ${formatDate(summary.nextChargeAt)}` : ""}.
              {summary.basePlanName ? ` Included plan: ${summary.basePlanName}.` : ""}
            </p>
          ) : null}

          {/* India (RBI): a bigger COMBINED debit changes what the buyer has to do
              each cycle. Say so before the charge, not after it fails. */}
          {summary?.collectionTier === "afa" ? (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Your bank will ask you to approve each renewal, because the combined
              amount is above the limit for automatic payments in India.
            </p>
          ) : summary?.collectionTier === "invoice" ? (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              This total is above the limit for automatic payments in India, so
              we&rsquo;ll email you an invoice to pay each cycle.
            </p>
          ) : null}
        </div>

        {/* Your products — paid products held beyond the base plan. Shown only
            when the org owns at least one, so a base-plan-only org sees nothing
            new. This is what tells a Commerce buyer they DO own the product even
            when the base plan badge above still reads "Free". */}
        {products.length > 0 && (
          <div className="rounded-2xl border bg-muted/30 px-5 pt-4 pb-5">
            <h3 className="mb-3 font-semibold">Your products</h3>
            <ul className="space-y-2">
              {products.map((p) => (
                <li
                  key={p.tier}
                  className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const priced = priceByTier.get(p.tier);
                        const cost =
                          priced && priced.amountKnown && priced.amount != null
                            ? `${money(priced.amount, priced.currency)}/mo`
                            : null;
                        // A row-level trialEndsAt means the product is granted now
                        // and starts billing on that date — say when, so a "free"
                        // product doesn't look permanently free.
                        const when = p.trialEndsAt
                          ? `Free until ${formatDate(p.trialEndsAt)}`
                          : p.renewsAt
                            ? `Renews ${formatDate(p.renewsAt)}`
                            : p.since
                              ? `Since ${formatDate(p.since)}`
                              : null;
                        return [cost, when].filter(Boolean).join(" · ") || "—";
                      })()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium capitalize",
                      p.state === "active"
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        : p.state === "trial"
                          ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground",
                    )}
                  >
                    {p.state === "trial" ? "Trial" : p.state}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Usage cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-muted/30 px-4 pt-3 pb-5">
            <p className="font-semibold mb-1">Content pieces</p>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">
                {plan === "free" ? "50" : "Unlimited"}
              </span>
              {plan === "free" ? " / 50 included" : " included"}
            </p>
            {plan === "free" && (
              <div className="relative mt-2 h-1 w-full rounded-full bg-muted">
                <span className="absolute top-0 left-0 h-full w-1/2 rounded-full bg-amber-500" />
              </div>
            )}
          </div>
          <div className="rounded-2xl border bg-muted/30 px-4 pt-3 pb-5">
            <p className="font-semibold mb-1">Ad platforms</p>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">
                {plan === "enterprise" || plan === "agency"
                  ? "All"
                  : plan === "growth"
                    ? "2"
                    : "Preview only"}
              </span>
              {" "}included
            </p>
          </div>
        </div>

        {/* Features unlocked on this plan — sourced from the entitlements
            snapshot so it reflects whatever cfg_plans currently grants,
            not a hardcoded enumeration that would drift from the seed. */}
        {features.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Features included</CardTitle>
              <CardDescription>
                Resolved from your plan + any add-ons or platform grants.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-1.5">
                {features.map((f) => (
                  <li key={f}>
                    {/* Resolve the raw cfg_feature key (e.g. "content.brand_voice")
                        to its customer-facing label via the shared featureLabel()
                        helper — the same resolver the upgrade drawer and plan cards
                        use — so Billing never shows internal developer keys. */}
                    <Badge variant="outline" className="text-[11px]">
                      {featureLabel(f)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* Payment method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Method</CardTitle>
            <CardDescription>
              Manage your payment details and billing address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No payment method on file. Contact us to set up billing.
            </p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <a href="mailto:hello@peakhour.ai">Contact support</a>
            </Button>
          </CardContent>
        </Card>

        {/* Tax details + self-issued invoices */}
        <TaxAndInvoices />
      </div>

      <UpgradePlanDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onPurchased={refreshBilling}
      />
    </div>
  );
}
