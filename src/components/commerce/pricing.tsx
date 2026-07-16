"use client";

import { useCallback, useState } from "react";
import {
  Loader2,
  Sparkles,
  Tag,
  Check,
  ShieldCheck,
  Store,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { useLocale } from "@/hooks/use-locale";
import { minorToMajor } from "@/lib/money";
import {
  usePricer,
  usePricerBrief,
  useProposePricing,
  type PricingProposal,
} from "@/hooks/use-commerce-pricer";
import {
  useCommerceRecommendations,
  useDecideRecommendation,
  type Recommendation,
} from "@/hooks/use-commerce-recommendations";

/**
 * Commerce → Pricing & Promotions (P2.5). Two surfaces over the connected
 * channel:
 *   • Price grid — the Pricer's guardrail-bounded markdown plan (GET /pricer):
 *     current → new price, discount, capital freed, inline "Propose", with the
 *     discount ceiling + margin floor made visible.
 *   • Promotions — the pricer-owned cmrc_recommendations as intent cards with
 *     projected revenue and approve / reject.
 * Gated on `commerce.nav`.
 */

/** Recommendation types the Pricer owns (mirrors api RECOMMENDATION_AGENT). */
const PRICER_REC_TYPES = new Set(["dead_stock_recovery", "aov_increase", "margin_protect"]);

export function CommercePricing() {
  return (
    <FeatureGate feature="commerce.nav" featureName="Commerce">
      <PricingBody />
    </FeatureGate>
  );
}

function PricingBody() {
  const { data, isLoading, isError } = usePricer();
  const { formatNumber } = useLocale();

  const money = useCallback(
    (minor: number | null, currency: string | null) => {
      if (minor === null) return "—";
      const cur = currency ?? "USD";
      return formatNumber(minorToMajor(minor, cur), {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 0,
      });
    },
    [formatNumber],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Header />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Header />
        <EmptyState
          icon={Store}
          title="Connect a store to plan pricing"
          description="Pricing & Promotions lights up once a Shopify or WooCommerce store is connected to this business."
          action={{ label: "Connect a store", href: "/dashboard/integrations" }}
        />
      </div>
    );
  }

  const { guardrails } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Header />

      {/* Guardrails — always visible so the merchant sees the safety rails */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Guardrails:
        </span>
        <Badge variant="outline" className="font-normal">
          Discount ceiling {guardrails.maxDiscountPct ?? "—"}%
        </Badge>
        <Badge variant="outline" className="font-normal">
          Margin floor {guardrails.marginFloorPct != null ? `${guardrails.marginFloorPct}%` : "not set"}
        </Badge>
        <span className="text-muted-foreground">
          Every markdown stays within these — the engine never proposes past them.
        </span>
      </div>

      <PricingBrief hasProposals={data.proposals.length > 0} />

      <PriceGrid proposals={data.proposals} scanned={data.scanned} money={money} />

      <Promotions formatMajor={formatNumber} />
    </div>
  );
}

function Header() {
  return (
    <header className="mb-6">
      <h1 className="text-xl font-semibold">Pricing &amp; Promotions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Clear slow stock to free up capital and run promotions that lift revenue —
        the Pricer proposes, you approve, and every move respects your guardrails.
      </p>
    </header>
  );
}

