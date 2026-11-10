"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, ClipboardCheck, ExternalLink, Loader2, MessageCircleQuestion, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { insightsHref } from "@/lib/insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DataToolbar, DataToolbarSearch } from "@/components/molecules/data-table/data-toolbar";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  useAnswerKbRequest,
  useApproveSuggestion,
  useCreateKbEntry,
  useDismissKbRequest,
  useDismissSuggestion,
  useFindingAction,
  useKbEntries,
  useKbEntryAction,
  useKbFindings,
  useKbRequests,
  useKbSuggestions,
  useSaveSuggestion,
  useUpdateKbEntry,
  type EntryFilter,
} from "@/hooks/use-knowledge-base";
import { useCommerceStores } from "@/hooks/use-commerce-stores";
import {
  APPROVED_LINE,
  EMPTY_FORM,
  KB_CHANNELS,
  KB_CONTENT_MAX,
  KB_TITLE_MAX,
  askedLine,
  answerToPayload,
  approveState,
  basedOnLine,
  channelLabel,
  channelsLine,
  charsLeft,
  entryToForm,
  findingFooter,
  FINDINGS_DISMISSED_EMPTY,
  FINDINGS_EMPTY,
  formToPayload,
  groupFindings,
  isImportedPolicy,
  kbErrorMessage,
  placeholdersIn,
  readOnlyNote,
  realityLine,
  routedLines,
  runAction,
  runApprove,
  safeUrl,
  severityHeading,
  shopifyPoliciesHref,
  sortSuggestions,
  sourceLabel,
  splitPlaceholders,
  SUGGESTIONS_EMPTY,
  suggestionAskedLine,
  type KbEntry,
  type KbFinding,
  type KbForm,
  type KbRequest,
  type KbSuggestion,
  type KbSuggestionsResponse,
} from "@/lib/knowledge-base";
import { shopOf } from "@/lib/insights";

/**
 * Commerce -> Knowledge base. What your assistant knows beyond the catalog: the
 * answers it gives on WhatsApp and on your storefront. "Questions to answer" are
 * the things shoppers asked that it could not answer; answering one writes an
 * entry. Imported store policies are shown read-only (they refresh from
 * Shopify); take one over to write your own version.
 */
export function KnowledgeBase() {
  return (
    <div className="space-y-8">
      <Questions />
      <Suggestions />
      <PolicyHealth />
      <Entries />
    </div>
  );
}

function Questions() {
  const { data, isLoading, isError } = useKbRequests();
  if (isLoading) return <Skeleton className="h-6 w-64" />;
  if (isError) return <p className="text-sm text-destructive">Could not load the questions to answer. Please refresh.</p>;
  // no answer yet (offline, or nothing asked): say nothing rather than "no questions are waiting"
  if (!data) return null;
  const n = data.requests.length;
  // ONE LINE: the questions themselves are answered under Insights in the Inbox, with the rest of what customers keep raising.
  return (
    <p data-kb-questions className="flex flex-wrap items-center gap-2 text-sm">
      <MessageCircleQuestion className="size-4" aria-hidden="true" />
      {n === 0 ? "No questions are waiting for an answer." : n === 1 ? "1 question is waiting for your answer." : `${n} questions are waiting for your answer.`}
      <Link href={insightsHref("missing_info")} className="font-medium underline underline-offset-2">
        See them in Insights
      </Link>
    </p>
  );
}

