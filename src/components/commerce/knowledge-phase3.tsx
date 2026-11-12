"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Download, Loader2, MessagesSquare, Scale, SearchCheck, Radar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useKbBenchmarks, useKbCandidates, useKbCapabilities, useKbCoverage, useKbEvidence, usePublishSet } from "@/hooks/use-knowledge-base";
import { insightsHref } from "@/lib/insights";
import { downloadConversationExport } from "@/lib/wa-conversation-export";
import { RECONNECT_HREF } from "@/lib/policy-builder";
import {
  BENCHMARKS_NOTE,
  COVERAGE_DAYS,
  COVERAGE_EMPTY,
  ICE_BREAKERS_HELP,
  REPLACE_HELP,
  REPLACE_LABEL,
  TITLE_TOO_LONG_NOTE,
  benchmarkView,
  candidateAskedLine,
  channelsCountedLine,
  evidenceDownloadError,
  evidenceError,
  evidenceExportPath,
  evidenceFallbackName,
  evidenceItemView,
  evidenceOrder,
  keepKnown,
  maxOf,
  outcomeLines,
  placedLine,
  preselect,
  setBody,
  setCallError,
  setSections,
  setWhere,
  toggleChoice,
  topicRows,
  weekRows,
  type BenchmarkView,
  type CandidatesResponse,
  type CoverageDays,
  type CoverageResponse,
  type OutcomeLine,
  type PolicyEvidence,
  type PolicyStanding,
  type SetSection,
} from "@/lib/knowledge-phase3";

// -- Benchmarks ----------------------------------------------------------------------------------------------------------------

/** How your return window, free-shipping threshold and cash-on-delivery share compare with similar stores. One sentence per figure, as the api words it. */
export function PolicyStandingCard() {
  const q = useKbBenchmarks();
  let body: React.ReactNode = null;
  if (q.isLoading) body = <Skeleton className="h-16 w-full" />;
  else if (q.isError && !q.data)
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Could not load the comparison.
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  else if (q.data) body = <BenchmarksView standing={q.data} />;
  if (body === null) return null;
  return (
    <div data-kb-benchmarks className="space-y-2 rounded-md border p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Scale className="size-4" aria-hidden="true" />
        How your policies compare with stores like yours
      </h3>
      {body}
    </div>
  );
}

