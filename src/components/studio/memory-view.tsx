"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import type { MemoryLine, MemoryRead, MemoryTrends } from "@/lib/api/creative";
import { MEMORY_LINE_MAX } from "@/lib/api/creative";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { MeasurementBadge } from "@/components/growth-v2/measurement-badge";
import { QueryError } from "@/components/dashboard/query-error";
import { checkDraft, lineNote, tasteLines } from "@/lib/studio-memory";
import { STUDIO_ROUTES, type IdeasFeedStatus } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";

const C = STUDIO_COPY.learned;

/** What the page can do, as callbacks that resolve to whether it worked, so the row knows whether to close its editor. */
export interface MemoryActions {
  onStop: (line: MemoryLine) => void;
  onSave: (line: MemoryLine, text: string) => Promise<boolean>;
  onAdd: (text: string) => Promise<boolean>;
  onPooled: (optIn: boolean) => void;
  onExport: () => void;
  onWipe: () => void;
}

function CharCount({ id, n }: { id: string; n: number }) {
  return (
    <p id={id} className={n > MEMORY_LINE_MAX ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
      {n > MEMORY_LINE_MAX ? C.tooLong(MEMORY_LINE_MAX) : C.counter(n, MEMORY_LINE_MAX)}
    </p>
  );
}

function LineRow({
  line,
  canChange,
  proTools,
  initialEditing,
  busy,
  actions,
}: {
  line: MemoryLine;
  canChange: boolean;
  proTools: boolean;
  initialEditing: boolean;
  busy: boolean;
  actions: MemoryActions;
}) {
  const [editing, setEditing] = useState(initialEditing && line.editable && proTools);
  const [text, setText] = useState(line.text);
  const [saving, setSaving] = useState(false);
  const draft = checkDraft(text);
  const inputId = `studio-line-${line.id}`;
  return (
    <li className="space-y-2 rounded-lg border bg-card p-3" data-line-source={line.source}>
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.ok || saving) return;
            setSaving(true);
            const ok = await actions.onSave(line, draft.text);
            setSaving(false);
            if (ok) setEditing(false);
          }}
        >
          <Label htmlFor={inputId}>{C.editLabel(line.text)}</Label>
          <Input id={inputId} className="h-11" value={text} onChange={(e) => setText(e.target.value)} aria-describedby={`${inputId}-count`} aria-invalid={!draft.ok && draft.problem === "too_long"} />
          <CharCount id={`${inputId}-count`} n={text.trim().length} />
          <div className="flex gap-2">
            <Button type="submit" className="h-11" disabled={!draft.ok || saving}>
              {C.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => {
                setText(line.text);
                setEditing(false);
              }}
            >
              {C.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-sm font-medium">{line.text}</p>
          <p className="text-xs text-muted-foreground">{lineNote(line)}</p>
          {canChange && (
            <div className="flex flex-wrap gap-2">
              {proTools && line.editable && (
                <Button type="button" variant="outline" className="h-11" aria-label={C.editLabel(line.text)} onClick={() => {
                    // Start from what the line says now, not from what it said when this row was first drawn.
                    setText(line.text);
                    setEditing(true);
                  }}>
                  {C.edit}
                </Button>
              )}
              <Button type="button" variant="outline" className="h-11 gap-1.5" aria-label={C.stopUsingLabel(line.text)} disabled={busy} onClick={() => actions.onStop(line)}>
                <Trash2 aria-hidden="true" className="size-4" />
                {C.stopUsing}
              </Button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

function AddLine({ actions }: { actions: MemoryActions }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const draft = checkDraft(text);
  return (
    <form
      className="space-y-2 rounded-lg border border-dashed p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft.ok || saving) return;
        setSaving(true);
        const ok = await actions.onAdd(draft.text);
        setSaving(false);
        if (ok) setText("");
      }}
    >
      <Label htmlFor="studio-add-line">{C.addLabel}</Label>
      <Input id="studio-add-line" className="h-11" value={text} placeholder={C.addPlaceholder} onChange={(e) => setText(e.target.value)} aria-describedby="studio-add-line-count" />
      <CharCount id="studio-add-line-count" n={text.trim().length} />
      <Button type="submit" className="h-11" disabled={!draft.ok || saving}>
        {C.addButton}
      </Button>
    </form>
  );
}

/**
 * "Is it getting better?": below 10 approved posts the one plain line; past that, three cards (now against the first month, with the posts behind each
 * number), or "still comparing" while the first month or the latest stretch has too few posts of its own. Never a before/after claim as proof: the
 * words say "now" and "in your first month", and the badge says how many posts it is read from.
 */
export function TrendsSection({ trends }: { trends: MemoryTrends }) {
  return (
    <section aria-labelledby="studio-trends-title" className="space-y-2">
      <h2 id="studio-trends-title" className="text-lg font-semibold">
        {C.trendsTitle}
      </h2>
      {!trends.enough ? (
        <>
          <p className="text-sm text-muted-foreground">{C.trendsNeed(trends.needs)}</p>
          <p className="text-xs text-muted-foreground">{C.trendsPosts(trends.approvedPosts)}</p>
        </>
      ) : trends.lines.length === 0 ? (
        <>
          <p className="text-sm text-muted-foreground">{C.trendsReady(trends.approvedPosts)}</p>
          <p className="text-sm text-muted-foreground">{C.trendsBuilding}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{C.trendsReady(trends.approvedPosts)}</p>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {trends.lines.map((t) => {
              const title = C.trendTitles[t.key];
              const now = C.trendValue(t.unit, t.now);
              const first = C.trendValue(t.unit, t.first);
              return (
                <li key={t.key} data-trend={t.key} data-direction={t.direction} className="space-y-1.5">
                  <KpiCard title={title} value={now} description={C.trendDirection[t.direction]} />
                  <MeasurementBadge state="measured" detail={C.trendEvidence(t.evidence.now, t.evidence.first)} />
                  <p className="sr-only">{C.trendSummary(title, now, first)}</p>
                  <p aria-hidden="true" className="text-xs text-muted-foreground">
                    {C.trendFirst(first)}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * "What we've learned about you" (UX spec S15), drawn from what it is told so every state can be rendered and tested on its own.
 * Sections in order: Your taste (each line with its evidence and "Stop using this"), Rules that always win (read only, never editable
 * here), Is it getting better, Privacy. Edit and Add are Pro tools. A viewer reads everything and changes nothing.
 */
export function MemoryView({
  status,
  data,
  hasMore = false,
  loadingMore = false,
  onMore = () => {},
  proTools,
  canChange,
  busyIds,
  exporting,
  pooledBusy,
  initialEditingId,
  onRetry,
  actions,
}: {
  status: IdeasFeedStatus;
  data?: MemoryRead;
  /** More lines wait on the api (the cursor), and the next page is on its way. */
  hasMore?: boolean;
  loadingMore?: boolean;
  onMore?: () => void;
  proTools: boolean;
  /** Editor or above. The api refuses a viewer's change; the buttons say so up front. */
  canChange: boolean;
  /** The lines whose delete is in flight. */
  busyIds?: ReadonlySet<string>;
  exporting?: boolean;
  /** The opt-in change is on its way: the switch waits for it. */
  pooledBusy?: boolean;
  /** Opens that line's editor on first draw (tests; the page leaves it unset). */
  initialEditingId?: string;
  onRetry: () => void;
  actions: MemoryActions;
}) {
  if (status === "loading") {
    return (
      <div aria-busy="true" aria-label={C.loading} className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }
  if (status === "offline") return <QueryError what={C.error} kind="offline" />;
  if (status === "error" || !data) return <QueryError what={C.error} onRetry={onRetry} />;

  const taste = tasteLines(data);
  const showAdd = proTools && canChange;
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-6">
        <section aria-labelledby="studio-taste-title" className="space-y-3">
          <h2 id="studio-taste-title" className="text-lg font-semibold">
            {C.tasteTitle}
          </h2>
          {!canChange && <p className="text-sm text-muted-foreground">{C.viewerNote}</p>}
          {taste.length === 0 && !hasMore ? (
            <EmptyState
              className="min-h-0"
              icon={Sparkles}
              title={STUDIO_COPY.shells.learned.emptyTitle}
              description={STUDIO_COPY.shells.learned.emptyDescription}
              action={{ label: STUDIO_COPY.shells.learned.emptyAction, href: STUDIO_ROUTES.home }}
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{C.tasteIntro}</p>
              <ul className="space-y-3">
                {taste.map((l) => (
                  <LineRow key={l.id} line={l} canChange={canChange} proTools={proTools} initialEditing={initialEditingId === l.id} busy={busyIds?.has(l.id) ?? false} actions={actions} />
                ))}
              </ul>
              {(hasMore || data.totalLines > taste.length) && <p className="text-xs text-muted-foreground">{C.shownOf(taste.length, data.totalLines)}</p>}
              {hasMore && (
                <Button type="button" variant="outline" className="h-11" disabled={loadingMore} onClick={onMore}>
                  {loadingMore ? C.loadingMoreLines : C.moreLines}
                </Button>
              )}
            </>
          )}
          {showAdd && <AddLine actions={actions} />}
        </section>

        <section aria-labelledby="studio-rules-title" className="space-y-3">
          <h2 id="studio-rules-title" className="text-lg font-semibold">
            {C.rulesTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{data.note || C.rulesNote}</p>
          <ul className="space-y-3">
            {data.rules.map((r, i) => (
              <li key={`${i}:${r.text}`} data-rule className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-sm">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {r.text}
                </p>
                {r.changeIn === "brand-kit" && (
                  <Button asChild variant="outline" className="h-11">
                    <Link href={C.brandKitHref}>{C.changeInBrandKit}</Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="space-y-6">
        <TrendsSection trends={data.trends} />

        <section aria-labelledby="studio-privacy-title" className="space-y-3">
          <h2 id="studio-privacy-title" className="text-lg font-semibold">
            {C.privacyTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{C.privacyIntro}</p>
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor="studio-pooled" className="text-sm font-medium">
                {C.pooledLabel}
              </Label>
              <p id="studio-pooled-help" className="text-xs text-muted-foreground">
                {C.pooledHelp}
              </p>
            </div>
            <Switch id="studio-pooled" checked={data.pooledOptIn} disabled={!canChange || pooledBusy} aria-describedby="studio-pooled-help" onCheckedChange={(v) => actions.onPooled(v)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-11 gap-1.5" disabled={exporting} onClick={actions.onExport}>
              <Download aria-hidden="true" className="size-4" />
              {C.export}
            </Button>
            <Button type="button" variant="outline" className="h-11 gap-1.5 text-destructive" disabled={!canChange} onClick={actions.onWipe}>
              <Trash2 aria-hidden="true" className="size-4" />
              {C.wipe}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
