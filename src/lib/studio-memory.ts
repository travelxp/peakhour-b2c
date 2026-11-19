import { ApiError } from "@/lib/api";
import { MEMORY_LINE_MAX, type MemoryExport, type MemoryLine, type MemoryRead } from "@/lib/api/creative";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** Pure helpers for "What we've learned about you" (UX spec S15). No React, no fetching: tested directly. */

const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/** What happened to a change: `done`, `gone` (the line was already deleted elsewhere: the page should just refresh), or `failed`. */
export type MemoryOutcome = "done" | "gone" | "failed";

/** Run one change. A 404 means the line is already gone, which is what a delete wanted; anything else is a failure with nothing changed. */
export async function runChange(change: () => Promise<unknown>): Promise<MemoryOutcome> {
  try {
    await change();
    return "done";
  } catch (e) {
    return isNotFound(e) ? "gone" : "failed";
  }
}

export type DraftProblem = "empty" | "too_long";

/** The text a merchant typed for a preference: trimmed, 1 to 140 characters (the api's own rule). */
export function checkDraft(text: string): { ok: true; text: string } | { ok: false; problem: DraftProblem } {
  const t = text.trim();
  if (t.length === 0) return { ok: false, problem: "empty" };
  if (t.length > MEMORY_LINE_MAX) return { ok: false, problem: "too_long" };
  return { ok: true, text: t };
}

/** The line to show for the evidence behind a learned line, or the plain origin for one the merchant wrote. Never a before/after claim. */
export function lineNote(line: Pick<MemoryLine, "origin" | "evidence" | "source">): string {
  if (line.source === "you") return STUDIO_COPY.learned.youWrote;
  return line.evidence?.label ? `${line.origin}. ${line.evidence.label}` : line.origin;
}

/** The taste lines only (the api sends them that way; a rule line that slips in is not editable or deletable here). */
export const tasteLines = (m: Pick<MemoryRead, "lines">): MemoryLine[] => m.lines.filter((l) => l.kind === "taste");

/** The JSON a merchant keeps. Pretty-printed so a person can read it. */
export const exportBody = (data: MemoryExport): string => JSON.stringify(data, null, 2);