export function BenchmarksView({ standing }: { standing: PolicyStanding }) {
  const view: BenchmarkView | null = benchmarkView(standing);
  if (!view) return null;
  if (view.kind === "note")
    return (
      <p data-kb-benchmarks-note className="text-sm text-muted-foreground">
        {view.text}{" "}
        {view.href && view.linkLabel && (
          <Link href={view.href} className="font-medium underline underline-offset-2">
            {view.linkLabel}
          </Link>
        )}
      </p>
    );
  return (
    <>
      <ul className="space-y-2 text-sm">
        {view.figures.map((f) => (
          <li key={f.key} data-kb-figure={f.tone}>
            <span className="font-medium capitalize">{f.label}</span>
            <span className="text-muted-foreground">: </span>
            <span className={f.tone === "quiet" ? "text-muted-foreground" : undefined}>{f.text}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{BENCHMARKS_NOTE}</p>
    </>
  );
}

// -- Evidence --------------------------------------------------------------------------------------------------------------------

/** "What was live when this order was placed": for a dispute. A record of what Peakhour holds. */
export function EvidencePanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <SearchCheck className="mr-1 size-4" aria-hidden="true" />
        {open ? "Hide the order check" : "Check what was live for an order"}
      </Button>
      {open && <EvidenceLookup />}
    </div>
  );
}

function EvidenceLookup() {
  const id = useId();
  const [typed, setTyped] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const q = useKbEvidence(asked);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = evidenceOrder(typed);
    if (!r.ok) {
      setFormError(r.error);
      return;
    }
    setFormError(null);
    // the same order again is a retry: the query key has not changed, so it is asked again by hand
    if (r.order === asked) void q.refetch();
    else setAsked(r.order);
  };
  return (
    <div data-kb-evidence className="space-y-3 rounded-md border p-3">
      <p className="text-sm text-muted-foreground">
        Enter an order to see the policy text Peakhour held as live when it was placed, and where. Use it with a dispute. It is a record of what Peakhour holds.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label htmlFor={id} className="space-y-1 text-sm">
          <span className="font-medium">Order number or id</span>
          <Input id={id} value={typed} maxLength={64} placeholder="#1001" onChange={(e) => setTyped(e.target.value)} aria-invalid={formError ? true : undefined} aria-describedby={formError ? `${id}-err` : undefined} />
        </label>
        <Button type="submit" size="sm" disabled={q.isFetching}>
          {q.isFetching && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
          Look up
        </Button>
      </form>
      {formError && (
        <p id={`${id}-err`} role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      {asked !== null && q.isError && (
        <p role="alert" className="text-sm text-destructive">
          {evidenceError(q.error)}
        </p>
      )}
      {asked !== null && q.data && <EvidenceView evidence={q.data} order={asked} />}
    </div>
  );
}

export function EvidenceView({ evidence, order, download }: { evidence: PolicyEvidence; order: string; download?: (path: string, name: string) => Promise<{ ok: true } | { ok: false; message: string }> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run =
    download ??
    ((path: string, name: string) => downloadConversationExport(path, name, (status) => evidenceDownloadError(status)));
  const items = evidence.policies.map((p) => evidenceItemView(p, evidence.order.timeZone));
  const onDownload = async () => {
    setBusy(true);
    setError(null);
    const r = await run(evidenceExportPath(order), evidenceFallbackName(order));
    setBusy(false);
    if (!r.ok) setError(r.message);
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1">
        <p className="font-medium">{evidence.summary}</p>
        <p data-kb-placed className="text-muted-foreground">
          {placedLine(evidence.order)}
        </p>
        {evidence.order.timeZoneNote && <p className="text-xs text-muted-foreground">{evidence.order.timeZoneNote}</p>}
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground">Peakhour has no policy record to show for this order.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.key} data-kb-evidence-item>
              <Card>
                <CardContent className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{it.title}</p>
                    <Badge variant="outline">{it.where}</Badge>
                  </div>
                  <p className="font-medium">{it.status}</p>
                  <p className="text-xs text-muted-foreground">{it.sentence}</p>
                  <p className="break-all text-xs text-muted-foreground">Target: {it.target}</p>
                  {it.text !== null && <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border p-2 text-xs">{it.text}</pre>}
                  {it.hash && <p className="break-all text-xs text-muted-foreground">Hash: {it.hash}</p>}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {evidence.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {evidence.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <div className="space-y-1">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void onDownload()}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 size-4" aria-hidden="true" />}
          Download as a file
        </Button>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// -- Conversation starters -----------------------------------------------------------------------------------------------------

/** Messenger and Instagram conversation starters: drawn only from the slots `publish/capabilities` lists. Nothing is drawn for a business with none. */
export function ConversationStarters() {
  const caps = useKbCapabilities();
  const sections = setSections(caps.data);
  if (sections.length === 0) return null;
  return (
    <section aria-labelledby="kb-starters" className="space-y-3">
      <h2 id="kb-starters" className="flex items-center gap-2 text-lg font-semibold">
        <MessagesSquare className="size-5" aria-hidden="true" />
        Conversation starters
      </h2>
      <p className="text-sm text-muted-foreground">{ICE_BREAKERS_HELP}</p>
      <ul className="space-y-3">
        {sections.map((s) => (
          <li key={s.key}>
            <StarterSection section={s} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StarterSection({ section }: { section: SetSection }) {
  // the candidates are read only for a slot that is open: a slot Meta has not approved yet says so and asks nothing more
  const cand = useKbCandidates(section.channel, section.slot, section.enabled);
  const publish = usePublishSet();
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [replace, setReplace] = useState(false);
  const [outcome, setOutcome] = useState<{ lines: OutcomeLine[]; removedLine: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // a pick can only hold entries that are still candidates: one archived or expired elsewhere drops out
  const picked = keepKnown(chosen ?? preselect(cand.data), cand.data);
  const run = async () => {
    setError(null);
    setOutcome(null);
    const body = setBody(section, picked, replace, maxOf(cand.data));
    if (!body.ok) {
      setError(body.error);
      return;
    }
    try {
      const res = await publish.mutateAsync(body.body);
      const titles = Object.fromEntries((cand.data?.candidates ?? []).map((c) => [c.id, c.title]));
      setOutcome(outcomeLines(res, titles));
      // a take-down is asked for each time, never carried over to the next publish
      setReplace(false);
    } catch (e) {
      setError(setCallError(e));
    }
  };
  return (
    <StarterSectionView
      section={section}
      data={cand.data}
      loading={cand.isLoading && section.enabled}
      failed={cand.isError && !cand.data}
      onRetry={() => void cand.refetch()}
      picked={picked}
      onToggle={(id) => setChosen(toggleChoice(picked, id, maxOf(cand.data)))}
      replace={replace}
      onReplace={setReplace}
      busy={publish.isPending}
      onPublish={() => void run()}
      outcome={outcome}
      error={error}
    />
  );
}

export function StarterSectionView({
  section,
  data,
  loading,
  failed,
  onRetry,
  picked,
  onToggle,
  replace,
  onReplace,
  busy,
  onPublish,
  outcome,
  error,
}: {
  section: SetSection;
  data: CandidatesResponse | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  picked: readonly string[];
  onToggle: (id: string) => void;
  replace: boolean;
  onReplace: (v: boolean) => void;
  busy: boolean;
  onPublish: () => void;
  outcome: { lines: OutcomeLine[]; removedLine: string | null } | null;
  error: string | null;
}) {
  const uid = useId();
  const max = maxOf(data);
  return (
    <Card>
      <CardContent data-kb-starters={section.slot} className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">{section.heading}</h3>
          <span className="text-xs text-muted-foreground">on {section.connectionLabel}</span>
        </div>
        {section.note && (
          <p data-kb-starters-note className="text-sm text-muted-foreground">
            {section.note}{" "}
            {section.reconnect && (
              <Link href={RECONNECT_HREF} className="font-medium underline underline-offset-2">
                Reconnect
              </Link>
            )}
          </p>
        )}
        {section.enabled && loading && <Skeleton className="h-20 w-full" />}
        {section.enabled && failed && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
            Could not load your questions.
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
        {section.enabled && data && data.candidates.length === 0 && <p className="text-sm text-muted-foreground">You have no approved entries to pick from yet. Approve a suggested answer first.</p>}
        {section.enabled && data && data.candidates.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Choose up to {max}, most asked first</legend>
            <ul className="space-y-1">
              {data.candidates.map((c) => {
                const ticked = picked.includes(c.id);
                const full = !ticked && picked.length >= max;
                const disabled = busy || !c.fits || full;
                return (
                  <li key={c.id} className="text-sm">
                    <label className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" checked={ticked} disabled={disabled} onChange={() => onToggle(c.id)} aria-describedby={`${uid}-${c.id}`} />
                      <span>
                        <span className="font-medium">{c.title}</span>
                        <span id={`${uid}-${c.id}`} className="block text-xs text-muted-foreground">
                          {candidateAskedLine(c)}
                          {c.published ? " · on your Page now" : ""}
                          {!c.fits ? ` · ${TITLE_TOO_LONG_NOTE}` : ""}
                          {full ? ` · You have chosen ${max}. Untick one to swap it.` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={replace} disabled={busy} onChange={(e) => onReplace(e.target.checked)} aria-describedby={`${uid}-replace`} />
              <span>
                <span className="font-medium">{REPLACE_LABEL}</span>
                <span id={`${uid}-replace`} className="block text-xs text-muted-foreground">
                  {REPLACE_HELP}
                </span>
              </span>
            </label>
            <Button size="sm" disabled={busy || picked.length === 0} onClick={onPublish}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              Publish to {setWhere(section.slot)}
            </Button>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {outcome && (
          <div role="status" data-kb-outcomes className="space-y-1 text-sm">
            {outcome.removedLine && <p>{outcome.removedLine}</p>}
            <ul className="space-y-1">
              {outcome.lines.map((l) => (
                <li key={l.entryId} data-outcome={l.tone} className={l.tone === "bad" ? "text-destructive" : l.tone === "quiet" ? "text-muted-foreground" : undefined}>
                  <span className="font-medium">{l.title}</span>: {l.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -- Coverage ------------------------------------------------------------------------------------------------------------------

/** What shoppers ask about, topic by topic, and how much of it your assistant could answer. Absent when the api does not have it yet. */
export function CoverageMap() {
  const [days, setDays] = useState<CoverageDays>(30);
  const q = useKbCoverage(days);
  // hide before anything else: a 404 (not shipped yet) is not an error to show
  if (q.hidden) return null;
  let body: React.ReactNode = null;
  if (q.isLoading) body = <Skeleton className="h-24 w-full" />;
  else if (q.isError && !q.data)
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Could not load what shoppers ask about.
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  else if (q.data) body = <CoverageView data={q.data} />;
  if (body === null) return null;
  return (
    <section aria-labelledby="kb-coverage" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="kb-coverage" className="flex items-center gap-2 text-lg font-semibold">
          <Radar className="size-5" aria-hidden="true" />
          What shoppers ask about
        </h2>
        <select aria-label="Time to look back over" className="rounded-md border bg-background px-2 py-1 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value) as CoverageDays)}>
          {COVERAGE_DAYS.map((d) => (
            <option key={d} value={d}>
              Last {d} days
            </option>
          ))}
        </select>
      </div>
      {body}
    </section>
  );
}

export function CoverageView({ data }: { data: CoverageResponse }) {
  const topics = topicRows(data.topics);
  const weeks = weekRows(data.answeredRate.weeks);
  const insights = insightsHref("missing_info");
  return (
    <div className="space-y-4">
      {topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{COVERAGE_EMPTY}</p>
      ) : (
        <ul data-kb-topics className="space-y-2">
          {topics.map((t) => (
            <li key={t.key} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.askedLine}</span>
              <Badge variant={t.covered ? "default" : "outline"}>{t.covered ? "Covered" : "Not covered"}</Badge>
              {t.action.kind === "request" && (
                <Link href={insights} className="font-medium underline underline-offset-2">
                  {t.action.label}
                </Link>
              )}
              {t.action.kind === "policy" && (
                <a href="#kb-policies" className="font-medium underline underline-offset-2">
                  {t.action.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {weeks.length > 0 && (
        <div data-kb-weeks className="space-y-1">
          <h3 className="text-sm font-medium">Questions answered, by week</h3>
          <p className="text-xs text-muted-foreground">{channelsCountedLine(data.answeredRate.channels)}</p>
          <table className="w-full text-sm">
            <caption className="sr-only">Questions asked and answered each week</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-2 font-normal">
                  Week
                </th>
                <th scope="col" className="py-1 pr-2 font-normal">
                  Asked
                </th>
                <th scope="col" className="py-1 pr-2 font-normal">
                  Answered
                </th>
                <th scope="col" className="py-1 font-normal">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.weekStart} className="border-t">
                  <th scope="row" className="py-1 pr-2 text-left font-normal">
                    {w.label}
                  </th>
                  <td className="py-1 pr-2">{w.asked}</td>
                  <td className="py-1 pr-2">{w.answered}</td>
                  <td className="w-1/3 py-1">
                    <div className="flex items-center gap-2">
                      <div aria-hidden="true" className="relative h-2 flex-1 rounded bg-muted">
                        <div className="absolute inset-y-0 left-0 rounded bg-primary/25" style={{ width: `${w.askedBarPct}%` }} />
                        <div className="absolute inset-y-0 left-0 rounded bg-primary" style={{ width: `${w.barPct}%` }} />
                      </div>
                      <span className="w-20 text-right text-xs">{w.pct === null ? "None asked" : `${w.pct}%`}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.notes.length > 0 && (
        <ul data-kb-coverage-notes className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
