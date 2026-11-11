import type { AssigneeFilter, DeskFilters, PriorityFilter } from "@/lib/inbox-desk";

/**
 * The list query for the filters: `?assignee=`, `?tag=` and `?priority=high` only when set. Kept apart from lib/inbox-desk.ts (which
 * re-exports it) so the Inbox list query options can build the query string without pulling the desk's whole client.
 */
export function deskListParams(f: DeskFilters): Record<string, string> {
  return { ...(f.assignee !== "all" ? { assignee: f.assignee } : {}), ...(f.tag ? { tag: f.tag } : {}), ...(f.priority === "high" ? { priority: "high" } : {}) };
}

// ── the address -> the list's filters ────────────────────────────────────────────────────────────────────────────────
// ★ONE PARSER, TWO READERS. The Conversations pane reads the address with these, and so does the intent prefetch for a link that carries
//  a filter (lib/nav-prefetch.ts), so the list a hover warms is the list the page then asks for.

export function assigneeFilterFromParam(v: string | null | undefined): AssigneeFilter {
  return v === "mine" || v === "unassigned" || v === "assigned" ? v : "all";
}

export function priorityFilterFromParam(v: string | null | undefined): PriorityFilter {
  return v === "high" ? "high" : "all";
}

const TAG_PARAM_MAX = 64;
/** A tag id from the URL, or null. Anything odd is "no tag" rather than a request the api would refuse. */
export function tagFromParam(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t && t.length <= TAG_PARAM_MAX && /^[A-Za-z0-9_-]+$/.test(t) ? t : null;
}

const TOPIC_MAX = 200;

/**
 * A topic key from the URL, or null. The key is the api's own and is only ever sent back to it (URL-encoded), so any printable text is
 * accepted: narrowing the alphabet here would turn "See conversations" on a key with a slash or an accent into the whole unfiltered
 * list with no banner. Only the empty, the over-long and control characters are "no topic".
 */
export function topicFromParam(v: string | null | undefined): string | null {
  // NOT trimmed in what is returned: the key goes back to the api verbatim
  const t = v ?? "";
  return t.trim() && t.length <= TOPIC_MAX && ![...t].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ? t : null;
}

/** Anything with `get` (URLSearchParams, Next's ReadonlyURLSearchParams). */
export interface ParamReader {
  get(name: string): string | null;
}

/** The filters the address names: `?assignee=`, `?tag=`, `?priority=` and `?topic=`, each as the page reads it. */
export function deskViewFromParams(p: ParamReader): { assignee: AssigneeFilter; tag: string | null; priority: PriorityFilter; topic: string | null } {
  return {
    assignee: assigneeFilterFromParam(p.get("assignee")),
    tag: tagFromParam(p.get("tag")),
    priority: priorityFilterFromParam(p.get("priority")),
    topic: topicFromParam(p.get("topic")),
  };
}
