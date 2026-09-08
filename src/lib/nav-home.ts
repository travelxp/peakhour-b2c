/**
 * Where the app opens, and how its navigation is grouped.
 *
 * ★★ONE FLAG, TWO CHANGES, BOTH OFF. `NEXT_PUBLIC_OUTCOMES_HOME` is the product
 * decision the plan's own call sheet asks for — whether Overview may be demoted
 * and the pillars reorganised around the funnel — and it is not ours to make.
 * With the flag unset every merchant sees exactly what they see today: the app
 * opens on Overview and the navigation is the existing run of pillars. Nothing
 * about this file changes a default.
 *
 * ★AND IT IS ONE FLAG RATHER THAN TWO, because the two halves are not
 * separately meaningful. `/dashboard` redirecting to Outcomes while the
 * navigation still leads with Overview is a home screen the navigation
 * contradicts, and a reorganised navigation that opens on Overview buries the
 * screen it was reorganised around. Either both or neither.
 *
 * ★BUILD-INLINED, SO IT IS SAFE AT MODULE SCOPE. `NEXT_PUBLIC_*` is substituted
 * at build time, which is why the existing `SHOW_AUTOPILOT` constant is
 * declared the same way — there is no request to read it from and no hydration
 * mismatch to have.
 *
 * @package peakhour-b2c
 */

// ★THE FLAG ITSELF LIVES IN lib/flags.ts, with every other client flag and on
// the same `"true"` convention. A first version declared it here and took `"1"`
// — so `NEXT_PUBLIC_OUTCOMES_HOME=true`, the spelling every other flag in this
// repo uses, silently left the feature off. One convention per repo; a flag
// whose accepted value has to be looked up is a flag somebody sets wrongly.
// Re-exported so callers of this module need only one import.
import { OUTCOMES_HOME } from "./flags";

export { OUTCOMES_HOME };

/**
 * The route the app opens on.
 *
 * ★A FUNCTION OF THE FLAG, IN ONE PLACE. `/dashboard` redirects here, the
 * sidebar's logo links here, and anything else that means "home" reads it. Two
 * copies of this decision is how the logo and the redirect come to disagree —
 * a click on the mark landing somewhere other than where the app opened.
 */
export const HOME_ROUTE = OUTCOMES_HOME ? "/dashboard/outcomes" : "/dashboard/overview";

/**
 * Which funnel question a navigation destination serves.
 *
 * ★★ONLY THE TOP-LEVEL PILLARS ARE ASSIGNED, and everything unassigned falls
 * through to the tail rather than disappearing. That is the difference between
 * a reorganisation and a rewrite: the plan's instruction is "the tool screens
 * KEPT and demoted rather than removed", and a hand-written second list would
 * lose a pillar the first time somebody adds one — invisibly, because a
 * destination missing from a navigation nobody has switched on yet fails
 * nothing.
 */
const FUNNEL_GROUP: Record<string, "Found" | "Chosen" | "Convinced"> = {
  "/dashboard/presence": "Found",
  "/dashboard/content": "Chosen",
  "/dashboard/ads": "Chosen",
  "/dashboard/insights/analytics": "Convinced",
  "/dashboard/commerce": "Convinced",
};

/**
 * Destinations that lead the navigation, above the funnel headings.
 *
 * Connecting is the prerequisite for every answer below it, and a customer
 * waiting on a reply outranks any question about reach — the reasoning the
 * existing pillar order already states, carried across unchanged.
 */
const LEAD_HREFS = ["/dashboard/integrations", "/dashboard/inbox"];

/** The minimum shape this partition needs. The real items carry icons,
 *  subitems, entitlement keys and badge renderers; none of that is read here,
 *  and the objects are passed through BY REFERENCE so none of it is lost. */
export interface NavLike {
  href: string;
}

export interface NavGroupLike<T extends NavLike> {
  label: string;
  items: T[];
}

/**
 * Regroup the pillar navigation around the funnel questions.
 *
 * ★★A PARTITION, NOT A SECOND LIST. Every item in `pillars` comes out exactly
 * once: assigned by `FUNNEL_GROUP`, promoted into the lead, or swept into the
 * tail. A pillar added next month lands in the tail rather than vanishing from
 * a navigation nobody has switched on to notice.
 *
 * ★AND `home` IS PROMOTED OUT OF WHEREVER IT WAS, not copied alongside it.
 * Outcomes lives inside Growth's subitems in the pillar navigation, so the
 * caller passes an item for it and this removes it from that parent — one
 * destination, one place in the list. Left in both, the route lights up twice,
 * its parent auto-expands beneath its own promoted child, and in the collapsed
 * rail the two are indistinguishable.
 *
 * ★★AND IF THE PILLAR LIST ALREADY HAS A TOP-LEVEL ITEM FOR THAT HREF, THAT
 * ITEM WINS. The caller's argument is a stub — an href, a label and an icon —
 * while a real pillar carries an entitlement key, upsell copy and subitems.
 * Preferring the stub deleted all of it silently: an unentitled org would stop
 * seeing the locked upsell and simply see a working link. The occurrence count
 * is 1 either way, so nothing about "exactly once" could catch it.
 *
 * ★★THERE IS NO "BOUGHT" GROUP, WHICH IS A FINDING RATHER THAN AN OMISSION.
 * The other three questions each have tools behind them; the fourth has none —
 * its answer is a figure on the home screen and there is nothing to navigate
 * to. A fourth heading over Commerce would imply Commerce answers "what was it
 * worth", which it does not: it is where a catalog is managed. Three headings
 * and an honest gap beat four headings and a wrong one.
 */
