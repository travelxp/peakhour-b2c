import type { DeskFilters } from "@/lib/inbox-desk";

/**
 * The list query for the filters: `?assignee=`, `?tag=` and `?priority=high` only when set. Kept apart from lib/inbox-desk.ts (which
 * re-exports it) so the Inbox list query options can build the query string without pulling the desk's whole client.
 */
export function deskListParams(f: DeskFilters): Record<string, string> {
  return { ...(f.assignee !== "all" ? { assignee: f.assignee } : {}), ...(f.tag ? { tag: f.tag } : {}), ...(f.priority === "high" ? { priority: "high" } : {}) };
}
