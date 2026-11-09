/**
 * Client-visible feature flags (inlined at build via NEXT_PUBLIC_*).
 */

/**
 * Ask Peakhour — the grounded assistant (FAB launcher + /dashboard/ask + nav).
 * Runs in parallel with the legacy ChatPanel until the PR-11 cutover; enable per
 * environment with NEXT_PUBLIC_ASK_ENABLED=true.
 */
export const ASK_ENABLED = process.env.NEXT_PUBLIC_ASK_ENABLED === "true";

/**
 * Outcomes as the app's home, and a sidebar grouped by the funnel questions.
 *
 * The product decision behind S4·4 and S4·5 — whether Overview may be demoted
 * and the seven pillars reorganised. Unset in every environment, so the app
 * opens on Overview and the sidebar is the existing run of pillars.
 *
 * ★COMPARED AGAINST "true", LIKE ITS NEIGHBOUR, NOT AGAINST "1". A first
 * version took "1", which meant `NEXT_PUBLIC_OUTCOMES_HOME=true` — the spelling
 * every other flag in this file uses — silently left the feature off. One
 * convention per repo; a flag that needs to be looked up is a flag somebody
 * sets wrongly.
 *
 * ★AND NOT COERCED. `process.env` values are strings, so `Boolean()` is true
 * for "0" and "false" — the two spellings somebody switching a flag OFF reaches
 * for — and the failure would be a navigation reorganisation shipping to every
 * merchant because a variable said "false".
 *
 * ⚠️★★BEFORE SWITCHING THIS ON: Overview still owns the setup checklist, the
 * discovery strip, the footprint review and the recommendations card, and none
 * of them renders anywhere else. A merchant part-way through onboarding lands
 * on Outcomes with the flag on and never sees the steps they have left. The
 * plan names the work — "Overview's setup and discovery content folds in or
 * moves to onboarding" — and it is NOT in this change. Turning the flag on
 * before that lands strands new accounts.
 */
export const OUTCOMES_HOME = process.env.NEXT_PUBLIC_OUTCOMES_HOME === "true";

