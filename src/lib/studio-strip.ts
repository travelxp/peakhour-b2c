import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * The running-jobs strip (UX spec 4.4): which of the running background jobs are Studio's, the line each one reads, and which have just finished.
 * A Studio job row names its creative (`creativeId`, api CS-UI-5), and the strip links there; a row without one (queued before it was kept, or a
 * batch that spans several creatives) links to the Studio home.
 */

export type StudioJobKind = "previews" | "final" | "extend" | "other";

export interface StudioJob {
  id: string;
  kind: StudioJobKind;
  name: string;
  done: number | null;
  total: number | null;
  /** The creative the job works on; null for a job that names none. */
  creativeId: string | null;
}

const JOB_KIND_OF: Record<string, StudioJobKind> = { creative_previews: "previews", creative_final: "final", creative_extend: "extend" };

interface JobRowLike {
  _id: string;
  kind: string;
  displayName?: string;
  creativeId?: string;
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
        creativeId: j.creativeId ?? null,
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

/** Where a kind of finished work is seen: finals on the Shortlist (one press can make several, from several creatives), the rest on their creative, or the Studio home when the job names none. */
export function workHref(kind: StudioJobKind, creativeId: string | null, paths: { home: string; shortlist: string; creative: (id: string) => string }): string {
  if (kind === "final") return paths.shortlist;
  return creativeId ? paths.creative(creativeId) : paths.home;
}
