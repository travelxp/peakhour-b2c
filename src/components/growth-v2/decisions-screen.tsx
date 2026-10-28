"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import {
  mandateFor,
  useDecideV2,
  useGrowthV2DecisionCounts,
  useGrowthV2Decisions,
  useGrowthV2Rules,
  useRecheckReviewV2,
  type DecideResponse,
  type DecisionAction,
  type DecisionsScreenData,
  type DecisionView,
  type GuardrailBlockView,
  type WaitingReviewView,
} from "@/lib/api/growth-v2";
import { PREVIEW_BUSINESS_NAME, PREVIEW_NOW } from "@/lib/growth-v2-fixtures";
import { decisionNotice, isAnswerable, KIND_LABEL, QUEUE_TABS, recheckNotice, TAB_QUEUE, whatsappPreview, type DecisionNotice, type QueueTab } from "@/lib/growth-v2-decisions";
import { withSummitTm } from "@/lib/growth-v2-copy";
import { formatDay, unitFor } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";
import { DecisionAsk } from "./decision-ask";
import { DecisionCard } from "./decision-card";
import { PageHead } from "./page-head";
import { QueryBoundary } from "./query-boundary";
import { ToneBadge, type Tone } from "./tone";

const PREVIEW_NOTE = "Preview data: nothing is sent.";

/** What the person is told when an answer went through, from what the api said happened. */
function doneToast(action: DecisionAction, r: DecideResponse): string {
  switch (action) {
    case "approve":
      if (r.status === "applied") return (r.scheduled?.length ?? 0) > 0 ? "Approved. The first step is applied and the rest are scheduled." : "Approved and applied.";
      return "Approved.";
    case "hold":
      return "Held. Nothing changes until you approve it.";
    case "reject":
      return "Rejected. Nothing changes.";
    case "undo":
      return "Undone.";
  }
}

/** Decisions: "What needs you?" Every proposal, block and finished experiment in one queue (plan 1, H2). */
export function DecisionsScreen() {
  const [tab, setTab] = useState<QueueTab>("needs_you");
  const query = useGrowthV2Decisions(TAB_QUEUE[tab]);
  const counts = useGrowthV2DecisionCounts();
  const rules = useGrowthV2Rules();
  const { business } = useAuth();
  return (
    <div className="grid gap-4">
      <PageHead
        title="What needs you?"
        description="Every proposal, block and finished experiment in one queue. Each decision also goes to your WhatsApp, and you can answer in either place."
      />
      <div role="group" aria-label="Filter decisions" className="flex flex-wrap gap-1.5">
        {QUEUE_TABS.map((t) => {
          const n = counts.data?.data[TAB_QUEUE[t.id]];
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                tab === t.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
              {n === undefined ? "" : <> &middot; {n}</>}
            </button>
          );
        })}
      </div>
      <QueryBoundary query={query}>
        {(r) => (
          <Inbox
            key={tab}
            tab={tab}
            result={r}
            currency={mandateFor(rules.data, r.preview)?.currency ?? ""}
            unit={unitFor(mandateFor(rules.data, r.preview)?.outcome.kind)}
            businessName={r.preview ? PREVIEW_BUSINESS_NAME : (business?.name ?? "your business")}
            onLoadMore={() => void query.fetchNextPage()}
            loadingMore={query.isFetchingNextPage}
            loadMoreFailed={query.isFetchNextPageError}
          />
        )}
      </QueryBoundary>
    </div>
  );
}

const KIND_TONE: Partial<Record<DecisionView["kind"], Tone>> = {
  budget_move: "ai",
  budget_raise: "ai",
  creative_approval: "ai",
  bid_strategy: "info",
  campaign_pause: "warn",
};

