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
import { useNavIntent } from "@/hooks/use-nav-intent";
import { useKbRequests } from "@/hooks/use-knowledge-base";
import { useCommerceStores } from "@/hooks/use-commerce-stores";
import {
  INSIGHT_FILTERS,
  TYPE_LABEL,
  CAUSE_LABEL,
  actionFor,
  chipCount,
  closedItems,
  conversationsHref,
  dismissedItems,
  conversationsLinkable,
  expiredNote,
  impactLine,
  insightFilterFromSearch,
  insightsState,
  itemsForFilter,
  linesLast,
  secondActionFor,
  shopOf,
  surfacesLine,
  topPriorityItems,
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
  const inChip = itemsForFilter(data.items, filter);
  // TOP PRIORITIES: the api's three (a shopper left on it, then customers, then rising), on the default view, drawn once and not again below
  const top = filter === "needs_action" ? topPriorityItems(data).filter((i) => inChip.some((c) => c.key === i.key)) : [];
  const shown = linesLast(inChip.filter((i) => !top.some((t) => t.key === i.key)));
  const fixed = closedItems(data.items);
  const setAside = dismissedItems(data.items);
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

      {top.length > 0 && (
        <section data-insights="top-priorities" aria-labelledby="top-priorities-heading" className="space-y-2">
          <h3 id="top-priorities-heading" className="text-sm font-semibold tracking-tight">
            Top priorities
          </h3>
          <ul className="space-y-3">
            {top.map((item) => (
              <InsightCard key={item.key} item={item} windowDays={data.windowDays} shop={shop} />
            ))}
          </ul>
        </section>
      )}

      {shown.length === 0 && top.length === 0 ? (
        <p data-insights="chip-empty" className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {filter === "needs_action" ? INSIGHTS_EMPTY : "Nothing here right now."}
        </p>
      ) : shown.length > 0 ? (
        <ul className="space-y-3">
          {shown.map((item) => (
            <InsightCard key={item.key} item={item} windowDays={data.windowDays} shop={shop} />
          ))}
        </ul>
      ) : null}

      {data.assistantMistakes?.line && (
        <p data-insights="assistant-mistakes" className="text-xs text-muted-foreground">
          {data.assistantMistakes.line}
        </p>
      )}

      {fixed.length > 0 && <RecentlyFixed items={fixed} />}
      {setAside.length > 0 && <DismissedItems items={setAside} />}
    </div>
  );
}

/**
 * What the merchant dismissed, with a way back (SA-10). A dismissed item returns on its own only when its count at least doubles, so without
 * this a dismissal by mistake could not be undone. Restore is the api's own call (`POST /v1/insights/:key/restore`), the same the Shopify app makes.
 */
