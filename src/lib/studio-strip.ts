import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * The running-jobs strip (UX spec 4.4): which of the running background jobs are Studio's, the line each one reads, and which have just finished.
 * A job row names no creative, so the page that starts work remembers where it is (`rememberWork`), and the strip links there.
 */

export type StudioJobKind = "previews" | "final" | "extend" | "other";

export interface StudioJob {
  id: string;
  kind: StudioJobKind;
  name: string;
  done: number | null;
  total: number | null;
}

const JOB_KIND_OF: Record<string, StudioJobKind> = { creative_previews: "previews", creative_final: "final", creative_extend: "extend" };

interface JobRowLike {
  _id: string;
  kind: string;
  displayName?: string;
  progress?: { totalUnits: number; processedUnits: number };
}

/** The Studio jobs among the running ones, with the api's own plain name for each (it says "Making another background" for one press). */
export function studioJobs(rows: ReadonlyArray<JobRowLike>): StudioJob[] {
  return rows
    .filter((j) => j.kind in JOB_KIND_OF)
    .map((j) => {
      const kind = JOB_KIND_OF[j.kind]!;
      const total = j.progress && j.progress.totalUnits > 0 ? j.progress.totalUnits : null;
      return {
        id: j._id,
        kind,
        name: j.displayName?.trim() || STUDIO_COPY.strip.names[kind],
        done: total === null || !j.progress ? null : Math.min(total, Math.max(0, j.progress.processedUnits)),
        total,
      };
    });
}

/** The strip's line for one job: "Making your previews · 2 of 4 ready", or just the name while no count is known. */
export const jobLine = (j: StudioJob): string =>
  j.total !== null && j.done !== null ? STUDIO_COPY.strip.line(j.name, j.done, j.total) : STUDIO_COPY.strip.lineNoCount(j.name);

/** The jobs that were running before and are not any more (finished, failed or stopped: the caller checks which). */
export function finishedJobs(before: ReadonlyArray<StudioJob>, now: ReadonlyArray<StudioJob>): StudioJob[] {
  const live = new Set(now.map((j) => j.id));
  return before.filter((j) => !live.has(j.id));
}

// ── Where the work is ──────────────────────────────────────────────────────────────────────────────────────

const WORK_KEY = "studio-work-creative";

/** Remember the creative the merchant just started work on, so the strip and the "ready" toast can open it. Per tab; losing it only loses the link. */
export function rememberWork(creativeId: string): void {
  try {
    window.sessionStorage.setItem(WORK_KEY, creativeId);
  } catch {
    // storage blocked: the strip simply has no link to offer
  }
}

export function rememberedWork(): string | null {
  try {
    return window.sessionStorage.getItem(WORK_KEY);
  } catch {
    return null;
  }
}

/** Where a kind of finished work is seen: finals on the Shortlist (they can come from several creatives), the rest on the creative started last. */
export function workHref(kind: StudioJobKind, creativeId: string | null, paths: { shortlist: string; creative: (id: string) => string }): string | null {
  if (kind === "final") return paths.shortlist;
  return creativeId ? paths.creative(creativeId) : null;
}
