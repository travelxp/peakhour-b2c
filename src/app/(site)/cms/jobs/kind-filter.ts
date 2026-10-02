/**
 * The Background Jobs page's kind and children filters — the same rules as
 * peakhour-cms's jobs page (cms#174), over local state instead of the URL.
 * ⚠️Two copies, one per admin app (no shared package): a fix to one is a fix
 * to make in the other.
 */

/**
 * What the kinds query has said so far. `paused`: no data and not fetching —
 * offline, or a retry waiting for this tab to be focused (cms#175). Not an
 * error; the page says it is waiting. `complete` is the api's flag (api#1442).
 */
export type KindsState =
  | { status: "pending" }
  | { status: "paused" }
  | { status: "error" }
  | { status: "success"; kinds: readonly string[]; complete: boolean };

/**
 * The kinds query as a `KindsState`. Data wins over an error: a failed
 * background refetch keeps the kinds already loaded, and must not drop a
 * working filter (cms#174 round 3).
 */
export function kindsStateOf(query: {
  data?: { kinds: readonly string[]; complete: boolean };
  isError: boolean;
  isPaused: boolean;
}): KindsState {
  if (query.data) return { status: "success", kinds: query.data.kinds, complete: query.data.complete };
  if (query.isError) return { status: "error" };
  return query.isPaused ? { status: "paused" } : { status: "pending" };
}

/**
 * Why a chosen kind is not applied: a complete answer lacks it ("unknown"),
 * or an INCOMPLETE one does ("partial": the api could not read `bg_jobs`, so
 * "not a known kind" would be a claim). ★IGNORED, NOT RESET (round 2): the
 * kind may be back in the next answer. The page says which, and offers a
 * clear. (A kind can only be chosen from loaded options, so with no data the
 * choice is "all" and there is nothing to check.)
 */
export function ignoredKind(kind: string, kinds: KindsState): "unknown" | "partial" | null {
  if (kind === "all" || kinds.status !== "success" || kinds.kinds.includes(kind)) return null;
  return kinds.complete ? "unknown" : "partial";
}

/** The kind actually filtered by: an ignored choice is "all". */
export function effectiveKind(kind: string, kinds: KindsState): string {
  return ignoredKind(kind, kinds) ? "all" : kind;
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
