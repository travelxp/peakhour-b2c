"use client";

/**
 * <MentionTypeahead/> — inline @-mention autocomplete for any composer
 * surface. Listens to the host textarea's value + caret, detects when
 * the user is mid-mention (`@…` at the caret, no whitespace yet),
 * debounces the host's `onSearch` callback, and surfaces a Popover
 * anchored under the textarea wrapper with the candidates.
 *
 * Picking a candidate replaces the partial `@foo` with the full
 * `@handle ` (trailing space), restores focus to the textarea, and
 * moves the caret past the inserted mention.
 *
 * INTERACTION MODEL:
 *   - Focus stays in the host textarea — never moves into the popover.
 *   - This primitive owns ArrowUp/Down/Enter/Escape handlers via a
 *     window-level keydown listener active only while the popover is
 *     open. Internal `highlightedIdx` state drives the visual focus.
 *   - Escape dismisses the popover for the current trigger; typing
 *     a new @ resets the dismissed flag.
 *   - The popover is anchored to the host's wrapper container (passed
 *     via `containerRef`), NOT the caret position. Slack-style
 *     "popover under the field" — not Notion-style caret-glued.
 *
 * REQUIRED HOST WIRING:
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const targetRef = useRef<HTMLTextAreaElement>(null);
 *   const [caret, setCaret] = useState(0);
 *
 *   <div ref={containerRef} className="relative"> // ← MUST be position: relative
 *     <Textarea ref={targetRef} value={text} onChange={(e) => setText(e.target.value)}
 *               onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
 *               onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)} />
 *     <MentionTypeahead
 *       containerRef={containerRef}
 *       targetRef={targetRef}
 *       text={text}
 *       caret={caret}
 *       onChange={setText}
 *       onSearch={searchMentions}
 *     />
 *   </div>
 *
 * Notes:
 * - The wrapper MUST have `position: relative` (or another non-static
 *   value) for the popover to position correctly under the textarea.
 *   Tailwind's `relative` class does the job.
 * - `caret` MUST update on BOTH `onSelect` AND `onKeyUp` — arrow keys
 *   inside the textarea fire selectionchange but not onChange, so
 *   relying on onChange alone misses keyboard navigation.
 *
 * Single-instance assumption: if two MentionTypeahead instances mount
 * simultaneously on the same page, the window-level Enter listener
 * fires twice and could double-insert. Acceptable for v1; revisit if
 * a split-view composer ships.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { AtSign, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { asMeasurableRef } from "./_helpers";
import type { MentionCandidate } from "./types";

export interface MentionTypeaheadProps {
  /** Ref to the wrapper element that contains the host's textarea —
   *  the popover anchors to this so it positions correctly under the
   *  field. Without this ref Radix would anchor to its trigger (or
   *  fall back to the viewport corner). */
  containerRef: RefObject<HTMLElement | null>;
  /** Ref to the textarea itself. Used to read live selectionStart /
   *  value at the moment of selection (so a user who types past the
   *  popover-render snapshot doesn't lose their characters). */
  targetRef: RefObject<HTMLTextAreaElement | null>;
  /** Current full composer text (used to detect the in-progress
   *  @-token at the caret position). */
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
   *  cancellation is via an AbortController the primitive owns. The
   *  function reference is stashed in a ref so passing an inline
   *  lambda from the host won't re-fire the debounce. */
  onSearch: (query: string, signal: AbortSignal) => Promise<MentionCandidate[]>;
  /** Optional: called with the picked candidate when the user selects one.
   *  The host uses this to record the candidate's id/URN (the inserted text
   *  alone can't carry it) — e.g. to build a LinkedIn mention segment. Fires
   *  alongside the `onChange` that inserts `@<handle>` into the text. */
  onPick?: (candidate: MentionCandidate) => void;
  /** Minimum query length before firing onSearch. Default 1 (most
   *  platforms accept single-char prefixes — bump to 2 for noisier
   *  datasets). */
  minQueryLength?: number;
}

const DEBOUNCE_MS = 200;

/** Returns `{ start, query }` if the caret is inside an in-progress
 *  @-mention, else null. An "in-progress mention" is `@` followed by
 *  non-whitespace word chars up to the caret. */
