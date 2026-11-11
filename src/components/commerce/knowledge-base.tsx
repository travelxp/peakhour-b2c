"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, ClipboardCheck, ExternalLink, Loader2, MessageCircleQuestion, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { insightsHref } from "@/lib/insights";
import { useNavIntent } from "@/hooks/use-nav-intent";
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
  claimsLine,
  otherEntryLine,
  canEditInShopify,
  reconcileWords,
  runSave,
  showingLine,
  SUGGESTION_UPDATED,
  routedLines,
  runAction,
  runApprove,
  safeUrl,
  severityHeading,
  shopifyPoliciesHref,
  sourceLabel,
  SUGGESTIONS_EMPTY,
  suggestionAskedLine,
  type KbEntry,
  type KbFinding,
  type KbForm,
  type KbRequest,
  type KbSuggestion,
  type KbSuggestionsResponse,
  type CardWords,
} from "@/lib/knowledge-base";
import { shopOf } from "@/lib/insights";
import { EntryPublish, PolicyBuilder } from "@/components/commerce/policy-builder";
import { Highlighted } from "@/components/commerce/highlighted";

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
      <PolicyBuilder />
      <Suggestions />
      <PolicyHealth />
      <Entries />
    </div>
  );
}

function Questions() {
  const intent = useNavIntent();
  const insightsLink = insightsHref("missing_info");
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
      <Link href={insightsLink} {...intent(insightsLink)} className="font-medium underline underline-offset-2">
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
  const [approvedAt, setApprovedAt] = useState<number | null>(null);
  // the one-line confirmation is for the moment after the click, not for the rest of the visit
  useEffect(() => {
    if (approvedAt === null) return;
    const t = setTimeout(() => setApprovedAt(null), 8000);
    return () => clearTimeout(t);
  }, [approvedAt]);
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
  else if (q.data) body = <SuggestionsView data={q.data} now={q.dataUpdatedAt} onApproved={() => setApprovedAt(Date.now())} onFailed={() => setApprovedAt(null)} />;
  if (body === null) return null;
  return (
    <section aria-labelledby="kb-suggestions" className="space-y-3">
      <h2 id="kb-suggestions" className="flex items-center gap-2 text-lg font-semibold">
        <ClipboardCheck className="size-5" aria-hidden="true" />
        Suggested answers
      </h2>
      {approvedAt !== null && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Check className="size-4" aria-hidden="true" />
          {APPROVED_LINE}
        </p>
      )}
      {body}
    </section>
  );
}

export function SuggestionsView({ data, now, onApproved, onFailed }: { data: KbSuggestionsResponse; now: number; onApproved: () => void; onFailed: () => void }) {
  // the api's order, as it arrives (most asked, then most recent, then id)
  const list = data.suggestions;
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
            <SuggestionCard key={s.id} suggestion={s} now={now} onApproved={onApproved} onFailed={onFailed} />
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

function SuggestionCard({ suggestion, now, onApproved, onFailed }: { suggestion: KbSuggestion; now: number; onApproved: () => void; onFailed: () => void }) {
  // The boxes hold the merchant's words. They follow the server's words only while untouched; edits are never dropped (reconcileWords).
  const [card, setCard] = useState<CardWords>({ base: { title: suggestion.title, content: suggestion.content }, title: suggestion.title, content: suggestion.content });
  const synced = reconcileWords(card, { title: suggestion.title, content: suggestion.content });
  if (synced.card !== card) setCard(synced.card);
  const stale = synced.stale;
  const { title, content } = card;
  const [error, setError] = useState<string | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  // a dismiss that worked has already deleted the suggestion: the card goes at once, so it cannot be sent twice before the refetch removes it
  const [gone, setGone] = useState(false);
  const approve = useApproveSuggestion();
  const dismiss = useDismissSuggestion();
  const save = useSaveSuggestion();
  const busy = approve.isPending || dismiss.isPending || save.isPending;
  const state = approveState(title, content);
  const based = basedOnLine(suggestion.evidence);
  const reasonId = `kb-sg-${suggestion.id}-reason`;
  const fail = (message: string) => {
    setError(message);
    onFailed();
  };

  const doApprove = async () => {
    setError(null);
    const r = await runApprove((p) => approve.mutateAsync({ id: suggestion.id, ...p }), title, content);
    if (r.ok) onApproved();
    else fail(r.error);
  };
  const doSave = async () => {
    setError(null);
    const r = await runSave((p) => save.mutateAsync({ id: suggestion.id, ...p }), title, content);
    if (r.ok) toast.success("Saved. It is not approved yet.");
    else fail(r.error);
  };
  const doDismiss = async () => {
    setError(null);
    const r = await runAction(() => dismiss.mutateAsync(suggestion.id));
    if (r.ok) setGone(true);
    else {
      setConfirmDismiss(false);
      fail(r.error);
    }
  };
  if (gone) return null;

  return (
    <li>
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">{suggestionAskedLine(suggestion, now)}</p>
          {stale && (
            <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {SUGGESTION_UPDATED}
              <Button size="sm" variant="outline" onClick={() => setCard({ base: { title: suggestion.title, content: suggestion.content }, title: suggestion.title, content: suggestion.content })}>
                Use the new version
              </Button>
            </p>
          )}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Title</span>
            <Input value={title} maxLength={KB_TITLE_MAX} onChange={(e) => setCard({ ...card, title: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Suggested answer</span>
            <Textarea rows={5} value={content} maxLength={KB_CONTENT_MAX} onChange={(e) => setCard({ ...card, content: e.target.value })} />
          </label>
          {placeholdersIn(`${title}\n${content}`).length > 0 && (
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
  else if (q.data)
    body = (
      <>
        <FindingsView data={q.data} view={view} entries={imported.data?.entries ?? []} shop={shop} />
        <MoreFindings shown={q.data.findings.length} total={q.data.total} hasMore={q.hasNextPage} loading={q.isFetchingNextPage} failed={q.isFetchNextPageError} onMore={() => void q.fetchNextPage()} />
      </>
    );
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

/** "Showing 100 of N" and a way to the rest. The api's order is kept across pages, so tips (the last group) are reached by paging on. */
export function MoreFindings({ shown, total, hasMore, loading, failed, onMore }: { shown: number; total: number; hasMore: boolean; loading: boolean; failed: boolean; onMore: () => void }) {
  const line = showingLine(shown, total);
  if (!line) return null;
  return (
    <div data-kb-more className="flex flex-wrap items-center gap-2 text-sm">
      <span>{line}</span>
      {failed && (
        <span role="alert" className="text-destructive">
          Could not load more.
        </span>
      )}
      {hasMore && (
        <Button size="sm" variant="outline" onClick={onMore} disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
          Show more
        </Button>
      )}
    </div>
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
  const claims = claimsLine(f);
  const other = otherEntryLine(f);
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
          {claims && <p className="text-sm">{claims}</p>}
          {other && <p className="text-sm">{other}</p>}
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
                {policiesHref && canEditInShopify(entry) && (
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
          {entry.status === "active" && !entry.readOnly && <EntryPublish entry={entry} />}
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