export function funnelNav<T extends NavLike & { subItems?: { href: string }[] }>(
  pillars: NavGroupLike<T>[],
  home: T,
): NavGroupLike<T>[] {
  // ★★THE PROMOTED HREF IS REMOVED FROM WHICHEVER PARENT HELD IT AS A SUBITEM.
  // Outcomes lives under Growth in the pillar navigation, so promoting it left
  // the route in two places at once: both entries light up on /dashboard/
  // outcomes, Growth auto-expands underneath its own promoted child, and in the
  // collapsed icon rail the two are indistinguishable. One destination, one
  // place in the list.
  const all = pillars
    .flatMap((g) => g.items)
    .map((i) =>
      // ★★NEVER AGAINST THE PROMOTED ITEM ITSELF. Growth and Commerce both list
      // their OWN href as their first subitem ("Ads", "Command Center"), so
      // promoting either would have deleted that subitem from its own submenu —
      // a destination lost by the very code written to stop losing them.
      i.href !== home.href && i.subItems?.some((s) => s.href === home.href)
        ? { ...i, subItems: i.subItems.filter((s) => s.href !== home.href) }
        : i,
    ) as T[];
  const byHref = new Map(all.map((i) => [i.href, i]));

  // ★THE REAL PILLAR WINS OVER THE CALLER'S STUB. See the docblock: the stub
  // has no entitlement key and no subitems, and preferring it throws both away.
  const homeItem = byHref.get(home.href) ?? home;

  const lead = LEAD_HREFS.map((h) => byHref.get(h)).filter((i): i is T => i !== undefined);

  const inGroup = (label: "Found" | "Chosen" | "Convinced") =>
    Object.entries(FUNNEL_GROUP)
      .filter(([, g]) => g === label)
      .map(([h]) => byHref.get(h))
      .filter((i): i is T => i !== undefined);

  // ★★EVERYTHING, IN ITS ORIGINAL ORDER — and the dedupe below is what makes
  // that correct rather than duplicative. A first version filtered an
  // exclusion set out of this list AND deduped afterwards; the set could not
  // change any output the dedupe did not already fix, so it was a guard that
  // read as load-bearing and tested as nothing. One rule, at the end.
  //
  // Overview lands here — still one click away, still the same page, no longer
  // the first thing a merchant sees, which is the whole of the change.
  const tail = all;

  // ★★ONE DEDUPE AT THE END, NOT AN EXCLUSION FILTER PER PLACE. An item can
  // land in three of these — the lead, a funnel heading, the tail — and a first
  // version guarded each entry point separately. Two of those three guards could
  // not fire on any input the module allows (`FUNNEL_GROUP` and `LEAD_HREFS`
  // are constants that do not name the home href today), which is a guard that
  // reads as load-bearing and tests as nothing. Emitting first and keeping the
  // FIRST occurrence is one rule, reachable from any input, and it is what makes
  // "exactly once" true rather than merely intended.
  //
  // ★AND AN EMPTY GROUP IS DROPPED, HEADING AND ALL. `FUNNEL_GROUP` names
  // hrefs, so a retired pillar or a mistyped href leaves its question with
  // nothing under it — and a "Found" heading over empty space tells a merchant
  // a section exists that does not.
  const seen = new Set<string>();
  return [
    { label: "", items: [homeItem, ...lead] },
    { label: "Found", items: inGroup("Found") },
    { label: "Chosen", items: inGroup("Chosen") },
    { label: "Convinced", items: inGroup("Convinced") },
    { label: "", items: tail },
  ]
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true))),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Normalise a server-issued landing route against the flag.
 *
 * ★★THE api CANNOT KNOW ABOUT THIS FLAG. `NEXT_PUBLIC_OUTCOMES_HOME` is
 * build-inlined into the browser bundle; `verify-magic` and the WordPress
 * bridge both hand back `/dashboard/overview` as "the app's home", and they are
 * a separate deployment with no visibility of it. With the flag on, the primary
 * entry into the product — signing in — landed on the very screen the flag
 * demotes, while `/dashboard`, the logo and the navigation all pointed at
 * Outcomes.
 *
 * ★ONLY THE HOME LITERAL IS REWRITTEN. A server that sends somewhere specific —
 * a Shopify claim page, an invite, a deep link — means it, and this must not
 * second-guess that. It rewrites exactly the one route that means "wherever
 * home is".
 */
export function landingRoute(serverRoute: string): string {
  return serverRoute === "/dashboard/overview" ? HOME_ROUTE : serverRoute;
}
