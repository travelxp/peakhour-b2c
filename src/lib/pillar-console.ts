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
 * screen-reader user can act on — so it renders as a single `role="img"`
 * carrying this label rather than as five readable rows.
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
  // ★A TRIAL, NOT A FREE PLAN (billing plan D19): there is no free tier, and a
  //  new business starts on a Peakhour Suite trial. No number here: the length
  //  is Suite's `trialDays`, catalog data, which `signupStats` reads.
  "Free trial of every module",
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
  "All five modules, one platform",
] as const;

/**
 * Pre-launch variant. When signups aren't open there is no same-day access to
 * promise, and the third promise would contradict the "join the queue" heading
 * directly above it — so swap it for the one thing still true on that path.
 */
export const PRELAUNCH_PROMISES = [
  "No credit card",
  SIGNUP_PROMISES[1],
  "We’ll email your link",
] as const;

/**
 * Row styling. It lived here first because two hand-copied class strings had
 * already drifted (the rows briefly carried a hover on /auth and none on the
 * landing page); with the landing page's console gone there is one consumer
 * left, and it stays here so the styling travels with the rows it styles.
 *
 * Deliberately no hover: the console is wrapped in `role="img"`, so it is one
 * picture. Rows that lift and warm under the cursor read as clickable, and
 * nothing here is — no href, no handler, no cursor change.
 */
export const PILLAR_CONSOLE_ROW_CLASS =
  "flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-3.5 py-2.5 text-sm";

/**
 * Proof points beside the /auth form. The trial length is catalog data (Suite's
 * `trialDays`, resolved server-side by `suiteTrialDays`), not a number kept in
 * sync by hand.
 *
 * ★It replaced "500+ free Peaks a month, every free plan": there is no free
 * plan (D19), so the figure promised an allowance nobody is given. What a new
 * business gets is the Suite trial.
 *
 * ★NO TRIAL, NO TRIAL STATS (official review R1 on b2c#591). `trialDays` is
 * `suiteTrialDays`: null when the environment sells no Suite trial. The card
 * and the days figures are both the trial's (without one, a business pays
 * before it starts, D19), so neither is shown; /pricing drops its "No card to
 * start" on the same rule.
 */
export function signupStats(trialDays: number | null): Array<{ value: string; label: string }> {
  const modules = { value: "5", label: "modules, one login" };
  if (!hasTrial(trialDays)) return [modules, { value: "1", label: "Peaks wallet for every module" }];
  return [
    modules,
    { value: "0", label: "credit cards required" },
    { value: String(trialDays), label: "days of Peakhour Suite, free" },
  ];
}

/** Whether a trial may be promised: `suiteTrialDays` served a length. */
export function hasTrial(trialDays: number | null | undefined): trialDays is number {
  return typeof trialDays === "number" && trialDays > 0;
}

/**
 * The tick row under the /auth form: `SIGNUP_PROMISES`, or the pre-launch
 * variant. ★Without a trial (`hasTrial`) its first two promises ("No credit
 * card", "Free trial of every module") are both the trial's, so they give way
 * to the scope of the platform, the hero's own third point (official review
 * R1 on b2c#591).
 */
export function signupPromises(trialDays: number | null, preLaunch: boolean): readonly string[] {
  const list = preLaunch ? PRELAUNCH_PROMISES : SIGNUP_PROMISES;
  if (hasTrial(trialDays)) return list;
  return [HERO_TRUST_POINTS[2], list[2]];
}
