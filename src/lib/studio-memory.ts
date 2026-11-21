import { ApiError } from "@/lib/api";
import { MEMORY_LINE_MAX, type MemoryExport, type MemoryLine, type MemoryPage, type MemoryRead } from "@/lib/api/creative";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** Pure helpers for "What we've learned about you" (UX spec S15). No React, no fetching: tested directly. */

const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/** What happened to a change: `done`, `gone` (the line was already deleted elsewhere: the page should just refresh), or `failed`. */
export type MemoryOutcome = "done" | "gone" | "failed";

/**
 * Run one change. Only a change aimed at one line (`goneOn404`: stop using, edit) reads a 404 as "that line is already gone". For anything else
 * (add, wipe, the opt-in) a 404 is a route or business that was not found, so it is a failure: a wipe must never say it worked when it did not.
 */
export async function runChange(change: () => Promise<unknown>, opts: { goneOn404?: boolean } = {}): Promise<MemoryOutcome> {
  try {
    await change();
    return "done";
  } catch (e) {
    return opts.goneOn404 && isNotFound(e) ? "gone" : "failed";
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

/**
 * The page the view draws, from the pages read so far: the first page's rules, trends and opt-in, every line read (a line that a later page repeats is
 * drawn once), and the cursor of the last page (absent when everything has been read). Undefined until the first page is in.
 */
export function assembleMemory(pages: MemoryPage[] | undefined): MemoryRead | undefined {
  const first = pages?.[0];
  if (!pages || !first || !first.rules || !first.trends) return undefined;
  const seen = new Set<string>();
  const lines: MemoryLine[] = [];
  for (const p of pages) {
    for (const l of p.lines) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      lines.push(l);
    }
  }
  const next = pages[pages.length - 1]!.next;
  return {
    lines,
    ...(next ? { next } : {}),
    totalLines: first.totalLines ?? lines.length,
    rules: first.rules,
    note: first.note ?? "",
    trends: first.trends,
    pooledOptIn: first.pooledOptIn ?? false,
  };
}

/** Change what the pages hold without reading them again: every line through `fn`, and the first page's own fields through `top`. */
export function patchPages(pages: MemoryPage[], fn: (lines: MemoryLine[]) => MemoryLine[], top?: (first: MemoryPage) => MemoryPage): MemoryPage[] {
  return pages.map((p, i) => {
    const next = { ...p, lines: fn(p.lines) };
    return i === 0 && top ? top(next) : next;
  });
}
