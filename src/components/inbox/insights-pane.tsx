"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Lightbulb, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { AdminLink } from "@/components/commerce/demand-insights";
import { QuestionCard } from "@/components/commerce/knowledge-base";
import { SupportResultsPanel } from "@/components/inbox/support-results-panel";
import { useInsightDismissal, useInsights } from "@/hooks/use-insights";
import { useKbRequests } from "@/hooks/use-knowledge-base";
import { useCommerceStores } from "@/hooks/use-commerce-stores";
import {
  INSIGHT_FILTERS,
  TYPE_LABEL,
  actionFor,
  chipCount,
  closedItems,
  conversationsHref,
  countLine,
  expiredNote,
  insightFilterFromSearch,
  insightsState,
  itemsForFilter,
  shopOf,
  surfacesLine,
  trendText,
  type Insight,
  type InsightFilter,
  type InsightsResponse,
  type InsightsState,
} from "@/lib/insights";
import type { KbRequest } from "@/lib/knowledge-base";

export const INSIGHTS_HEADING = "What customers are telling you";
export const INSIGHTS_EMPTY = "Nothing needs your attention yet. Insights appear once several customers raise the same thing.";

/**
 * Inbox -> Insights. What customers keep raising with your assistant, each with why it matters and the one thing to do about it.
 * Rows are normalised topics and counts: no customer's message, name or contact is shown on a card.
 *
 * The tab holds the chip in the address (`?type=`), so a reload, a bookmark and the old Commerce link all land on the same view.
 */
export function InsightsPane() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filter = insightFilterFromSearch(params.get("tab"), params.get("type"));
  const q = useInsights();
  const stores = useCommerceStores();
  const state = insightsState(q);

  function pick(next: InsightFilter) {
    const search = new URLSearchParams(params.toString());
    search.set("tab", "insights");
    search.set("type", next);
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <InsightsView state={state} filter={filter} onPick={pick} onRetry={() => void q.refetch()} shop={shopOf(stores.data)} />
      <SupportResultsPanel />
    </div>
  );
}

/** The part of the tab for a state. No hooks beyond the cards' own, so every state is renderable and testable. */
export function InsightsView({
  state,
  filter,
  onPick,
  onRetry,
  shop,
}: {
  state: InsightsState;
  filter: InsightFilter;
  onPick: (f: InsightFilter) => void;
  onRetry: () => void;
  shop: string | null;
}) {
  return (
    <section aria-labelledby="insights-heading" className="space-y-4">
      <div>
        <h2 id="insights-heading" className="text-lg font-semibold tracking-tight">
          {INSIGHTS_HEADING}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">What shoppers keep asking your assistant, and what to do about it. Wording is normalised; no customer&apos;s message is shown here.</p>
      </div>
      <Body state={state} filter={filter} onPick={onPick} onRetry={onRetry} shop={shop} />
    </section>
  );
}

function Body({ state, filter, onPick, onRetry, shop }: { state: InsightsState; filter: InsightFilter; onPick: (f: InsightFilter) => void; onRetry: () => void; shop: string | null }) {
  switch (state.kind) {
    case "loading":
      return (
        <div data-insights="loading" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      );
    case "waiting":
      return null;
    case "error":
      return (
        <Card data-insights="error" role="alert" className="flex flex-col items-center gap-2 p-8 text-center">
          <p className="text-sm font-medium">Couldn&apos;t load what customers are telling you</p>
          <p className="max-w-md text-xs text-muted-foreground">This is a problem loading the list, not a sign that nobody asked anything. Try again in a moment.</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </Card>
      );
    case "no-assistant":
      return (
        <div data-insights="no-assistant">
          <EmptyState
            icon={Store}
            title="Your assistant isn't set up yet"
            description="Once your assistant is chatting with customers, the things they keep asking for show up here."
            action={{ label: "Set up your assistant", href: "/dashboard/commerce/assistant" }}
            className="min-h-60"
          />
        </div>
      );
    case "empty":
      return (
        <Card data-insights="empty" className="flex flex-col items-center gap-2 p-8 text-center">
          <Lightbulb className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm font-medium">{INSIGHTS_EMPTY}</p>
        </Card>
      );
    case "ready":
      return <Ready data={state.data} filter={filter} onPick={onPick} shop={shop} />;
  }
}

