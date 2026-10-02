/**
 * The Background Jobs page's kind and children filters — the same rules as
 * peakhour-cms's jobs page (cms#174), over local state instead of the URL.
 */

/** What the kinds query has said so far. */
export type KindsState = { status: "pending" } | { status: "error" } | { status: "success"; kinds: readonly string[] };

/**
 * The kind actually filtered by: a kind the served list no longer has (a
 * refetch dropped it, or the kinds failed to load) is "all", so the list is
 * never filtered by a kind the dropdown cannot show.
 */
export function resolveKindFilter(kind: string, kinds: KindsState): string {
  if (kind === "all") return kind;
  if (kinds.status === "pending") return kind;
  if (kinds.status === "error") return "all";
  return kinds.kinds.includes(kind) ? kind : "all";
}

/** A chosen kind the loaded kinds no longer contain, to reset to "all". */
export function isStaleKind(kind: string, kinds: KindsState): boolean {
  return kind !== "all" && kinds.status === "success" && !kinds.kinds.includes(kind);
}

/** The dropdown's options: the served kinds once loaded, else none. */
export function kindSelectOptions(kinds: KindsState): readonly string[] {
  return kinds.status === "success" ? kinds.kinds : [];
}

export type ChildrenMode = "auto" | "on" | "off";

/**
 * Whether child jobs are listed. `auto`: ON when a kind is chosen (some kinds
 * only run as children, `tag_drafts`), OFF with "All kinds"; `on`/`off` are
 * the operator's explicit choice and survive a change of kind.
 */
export function resolveShowChildren(mode: ChildrenMode, kind: string): boolean {
  if (mode === "on") return true;
  if (mode === "off") return false;
  return kind !== "all";
}
