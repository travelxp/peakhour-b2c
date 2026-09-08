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

/**
 * Whether Outcomes is the app's home and the navigation follows the funnel.
 *
 * ⚠️COMPARED AGAINST THE STRING "1", NOT COERCED. `process.env` values are
 * strings, so `Boolean(process.env.X)` is true for "0" and "false" — the two
 * spellings somebody switching a flag OFF is most likely to reach for, and the
 * failure would be a navigation reorganisation shipping to everyone because a
 * variable said "false".
 */
export const OUTCOMES_HOME = process.env.NEXT_PUBLIC_OUTCOMES_HOME === "1";

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
 * ★AND `home` IS PROMOTED, NOT COPIED. Outcomes lives inside Growth's subitems
 * in the pillar navigation; the funnel leads with it, so the caller passes the
 * item and it appears at the top. It stays where it was as well — this changes
 * where a merchant FINDS it first, not where it exists.
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
      i.subItems?.some((s) => s.href === home.href)
        ? { ...i, subItems: i.subItems.filter((s) => s.href !== home.href) }
        : i,
    ) as T[];
  const byHref = new Map(all.map((i) => [i.href, i]));

  const lead = LEAD_HREFS.map((h) => byHref.get(h)).filter((i): i is T => i !== undefined);
  // ★`home.href` IS IN THE SET TOO. It is promoted from a SUBITEM today, so it
  // is not in `all` and the omission cost nothing — but the moment Outcomes
  // becomes a top-level pillar it would appear in the lead AND in the tail, and
  // the "exactly once" rule would break silently on the one item the whole
  // navigation is built around.
  const taken = new Set([home.href, ...lead.map((i) => i.href), ...Object.keys(FUNNEL_GROUP)]);

  const inGroup = (label: "Found" | "Chosen" | "Convinced") =>
    Object.entries(FUNNEL_GROUP)
      .filter(([, g]) => g === label)
      .map(([h]) => byHref.get(h))
      .filter((i): i is T => i !== undefined);

  // ★EVERYTHING NOT PLACED, IN ITS ORIGINAL ORDER. Overview lands here — still
  // one click away, still the same page, no longer the first thing a merchant
  // sees, which is the whole of the change.
  const tail = all.filter((i) => !taken.has(i.href));

  // ★★AN EMPTY GROUP IS DROPPED, HEADING AND ALL. `FUNNEL_GROUP` names hrefs,
  // so a pillar that is retired or an href that is mistyped leaves its question
  // with nothing under it — and a "Found" heading over empty space tells a
  // merchant a section exists that does not. Dropping it is also what keeps the
  // grouping honest as pillars come and go: the sidebar shows the questions it
  // can actually answer.
  return [
    { label: "", items: [home, ...lead] },
    { label: "Found", items: inGroup("Found") },
    { label: "Chosen", items: inGroup("Chosen") },
    { label: "Convinced", items: inGroup("Convinced") },
    { label: "", items: tail },
  ].filter((g) => g.items.length > 0);
}
