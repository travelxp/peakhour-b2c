"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Download, MessageSquareHeart, ShoppingBag, Star, UserRoundCheck, Bot } from "lucide-react";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { KpiCard } from "@/components/molecules/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Peaks } from "@/components/peaks/peaks";
import { useWaAnalytics } from "@/hooks/use-wa-analytics";
import { useCsatSetting, useSupportResults } from "@/hooks/use-support-results";
import { PageShell } from "@/components/dashboard/page-shell";
import { ApiError } from "@/lib/api";
import { downloadConversationExport } from "@/lib/wa-conversation-export";
import {
  CHANNEL_LABEL,
  CSAT_SWITCH_HELP,
  CSAT_SWITCH_LABEL,
  DEFINITIONS,
  barWidths,
  csatSwitchFailure,
  firstReplyNote,
  formatPercent,
  formatRating,
  formatWait,
  hourLabel,
  presetRange,
  rangeProblem,
  ratingNote,
  reasonLine,
  resolvedNote,
  revenueHeadline,
  supportExportPath,
  type SupportChannel,
  type SupportParams,
} from "@/lib/support-results";

const PILLAR_LABEL: Record<string, string> = {
  support: "Support",
  commerce: "Commerce",
  growth: "Growth",
  content: "Content",
  general: "General",
};

const PRESETS = [
  { days: 7 as const, label: "Last 7 days" },
  { days: 30 as const, label: "Last 30 days" },
  { days: 90 as const, label: "Last 90 days" },
];

const browserZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export default function SupportResultsPage() {
  const [preset, setPreset] = useState<7 | 30 | 90 | "custom">(30);
  const [range, setRange] = useState(() => presetRange(30));
  const [channel, setChannel] = useState<SupportChannel>("all");
  const [timeZone] = useState(browserZone);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const problem = rangeProblem(range.from, range.to);
  const half = (range.from === "") !== (range.to === "");
  const params: SupportParams = { from: range.from, to: range.to, channel, timeZone };
  const canRead = !problem && !half;
  const results = useSupportResults(params, canRead);
  const csat = useCsatSetting();
  const outcomes = useWaAnalytics(30);

  const m = results.data?.metrics;
  const revenue = results.data?.revenue;
  const csatEnabled = results.data?.csatEnabled ?? false;
  const pending = results.isPending && canRead;
  const total = outcomes.data?.totalPeaks ?? 0;
  const maxPillar = Math.max(1, ...(outcomes.data?.byPillar ?? []).map((p) => p.peaks));

  const choosePreset = (days: 7 | 30 | 90) => {
    setPreset(days);
    setRange(presetRange(days));
  };

  const exportCsv = async () => {
    setExporting(true);
    setExportMessage(null);
    const out = await downloadConversationExport(supportExportPath(params), "support-results.csv");
    setExporting(false);
    if (!out.ok) setExportMessage(out.message);
  };

  const hourBars = m ? barWidths(m.volume.byHour.map((h) => h.whatsapp + h.storefront)) : [];
  const ratingBars = m ? barWidths([5, 4, 3, 2, 1].map((s) => m.csat.distribution[String(s) as "1"])) : [];
  const switchError = csat.error instanceof ApiError ? csatSwitchFailure(csat.error.status) : csat.error ? csatSwitchFailure(500) : null;

  return (
    <PageShell>
      <CronToolbar crons={["wa-outcome-billing"]} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support results</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How your assistant and your team are handling customer conversations. Your own Test on your store chats are never counted.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Want to ask a question about your conversations? <Link href="/dashboard/inbox?tab=ask" className="underline underline-offset-2">Ask your inbox</Link> is in the Inbox.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Choose what to show">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button key={p.days} type="button" size="sm" variant={preset === p.days ? "default" : "outline"} aria-pressed={preset === p.days} onClick={() => choosePreset(p.days)}>
              {p.label}
            </Button>
          ))}
        </div>
        <label className="text-xs text-muted-foreground">
          From
          <input
            type="date"
            className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm text-foreground"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => {
              setPreset("custom");
              setRange((r) => ({ ...r, from: e.target.value }));
            }}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <input
            type="date"
            className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm text-foreground"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => {
              setPreset("custom");
              setRange((r) => ({ ...r, to: e.target.value }));
            }}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Channel
          <select className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm text-foreground" value={channel} onChange={(e) => setChannel(e.target.value as SupportChannel)}>
            {(Object.keys(CHANNEL_LABEL) as SupportChannel[]).map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" size="sm" variant="outline" onClick={exportCsv} disabled={!canRead || exporting}>
          <Download aria-hidden="true" /> {exporting ? "Preparing…" : "Download CSV"}
        </Button>
      </div>
      {(problem || half) && <p role="alert" className="text-sm text-destructive-on-tint">{problem ?? "Choose both a first and a last day, or pick one of the ranges."}</p>}
      {exportMessage && <p role="alert" className="text-sm text-destructive-on-tint">{exportMessage}</p>}

      {results.isError && (
        <Card className="p-4" role="alert">
          <p className="text-sm font-medium">We couldn&apos;t load your support results.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again. Your conversations are not affected.</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void results.refetch()}>
            Try again
          </Button>
        </Card>
      )}

      {pending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        m &&
        revenue && (
          <>
            {m.truncated && (
              <p role="status" className="text-sm text-muted-foreground">
                There are more conversations in this range than we can read at once, so these figures cover the most recent part. Choose a shorter range for exact numbers.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard title="Resolved by the assistant" value={formatPercent(m.aiResolved.share)} icon={Bot} description={resolvedNote(m)} />
              <KpiCard title="First reply by a person" value={formatWait(m.firstReply.medianMs)} icon={Clock} description={firstReplyNote(m.firstReply)} />
              <KpiCard title="Customer rating" value={formatRating(m.csat.average)} icon={Star} description={ratingNote(m, csatEnabled)} />
              <KpiCard
                title="Revenue from chats"
                value={revenueHeadline(revenue).value}
                icon={ShoppingBag}
                description={revenueHeadline(revenue).note}
              />
            </div>
            <p className="-mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Estimated</Badge>
              Revenue from chats is an estimate, not a measured result.
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <UserRoundCheck aria-hidden="true" className="size-4 text-muted-foreground" /> Handed to your team
                </p>
                <p className="mt-2 text-2xl font-bold">{m.handOver.count.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">
                  {m.handOver.rate === null ? "No WhatsApp conversations in this range." : `${formatPercent(m.handOver.rate)} of ${m.conversations.whatsapp.toLocaleString("en-IN")} WhatsApp conversations.`}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {m.handOver.reasons.length === 0 && <li className="text-muted-foreground">Nothing was handed over in this range.</li>}
                  {m.handOver.reasons.map((r) => (
                    <li key={r.reason}>{reasonLine(r)}</li>
                  ))}
                </ul>
              </Card>

              <Card className="p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 aria-hidden="true" className="size-4 text-muted-foreground" /> Time to resolve
                </p>
                <p className="mt-2 text-2xl font-bold">{formatWait(m.resolution.medianMs).replace("No replies yet", "Nothing marked done")}</p>
                <p className="text-xs text-muted-foreground">
                  {m.resolution.count === 0
                    ? "No conversation was marked done by a person in this range."
                    : `Middle time from a customer's first message to a person marking it done (${m.resolution.count.toLocaleString("en-IN")} conversations). 9 in 10 took less than ${formatWait(m.resolution.p90Ms)}.`}
                </p>
              </Card>

              <Card className="p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquareHeart aria-hidden="true" className="size-4 text-muted-foreground" /> Ratings
                </p>
                <div className="mt-3 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((s, i) => (
                    <div key={s} className="flex items-center gap-3 text-sm">
                      <span className="w-14 shrink-0">{s} out of 5</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${ratingBars[i] ?? 0}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right tabular-nums">{m.csat.distribution[String(s) as "1"]}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Closed by the assistant: {formatRating(m.csat.byResolvedBy.ai.average)} ({m.csat.byResolvedBy.ai.responses}). Closed by a person: {formatRating(m.csat.byResolvedBy.human.average)} ({m.csat.byResolvedBy.human.responses}).
                </p>
              </Card>

              <Card className="p-4">
                <p className="text-sm font-medium">Customer messages by hour</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  WhatsApp {m.volume.byChannel.whatsapp.toLocaleString("en-IN")} · Storefront chat {m.volume.byChannel.storefront.toLocaleString("en-IN")} · hours in {m.timeZone}
                </p>
                <div className="mt-3 flex h-24 items-end gap-0.5" role="img" aria-label="Customer messages by hour of the day">
                  {m.volume.byHour.map((h, i) => (
                    <div key={h.hour} className="flex h-full flex-1 items-end" title={`${hourLabel(h.hour)}: ${h.whatsapp + h.storefront}`}>
                      <div className="w-full rounded-sm bg-primary" style={{ height: `${hourBars[i] ?? 0}%`, minHeight: h.whatsapp + h.storefront > 0 ? 2 : 0 }} />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{hourLabel(0)}</span>
                  <span>{hourLabel(12)}</span>
                  <span>{hourLabel(23)}</span>
                </div>
              </Card>
            </div>
          </>
        )
      )}

      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{CSAT_SWITCH_LABEL}</p>
            <p className="mt-1 text-sm text-muted-foreground">{CSAT_SWITCH_HELP}</p>
          </div>
          <Switch
            aria-label={CSAT_SWITCH_LABEL}
            checked={csat.isPending ? !csatEnabled : csatEnabled}
            disabled={csat.isPending || results.isPending}
            onCheckedChange={(on) => csat.mutate(on)}
          />
        </div>
        {switchError && <p role="alert" className="mt-2 text-sm text-destructive-on-tint">{switchError}</p>}
      </Card>

      <Card className="p-4">
        <p className="text-sm font-medium">How these are counted</p>
        <dl className="mt-3 space-y-2 text-sm">
          {DEFINITIONS.map((d) => (
            <div key={d.term}>
              <dt className="font-medium">{d.term}</dt>
              <dd className="text-muted-foreground">{d.text}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Billed outcomes, last {outcomes.data?.windowDays ?? 30} days</h2>
        <p className="mt-1 text-sm text-muted-foreground">What your WhatsApp assistant delivered. You’re billed on outcomes, not chatter.</p>
      </div>

      {outcomes.isPending ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard title="Resolved conversations" value={outcomes.data?.resolved.count ?? 0} icon={CheckCircle2} />
          <KpiCard title="Assisted orders" value={outcomes.data?.assisted.count ?? 0} icon={ShoppingBag} />
          <Card className="p-4">
            <p className="text-sm font-medium text-muted-foreground">AI credits spent</p>
            <div className="mt-2">
              <Peaks amount={total} unit="AI credits" />
            </div>
          </Card>
        </div>
      )}

      <Card className="p-4">
        <p className="text-sm font-medium">Outcomes by product</p>
        <div className="mt-3 space-y-2.5">
          {outcomes.isPending && <Skeleton className="h-4 w-full" />}
          {!outcomes.isPending && (outcomes.data?.byPillar.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No billable outcomes yet.</p>
          )}
          {outcomes.data?.byPillar.map((p) => (
            <div key={p.pillar} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm">{PILLAR_LABEL[p.pillar] ?? p.pillar}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(p.peaks / maxPillar) * 100}%` }} />
              </div>
              <span className="w-36 shrink-0 text-right">
                <Peaks amount={p.peaks} unit="AI credits" />
              </span>
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
