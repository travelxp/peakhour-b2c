"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import { useDecideV2, useGrowthV2Decisions, useGrowthV2Rules, type DecisionAction, type DecisionView } from "@/lib/api/growth-v2";
import { PREVIEW_BUSINESS_NAME, PREVIEW_NOW } from "@/lib/growth-v2-fixtures";
import { KIND_LABEL, QUEUE_TABS, queueTab, tabCounts, whatsappPreview, type QueueTab } from "@/lib/growth-v2-decisions";
import { OUTCOME_UNIT, formatDay } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";
import { DecisionCard } from "./decision-card";
import { PageHead } from "./page-head";
import { QueryBoundary } from "./query-boundary";
import { ToneBadge, type Tone } from "./tone";

/** Decisions: "What needs you?" Every proposal, block and finished experiment in one queue (plan 1, H2). */
export function DecisionsScreen() {
  const query = useGrowthV2Decisions();
  const rules = useGrowthV2Rules();
  const { business } = useAuth();
  const mandate = rules.data?.data.mandate;
  const currency = mandate?.currency ?? "";
  const kind = mandate?.outcome.kind ?? "bookings";
  return (
    <div className="grid gap-4">
      <PageHead
        title="What needs you?"
        description="Every proposal, block and finished experiment in one queue. Each decision also goes to your WhatsApp, and you can answer in either place."
      />
      <QueryBoundary query={query}>
        {(r) => (
          <Inbox
            decisions={r.data.decisions}
            preview={r.preview}
            currency={currency}
            unitPlural={OUTCOME_UNIT[kind].many}
            businessName={r.preview ? PREVIEW_BUSINESS_NAME : (business?.name ?? "your business")}
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
  decisions,
  preview,
  currency,
  unitPlural,
  businessName,
}: {
  decisions: DecisionView[];
  preview: boolean;
  currency: string;
  unitPlural: string;
  businessName: string;
}) {
  const [tab, setTab] = useState<QueueTab>("needs_you");
  const [pickedId, setPickedId] = useState<string | null>(null);
  // A lazy initial value, so the clock is read once and is not an impure render.
  const [liveNow] = useState(() => Date.now());
  const now = preview ? PREVIEW_NOW : liveNow;
  const decide = useDecideV2();

  const counts = tabCounts(decisions);
  const inTab = decisions.filter((d) => queueTab(d.status) === tab);
  const selected = inTab.find((d) => d.id === pickedId) ?? inTab[0];

  const act = (action: DecisionAction) => {
    if (!selected) return;
    decide.mutate(
      { id: selected.id, action },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "That didn't go through. Nothing changed.") },
    );
  };

  return (
    <div className="grid min-h-[480px] overflow-hidden rounded-xl border bg-card lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col border-b lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b px-3.5 py-3">
          <b className="text-sm">Decisions</b>
          <ToneBadge>{counts.needs_you} open</ToneBadge>
        </div>
        <div role="group" aria-label="Filter decisions" className="flex flex-wrap gap-1.5 border-b px-3.5 py-2.5">
          {QUEUE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setPickedId(null);
              }}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                tab === t.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label} &middot; {counts[t.id]}
            </button>
          ))}
        </div>
        {inTab.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {tab === "needs_you" ? "Nothing needs you. The engine will list a proposal here the moment it has one." : "Nothing here yet."}
          </p>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto lg:max-h-none">
            {inTab.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  aria-current={selected?.id === d.id}
                  onClick={() => setPickedId(d.id)}
                  className={cn(
                    "block w-full border-b px-3.5 py-3 text-left hover:bg-muted aria-[current=true]:bg-chart-1/10 aria-[current=true]:shadow-[inset_3px_0_0_var(--chart-1)]",
                  )}
                >
                  <span className="flex items-center justify-between gap-1.5">
                    <ToneBadge tone={KIND_TONE[d.kind] ?? "neutral"}>{KIND_LABEL[d.kind]}</ToneBadge>
                    <span className="text-xs text-muted-foreground">{formatDay(d.createdAt)}</span>
                  </span>
                  <span className="mt-1 block text-sm font-medium">{d.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{d.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid min-w-0 content-start gap-4 p-4 sm:p-5">
        {selected ? (
          <>
            <DecisionCard
              decision={selected}
              currency={currency}
              unitPlural={unitPlural}
              now={now}
              onAction={preview ? undefined : act}
              actionsDisabled={preview ? "Preview data: nothing is sent." : undefined}
              pending={decide.isPending}
            />
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex items-center gap-2 rounded-xl border bg-background p-2 pl-3"
              aria-label="Ask about this decision"
            >
              <Input
                disabled
                aria-label="Ask about this decision"
                placeholder="Ask about this decision: “What if we stop X completely?”"
                className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button type="submit" size="sm" disabled title="Asking about a decision arrives with the council backend">
                <Send aria-hidden /> Ask
              </Button>
            </form>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Pick a decision on the left to see what it would change and why.</p>
        )}
      </div>

      <aside className="grid min-w-0 content-start gap-2.5 border-t p-3.5 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0" aria-label="Same decision on WhatsApp">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Same decision on WhatsApp</p>
        {selected ? <WhatsAppPhone d={selected} businessName={businessName} /> : null}
        <p className="text-xs text-muted-foreground">
          Sent as a utility message, worded as an account action. Spend needs a CONFIRM reply from a verified number. If there&apos;s no answer within
          72 hours, nothing happens.
        </p>
      </aside>
    </div>
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
