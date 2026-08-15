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
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquareQuote, Loader2, Search } from "lucide-react";
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
  disabled,
}: {
  /** Narrows the list to replies scoped to this surface, plus every
   *  reply with no scope at all — which is most of them. */
  channel: SavedReplyChannel;
  /** Receives the reply's text. The caller decides where it goes; this
   *  component never sends anything. */
  onInsert: (body: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

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
    onInsert(reply.body);
    markUsed.mutate(reply.id);
    setOpen(false);
    setFilter("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
              Nothing matches &ldquo;{filter}&rdquo;.
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

        {query.data?.truncated && (
          <p className="border-t p-2 text-[10px] text-muted-foreground">
            Showing the first 200. Archive the ones you no longer use.
          </p>
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
export function appendReply(draft: string, reply: string, maxLen: number): string {
  const base = draft.trimEnd();
  const joined = base.length === 0 ? reply : `${base}\n\n${reply}`;
  // The caller's channel cap wins. Truncating here is the lesser evil
  // versus handing a composer a value it will refuse on send — but it is
  // still a loss, which is why the picker shows the body before insert.
  return joined.slice(0, maxLen);
}
