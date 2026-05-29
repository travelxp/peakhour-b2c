/**
 * Caret-aware text insertion — the single helper every composer uses to
 * splice a snippet (emoji, AI pull-quote, AI disclosure, …) into a
 * `<Textarea/>` at the user's cursor.
 *
 * Why this exists: the composer kit previously had TWO competing notions
 * of "the caret" and neither was reliable. `EmojiPickerTrigger` read
 * `el.selectionStart` LIVE — but opening the picker popover blurs the
 * textarea, so the live read fell back to the end (or 0). AI insert ops
 * (quote / disclosure) weren't wired as inserts at all — they did a
 * full-body `setText()` replace. Both now route through this one pure
 * function, fed by ONE caret source of truth the host tracks (captured
 * on select / click / keyup AND blur, so it survives the toolbar or
 * popover stealing focus).
 *
 * Pure + DOM-free so it is trivially unit-testable. The host owns the
 * side effects (setText, focus restore, setSelectionRange).
 */

export interface CaretInsertResult {
  /** The new full text with `snippet` spliced in. */
  text: string;
  /** Where the caret should land afterwards — just past the snippet,
   *  so the user can keep typing. */
  caret: number;
}

/**
 * Splice `snippet` into `text` at `caret`, returning the new text and
 * the caret position to restore.
 *
 * `caret` is clamped into `[0, text.length]` so a stale or out-of-range
 * caret (e.g. the snippet arrives from an async AI call after the user
 * shortened the draft) degrades to a safe in-bounds insert rather than
 * throwing or dropping characters. An out-of-range caret clamps to the
 * end — the most predictable place for a "the cursor moved" edge.
 */
export function insertAtCaret(
  text: string,
  caret: number,
  snippet: string,
): CaretInsertResult {
  const pos = clampCaret(caret, text.length);
  const next = text.slice(0, pos) + snippet + text.slice(pos);
  return { text: next, caret: pos + snippet.length };
}

/** Clamp a caret index into `[0, length]`. NaN / negative / overflow all
 *  resolve to a valid in-bounds position (overflow → end). */
export function clampCaret(caret: number, length: number): number {
  if (!Number.isFinite(caret)) return length;
  if (caret < 0) return 0;
  if (caret > length) return length;
  return Math.floor(caret);
}
