"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  FlaskConical,
  ShieldCheck,
  Store,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionCost } from "@/components/dashboard/action-cost";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { useLocale } from "@/hooks/use-locale";
import { useActiveStore } from "@/providers/active-store-provider";
import { minorToMajor } from "@/lib/money";
import { PageShell } from "@/components/dashboard/page-shell";
import { emptyPlanCopy, partialPlanCopy } from "@/lib/pricing-empty-copy";
import {
  COST_NOTE, acceptTests, chainsOf, decisionLine, decisionWords, headlineNote, headlineOf, outcomeHeading, planFacts, proposalNotes,
  showWaiting, startOutcome, testLine, ungroupedWaiting, waitingRows, type StartOutcome,
} from "@/lib/markdown-test";
import {
  usePricer,
  usePricerBrief,
  useMarkdownTests,
  useStartMarkdownTest,
  type PricingPlan,
} from "@/hooks/use-commerce-pricer";
import {
  useCommerceRecommendations,
  useDecideRecommendation,
  type Recommendation,
} from "@/hooks/use-commerce-recommendations";

/**
 * Commerce → Pricing & Promotions (P2.5). Two surfaces over the connected
 * channel:
 *   • The test — the Pricer's few chosen products (GET /pricer), started as ONE
 *     test with a holdout (POST /pricer/test), why the rest are waiting, and
 *     the tests already running with the weekly verdict (GET /pricer/tests).
 *     Smart Markdowns C.10: a markdown is a priced test on a few products, not a
 *     sale on everything slow. The api owns every decision; this page words it.
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
      <PageShell width="standard">
        <Header />
        <Skeleton className="h-64 w-full rounded-lg" />
      </PageShell>
    );
  }

  if (isError || !data) {
    return (
      <PageShell width="standard">
        <Header />
        <EmptyState
          icon={Store}
          title="Connect a store to plan pricing"
          description="Pricing & Promotions lights up once a Shopify or WooCommerce store is connected to this business."
          action={{ label: "Connect a store", href: "/dashboard/integrations" }}
        />
      </PageShell>
    );
  }

  const { guardrails } = data;

  return (
    <PageShell width="standard">
      <Header />

      {/* Guardrails — always visible so the merchant sees the safety rails */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Guardrails:
        </span>
        <Badge variant="outline" className="font-normal">
          Discount ceiling {guardrails.maxDiscountPct != null ? `${guardrails.maxDiscountPct}%` : "not set"}
        </Badge>
        <Badge variant="outline" className="font-normal">
          Margin floor {guardrails.marginFloorPct != null ? `${guardrails.marginFloorPct}%` : "not set"}
        </Badge>
        {/* ★THE CLAIM IS CONDITIONAL ON THERE BEING A CEILING TO STAY WITHIN.
            "Every markdown stays within these" was unconditional, so it was
            printed with no ceiling set (nothing to stay within) and with a
            ceiling of 0 (no markdowns to stay within anything). */}
        {guardrails.maxDiscountPct != null && guardrails.maxDiscountPct > 0 ? (
          <span className="text-muted-foreground">
            Every markdown stays within these — Peakhour never proposes past them.
          </span>
        ) : null}
      </div>

      <PricingBrief hasProposals={data.proposals.length > 0} />

      <TestPlan plan={data} money={money} />

      <YourTests />

      <Promotions formatMajor={formatNumber} />
    </PageShell>
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
            what discount. <ActionCost action="pricerBrief" />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type Money = (minor: number | null, currency: string | null) => string;

const TONE_CLASS: Record<StartOutcome["tone"], string> = {
  success: "border-success/40 bg-success/10",
  info: "border-border bg-muted/40",
  warning: "border-warning/40 bg-warning/10",
};

/**
 * ★TAKES THE PLAN, NOT THE PLAN AND ITS OWN PROPOSALS. Passing both meant emptiness was read from one prop and its explanation from another,
 * which is one refactor away from a grid that renders rows under an empty-state sentence.
 *
 * ★ONE TEST, NOT A LIST (Smart Markdowns C.10). The cohort is the api's choice; the button starts exactly what the merchant saw, by sending the
 * ids it saw, and a cohort that moved since is refused by the api (409 MOVED) and the new plan is loaded.
 */