function Ready({ data, filter, onPick, shop }: { data: InsightsResponse; filter: InsightFilter; onPick: (f: InsightFilter) => void; shop: string | null }) {
  const shown = itemsForFilter(data.items, filter);
  const fixed = closedItems(data.items);
  return (
    <div data-insights="ready" className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
        {INSIGHT_FILTERS.map((f) => (
          <Button key={f.value} size="xs" variant={filter === f.value ? "default" : "outline"} aria-pressed={filter === f.value} onClick={() => onPick(f.value)}>
            {f.label}
            <span className="ml-1 tabular-nums" data-chip-count={f.value}>
              {chipCount(data, f.value)}
            </span>
          </Button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p data-insights="chip-empty" className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {filter === "needs_action" ? INSIGHTS_EMPTY : "Nothing here right now."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => (
            <InsightCard key={item.key} item={item} windowDays={data.windowDays} shop={shop} />
          ))}
        </ul>
      )}

      {fixed.length > 0 && <RecentlyFixed items={fixed} />}
    </div>
  );
}

function RecentlyFixed({ items }: { items: Insight[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section data-insights="fixed" className="rounded-md border">
      <button type="button" className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
        Recently fixed
        <Badge variant="secondary">{items.length}</Badge>
      </button>
      {open && (
        <ul className="space-y-2 border-t p-3">
          {items.map((i) => (
            <li key={i.key} data-insight-key={i.key} className="text-sm">
              <p className="font-medium">{i.title}</p>
              {i.closedNote && <p className="text-muted-foreground">{i.closedNote}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InsightCard({ item, windowDays, shop }: { item: Insight; windowDays: number; shop: string | null }) {
  const dismissal = useInsightDismissal();
  const action = actionFor(item, shop);
  const trend = trendText(item.trend);
  const where = surfacesLine(item.surfaces);
  const aged = expiredNote(item.evidence.expired);
  return (
    <li data-insight-key={item.key} data-insight-type={item.type}>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{item.title}</p>
            <Badge variant="outline">{TYPE_LABEL[item.type]}</Badge>
            {trend && <Badge variant="secondary">{trend}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {countLine(item, windowDays)}
            {where ? ` · ${where}` : ""}
          </p>
          <p className="text-sm">
            <span className="font-medium">Why it matters: </span>
            {item.why}
          </p>
          <p className="text-sm">
            <span className="font-medium">Next step: </span>
            {action.kind === "link" && action.external ? <AdminLink href={action.href}>{action.label}</AdminLink> : item.nextStep.label}
          </p>

          {action.kind === "answer" && <AnswerInline requestIds={action.requestIds} />}

          <div className="flex flex-wrap items-center gap-2">
            {action.kind === "link" && !action.external && (
              <Button size="sm" asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            )}
            {action.kind === "conversations" && (
              <Button size="sm" asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            )}
            {/* a "conversations" step already opens this same list under its own label: one button, not two */}
            {action.kind !== "conversations" && (
              <Button size="sm" variant="outline" asChild>
                <Link href={conversationsHref(item.key)}>See conversations</Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={dismissal.isPending} onClick={() => dismissal.mutate({ key: item.key })}>
              Dismiss
            </Button>
          </div>
          {dismissal.isError && (
            <p role="alert" className="text-sm text-destructive">
              That did not save. Please try again.
            </p>
          )}
          {aged && <p className="text-xs text-muted-foreground">{aged}</p>}
        </CardContent>
      </Card>
    </li>
  );
}

/**
 * The questions behind an insight, answered where they are shown. It is the Knowledge base's own card and answer call, so the two
 * cannot answer differently. A request that is no longer open (answered in the Knowledge base meanwhile) simply is not drawn.
 */
function AnswerInline({ requestIds }: { requestIds: string[] }) {
  const q = useKbRequests();
  if (q.isPending) return <Skeleton className="h-24 w-full" />;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">The questions could not be loaded. Please refresh.</p>;
  const open: KbRequest[] = (q.data?.requests ?? []).filter((r) => requestIds.includes(r.id));
  if (open.length === 0) return <p className="text-sm text-muted-foreground">These questions have been answered.</p>;
  return (
    <ul className="space-y-3">
      {open.map((r) => (
        <QuestionCard key={r.id} request={r} answerLabel="Answer once" />
      ))}
    </ul>
  );
}