function PricingBrief({ hasProposals }: { hasProposals: boolean }) {
  const brief = usePricerBrief();
  const text = brief.data?.brief;
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Pricing brief</CardTitle>
        <Button size="sm" onClick={() => brief.mutate()} disabled={brief.isPending || !hasProposals}>
          {brief.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Writing…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" /> Get pricing brief
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {brief.isError ? (
          <p className="text-sm text-muted-foreground">
            {(brief.error as { message?: string })?.message ||
              "Couldn't generate the brief. Please try again."}
          </p>
        ) : text ? (
          <p className="whitespace-pre-wrap text-sm">{text}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            A prioritised, plain-language markdown plan — what to clear this week and at
            what discount. Uses Peaks.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PriceGrid({
  proposals,
  scanned,
  money,
}: {
  proposals: PricingProposal[];
  scanned: boolean;
  money: (minor: number | null, currency: string | null) => string;
}) {
  const propose = useProposePricing();
  const [proposed, setProposed] = useState<Set<string>>(new Set());

  const onPropose = useCallback(
    (p: PricingProposal) => {
      propose.mutate(p.sourceProductId, {
        onSuccess: () => {
          setProposed((prev) => new Set(prev).add(p.sourceProductId));
          toast.success("Markdown proposed", {
            description: `${p.title || "Product"} — the Pricer logged the intent.`,
          });
        },
        onError: () =>
          toast.error("Couldn't propose markdown", { description: "Please try again shortly." }),
      });
    },
    [propose],
  );

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-base">Markdown plan</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {proposals.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {scanned
              ? "No slow stock to mark down right now — nothing is sitting with tied-up capital."
              : "No products have synced yet. Your markdown plan appears once your catalog and recent orders sync."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 text-right font-medium">Now</th>
                  <th className="px-4 py-2 text-right font-medium">Off</th>
                  <th className="px-4 py-2 text-right font-medium">New</th>
                  <th className="px-4 py-2 text-right font-medium">Frees</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {proposals.map((p) => {
                  const isDone = proposed.has(p.sourceProductId);
                  const isBusy = propose.isPending && propose.variables === p.sourceProductId;
                  return (
                    <tr key={p.sourceProductId}>
                      <td className="max-w-[16rem] px-4 py-3">
                        <p className="line-clamp-1 font-medium">{p.title || "Untitled product"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.stock ?? "?"} in stock · {p.unitsSold} sold
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground line-through">
                        {money(p.currentPriceMinor, p.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="secondary" className="tabular-nums">−{p.suggestedDiscountPct}%</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {money(p.newPriceMinor, p.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {money(p.recoveredCapitalMinor, p.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <Check className="size-3" /> Proposed
                          </span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => onPropose(p)} disabled={isBusy}>
                            {isBusy ? <Loader2 className="size-4 animate-spin" /> : (<><Tag className="mr-1 size-4" /> Propose</>)}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Promotions({
  formatMajor,
}: {
  formatMajor: ReturnType<typeof useLocale>["formatNumber"];
}) {
  const { data } = useCommerceRecommendations();
  const decide = useDecideRecommendation();
  const promos = (data?.items ?? []).filter((r) => PRICER_REC_TYPES.has(r.type));

  if (promos.length === 0) return null;

  const revenue = (r: Recommendation) => {
    const range = r.expectedRevenueRange;
    if (!range) return null;
    const fmt = (v: number) =>
      formatMajor(v, { style: "currency", currency: range.currency, maximumFractionDigits: 0 });
    return `${fmt(range.min)}–${fmt(range.max)}`;
  };

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Promotions</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {promos.map((r) => {
          const est = revenue(r);
          const isBusy = decide.isPending && decide.variables?.id === r.id;
          return (
            <Card key={r.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{r.title}</p>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">−{r.suggestedDiscount}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{r.reasonSummary}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {est ? `Est. lift ${est}` : `${r.productCount} product${r.productCount === 1 ? "" : "s"}`}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Reject promotion"
                      title="Reject"
                      disabled={isBusy}
                      onClick={() =>
                        decide.mutate(
                          { id: r.id, decision: "reject" },
                          { onError: () => toast.error("Couldn't update", { description: "Please try again." }) },
                        )
                      }
                    >
                      <ThumbsDown className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        decide.mutate(
                          { id: r.id, decision: "approve" },
                          {
                            onSuccess: () => toast.success("Promotion approved"),
                            onError: () => toast.error("Couldn't approve", { description: "Please try again." }),
                          },
                        )
                      }
                    >
                      {isBusy ? <Loader2 className="size-4 animate-spin" /> : (<><ThumbsUp className="mr-1 size-4" /> Approve</>)}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
