"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTE_LABEL } from "@/lib/inbox-desk";

/**
 * An internal note (I3a), in the thread timeline and in the notes panel. ★NEVER A MESSAGE BUBBLE: a note is the team's, it is never
 * sent to the shopper, and it must not be mistaken for something that was. It has its own dashed, tinted card and always carries the
 * api's label (`Note — only your team sees this`) above the author and the time.
 *
 * Delete is the author's alone (`onDelete` is absent for everyone else) and asks first.
 */
export function NoteCard({
  body,
  author,
  time,
  label = NOTE_LABEL,
  onDelete,
  deleting = false,
  mentions = [],
}: {
  body: string;
  author: string;
  /** Already worded ("08:05", "Yesterday"). */
  time: string;
  label?: string;
  onDelete?: (() => void) | null;
  deleting?: boolean;
  /** The names of the teammates the note @mentions (SA-10). */
  mentions?: readonly string[];
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mx-auto w-full max-w-[90%] rounded-lg border border-dashed border-warning/60 bg-warning/10 p-2.5 text-sm text-foreground" data-testid="note-card">
      <p className="mb-0.5 flex items-center gap-1 text-micro font-medium text-warning-on-tint">
        <Lock className="size-3" aria-hidden="true" />
        <span>{label}</span>
      </p>
      <p className="whitespace-pre-wrap wrap-break-word">{body}</p>
      {mentions.length > 0 && (
        <p className="mt-1 text-micro text-muted-foreground" data-testid="note-mentions">
          Mentioned: {mentions.join(", ")}
        </p>
      )}
      <div className="mt-1 flex items-center justify-between gap-2 text-micro text-muted-foreground">
        <span>
          {author}
          {time ? ` · ${time}` : ""}
        </span>
        {onDelete &&
          (confirming ? (
            <span className="flex items-center gap-1">
              <Button size="xs" variant="destructive" disabled={deleting} onClick={onDelete}>
                {deleting ? "Deleting…" : "Delete note"}
              </Button>
              <Button size="xs" variant="ghost" disabled={deleting} onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button size="xs" variant="ghost" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          ))}
      </div>
    </div>
  );
}