function detectMention(text: string, caret: number): { start: number; query: string } | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "@") {
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
  containerRef,
  targetRef,
  text,
  caret,
  onChange,
  onSearch,
  onPick,
  minQueryLength = 1,
}: MentionTypeaheadProps) {
  const detected = useMemo(() => detectMention(text, caret), [text, caret]);
  // Escape-dismissed flag, keyed by the @-trigger start position so a
  // new mention later in the text reopens the popover automatically.
  const [escapedFromStart, setEscapedFromStart] = useState<number | null>(null);
  const isOpen =
    detected !== null &&
    detected.query.length >= minQueryLength &&
    escapedFromStart !== detected.start;

  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  // Remember which candidate the user had highlighted before a
  // re-query — so a typed extra char doesn't snap the selection back
  // to row 0 if the previously-highlighted item is still in results.
  const lastHighlightIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stash onSearch in a ref — inline lambdas from the host would
  // otherwise change identity every render, refire the effect, and
  // continuously reset the debounce so the search never executes.
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Re-run search when query changes (debounced). onSearch is NOT in
  // deps — see ref pattern above.
  useEffect(() => {
    if (!isOpen || !detected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      // Loading is set synchronously inside the timeout (post-render);
      // safe by lint rules and avoids the spinner-after-results race.
      setLoading(true);
      onSearchRef.current(detected.query, ctrl.signal)
        .then((results) => {
          if (ctrl.signal.aborted) return;
          setCandidates(results);
          // Preserve highlight across re-queries: if the previously-
          // highlighted candidate id is still in results, point at
          // its new index; otherwise fall back to row 0.
          const prevId = lastHighlightIdRef.current;
          const prevIdx = prevId ? results.findIndex((c) => c.id === prevId) : -1;
          setHighlightedIdx(prevIdx >= 0 ? prevIdx : 0);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
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
  }, [isOpen, detected]);

  const handleSelect = useCallback(
    (c: MentionCandidate) => {
      // Read LIVE textarea state at click/Enter time, not the props
      // snapshot — if the user typed extra chars between popover
      // render and selection we'd otherwise chop them.
      const el = targetRef.current;
      const liveText = el?.value ?? text;
      const liveCaret = el?.selectionStart ?? caret;
      const liveDetected = detectMention(liveText, liveCaret);
      // If the user has typed past the mention trigger (e.g. they hit
      // space already), refuse silently rather than corrupting the text.
      if (!liveDetected) return;
      const before = liveText.slice(0, liveDetected.start);
      const after = liveText.slice(liveCaret);
      const insert = `@${c.handle} `;
      const next = before + insert + after;
      onChange(next);
      // Let the host record the picked candidate's id/URN — the inserted
      // `@<handle>` text alone can't carry it.
      onPick?.(c);
      const newCaret = liveDetected.start + insert.length;
      requestAnimationFrame(() => {
        const elNow = targetRef.current;
        if (!elNow) return;
        elNow.focus();
        elNow.setSelectionRange(newCaret, newCaret);
      });
    },
    [text, caret, onChange, onPick, targetRef],
  );

  // Window-level keyboard handler — only active when popover is open.
  // Captures Arrow / Enter / Escape from the host textarea since
  // focus never moves into the popover.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((i) => {
          const next = Math.min(i + 1, Math.max(0, candidates.length - 1));
          lastHighlightIdRef.current = candidates[next]?.id ?? null;
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((i) => {
          const next = Math.max(i - 1, 0);
          lastHighlightIdRef.current = candidates[next]?.id ?? null;
          return next;
        });
      } else if (e.key === "Enter" && candidates.length > 0) {
        e.preventDefault();
        const pick = candidates[highlightedIdx];
        if (pick) handleSelect(pick);
      } else if (e.key === "Escape") {
        // Dismiss the popover for THIS @-trigger. Detected.start is
        // stable while the user is editing within the same mention;
        // typing past whitespace or starting a new @ later in the
        // text will produce a new detected.start and the popover
        // reopens automatically.
        e.preventDefault();
        if (detected) setEscapedFromStart(detected.start);
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, candidates, highlightedIdx, handleSelect, detected]);

  return (
    <Popover open={isOpen}>
      <PopoverAnchor virtualRef={asMeasurableRef(containerRef)} />
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-80 p-0"
        // Keep focus in the host textarea — premium typeaheads (Slack,
        // Linear) never steal focus mid-edit. Arrow keys handled above.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          People
        </div>
        <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
          {loading && candidates.length === 0 && (
            <li className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground motion-reduce:animate-none">
              <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
              Searching…
            </li>
          )}
          {!loading && candidates.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              {detected ? `No matches for "@${detected.query}".` : "No matches."}
            </li>
          )}
          {candidates.map((c, idx) => {
            const isActive = idx === highlightedIdx;
            return (
              <li
                key={c.id}
                role="option"
                aria-selected={isActive}
                // onMouseDown (not onClick) — mousedown fires before
                // blur of the textarea, so handleSelect can read the
                // live textarea selection and refocus cleanly. Click
                // would lose focus first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(c);
                }}
                onMouseEnter={() => {
                  setHighlightedIdx(idx);
                  lastHighlightIdRef.current = c.id;
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors motion-reduce:transition-none",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50",
                )}
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
                  <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <AtSign className="size-3" />
                    <span className="truncate">{c.handle}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
