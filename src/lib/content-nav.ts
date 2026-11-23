/**
 * The Content pillar's routes, named once. dashboard-nav.ts builds the
 * five-item nav from them, PlanTabs draws the Plan strip from them, and the
 * tests hold the two together.
 */

/** The Content home: Needs your OK, Coming up, Post something. */
export const CONTENT_HOME = "/dashboard/content";
export const CONTENT_CREATE = "/dashboard/content/create";
/** Built by the Needs your OK lane (W1-A): linked here, no count shown until it lands. */
export const CONTENT_NEEDS_OK = "/dashboard/content/needs-ok";
export const CONTENT_CALENDAR = "/dashboard/calendar";
export const CONTENT_RESULTS = "/dashboard/content/ledger";

/**
 * The four planning pages, in the order the Plan strip shows them. Each keeps
 * its own page; "Plan" is only the group. The first is where the nav's Plan
 * link goes.
 */
export const PLAN_HREFS = [
  "/dashboard/strategist",
  "/dashboard/content/news",
  "/dashboard/content/seasonal-events",
  "/dashboard/content/sources",
] as const;

/** Web pages and each channel's own page: all of them sit under Create. */
export const CREATE_MATCHES = [
  "/dashboard/pages",
  "/dashboard/content/facebook",
  "/dashboard/content/instagram",
  "/dashboard/content/linkedin",
  "/dashboard/content/x",
  "/dashboard/content/threads",
  "/dashboard/content/tiktok",
  "/dashboard/content/whatsapp",
  "/dashboard/content/beehiiv",
] as const;
