"use client";

import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, Loader2, MessageCircleQuestion, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import {
  useAnswerKbRequest,
  useCreateKbEntry,
  useDismissKbRequest,
  useKbEntries,
  useKbEntryAction,
  useKbRequests,
  useUpdateKbEntry,
  type EntryFilter,
} from "@/hooks/use-knowledge-base";
import {
  EMPTY_FORM,
  KB_CHANNELS,
  KB_CONTENT_MAX,
  KB_TITLE_MAX,
  askedLine,
  answerToPayload,
  channelLabel,
  channelsLine,
  charsLeft,
  entryToForm,
  formToPayload,
  kbErrorMessage,
  readOnlyNote,
  sourceLabel,
  type KbEntry,
  type KbForm,
  type KbRequest,
} from "@/lib/knowledge-base";

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
      <Entries />
    </div>
  );
}

function Questions() {
  const { data, isLoading, isError } = useKbRequests();
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isError) return <p className="text-sm text-destructive">Could not load the questions to answer. Please refresh.</p>;
  const requests = data?.requests ?? [];
  return (
    <section aria-labelledby="kb-questions" className="space-y-3">
      <h2 id="kb-questions" className="flex items-center gap-2 text-lg font-semibold">
        <MessageCircleQuestion className="size-5" aria-hidden="true" />
        Questions to answer
        {requests.length > 0 && <Badge variant="secondary">{requests.length}</Badge>}
      </h2>
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing waiting. When a shopper asks something your assistant cannot answer, it lands here instead of being guessed.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <QuestionCard key={r.id} request={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestionCard({ request }: { request: KbRequest }) {
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
              Answer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => dismissMut.mutate(request.id, { onError: (e) => setError(kbErrorMessage(e)) })}
            >
              Dismiss
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

      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Search entries"
          className="max-w-xs"
          placeholder="Search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
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
      </div>

      {editing && <EntryEditor key={editing === "new" ? "new" : editing.id} entry={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError && !data ? (
        <p className="text-sm text-destructive">Could not load the knowledge base. Please refresh.</p>
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
          {entry.url && (
            <a href={entry.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">
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