/** One question a shopper asked that the assistant could not answer. `answerLabel`: the Inbox calls the button "Answer once" (the answer is saved and used from then on). */
export function QuestionCard({ request, answerLabel = "Answer", dismissLabel = "Dismiss" }: { request: KbRequest; answerLabel?: string; dismissLabel?: string | null }) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const answerMut = useAnswerKbRequest();
  const dismissMut = useDismissKbRequest();
  const busy = answerMut.isPending || dismissMut.isPending;

  const submit = () => {
    const p = answerToPayload(answer);
    if (!p.ok) return setError(p.error);
    setError(null);
    answerMut.mutate(
      { id: request.id, content: p.payload.content },
      { onSuccess: () => toast.success("Saved - your assistant will use this answer."), onError: (e) => setError(kbErrorMessage(e)) },
    );
  };

  return (
    <li>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="font-medium">{request.question}</p>
            <p className="text-xs text-muted-foreground">{askedLine(request)}</p>
          </div>
          <Textarea
            aria-label={`Your answer to: ${request.question}`}
            value={answer}
            maxLength={KB_CONTENT_MAX}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write the answer your assistant should give"
            rows={3}
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={busy}>
              {answerMut.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              {answerLabel}
            </Button>
            {dismissLabel !== null && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => dismissMut.mutate(request.id, { onError: (e) => setError(kbErrorMessage(e)) })}
              >
                {dismissLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

// -- Suggested answers ------------------------------------------------------------------------------------------------

function Suggestions() {
  const q = useKbSuggestions();
  const [approved, setApproved] = useState(false);
  // the one-line confirmation is for the moment after the click, not for the rest of the visit
  useEffect(() => {
    if (!approved) return;
    const t = setTimeout(() => setApproved(false), 8000);
    return () => clearTimeout(t);
  }, [approved]);
  // honest states: a failed read says so and offers a retry; it never shows the empty sentence in its place.
  // A paused query (offline) is not isLoading, and has no data: say nothing rather than guess.
  let body: React.ReactNode = null;
  if (q.isLoading) body = <Skeleton className="h-24 w-full" />;
  else if (q.isError && !q.data)
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Could not load the suggested answers.
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  else if (q.data) body = <SuggestionsView data={q.data} now={q.dataUpdatedAt} onApproved={() => setApproved(true)} />;
  if (body === null) return null;
  return (
    <section aria-labelledby="kb-suggestions" className="space-y-3">
      <h2 id="kb-suggestions" className="flex items-center gap-2 text-lg font-semibold">
        <ClipboardCheck className="size-5" aria-hidden="true" />
        Suggested answers
      </h2>
      {approved && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Check className="size-4" aria-hidden="true" />
          {APPROVED_LINE}
        </p>
      )}
      {body}
    </section>
  );
}

export function SuggestionsView({ data, now, onApproved }: { data: KbSuggestionsResponse; now: number; onApproved: () => void }) {
  const list = sortSuggestions(data.suggestions);
  const routed = routedLines(data.routed);
  return (
    <>
      {list.length === 0 ? (
        <p data-kb-suggestions-empty className="text-sm text-muted-foreground">
          {SUGGESTIONS_EMPTY}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <SuggestionCard key={`${s.id}|${s.title}|${s.content}`} suggestion={s} now={now} onApproved={onApproved} />
          ))}
        </ul>
      )}
      {routed.length > 0 && (
        <ul data-kb-routed className="space-y-1 text-sm">
          {routed.map((r) => (
            <li key={r.href}>
              {r.text}{" "}
              <Link href={r.href} className="font-medium underline underline-offset-2">
                {r.linkLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The text with each [bracketed] detail still to fill in highlighted. */
export function Highlighted({ text }: { text: string }) {
  return (
    <>
      {splitPlaceholders(text).map((p, i) =>
        p.placeholder ? (
          <mark key={i} data-kb-placeholder className="rounded bg-warning/20 px-0.5 text-warning-on-tint">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function SuggestionCard({ suggestion, now, onApproved }: { suggestion: KbSuggestion; now: number; onApproved: () => void }) {
  const [title, setTitle] = useState(suggestion.title);
  const [content, setContent] = useState(suggestion.content);
  const [error, setError] = useState<string | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const approve = useApproveSuggestion();
  const dismiss = useDismissSuggestion();
  const save = useSaveSuggestion();
  const busy = approve.isPending || dismiss.isPending || save.isPending;
  const state = approveState(title, content);
  const based = basedOnLine(suggestion.evidence);
  const reasonId = `kb-sg-${suggestion.id}-reason`;
  const edited = `${title}\n${content}`;

  const doApprove = async () => {
    setError(null);
    const r = await runApprove((p) => approve.mutateAsync({ id: suggestion.id, ...p }), title, content);
    if (r.ok) onApproved();
    else setError(r.error);
  };
  const doSave = async () => {
    setError(null);
    const r = await runAction(() => save.mutateAsync({ id: suggestion.id, title: title.trim(), content: content.trim() }));
    if (r.ok) toast.success("Saved. It is not approved yet.");
    else setError(r.error);
  };
  const doDismiss = async () => {
    setError(null);
    const r = await runAction(() => dismiss.mutateAsync(suggestion.id));
    if (!r.ok) {
      setConfirmDismiss(false);
      setError(r.error);
    }
  };

  return (
    <li>
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">{suggestionAskedLine(suggestion, now)}</p>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Title</span>
            <Input
              value={title}
              maxLength={KB_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Suggested answer</span>
            <Textarea
              rows={5}
              value={content}
              maxLength={KB_CONTENT_MAX}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          {placeholdersIn(edited).length > 0 && (
            <div data-kb-preview className="space-y-1 rounded-md border p-2 text-sm">
              <p className="font-medium">
                <Highlighted text={title} />
              </p>
              <p className="whitespace-pre-line">
                <Highlighted text={content} />
              </p>
            </div>
          )}
          {suggestion.needsFacts.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">Your assistant needs you to say:</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {suggestion.needsFacts.map((n, i) => (
                  <li key={`${i}-${n}`}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          {based && <p className="text-xs text-muted-foreground">{based}</p>}
          {!state.enabled && (
            <p id={reasonId} className="text-sm text-muted-foreground">
              {state.reason}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void doApprove()} disabled={busy || !state.enabled} aria-describedby={state.enabled ? undefined : reasonId}>
              {approve.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => void doSave()} disabled={busy}>
              {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              Save without approving
            </Button>
            {confirmDismiss ? (
              <>
                <Button size="sm" variant="destructive" onClick={() => void doDismiss()} disabled={busy}>
                  Yes, dismiss it
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDismiss(false)} disabled={busy}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDismiss(true)} disabled={busy} aria-label="Dismiss this suggestion">
                Dismiss
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

// -- Policy health ----------------------------------------------------------------------------------------------------

function PolicyHealth() {
  const [view, setView] = useState<"open" | "dismissed">("open");
  const q = useKbFindings(view);
  const imported = useKbEntries({ source: "import", status: "active", q: "" });
  const stores = useCommerceStores();
  const shop = shopOf(stores.data);
  let body: React.ReactNode = null;
  if (q.isLoading) body = <Skeleton className="h-24 w-full" />;
  else if (q.isError && !q.data)
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Could not load the policy check.
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  else if (q.data) body = <FindingsView data={q.data} view={view} entries={imported.data?.entries ?? []} shop={shop} />;
  if (body === null) return null;
  return (
    <section aria-labelledby="kb-health" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="kb-health" className="text-lg font-semibold">
          Policy health
        </h2>
        <select aria-label="Show findings" className="rounded-md border bg-background px-2 text-sm" value={view} onChange={(e) => setView(e.target.value as "open" | "dismissed")}>
          <option value="open">To look at</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>
      {body}
    </section>
  );
}

export function FindingsView({ data, view, entries, shop }: { data: { findings: KbFinding[] }; view: "open" | "dismissed"; entries: KbEntry[]; shop: string | null }) {
  if (data.findings.length === 0) {
    return (
      <p data-kb-findings-empty className="text-sm text-muted-foreground">
        {view === "open" ? FINDINGS_EMPTY : FINDINGS_DISMISSED_EMPTY}
      </p>
    );
  }
  const byId = new Map(entries.map((e) => [e.id, e]));
  return (
    <div className="space-y-5">
      {groupFindings(data.findings).map((g) => (
        <div key={g.severity} data-kb-severity={g.severity} className="space-y-2">
          <h3 className="text-sm font-semibold">{severityHeading(g.severity)}</h3>
          <ul className="space-y-3">
            {g.findings.map((f) => (
              <FindingCard key={f.id} finding={f} dismissed={view === "dismissed"} entry={f.entryId ? byId.get(f.entryId) : undefined} shop={shop} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FindingCard({ finding: f, dismissed, entry, shop }: { finding: KbFinding; dismissed: boolean; entry: KbEntry | undefined; shop: string | null }) {
  const action = useFindingAction();
  const takeOver = useKbEntryAction();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const footer = findingFooter(f);
  const reality = realityLine(f);
  const policiesHref = shopifyPoliciesHref(shop);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(f.suggestion);
      setError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setError("Could not copy. Select the text and copy it instead.");
    }
  };
  const run = async () => {
    setError(null);
    const r = await runAction(() => action.mutateAsync({ id: f.id, action: dismissed ? "reopen" : "dismiss" }));
    if (!r.ok) setError(r.error);
  };
  return (
    <li>
      <Card>
        <CardContent className="space-y-2 p-4">
          {f.entryTitle && <p className="text-xs text-muted-foreground">In: {f.entryTitle}</p>}
          {f.quote && <blockquote className="border-l-2 pl-3 text-sm italic">{f.quote}</blockquote>}
          {reality && <p className="text-sm">{reality}</p>}
          <p className="text-sm">{f.why}</p>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">A way to put it</p>
            <p className="whitespace-pre-line text-sm">{f.suggestion}</p>
          </div>
          {footer.legalLine && (
            <p className="text-xs text-muted-foreground">
              {footer.sourceHref && (
                <>
                  <a href={footer.sourceHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                    {footer.sourceLabel} <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                  {" · "}
                </>
              )}
              {footer.legalLine}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </Button>
            {isImportedPolicy(entry) && (
              <>
                {policiesHref && (
                  <a href={policiesHref} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium">
                    Edit in Shopify
                  </a>
                )}
                <Button size="sm" variant="outline" disabled={takeOver.isPending} onClick={() => {
                    setError(null);
                    takeOver.mutate({ id: entry!.id, action: "take-over" }, { onError: (e) => setError(kbErrorMessage(e)) });
                  }}>
                  Take over in Peakhour
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" disabled={action.isPending} onClick={() => void run()}>
              {dismissed ? "Reopen" : "Dismiss"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function Entries() {
  const [filter, setFilter] = useState<EntryFilter>({ source: "", status: "active", q: "" });
  // the box updates at once; the query follows 300 ms after the last keystroke
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFilter((f) => (f.q === typed ? f : { ...f, q: typed })), 300);
    return () => clearTimeout(t);
  }, [typed]);
  const [editing, setEditing] = useState<KbEntry | "new" | null>(null);
  const { data, isLoading, isError } = useKbEntries(filter);

  return (
    <section aria-labelledby="kb-entries" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="kb-entries" className="flex items-center gap-2 text-lg font-semibold">
          <BookOpen className="size-5" aria-hidden="true" />
          Entries
        </h2>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="mr-1 size-4" aria-hidden="true" />
          New entry
        </Button>
      </div>

      <DataToolbar
        search={
          <DataToolbarSearch
            aria-label="Search entries"
            placeholder="Search"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        }
        filters={
          <>
            <select
              aria-label="Show entries from"
              className="rounded-md border bg-background px-2 text-sm"
              value={filter.source}
              onChange={(e) => setFilter((f) => ({ ...f, source: e.target.value as EntryFilter["source"] }))}
            >
              <option value="">All sources</option>
              <option value="owner">Written by you</option>
              <option value="import">Imported</option>
              <option value="learned">Learned</option>
            </select>
            <select
              aria-label="Active or archived"
              className="rounded-md border bg-background px-2 text-sm"
              value={filter.status}
              onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as EntryFilter["status"] }))}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </>
        }
      />

      {editing && <EntryEditor key={editing === "new" ? "new" : editing.id} entry={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError && !data ? (
        <p className="text-sm text-destructive">Could not load assistant answers. Please refresh.</p>
      ) : (data?.entries.length ?? 0) === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No entries yet"
          description="Add what your shoppers keep asking - delivery times, sizing, warranty, store hours. Your assistant answers from these and never guesses."
          action={{ label: "New entry", onClick: () => setEditing("new") }}
        />
      ) : (
        <ul className="space-y-3">
          {data!.entries.map((e) => (
            <EntryCard key={e.id} entry={e} onEdit={() => setEditing(e)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EntryCard({ entry, onEdit }: { entry: KbEntry; onEdit: () => void }) {
  const action = useKbEntryAction();
  const note = readOnlyNote(entry);
  const link = safeUrl(entry.url);
  const run = (a: "archive" | "restore" | "take-over") =>
    action.mutate({ id: entry.id, action: a }, { onError: (e) => toast.error(kbErrorMessage(e)) });
  return (
    <li>
      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{entry.title}</p>
            <Badge variant="outline">{sourceLabel(entry)}</Badge>
            <Badge variant="secondary">{channelsLine(entry.channels)}</Badge>
            {entry.status === "archived" && <Badge variant="outline">Archived</Badge>}
          </div>
          <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{entry.content}</p>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">
              View the original <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
          <div className="flex gap-2 pt-1">
            {entry.readOnly ? (
              <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => run("take-over")}>
                Take over
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={onEdit}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" disabled={action.isPending} onClick={() => run(entry.status === "archived" ? "restore" : "archive")}>
                  {entry.status === "archived" ? "Restore" : "Archive"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function EntryEditor({ entry, onDone }: { entry: KbEntry | null; onDone: () => void }) {
  const [form, setForm] = useState<KbForm>(entry ? entryToForm(entry) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateKbEntry();
  const update = useUpdateKbEntry();
  const pending = create.isPending || update.isPending;

  const save = () => {
    const p = formToPayload(form);
    if (!p.ok) return setError(p.error);
    setError(null);
    const opts = { onSuccess: onDone, onError: (e: unknown) => setError(kbErrorMessage(e)) };
    if (entry) update.mutate({ id: entry.id, payload: p.payload }, opts);
    else create.mutate(p.payload, opts);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Title</span>
          <Input value={form.title} maxLength={KB_TITLE_MAX} aria-invalid={error ? true : undefined} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Do you deliver to Goa?" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Answer</span>
          <Textarea rows={5} value={form.content} maxLength={KB_CONTENT_MAX} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <span className="text-xs text-muted-foreground">{charsLeft(form.content)} characters left</span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Tags (optional, comma separated)</span>
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="delivery, shipping" />
        </label>
        <fieldset className="space-y-1 text-sm">
          <legend className="font-medium">Applies to</legend>
          <p className="text-xs text-muted-foreground">Leave all unticked to apply to every channel.</p>
          {KB_CHANNELS.map((c) => (
            <label key={c} className="mr-4 inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.channels.includes(c)}
                onChange={(e) => setForm({ ...form, channels: e.target.checked ? [...form.channels, c] : form.channels.filter((x) => x !== c) })}
              />
              {channelLabel(c)}
            </label>
          ))}
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
            {entry ? "Save changes" : "Add entry"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
