"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { NoteCard } from "@/components/inbox/note-card";
import { useAddNote, useDeleteNote, useDeskTeam, useThreadNotes } from "@/hooks/use-inbox-desk";
import { actionError } from "@/lib/inbox-customer";
import { NOTE_LABEL, NOTE_MAX, canDeleteNote, canWorkConversation, createFlightGuard, insertMention, mentionNames, mentionsIn, noteDraft, type DeskNote, type TeamMemberRef } from "@/lib/inbox-desk";
import { previewTime } from "@/lib/inbox-view";

/**
 * The team's notes on the open conversation, in the side panel under the customer's details (I3a). Editors and above write; an author
 * deletes their own; a viewer reads. The same notes are laid into the timeline by the conversation pane (same query).
 */
export function NotesPanelView({
  notes,
  label,
  me,
  role,
  state,
  body,
  onBody,
  saving,
  onAdd,
  onDelete,
  deletingId,
  error,
  team = [],
  onMention,
}: {
  /** SA-10: the teammates a note can @mention, and what picking one does. Both optional: without them the panel is the plain one. */
  team?: readonly TeamMemberRef[];
  onMention?: (member: TeamMemberRef) => void;
  notes: readonly DeskNote[];
  label: string;
  me: string | null;
  role: string | null;
  state: "loading" | "error" | "ready";
  body: string;
  onBody: (v: string) => void;
  saving: boolean;
  onAdd: () => void;
  onDelete: (noteId: string) => void;
  deletingId: string | null;
  error: string | null;
}) {
  const canAdd = canWorkConversation(role);
  const draft = noteDraft(body, saving);
  const now = new Date();
  return (
    <section aria-label="Team notes" className="space-y-2 border-t p-3" data-testid="notes-panel">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team notes</h3>
      {state === "loading" && <p className="text-xs text-muted-foreground">Loading notes…</p>}
      {state === "error" && <p className="text-xs text-muted-foreground">Couldn&apos;t load the notes. Reload the page to try again.</p>}
      {state === "ready" && notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
      <div className="space-y-2">
        {notes.map((n) => (
          <NoteCard
            key={n.id}
            body={n.body}
            author={n.authorName}
            time={previewTime(n.createdAt, now)}
            label={label}
            deleting={deletingId === n.id}
            mentions={mentionNames(n, team)}
            onDelete={canDeleteNote(n, me, role) ? () => onDelete(n.id) : null}
          />
        ))}
      </div>
      {canAdd ? (
        <div className="space-y-1.5">
          <Textarea
            value={body}
            onChange={(e) => onBody(e.target.value)}
            disabled={saving}
            placeholder="Write a note for your team"
            aria-label="Add a note"
            className="min-h-16 text-xs"
          />
          <div className="flex items-center justify-between gap-2">
            <span className={`text-micro ${draft.remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {draft.remaining} left of {NOTE_MAX}
            </span>
            {onMention && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="xs" variant="ghost" disabled={saving || team.filter((m) => m.userId !== me).length === 0} aria-label="Mention a teammate">
                    <AtSign />
                    Mention
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {team
                    .filter((m) => m.userId !== me)
                    .map((m) => (
                      <DropdownMenuItem key={m.userId} onSelect={() => onMention(m)}>
                        {m.name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button size="sm" disabled={!draft.canSave} onClick={onAdd}>
              {saving ? "Saving…" : "Add note"}
            </Button>
          </div>
          {(draft.error ?? error) && (
            <p role="alert" className="text-xs text-destructive">
              {draft.error ?? error}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">You can read notes. Adding them needs Editor access or above.</p>
      )}
    </section>
  );
}

export function NotesPanel({ threadId, role }: { threadId: string; role: string | null }) {
  const query = useThreadNotes(threadId);
  const add = useAddNote(threadId);
  const del = useDeleteNote(threadId);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // SA-10: the teammates picked with Mention. Only those whose @Name is still in the text when the note is saved are sent.
  const [picked, setPicked] = useState<TeamMemberRef[]>([]);
  const team = useDeskTeam(canWorkConversation(role));
  const addGuard = useState(createFlightGuard)[0];
  const delGuard = useState(createFlightGuard)[0];

  return (
    <NotesPanelView
      notes={query.data?.notes ?? []}
      label={query.data?.label ?? NOTE_LABEL}
      me={query.data?.me ?? null}
      role={role}
      team={team.data?.team ?? []}
      onMention={(m) => {
        setBody((b) => insertMention(b, m));
        setPicked((p) => (p.some((x) => x.userId === m.userId) ? p : [...p, m]));
        setError(null);
      }}
      state={query.data ? "ready" : query.isError ? "error" : "loading"}
      body={body}
      onBody={(v) => {
        setBody(v);
        setError(null);
      }}
      saving={add.isPending}
      error={error}
      deletingId={deletingId}
      // ★ONE NOTE PER CLICK: the guard is a ref, so a double click is one request; the draft clears only once the note is saved, so a
      //  failure keeps the words for another try.
      onAdd={() =>
        void addGuard.run(async () => {
          if (!noteDraft(body, false).canSave) return;
          try {
            await add.mutateAsync({ body: body.trim(), mentions: mentionsIn(body, picked) });
            setBody("");
            setPicked([]);
            setError(null);
          } catch (e) {
            setError(actionError(e, "Saving the note"));
          }
        })
      }
      onDelete={(id) =>
        void delGuard.run(async () => {
          setDeletingId(id);
          try {
            await del.mutateAsync(id);
          } catch (e) {
            toast.error(actionError(e, "Deleting the note"));
          } finally {
            setDeletingId(null);
          }
        })
      }
    />
  );
}
