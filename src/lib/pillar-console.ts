/**
 * The five-pillar "console" — a picture of the product mid-day.
 *
 * It now renders on /auth ONLY. The landing hero used to carry it too, and
 * dropping it there was the point of that redesign: a screenshot of a product
 * nobody has used yet argues nothing to a first-time visitor, so the hero
 * shows the pillar ORBIT (what Peakhour is) and /auth — where the visitor has
 * already bought the argument — shows the console (what it looks like).
 * Keep it here rather than inlining it into auth-flow.tsx now that there is
 * one consumer: this file carries the pillar NAMES, which are brand
 * architecture (mirrors cfg_products.pillar), and the strings below are still
 * shared with the landing page.
 *
 * The statuses are illustrative — a plausible day, not live data. Keep them in
 * the present tense and specific; vague statuses ("Working on it") read as
 * placeholder copy.
 */
export const PILLAR_CONSOLE_ROWS = [
  { name: "Commerce", status: "Answered 34 shoppers on WhatsApp today" },
  { name: "Content", status: "2 articles drafted from this week's news" },
  { name: "Growth", status: "LinkedIn post scheduled · 3 leads in inbox" },
  { name: "Support", status: "Inbox clear — 12 conversations resolved" },
  { name: "Presence", status: "Google listing synced · 2 new reviews" },
] as const;

/**
 * The console is decorative — it's a picture of the product, not a table a
 * screen-reader user can act on — so both surfaces render it as a single
 * `role="img"` with this label. Shared for the same reason the rows are: the
 * two copies had already drifted apart once.
 */
export const PILLAR_CONSOLE_LABEL =
  "Peakhour console showing five active pillars";

/**
 * The three promises made under the primary CTA on /auth. Shared for the same
 * reason the console rows are: the point of repeating them at the point of
 * signup is that the pitch does NOT change, which only holds if there is one
 * copy.
 */
export const SIGNUP_PROMISES = [
  "No credit card",
  "Free plan on every pillar",
  "Live the same day",
] as const;

/**
 * The landing hero's three trust points. The first two are the SAME strings
 * /auth shows — spelled as references, not as copies, so they can't drift —
 * and only the third differs.
 *
 * It differs on purpose. /auth is the point of signup, where the remaining
 * question is "what happens after I click", so its third promise is about
 * access ("Live the same day" / "We'll email your link"). The hero is the
 * point of orientation, where the remaining question is "how much of my
 * problem does this cover" — and the answer to that is the scope of the
 * platform, not its delivery time.
 */
export const HERO_TRUST_POINTS = [
  SIGNUP_PROMISES[0],
  SIGNUP_PROMISES[1],
  "All five pillars, one platform",
] as const;

/**
 * Pre-launch variant. When signups aren't open there is no same-day access to
 * promise, and the third promise would contradict the "join the queue" heading
 * directly above it — so swap it for the one thing still true on that path.
 */
export const PRELAUNCH_PROMISES = [
  "No credit card",
  "Free plan on every pillar",
  "We’ll email your link",
] as const;

/**
 * Row styling, shared so the two consoles can't diverge in appearance the way
 * they nearly did in content — during this change the rows briefly carried a
 * hover on /auth and none on the landing page, from hand-copied class strings.
 *
 * Deliberately no hover: the console is wrapped in `role="img"` on both
 * surfaces, so it is one picture. Rows that lift and warm under the cursor
 * read as clickable, and nothing here is — there's no href, no handler and no
 * cursor change. The hover polish lives on the pillar CARDS, which are the
 * real affordance.
 */
export const PILLAR_CONSOLE_ROW_CLASS =
  "flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-3.5 py-2.5 text-sm";

// The free-Peaks figure deliberately does NOT live here — it is catalog data,
// not brand copy. See minFreePeaksPerMonth() in lib/pricing.ts.
