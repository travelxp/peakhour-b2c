"use client";

/**
 * The saved-reply picker — insert an answer you already wrote.
 *
 * ── ★IT INSERTS. IT NEVER SENDS. ─────────────────────────────────────
 * Picking a reply puts text in the composer and closes. The person then
 * reads it, edits it, and presses the send button that was always there.
 * Nothing in this component can post anything, and the callback it takes
 * is named `onInsert` rather than `onPick` so that stays obvious at every
 * call site. An auto-reply bot is explicitly out of scope for this
 * product; making the picker one click from sending would be how that
 * line gets crossed by accident.
 *
 * ── ★AND IT APPENDS TO A DRAFT RATHER THAN REPLACING IT ──────────────
 * If someone has already typed, their words are kept and the saved reply
 * follows. Replacing would be tidier to implement and would silently
 * destroy work — the one outcome a convenience feature must never have.
 *
 * ── CHANNEL-NEUTRAL BY CONSTRUCTION ──────────────────────────────────
 * Lives in `components/inbox`, not under the LinkedIn dashboard: the
 * library is shared by every surface that answers a customer, and the
 * `channel` prop is what narrows it. Building it inside the LinkedIn
 * folder would have guaranteed a second copy for WhatsApp.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquareQuote, Loader2, Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  savedRepliesApi,
  type SavedReply,
  type SavedReplyChannel,
} from "@/lib/api/saved-replies";

export function SavedReplyPicker({
  channel,
  onInsert,
  draft,
  disabled,
}: {
  /** Narrows the list to replies scoped to this surface, plus every
   *  reply with no scope at all — which is most of them. */
  channel: SavedReplyChannel;
  /**
   * Receives the reply's text. The caller decides where it goes; this
   * component never sends anything.
   *
   * Returns whether the text actually landed — a composer at its
   * character cap refuses rather than truncating, and a reply that did
   * not go in must not be counted as used.
   */
  onInsert: (body: string) => boolean;
  /** The composer's current text, so "save this answer" can offer it.
   *  Without a create path the library stays permanently empty and the
   *  picker's own empty state asks for something the product cannot do. */
  draft?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["saved-replies", channel],
    queryFn: () => savedRepliesApi.list({ channel }),
    // Only when the popover is open. The picker sits beside every reply
    // box on a page that can render dozens of them — fetching per box on
    // mount would be one request per comment on screen.
    enabled: open,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const markUsed = useMutation({
    mutationFn: (id: string) => savedRepliesApi.markUsed(id),
    // ★Deliberately silent on failure. The text is already in the box;
    // the person is mid-reply to a customer. A toast saying the usage
    // counter did not increment is noise about a number that orders a
    // list, interrupting the task it exists to speed up.
    onError: () => {},
  });

  const replies = query.data?.replies ?? [];
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? replies.filter(
        (r) =>
          r.title.toLowerCase().includes(needle) ||
          r.body.toLowerCase().includes(needle) ||
          r.tags?.some((t) => t.toLowerCase().includes(needle)),
      )
    : replies;

  function insert(reply: SavedReply) {
    // ★Counted only when it actually went in. `usageCount` is documented
    // as "times inserted" and orders the list — counting a refused
    // insert inflates the number and promotes a reply nobody could use.
    if (!onInsert(reply.body)) {
      toast.warning("That reply is too long to add to what you've already written.", {
        description: "Shorten your draft, or clear it and insert the reply first.",
      });
      return;
    }
    markUsed.mutate(reply.id);
    setOpen(false);
  }

  /**
   * Save what is in the composer as a new reply.
   *
   * ★THE CREATE PATH LIVES HERE BECAUSE THIS IS WHERE THE ANSWER EXISTS.
   * The picker shipped without one, so the library was permanently empty
   * and its own empty state ("save the answer here") pointed at an
   * affordance the product did not have. A settings page would work and
   * would be the wrong first home: you learn a reply is worth saving at
   * the moment you finish typing it for the second time, not later, in
   * another tab.
   */
  const create = useMutation({
    mutationFn: (title: string) =>
      savedRepliesApi.create({ title, body: (draft ?? "").trim() }),
    onSuccess: () => {
      toast.success("Saved. It'll be here next time.");
      setSaving(false);
      setNewTitle("");
      void qc.invalidateQueries({ queryKey: ["saved-replies"] });
    },
    onError: (err) => {
      // The api answers 409 with a sentence about the existing title,
      // which is the useful thing to show — a generic failure would send
      // someone looking for a bug instead of at their own list.
      toast.error(
        err instanceof ApiError && err.code === "DUPLICATE_TITLE"
          ? err.message
          : "Couldn't save that reply. Please try again.",
      );
    },
  });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // ★Reset on CLOSE, not only on insert. Escape or an outside click
        // used to leave the search term behind, so the next open showed a
        // filtered list — or "Nothing matches" — for a search the person
        // had already abandoned and could not see.
        if (!next) {
          setFilter("");
          setSaving(false);
          setNewTitle("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={disabled}
        >
          <MessageSquareQuote className="size-3.5" />
          Saved replies
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search saved replies…"
              className="h-7 pl-7 text-xs"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {query.isLoading ? (
            <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
              Loading…
            </div>
          ) : query.isError ? (
            <p className="p-4 text-xs text-muted-foreground">
              Couldn&apos;t load your saved replies. You can still write one by hand.
            </p>
          ) : replies.length === 0 ? (
            <div className="p-4">
              <p className="text-xs font-medium">No saved replies yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                When you answer the same question twice, save the answer here
                and it&apos;ll be one click next time.
              </p>
            </div>
          ) : shown.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">
              Nothing matches &ldquo;{filter}&rdquo;
              {/* ★Says WHY it might be lying. The filter runs over the
                  rows already loaded, and the server caps that list — so
                  on a large library a reply that exists can be absent
                  from a search. Claiming a flat "nothing matches" there
                  is the search telling the person their answer is gone. */}
              {query.data?.truncated
                ? " in the replies loaded so far. Archive ones you no longer use so the rest can load."
                : "."}
            </p>
          ) : (
            <ul>
              {shown.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => insert(r)}
                    className="w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <span className="block text-xs font-medium">{r.title}</span>
                    {/* Two lines of the body, so someone can tell two
                        similarly-titled replies apart before inserting
                        one into a message to a customer. */}
                    <span className="mt-0.5 block line-clamp-2 text-[11px] text-muted-foreground">
                      {r.body}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ★No number. The cap is the api's (`LIST_LIMIT`) and nothing
            ties the two files together, so a figure printed here is one
            deploy away from being a confident lie. The flag is the fact;
            the count is the server's business. */}
        {query.data?.truncated && (
          <p className="border-t p-2 text-[10px] text-muted-foreground">
            Not all of your saved replies are shown. Archive the ones you no
            longer use.
          </p>
        )}

        {/* ── Save what is in the box ──────────────────────────────── */}
        {(draft ?? "").trim().length > 0 && (
          <div className="border-t p-2">
            {saving ? (
              <div className="space-y-1.5">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value.slice(0, 80))}
                  placeholder="Name it — e.g. Pricing"
                  className="h-7 text-xs"
                  autoFocus
                />
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    disabled={!newTitle.trim() || create.isPending}
                    aria-busy={create.isPending}
                    onClick={() => create.mutate(newTitle.trim())}
                  >
                    {create.isPending && (
                      <Loader2 className="mr-1 size-3 animate-spin motion-reduce:animate-none" />
                    )}
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setSaving(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-full justify-start gap-1.5 px-1 text-[11px]"
                onClick={() => setSaving(true)}
              >
                <Plus className="size-3" />
                Save what you&apos;ve written as a reply
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Append a saved reply to whatever is already in the box.
 *
 * ★Exported and tested because "insert" has a wrong version that looks
 * right: replacing the draft. Someone half-way through typing a personal
 * sentence, who reaches for a saved reply to finish it, must not lose the
 * sentence. Blank draft in, reply out; non-blank draft in, both, with one
 * blank line between so the seam is visible and editable.
 */
export function appendReply(
  draft: string,
  reply: string,
  maxLen: number,
): { text: string; fitted: boolean } {
  const base = draft.trimEnd();
  const joined = base.length === 0 ? reply : `${base}\n\n${reply}`;

  // ★IT REFUSES RATHER THAN TRUNCATING, and the first version did the
  // opposite. `joined.slice(0, maxLen)` on a near-full draft appends a
  // mid-word fragment — a draft at 1,240 characters gained "\n\nOur pl"
  // — or, at 1,249, nothing but a stray newline. Both are silent, and
  // both end up in a message to a customer if the person does not
  // re-read what the button just did to their text.
  //
  // Cutting at a word boundary would be tidier and no more honest: half
  // a saved reply is not the saved reply, and the half that gets cut is
  // the end, where the call to action lives. So the draft is left
  // untouched and the caller is told it did not fit — which is
  // information the person can act on.
  if (joined.length > maxLen) return { text: draft, fitted: false };
  return { text: joined, fitted: true };
}
