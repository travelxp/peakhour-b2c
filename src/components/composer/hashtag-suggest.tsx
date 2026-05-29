"use client";

/**
 * <HashtagSuggest/> — inline #-tag autocomplete. Same shape as
 * `<MentionTypeahead/>` but triggered on `#` and rendered as a
 * tag-list (no avatar / no verified badge). Usage count is shown
 * right-aligned per row when the host's search returns one.
 *
 * Architectural choice: NOT merged with mention typeahead into a
 * single "trigger-aware combobox" primitive — the two have different
 * candidate shapes, different list visual, and different host
 * backends (mentions hit a per-platform search API; hashtags hit
 * cnt_content_tags history + optional platform-trending). Keeping
 * them separate keeps each ~150 LOC and easier to specialise.
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Hash, Loader2, TrendingUp } from "lucide-react";
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
import type { HashtagCandidate } from "./types";

export interface HashtagSuggestProps {
  targetRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  caret: number;
  onChange: (next: string) => void;
  onSearch: (query: string, signal: AbortSignal) => Promise<HashtagCandidate[]>;
  minQueryLength?: number;
}

const DEBOUNCE_MS = 200;

/** Returns `{ start, query }` if the caret is inside an in-progress
 *  hashtag, else null. Same rules as mentions: `#` must be at the
 *  start of the string or follow whitespace; word chars only until
 *  the caret. */
function detectHashtag(text: string, caret: number): { start: number; query: string } | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "#") {
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

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function HashtagSuggest({
  targetRef,
  text,
  caret,
  onChange,
  onSearch,
  minQueryLength = 1,
}: HashtagSuggestProps) {
  const detected = useMemo(() => detectHashtag(text, caret), [text, caret]);
  const isOpen = detected !== null && detected.query.length >= minQueryLength;

  const [candidates, setCandidates] = useState<HashtagCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When isOpen flips false we DON'T reset state here (lint: no
  // setState in effect). The popover stops rendering; next open
  // overwrites.
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
          if (process.env.NODE_ENV !== "production") {
            console.warn("[HashtagSuggest] search failed:", err);
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

  function handleSelect(c: HashtagCandidate) {
    if (!detected) return;
    const before = text.slice(0, detected.start);
    const after = text.slice(caret);
    const insert = `#${c.tag} `;
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

  return (
    <Popover open={isOpen}>
      <PopoverAnchor asChild>
        <span aria-hidden className="sr-only" />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-64 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={detected ? `Search for #${detected.query}…` : "Search…"}
            value={detected?.query ?? ""}
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
              <CommandGroup heading="Hashtags">
                {candidates.map((c) => (
                  <CommandItem
                    key={c.tag}
                    value={c.tag}
                    onSelect={() => handleSelect(c)}
                    className="flex items-center gap-2"
                  >
                    <Hash className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{c.tag}</span>
                    {typeof c.usageCount === "number" && c.usageCount > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
                        <TrendingUp className="size-3" />
                        {formatCount(c.usageCount)}
                      </span>
                    )}
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
