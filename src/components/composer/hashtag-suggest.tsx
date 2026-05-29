"use client";

/**
 * <HashtagSuggest/> — inline #-tag autocomplete. Same shape and
 * interaction model as `<MentionTypeahead/>` (popover anchored to
 * containerRef, arrow-key nav, live-read targetRef on selection,
 * onSearch ref pattern). See that file for the full architectural
 * notes.
 *
 * Differences from mentions:
 *   - Tag-list rendering instead of avatar rows.
 *   - Usage-count chip right-aligned per row.
 *   - "Create #{query}" affordance in the empty state — common UX
 *     for hashtags (Twitter / Mastodon pattern) where new tags are
 *     valid by definition.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Hash, Loader2, Plus, TrendingUp } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { HashtagCandidate } from "./types";

export interface HashtagSuggestProps {
  containerRef: RefObject<HTMLElement | null>;
  targetRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  caret: number;
  onChange: (next: string) => void;
  onSearch: (query: string, signal: AbortSignal) => Promise<HashtagCandidate[]>;
  minQueryLength?: number;
}

const DEBOUNCE_MS = 200;

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
  containerRef,
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
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    if (!isOpen || !detected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      onSearchRef.current(detected.query, ctrl.signal)
        .then((results) => {
          if (ctrl.signal.aborted) return;
          setCandidates(results);
          setHighlightedIdx(0);
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
  }, [isOpen, detected]);

  // The "Create #foo" affordance becomes an implicit extra candidate
  // when the query is non-empty and the live results don't include
  // an exact match. We append it to the candidates array for
  // arrow-key + Enter navigation symmetry.
  const visibleCandidates = useMemo<(HashtagCandidate & { __create?: boolean })[]>(() => {
    if (!detected || detected.query.length === 0) return candidates;
    const lower = detected.query.toLowerCase();
    const hasExact = candidates.some((c) => c.tag.toLowerCase() === lower);
    if (hasExact) return candidates;
    return [...candidates, { tag: detected.query, __create: true }];
  }, [detected, candidates]);

  const handleSelect = useCallback(
    (c: HashtagCandidate) => {
      const el = targetRef.current;
      const liveText = el?.value ?? text;
      const liveCaret = el?.selectionStart ?? caret;
      const liveDetected = detectHashtag(liveText, liveCaret);
      if (!liveDetected) return;
      const before = liveText.slice(0, liveDetected.start);
      const after = liveText.slice(liveCaret);
      const insert = `#${c.tag} `;
      const next = before + insert + after;
      onChange(next);
      const newCaret = liveDetected.start + insert.length;
      requestAnimationFrame(() => {
        const elNow = targetRef.current;
        if (!elNow) return;
        elNow.focus();
        elNow.setSelectionRange(newCaret, newCaret);
      });
    },
    [text, caret, onChange, targetRef],
  );

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.min(i + 1, Math.max(0, visibleCandidates.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && visibleCandidates.length > 0) {
        e.preventDefault();
        const pick = visibleCandidates[highlightedIdx];
        if (pick) handleSelect(pick);
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, visibleCandidates, highlightedIdx, handleSelect]);

  return (
    <Popover open={isOpen}>
      <PopoverAnchor virtualRef={containerRef as RefObject<HTMLElement>} />
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-80 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Hashtags
        </div>
        <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
          {loading && candidates.length === 0 && (
            <li className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
              Searching…
            </li>
          )}
          {visibleCandidates.map((c, idx) => {
            const isActive = idx === highlightedIdx;
            return (
              <li
                key={c.__create ? `__create:${c.tag}` : c.tag}
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(c);
                }}
                onMouseEnter={() => setHighlightedIdx(idx)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors motion-reduce:transition-none",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50",
                )}
              >
                {c.__create ? (
                  <Plus className="size-3.5 shrink-0 text-primary" />
                ) : (
                  <Hash className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">
                  {c.__create ? (
                    <>
                      Create <span className="font-semibold">#{c.tag}</span>
                    </>
                  ) : (
                    c.tag
                  )}
                </span>
                {!c.__create && typeof c.usageCount === "number" && c.usageCount > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
                    <TrendingUp className="size-3" />
                    {formatCount(c.usageCount)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
