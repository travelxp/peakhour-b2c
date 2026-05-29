"use client";

/**
 * <MentionTypeahead/> — inline @-mention autocomplete for any composer
 * surface. Listens to keystrokes on a controlled `<Textarea/>` ref,
 * detects when the user is mid-mention (`@…` at the caret, no
 * whitespace yet), debounces the host's `onSearch` callback, and
 * surfaces a Popover anchored under the caret with the candidates.
 *
 * Picking a candidate replaces the partial `@foo` with the full
 * `@handle`, restores focus, and moves the caret past the inserted
 * mention so the user can keep typing.
 *
 * The primitive doesn't render the textarea itself — it sits next to
 * the host's textarea as a non-visual coordinator. That keeps each
 * host composer in control of its own layout (size, padding,
 * resize-handle, autosize-on-content, etc.) and lets multiple
 * typeaheads (mentions + hashtags) coexist on the same field.
 *
 * Design note: we use shadcn `<Command/>` inside `<Popover/>` for the
 * list (so arrow-key navigation, type-to-filter, and the keyboard
 * shortcuts come free). The popover anchors via a hidden absolutely-
 * positioned <span> so it tracks the caret reasonably without
 * measuring text-area glyph positions — close enough for the v1
 * composer, which sits the popover BELOW the textarea rather than
 * floating right at the caret like Notion does.
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AtSign, Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MentionCandidate } from "./types";

export interface MentionTypeaheadProps {
  /** Controlled ref to the host's textarea. The primitive attaches
   *  no listeners directly — the host calls `onTextChange(text)`
   *  whenever the textarea value updates. */
  targetRef: RefObject<HTMLTextAreaElement | null>;
  /** Current full composer text (so the primitive can detect the
   *  mid-mention substring at the caret). */
  text: string;
  /** Caret position from the textarea's selectionStart. The host
   *  forwards this on every keystroke; the primitive uses it to find
   *  the in-progress @-token. */
  caret: number;
  /** Host's setText. The primitive calls this with the new full
   *  string after a selection. */
  onChange: (next: string) => void;
  /** Host's search handler. Receives the typed query (no leading @);
   *  returns a Promise of candidates. Debounce is internal (200ms);
   *  cancellation is via an AbortController the primitive owns. */
  onSearch: (query: string, signal: AbortSignal) => Promise<MentionCandidate[]>;
  /** Minimum query length before firing onSearch. Default 1 (most
   *  platforms accept single-char prefixes — but you can bump to 2
   *  for noisier datasets). */
  minQueryLength?: number;
}

const DEBOUNCE_MS = 200;

/** Returns `{ start, query }` if the caret is inside an in-progress
 *  @-mention, else null. An "in-progress mention" is `@` followed by
 *  non-whitespace word chars up to the caret. */
function detectMention(text: string, caret: number): { start: number; query: string } | null {
  // Walk backwards from the caret until we hit '@', whitespace, or
  // the start of the string. If we find '@' first, we're in a
  // mention. If we find whitespace first, we're not.
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "@") {
      // Edge: '@' at the very start of the string, OR preceded by
      // whitespace, counts as a mention trigger. If it's preceded by
      // a word char (e.g. "email@domain.com"), don't trigger.
      const prev = i > 0 ? text[i - 1] : " ";
      if (prev && /\s/.test(prev)) {
        return { start: i, query: text.slice(i + 1, caret) };
      }
      return null;
    }
    if (ch && /\s/.test(ch)) return null;
  }
  return null;
}

export function MentionTypeahead({
  targetRef,
  text,
  caret,
  onChange,
  onSearch,
  minQueryLength = 1,
}: MentionTypeaheadProps) {
  const detected = useMemo(() => detectMention(text, caret), [text, caret]);
  const isOpen = detected !== null && detected.query.length >= minQueryLength;

  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effect: re-run search whenever the query changes (debounced).
  // Cancel the previous in-flight request to avoid out-of-order
  // results overwriting a newer query.
  //
  // When isOpen flips false we DON'T reset candidates/loading here
  // (lint rule: no setState in effect). The popover stops rendering
  // anyway, and the next time the user opens a mention the effect
  // overwrites the stale state.
  useEffect(() => {
    if (!isOpen || !detected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      onSearch(detected.query, ctrl.signal)
        .then((results) => {
          if (ctrl.signal.aborted) return;
          setCandidates(results);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          // Search failures are quiet — the user keeps typing,
          // popover stays empty, and there's no toast spam. The host
          // can log if it cares.
          if (process.env.NODE_ENV !== "production") {
            console.warn("[MentionTypeahead] search failed:", err);
          }
          setCandidates([]);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOpen, detected, onSearch]);

  function handleSelect(c: MentionCandidate) {
    if (!detected) return;
    const before = text.slice(0, detected.start);
    const after = text.slice(caret);
    const insert = `@${c.handle} `;
    const next = before + insert + after;
    onChange(next);
    const newCaret = detected.start + insert.length;
    requestAnimationFrame(() => {
      const el = targetRef.current;
      if (!el) return;
      el.setSelectionRange(newCaret, newCaret);
      el.focus();
    });
  }

  // We render the popover anchored to the textarea itself (not a
  // floating per-caret anchor). The popover hangs under the textarea
  // by Radix's default placement.
  return (
    <Popover open={isOpen}>
      <PopoverAnchor asChild>
        {/* Anchor wraps the textarea — host passes its <Textarea/> in
            via the parent. We render a no-op span here that the host
            doesn't see; Radix uses the anchor's bounding box. The
            real anchor is the textarea via targetRef, set imperatively
            in the effect below. */}
        <span aria-hidden className="sr-only" />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-72 p-0"
        onOpenAutoFocus={(e) => {
          // Don't steal focus from the textarea — the user is still
          // typing. Arrow keys + Enter are handled by Command's
          // global listeners, so the textarea keeps focus.
          e.preventDefault();
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={detected ? `Search for @${detected.query}…` : "Search…"}
            value={detected?.query ?? ""}
            // Host owns the input. CommandInput is read-only here —
            // we display the in-progress mention text so the user has
            // visual confirmation of what's matching.
            readOnly
          />
          <CommandList className="max-h-64">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Searching…
              </div>
            )}
            {!loading && candidates.length === 0 && (
              <CommandEmpty>No matches.</CommandEmpty>
            )}
            {!loading && candidates.length > 0 && (
              <CommandGroup heading="People">
                {candidates.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.handle}
                    onSelect={() => handleSelect(c)}
                    className="flex items-center gap-2"
                  >
                    <Avatar className="size-7 shrink-0">
                      {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt="" />}
                      <AvatarFallback className="text-[10px]">
                        {(c.displayName ?? c.handle).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <span className="truncate">{c.displayName ?? c.handle}</span>
                        {c.verified && (
                          <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                            ✓
                          </Badge>
                        )}
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-0.5 text-xs text-muted-foreground",
                        )}
                      >
                        <AtSign className="size-3" />
                        <span className="truncate">{c.handle}</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