export function Inbox({
  tab,
  result,
  currency,
  unit,
  businessName,
  onLoadMore,
  loadingMore,
  loadMoreFailed,
}: {
  tab: QueueTab;
  result: DecisionsScreenData;
  currency: string;
  unit: { one: string; many: string };
  businessName: string;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  loadMoreFailed?: boolean;
}) {
  const preview = result.preview;
  const decisions = result.data.decisions;
  const blocks = result.data.blocks;
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; action: DecisionAction; notice: DecisionNotice } | null>(null);
  // A lazy initial value, so the clock is not read during render, then a tick so "expires in" does not freeze on an open page.
  const [liveNow, setLiveNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setLiveNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const now = preview ? PREVIEW_NOW : liveNow;
  const decide = useDecideV2();

  const waiting = tab === "needs_you" ? (result.data.waiting ?? []) : [];
  const isBlocked = tab === "blocked";
  const items: Array<DecisionView | GuardrailBlockView> = isBlocked ? blocks : decisions;
  const selected = items.find((x) => x.id === pickedId) ?? items[0];
  const selectedDecision = !isBlocked ? (selected as DecisionView | undefined) : undefined;

  const act = (action: DecisionAction) => {
    if (!selectedDecision) return;
    const id = selectedDecision.id;
    setNotice(null);
    decide.mutate(
      { id, action },
      {
        onSuccess: (r) => toast.success(doneToast(action, r)),
        // The refusal stays on the card as something to do; the queues refetch (the decision may have moved to held).
        onError: (e) => {
          const n = decisionNotice(e, action);
          setNotice({ id, action, notice: n });
          // The card can be gone by the time the refetch lands (answered elsewhere, expired): say it here too.
          toast.error(n.text);
        },
      },
    );
  };

  return (
    <div className="grid gap-4">
      {waiting.length > 0 ? <WaitingForReview items={waiting} preview={preview} /> : null}
    <div className="grid min-h-[480px] overflow-hidden rounded-xl border bg-card lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col border-b lg:border-b-0 lg:border-r">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {tab === "needs_you"
              ? "Nothing needs you. The engine will list a proposal here the moment it has one."
              : tab === "blocked"
                ? "Nothing is blocked. If a guardrail stops the engine from doing something, it shows here."
                : "Nothing here yet."}
          </p>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto lg:max-h-none" aria-label={tab === "blocked" ? "Blocked" : "Decisions"}>
            {isBlocked
              ? blocks.map((b) => (
                  <li key={b.id}>
                    <RowButton selected={selected?.id === b.id} onClick={() => setPickedId(b.id)}>
                      <span className="flex items-center justify-between gap-1.5">
                        <ToneBadge tone="warn">Guardrail</ToneBadge>
                        <span className="text-xs text-muted-foreground">{formatDay(b.lastAt)}</span>
                      </span>
                      <span className="mt-1 block text-sm font-medium">{b.title}</span>
                    </RowButton>
                  </li>
                ))
              : decisions.map((d) => (
                  <li key={d.id}>
                    <RowButton selected={selected?.id === d.id} onClick={() => setPickedId(d.id)}>
                      <span className="flex items-center justify-between gap-1.5">
                        <ToneBadge tone={KIND_TONE[d.kind] ?? "neutral"}>{KIND_LABEL[d.kind]}</ToneBadge>
                        <span className="text-xs text-muted-foreground">{formatDay(d.createdAt)}</span>
                      </span>
                      <span className="mt-1 block text-sm font-medium">{d.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{d.summary}</span>
                    </RowButton>
                  </li>
                ))}
          </ul>
        )}
        {result.hasMore ? (
          <div className="grid gap-1.5 border-t p-3">
            {loadMoreFailed ? <p role="alert" className="text-xs text-muted-foreground">Couldn&apos;t load more. Try again.</p> : null}
            <Button variant="outline" size="sm" className="w-full" disabled={loadingMore} onClick={onLoadMore}>
              {loadingMore ? "Loading…" : "Show older"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid min-w-0 content-start gap-4 p-4 sm:p-5">
        {selectedDecision ? (
          <>
            <DecisionCard
              key={selectedDecision.id}
              decision={selectedDecision}
              currency={currency}
              unit={unit}
              now={now}
              onAction={preview ? undefined : act}
              actionsDisabled={preview ? PREVIEW_NOTE : undefined}
              pending={decide.isPending}
              notice={liveNotice(notice, selectedDecision)}
            />
            <DecisionAsk key={selectedDecision.id} decisionId={selectedDecision.id} disabled={preview ? PREVIEW_NOTE : undefined} />
          </>
        ) : selected ? (
          <BlockDetail block={selected as GuardrailBlockView} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {isBlocked ? "Pick a block on the left to see what was stopped and why." : "Pick a decision on the left to see what it would change and why."}
          </p>
        )}
      </div>

      {!isBlocked ? (
        <aside className="grid min-w-0 content-start gap-2.5 border-t p-3.5 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0" aria-label="Same decision on WhatsApp">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Same decision on WhatsApp</p>
          {selectedDecision ? <WhatsAppPhone d={selectedDecision} businessName={businessName} /> : null}
          <p className="text-xs text-muted-foreground">
            Sent as a utility message, worded as an account action. Spend needs a CONFIRM reply from a verified number. If there&apos;s no answer within
            72 hours, nothing happens.
          </p>
        </aside>
      ) : null}
    </div>
    </div>
  );
}

/**
 * Changes Peakhour Summit has not been able to review yet. They are not decisions: nothing is asked of the merchant, and the one
 * action re-runs the review once. The first title on the screen carries the trademark sign; the rest are plain.
 */
function WaitingForReview({ items, preview }: { items: WaitingReviewView[]; preview: boolean }) {
  const recheck = useRecheckReviewV2();
  const [notice, setNotice] = useState<{ id: string; notice: DecisionNotice } | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const check = (w: WaitingReviewView) => {
    setNotice(null);
    setDoneId(null);
    recheck.mutate(
      { runId: w.runId, proposalId: w.proposalId },
      {
        onSuccess: (r) => {
          setDoneId(w.id);
          toast.success(r.outcome === "reviewed" ? "Reviewed. It is in your list to answer." : "Reviewed. It was closed, and nothing was changed on your account.");
        },
        onError: (e) => {
          const n = recheckNotice(e);
          setNotice({ id: w.id, notice: n });
          toast.error(n.text);
        },
      },
    );
  };
  return (
    <section aria-label="Waiting for review" className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone="warn" dot>
          Waiting for review
        </ToneBadge>
        <span className="text-xs text-muted-foreground">Not a decision: nothing is asked of you.</span>
      </div>
      <ul className="grid divide-y">
        {items.map((w, i) => (
          <li key={w.id} className="grid gap-2 py-3 first:pt-0 last:pb-0">
            <h3 className="text-sm font-semibold">{i === 0 ? withSummitTm(w.title) : w.title}</h3>
            <p className="text-sm text-muted-foreground">{w.body}</p>
            <p className="text-xs text-muted-foreground">
              Waiting since {formatDay(w.waitingSince)}. If it still can&apos;t be reviewed by {formatDay(w.giveUpAt)}, it is set aside and your next weekly plan will look at it again.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={preview || recheck.isPending}
                title={preview ? PREVIEW_NOTE : undefined}
                onClick={() => check(w)}
              >
                {recheck.isPending && recheck.variables?.proposalId === w.proposalId ? "Checking…" : "Check it again now"}
              </Button>
              {doneId === w.id ? <span role="status" className="text-xs text-muted-foreground">Checked.</span> : null}
            </div>
            {notice?.id === w.id ? (
              <p role="alert" className={cn("text-sm", notice.notice.tone === "bad" ? "text-destructive-on-tint" : "text-warning-on-tint")}>
                {notice.notice.text}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A refusal stays on its card only while it is still about what the card shows: an answer's refusal while the decision
 * can still be answered (a refused approve sends it to held, which is still answerable), an undo's while it is applied.
 * Once the refetch shows the decision moved on (already answered, applied), the notice is stale and goes.
 */
function liveNotice(n: { id: string; action: DecisionAction; notice: DecisionNotice } | null, d: DecisionView): DecisionNotice | undefined {
  if (!n || n.id !== d.id) return undefined;
  return (n.action === "undo" ? d.status === "applied" : isAnswerable(d)) ? n.notice : undefined;
}

function RowButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-current={selected}
      onClick={onClick}
      className="block w-full border-b px-3.5 py-3 text-left hover:bg-muted aria-[current=true]:bg-chart-1/10 aria-[current=true]:shadow-[inset_3px_0_0_var(--chart-1)]"
    >
      {children}
    </button>
  );
}

/** A guardrail block: what the engine was stopped from doing, in the api's words, and where to change the rule. */
function BlockDetail({ block }: { block: GuardrailBlockView }) {
  return (
    <article className="grid min-w-0 content-start gap-3">
      <div className="flex flex-wrap gap-2">
        <ToneBadge tone="warn" dot>
          Blocked by a guardrail
        </ToneBadge>
        {block.count > 1 ? <ToneBadge>{block.count} times</ToneBadge> : null}
      </div>
      <h2 className="text-balance text-lg font-semibold">{block.title}</h2>
      <p className="text-sm text-muted-foreground">{block.message}</p>
      <p className="text-xs text-muted-foreground">Last stopped on {formatDay(block.lastAt)}. Nothing was changed on the platform.</p>
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/growth/rules">Review your rules</Link>
        </Button>
      </div>
    </article>
  );
}

function WhatsAppPhone({ d, businessName }: { d: DecisionView; businessName: string }) {
  const wa = whatsappPreview(d, businessName);
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-3xl border bg-[#efeae2] dark:bg-[#0b141a]">
      <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5 text-[13px] text-white">
        <span className="grid size-6 place-items-center rounded-full bg-white text-xs font-bold text-[#075e54]">P</span>
        <span>
          <b className="block leading-tight">Peakhour</b>
          <span className="text-[11px] opacity-80">Business account</span>
        </span>
      </div>
      <div className="grid gap-2 p-2.5">
        <div className="max-w-[92%] rounded-[10px] bg-white p-2 text-[12.5px] text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
          <b className="font-semibold">{wa.header}</b>
          <p className="mt-1 whitespace-pre-line">{wa.body}</p>
          {wa.confirmNote ? <p className="mt-1.5 opacity-80">{wa.confirmNote}</p> : null}
          <div className="mt-2 grid gap-1">
            {wa.buttons.map((b) => (
              <span key={b} className="block border-t border-black/10 pt-1.5 text-center font-medium text-[#0a7cff] dark:border-white/10 dark:text-[#53bdeb]">
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
