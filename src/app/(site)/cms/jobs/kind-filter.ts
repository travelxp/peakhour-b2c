/**
 * The Background Jobs page's kind and children filters — the same rules as
 * peakhour-cms's jobs page (cms#174), over local state instead of the URL.
 * ⚠️Two copies, one per admin app (no shared package): a fix to one is a fix
 * to make in the other.
 */

/** What the kinds query has said so far. */
export type KindsState = { status: "pending" } | { status: "error" } | { status: "success"; kinds: readonly string[] };

/**
 * The kinds query as a `KindsState`. Data wins over an error: a failed
 * background refetch keeps the kinds already loaded, and must not drop a
 * working filter (cms#174 round 3). ★A PAUSED query with no data (offline)
 * is an error, not pending (round 3): it will not load until the network
 * returns, and "Loading kinds…" would claim otherwise.
 */
export function kindsStateOf(query: {
  data?: { kinds: readonly string[] };
  isError: boolean;
  isPaused: boolean;
}): KindsState {
  if (query.data) return { status: "success", kinds: query.data.kinds };
  return query.isError || query.isPaused ? { status: "error" } : { status: "pending" };
}

/**
 * A chosen kind the latest kinds do not contain. ★IGNORED, NOT RESET (round
 * 2): the api answers a failed `bg_jobs` read with its registered kinds only,
 * so a real kind can be missing from one answer and back in the next —
 * resetting the choice lost it for good. The page says so and offers a clear.
 * (A kind can only be chosen from loaded options, so with no data the choice
 * is "all" and there is nothing to check.)
 */
export function isUnknownKind(kind: string, kinds: KindsState): boolean {
  return kind !== "all" && kinds.status === "success" && !kinds.kinds.includes(kind);
}

/** The kind actually filtered by: an unknown choice is "all". */
export function effectiveKind(kind: string, kinds: KindsState): string {
  return isUnknownKind(kind, kinds) ? "all" : kind;
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

/**
 * The mode the toggle sets to show (or hide) children under `kind`: "auto"
 * when that is what auto would do anyway, so a toggle switched back returns
 * to auto instead of pinning an explicit choice (cms#174 round 3).
 */
export function childrenModeFor(show: boolean, kind: string): ChildrenMode {
  if (show === resolveShowChildren("auto", kind)) return "auto";
  return show ? "on" : "off";
}
