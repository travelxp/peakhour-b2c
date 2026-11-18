import type { ScheduleRow } from "@/hooks/use-schedules";

const KNOWN_STATUSES = ["healthy", "failing", "missed", "did_not_finish", "running", "waiting"] as const;

/** The statuses the page knows how to show. */
export type KnownStatus = (typeof KNOWN_STATUSES)[number];

/** What the Result column shows: the api's status, or "off_dev" for a schedule switched off on dev. */
export type ShownStatus = KnownStatus | "off_dev";

export const STATUS_LABEL: Record<ShownStatus, string> = {
  healthy: "Healthy",
  failing: "Failing",
  missed: "Missed",
  did_not_finish: "Didn't finish",
  running: "Running",
  waiting: "Waiting for first run",
  off_dev: "Off on dev",
};

/** Default sort: what needs a look comes first. */
const STATUS_RANK: Record<ShownStatus, number> = {
  missed: 0,
  failing: 1,
  did_not_finish: 2,
  running: 3,
  waiting: 4,
  healthy: 5,
  off_dev: 6,
};

const KNOWN: ReadonlySet<string> = new Set(KNOWN_STATUSES);

/** The legacy `never_ran`, and any status this page does not know, read as waiting. */
export function normaliseStatus(status: string): KnownStatus {
  return KNOWN.has(status) ? (status as KnownStatus) : "waiting";
}

export function shownStatus(s: ScheduleRow): ShownStatus {
  return s.devEnabled === false ? "off_dev" : normaliseStatus(s.status);
}

/** Every schedule lands in exactly one bucket, so the buckets sum to the total. */
export function summarise(rows: ScheduleRow[]): Record<ShownStatus, number> {
  const out: Record<ShownStatus, number> = {
    healthy: 0, failing: 0, missed: 0, did_not_finish: 0, running: 0, waiting: 0, off_dev: 0,
  };
  for (const r of rows) out[shownStatus(r)]++;
  return out;
}

/** The sentence under a Missed or Waiting badge (tooltip and sheet); null for the rest. */
export function statusNote(
  row: ScheduleRow,
  recordingSince: string | null | undefined,
  fmt: (iso: string) => string,
): string | null {
  const s = shownStatus(row);
  if (s === "missed") {
    return row.dueAt ? `Was due at ${fmt(row.dueAt)}; no run arrived.` : "A run was due; none arrived.";
  }
  if (s === "waiting") {
    const since = recordingSince ? `No run recorded since ${fmt(recordingSince)}` : "No run recorded yet";
    return row.nextRunAt ? `${since}; next run ${fmt(row.nextRunAt)}.` : `${since}.`;
  }
  return null;
}

export function filterSchedules(
  rows: ScheduleRow[],
  f: { search: string; status: string; area: string },
): ScheduleRow[] {
  const q = f.search.trim().toLowerCase();
  const out = rows.filter((r) => {
    if (f.area !== "all" && r.area !== f.area) return false;
    if (f.status !== "all" && shownStatus(r) !== f.status) return false;
    if (q && !r.label.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
    return true;
  });
  return out.sort(
    (a, b) =>
      STATUS_RANK[shownStatus(a)] - STATUS_RANK[shownStatus(b)] ||
      a.label.localeCompare(b.label) ||
      a.name.localeCompare(b.name),
  );
}

/** The command that runs one schedule by hand; dev runs the master branch. */
export function invokeCommand(name: string, environment: "production" | "dev"): string {
  return `vercel schedules invoke ${name}${environment === "dev" ? " --git-branch master" : ""}`;
}
