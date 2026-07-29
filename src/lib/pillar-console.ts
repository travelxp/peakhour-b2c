/**
 * The five-pillar "console" — the product's most recognisable marketing device.
 * It renders in the landing hero and again on /auth, so a visitor who clicks
 * "Start free" lands on a page that continues the same picture rather than a
 * sign-in screen from a different product.
 *
 * Shared here (rather than duplicated per page) for the same reason
 * HOW_IT_WORKS_STEPS is: two hand-maintained copies drift, and this one carries
 * the pillar names, which are brand architecture (mirrors cfg_products.pillar).
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
 * The three promises made under every primary CTA — landing hero and /auth.
 * Shared for the same reason the console rows are: the point of repeating them
 * at the point of signup is that the pitch does NOT change, which only holds
 * if there is one copy.
 */
export const SIGNUP_PROMISES = [
  "No credit card",
  "Free plan on every pillar",
  "Live the same day",
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
 * Free Peaks granted monthly on the free plans, as shown on the marketing
 * surface. Hard-coded to match the landing hero's existing figure; when the
 * public catalog starts exposing the free grant this should read from there.
 */
export const FREE_PEAKS_PER_MONTH = "1,240";
