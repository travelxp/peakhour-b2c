/**
 * Growth v2 navigation: five screens, a First-run flow, and the sub-tabs that
 * hold the pages that predate them (plan 1, U0).
 *
 * ★PURE, SO IT CAN BE TESTED WITHOUT A SIDEBAR. The dashboard layout renders
 * what `growthNav` returns; whether First run appears is decided here, from the
 * mandate state, not inside JSX.
 */

export const GROWTH_HOME = "/dashboard/growth";

/** Where the pre-v2 pages live now. They keep their pages; only the routes moved. */
export const RULES_ROUTE = `${GROWTH_HOME}/rules`;
export const LEARNING_ROUTE = `${GROWTH_HOME}/learning`;

export interface GrowthNavSub {
  href: string;
  label: string;
  /** Extra path prefixes that light this entry up (a sub-tab's pages, a linked page). */
  matches?: string[];
  /** The sidebar can render a count here; Growth's entries carry none. */
  badge?: undefined;
}

/**
 * Whether the engine has a mandate, as the nav needs to know it.
 *
 * - `present`: a mandate exists, so First run has done its job.
 * - `absent`: the rules route answered and there is no mandate.
 * - `not_built`: the rules route is still a 501 (no lane has built it), so no
 *   mandate can exist yet and the way in is First run.
 * - `unknown`: loading, or an error. First run stays hidden rather than flicker in
 *   for a merchant who may well have a mandate.
 */
export type MandateState = "present" | "absent" | "not_built" | "unknown";

/**
 * The mandate state from the rules query result. A preview (501 NOT_BUILT) is
 * `not_built`, whatever mandate the sample carries: the sample is not this
 * business's.
 */
export function mandateStateOf(rules: { preview: boolean; data: { mandate?: unknown } } | undefined): MandateState {
  if (!rules) return "unknown";
  if (rules.preview) return "not_built";
  return rules.data.mandate ? "present" : "absent";
}

export function showFirstRun(state: MandateState): boolean {
  return state === "absent" || state === "not_built";
}

export function growthNav(state: MandateState): GrowthNavSub[] {
  const items: GrowthNavSub[] = [
    { href: GROWTH_HOME, label: "Growth home" },
    { href: `${GROWTH_HOME}/decisions`, label: "Decisions" },
    // Campaign management stays at /dashboard/ads; Channels & money links to it.
    { href: `${GROWTH_HOME}/channels`, label: "Channels & money", matches: ["/dashboard/ads"] },
    { href: LEARNING_ROUTE, label: "Learning" },
    { href: RULES_ROUTE, label: "Rules" },
  ];
  if (showFirstRun(state)) items.push({ href: `${GROWTH_HOME}/start`, label: "First run" });
  return items;
}

/** The sub-tabs under Rules and Learning. The first tab of each is the screen itself. */
export const RULES_TABS: GrowthNavSub[] = [
  { href: RULES_ROUTE, label: "Rules" },
  { href: `${RULES_ROUTE}/audiences`, label: "Audiences" },
  { href: `${RULES_ROUTE}/business`, label: "Your Business" },
];

export const LEARNING_TABS: GrowthNavSub[] = [
  { href: LEARNING_ROUTE, label: "Learning" },
  { href: `${LEARNING_ROUTE}/creatives`, label: "Ad creatives" },
  { href: `${LEARNING_ROUTE}/signals`, label: "Signals" },
];

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

/**
 * The one entry that is active for `pathname`: the one with the longest matching
 * prefix across its `href` and `matches`. "Growth home" (`/dashboard/growth`) is a
 * prefix of every other Growth page, and must lose to the more specific entry.
 */
export function activeSubHref(pathname: string, subs: Array<{ href: string; matches?: string[] }>): string | undefined {
  let best: { href: string; len: number } | undefined;
  for (const sub of subs) {
    for (const prefix of [sub.href, ...(sub.matches ?? [])]) {
      if (under(pathname, prefix) && (!best || prefix.length > best.len)) best = { href: sub.href, len: prefix.length };
    }
  }
  return best?.href;
}
