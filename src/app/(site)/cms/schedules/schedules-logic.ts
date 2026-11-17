import type { ScheduleRow, ScheduleStatus } from "@/hooks/use-schedules";

/** What the Result column shows: the api's status, or "off_dev" for a schedule switched off on dev. */
export type ShownStatus = ScheduleStatus | "off_dev";

export const STATUS_LABEL: Record<ShownStatus, string> = {
  healthy: "Healthy",
  failing: "Failing",
  did_not_finish: "Didn't finish",
  running: "Running",
  never_ran: "Never ran",
  off_dev: "Off on dev",
};

/** Default sort: what needs a look comes first. */
const STATUS_RANK: Record<ShownStatus, number> = {
  failing: 0,
  did_not_finish: 1,
  running: 2,
  never_ran: 3,
  healthy: 4,
  off_dev: 5,
};

export function shownStatus(s: ScheduleRow): ShownStatus {
  return s.devEnabled === false ? "off_dev" : s.status;
}

export function summarise(rows: ScheduleRow[]): Record<ShownStatus, number> {
  const out: Record<ShownStatus, number> = {
    healthy: 0, failing: 0, did_not_finish: 0, running: 0, never_ran: 0, off_dev: 0,
  };
  for (const r of rows) out[shownStatus(r)]++;
  return out;
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