function TestPlan({ plan, money }: { plan: PricingPlan; money: Money }) {
  const proposals = plan.proposals;
  const facts = planFacts(plan);
  const partial = partialPlanCopy(plan);
  const platform = useActiveStore().store?.platform ?? null;
  const start = useStartMarkdownTest();
  // Kept here, not in the button: a started test empties the plan, and the answer must outlive the table it came from.
  const [outcome, setOutcome] = useState<StartOutcome | null>(null);

  const onStart = useCallback(() => {
    // A new press is a new answer: the last banner (a moved cohort, a started test) is not the state of this one.
    setOutcome(null);
    start.mutate(
      proposals.map((p) => p.sourceProductId),
      { onSuccess: (answer) => setOutcome(startOutcome(answer, platform)) },
    );
  }, [start, proposals, platform]);

  return (
    <>
      {outcome ? (
        <div role="status" className={`mb-4 rounded-lg border p-4 text-sm ${TONE_CLASS[outcome.tone]}`}>
          <p className="font-medium">{outcomeHeading(outcome)}</p>
          <p className="mt-1 text-muted-foreground">{outcome.message}</p>
          <p className="mt-2 text-xs">
            <Link href="/dashboard/commerce/autopilot" className="underline">
              What Peakhour has done
            </Link>
          </p>
        </div>
      ) : null}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-4" />
            {proposals.length > 0 ? headlineOf(proposals.length, facts) : "Markdown test"}
          </CardTitle>
          {proposals.length > 0 ? <p className="text-sm text-muted-foreground">{headlineNote(proposals.length, facts)}</p> : null}
        </CardHeader>
        <CardContent className="p-0">
          {proposals.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyPlanCopy(plan)}</p>
          ) : (
            <>
              {/* ★A NON-EMPTY PLAN CAN BE PARTIAL TOO, and that is the quieter failure: it looks complete. ★OUTSIDE the horizontal scroller:
                  inside it, the caveat scrolled out of view exactly when the merchant scrolled right to read the numbers it qualifies. */}
              {partial ? <p className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">{partial}</p> : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="sticky left-0 z-10 bg-background px-4 py-2 font-medium">Product</th>
                      <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Now</th>
                      <th className="px-4 py-2 text-right font-medium">Off</th>
                      <th className="px-4 py-2 text-right font-medium">New</th>
                      <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Frees</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {proposals.map((p) => {
                      const notes = proposalNotes(p, platform);
                      return (
                        <tr key={p.sourceProductId}>
                          <td className="sticky left-0 z-10 max-w-[9rem] bg-background px-4 py-3 md:max-w-[18rem]">
                            <p className="line-clamp-1 font-medium">{p.title || "Untitled product"}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.stock ?? "?"} in stock · {p.unitsSold} sold{notes.route ? ` · ${notes.route}` : ""}
                            </p>
                            {notes.needsCost ? <p className="text-xs text-warning-on-tint">{COST_NOTE}</p> : null}
                            {notes.referenceNote ? <p className="text-xs text-muted-foreground">{notes.referenceNote}</p> : null}
                          </td>
                          <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground md:table-cell">
                            {money(p.currentPriceMinor, p.currency)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant="secondary" className="tabular-nums">
                              −{p.suggestedDiscountPct}%
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            {money(p.newPriceMinor, p.currency)}
                            {notes.struck ? (
                              <span className="ml-1 text-xs font-normal text-muted-foreground line-through">{money(p.currentPriceMinor, p.currency)}</span>
                            ) : null}
                          </td>
                          <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{money(p.recoveredCapitalMinor, p.currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Prices are in your store&apos;s currency. Nothing changes until you start the test, and you can undo any markdown from the Autopilot page.
                </p>
                <Button onClick={onStart} disabled={start.isPending}>
                  {start.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Starting…
                    </>
                  ) : (
                    "Start this test"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {showWaiting(plan) ? <Waiting facts={facts} /> : null}
    </>
  );
}

/** "Why the rest are waiting": one row per route, with the api's first few products and their one-line reasons. */
function Waiting({ facts }: { facts: ReturnType<typeof planFacts> }) {
  const rows = waitingRows(facts);
  const loose = ungroupedWaiting(facts);
  if (rows.length === 0 && loose.length === 0) return null;
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Why the rest are waiting</CardTitle>
        <p className="text-sm text-muted-foreground">Most slow stock is better handled another way than a discount.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => (
          <div key={r.route}>
            <p className="text-sm font-medium">
              {r.label} <span className="font-normal tabular-nums text-muted-foreground">· {r.count}</span>
            </p>
            {r.says ? <p className="text-xs text-muted-foreground">{r.says}</p> : null}
            {r.products.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {r.products.map((w, i) => (
                  <li key={`${w.sourceProductId || w.productId || w.title}-${i}`}>
                    <span className="text-foreground">{w.title}</span>
                    {w.reason ? ` — ${w.reason}` : ""}
                  </li>
                ))}
                {r.count > r.products.length ? <li>and {r.count - r.products.length} more</li> : null}
              </ul>
            ) : null}
          </div>
        ))}
        {loose.length > 0 ? (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {loose.map((w, i) => (
              <li key={`${w.sourceProductId || w.productId || w.title}-${i}`}>
                <span className="text-foreground">{w.title}</span>
                {w.reason ? ` — ${w.reason}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** "Your tests": each test in a chain with where it is, what is compared and what the weekly review said. Nothing is shown before one has run. */
function YourTests() {
  const { data, isError, error } = useMarkdownTests();
  const tests = acceptTests(data);
  // ★AN API THAT PREDATES THE ROUTE (404/501) HAS NO LIST TO SHOW: that is not a failed read, and must not tell every merchant a test may be running.
  const status = (error as { status?: number } | null)?.status;
  if (isError && (status === 404 || status === 501)) return null;
  // ★A FAILED READ IS NOT "NO TESTS": the merchant may have one running, and an empty section would say they have not.
  if (isError) {
    return (
      <p className="mb-6 text-sm text-muted-foreground">
        We couldn&apos;t load your tests just now. A test you started may still be running; check the Autopilot page.
      </p>
    );
  }
  if (tests === null) return null;
  const chains = chainsOf(tests);
  if (chains.length === 0) return null;
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-base">Your tests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {chains.map((c) => (
          <div key={c.rootId} className="space-y-2">
            {c.tests.map((t) => {
              const words = decisionWords(t);
              const reason = decisionLine(t);
              return (
                <div key={t.campaignId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      Step {t.step} · {t.depthPct}% off
                    </p>
                    <Badge variant={words.tone === "success" ? "default" : "secondary"} className="shrink-0">
                      {words.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{testLine(t)}</p>
                  {reason ? <p className="mt-1 text-sm">{reason}</p> : null}
                </div>
              );
            })}
          </div>
        ))}
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