export function DismissedItems({ items, defaultOpen = false }: { items: Insight[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const restore = useInsightDismissal();
  return (
    <section data-insights="dismissed" className="rounded-md border">
      <button type="button" className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
        Dismissed
        <Badge variant="secondary">{items.length}</Badge>
      </button>
      {open && (
        <ul className="space-y-2 border-t p-3">
          {items.map((i) => (
            <li key={i.key} data-insight-key={i.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0 font-medium wrap-break-word">{i.title}</span>
              <Button size="sm" variant="outline" disabled={restore.isPending && restore.variables?.key === i.key} onClick={() => restore.mutate({ key: i.key, restore: true })}>
                {restore.isPending && restore.variables?.key === i.key ? "Restoring…" : "Restore"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {restore.isError && (
        <p role="alert" className="border-t p-3 text-sm text-destructive">
          That did not save. Please try again.
        </p>
      )}
    </section>
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
  // these links carry the lane and its filter, so a hover warms exactly the list they open (lib/nav-prefetch.ts)
  const intent = useNavIntent();
  const convoHref = conversationsHref(item.key);
  const action = actionFor(item, shop);
  const second = secondActionFor(item, shop);
  const trend = trendText(item.trend);
  const where = surfacesLine(item.surfaces);
  const convo = conversationsLinkable(item);
  // ONE aged-out line: the api's own reason when it gave one, else the count of aged-out conversations
  const aged = convo.reason ? null : expiredNote(item.evidence.expired);
  // a "conversations" step with no conversation to open is words, not a button to an empty list
  const primaryIsDeadList = action.kind === "conversations" && !convo.linkable;
  return (
    <li data-insight-key={item.key} data-insight-type={item.type}>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{item.title}</p>
            <Badge variant="outline">{TYPE_LABEL[item.type]}</Badge>
            {item.priority?.blocked && <Badge variant="destructive">A shopper left after this</Badge>}
            {trend && <Badge variant="secondary">{trend}</Badge>}
          </div>
          {item.summary && (
            <p data-insight-part="what-happened" className="text-sm">
              {item.summary}
            </p>
          )}
          <p data-insight-part="impact" className="text-xs text-muted-foreground">
            {impactLine(item, windowDays)}
            {where ? ` · ${where}` : ""}
          </p>
          <p data-insight-part="why" className="text-sm">
            <span className="font-medium">Why it matters: </span>
            {/* ONE sentence: the cause (its label and reason) when there is one, else the topic's why. They said the same thing twice. */}
            {item.cause && typeof item.cause.reason === "string" ? (
              <span className="text-muted-foreground">
                {CAUSE_LABEL[item.cause.kind] ?? "Cause"}. {item.cause.reason.replace(/\.?\s*$/, ".")}
              </span>
            ) : (
              item.why
            )}
          </p>
          <p data-insight-part="next-step" className="text-sm">
            <span className="font-medium">Next step: </span>
            {action.kind === "link" && action.external ? <AdminLink href={action.href}>{action.label}</AdminLink> : item.nextStep.label}
            {item.nextStep.where ? <span className="text-muted-foreground"> {item.nextStep.where}</span> : null}
          </p>
          {/* "Read the conversations" is the See conversations button below: drawn once, as a button, never as words */}
          {second.kind === "link" && (
            <p data-insight-part="second-step" className="text-sm text-muted-foreground">
              Or: {second.external ? <AdminLink href={second.href}>{second.label}</AdminLink> : <Link className="underline" href={second.href} {...intent(second.href)}>{second.label}</Link>}
            </p>
          )}

          {action.kind === "answer" && <AnswerInline requestIds={action.requestIds} heading={item.title} />}
          {second.kind === "answer" && (
            <div data-insight-part="answer-here" className="space-y-2">
              <p className="text-sm text-muted-foreground">Or answer it here:</p>
              <AnswerInline requestIds={second.requestIds} heading={item.title} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {action.kind === "link" && !action.external && (
              <Button size="sm" asChild>
                <Link href={action.href} {...intent(action.href)}>{action.label}</Link>
              </Button>
            )}
            {action.kind === "conversations" && !primaryIsDeadList && (
              <Button size="sm" asChild>
                <Link href={action.href} {...intent(action.href)}>{action.label}</Link>
              </Button>
            )}
            {/* a "conversations" step already opens this same list under its own label: one button, not two */}
            {action.kind !== "conversations" && convo.linkable && (
              <Button size="sm" variant="outline" asChild>
                <Link href={convoHref} {...intent(convoHref)}>See conversations</Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={dismissal.isPending} onClick={() => dismissal.mutate({ key: item.key })}>
              Dismiss
            </Button>
          </div>
          {!convo.linkable && convo.reason && (
            <p data-insight-part="no-conversations" className="text-xs text-muted-foreground">
              {convo.reason}
            </p>
          )}
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
 * cannot answer differently. ★THE STORED QUESTION IS NEVER PRINTED: it is a scrubbed keyword string, and as a heading it read as raw shopper text. Each card is
 * headed with the insight's own title (and "1 of 2" when several questions stand behind it), and the answer is saved against each as before. A request that is no longer open (answered in the Knowledge base meanwhile) simply is not drawn.
 */
function AnswerInline({ requestIds, heading }: { requestIds: string[]; heading: string }) {
  const q = useKbRequests();
  if (q.isPending) return <Skeleton className="h-24 w-full" />;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">The questions could not be loaded. Please refresh.</p>;
  const open: KbRequest[] = (q.data?.requests ?? []).filter((r) => requestIds.includes(r.id));
  if (open.length === 0) return <p className="text-sm text-muted-foreground">These questions have been answered.</p>;
  return (
    <ul className="space-y-3">
      {open.map((r, i) => (
        <QuestionCard
          key={r.id}
          request={{ ...r, question: open.length > 1 ? `${heading} (${i + 1} of ${open.length})` : heading }}
          answerLabel="Answer once"
          // the card's own Dismiss is the card's; this one stays only where several questions stand behind a line, and then says which one it sets aside
          dismissLabel={open.length > 1 ? `Dismiss question ${i + 1}` : null}
        />
      ))}
    </ul>
  );
}
