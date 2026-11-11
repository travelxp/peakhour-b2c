import type { DeskFilters } from "@/lib/inbox-desk";

/** Kept apart from lib/inbox-desk.ts so the Inbox list query options can build the query string without pulling the desk's whole client. */
/** The list query for the filters: `?assignee=`, `?tag=` and `?priority=high` only when set. */
export function deskListParams(f: DeskFilters): Record<string, string> {
  return { ...(f.assignee !== "all" ? { assignee: f.assignee } : {}), ...(f.tag ? { tag: f.tag } : {}), ...(f.priority === "high" ? { priority: "high" } : {}) };
}
