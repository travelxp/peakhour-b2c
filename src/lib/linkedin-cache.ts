import type { QueryClient } from "@tanstack/react-query";

/**
 * Every TanStack cache key that holds LinkedIn CONTENT scoped to one business +
 * its enabled Page set — and the one call that drops all of them.
 *
 * ★WHY A SHARED LIST. Changing which Company Page is enabled happens on
 * /dashboard/integrations, which does not use TanStack Query at all: it holds
 * its integrations in `useState` and refetches with a bare `api.get`. So a Page
 * toggle touched nothing the LinkedIn hub reads, and the Library kept serving
 * the previous Page's posts — the Library feed worst of all, because it sets
 * `refetchOnMount: false` AND `refetchOnWindowFocus: false`, so navigating back
 * could never refresh it. Only a hard reload cleared it.
 *
 * The list lives here, once, because the failure mode is a surface that forgets
 * one key: the tab that forgot looks like it works — it just shows the old
 * brand's data, which is indistinguishable from that brand having no activity.
 * Any new LinkedIn content query belongs in this array.
 *
 * LinkedIn ADS keys are absent from THIS list because a content cron does not
 * change them — but they are no longer independent of the Page. See
 * `LINKEDIN_PAGE_SCOPED_QUERY_KEYS` below: switching the active Page now
 * re-scopes Growth as well, and the note that used to live here ("they hang off
 * the ads connection, not the content connection's Page set") stopped being
 * true the moment every ads surface started resolving its ad account per Page.
 */
export const LINKEDIN_CONTENT_QUERY_KEYS = [
  // Identity + the composer's Page picker — the first thing that goes stale.
  ["linkedin-me"],
  // Published archive + per-post engagement drilldowns.
  ["linkedin-feed"],
  ["linkedin-post-reposts"],
  ["linkedin-reactions"],
  ["linkedin-thread"],
  ["linkedin-replies"],
  // Community activity.
  ["linkedin-interactions"],
  // Audience tab.
  ["linkedin-audience-summary"],
  ["linkedin-engagers"],
  ["linkedin-follower-stats"],
  // Boost tab.
  ["linkedin-boost-candidates"],
  // Voice + drafting.
  ["linkedin-voice-card"],
  ["linkedin-suggested-drafts"],
  // Per-Page brand-fit + enabled set (GET /integrations/linkedin_content/pages),
  // read by the Manage-Pages dialog and the composer's off-brand notice. A Page
  // toggle changes the `enabled` flags in this very payload, so leaving it
  // cached is precisely the "forgot one key" case this file exists to prevent.
  ["linkedin-page-fit"],
  // ★The scheduled queue, because a PAGE TOGGLE CAN NOW MUTATE IT. Disabling a
  // Page invalidates the author of posts already queued as it, and the toggle
  // offers to cancel them — so the Scheduled tab and the calendar are stale the
  // moment that happens. `scheduler:items` is the calendar's key prefix.
  ["linkedin-scheduled-items"],
  ["scheduler:items"],
] as const;

/**
 * Drop every LinkedIn content query so the next render refetches for the
 * business + Page set that is live NOW.
 *
 * Prefix invalidation: keys carry per-view suffixes (`["linkedin-feed", "org"]`,
 * `["linkedin-interactions", filter]`, `["linkedin-audience-summary", days]`),
 * and TanStack matches on prefix by default — so the bare key clears every
 * variant rather than only the one currently mounted.
 *
 * Also clears `content-hub-integrations`, the connect-gate query the LinkedIn
 * hub reads: a Page change can flip the hub between its EmptyState and the
 * composer, and a stale gate would show the wrong one.
 */
export function invalidateLinkedInContentQueries(queryClient: QueryClient): void {
  for (const queryKey of LINKEDIN_CONTENT_QUERY_KEYS) {
    void queryClient.invalidateQueries({ queryKey });
  }
  void queryClient.invalidateQueries({ queryKey: ["content-hub-integrations"] });
}

/**
 * Everything that changes meaning when the ACTIVE PAGE changes — Growth
 * included.
 *
 * ★A CRON REFRESH AND A PAGE SWITCH ARE NOT THE SAME EVENT, which is why this
 * is a second list rather than more entries in the first. A content cron writes
 * new rows for the Page you are already looking at; a Page switch changes which
 * Page every surface in the product is answering about, and that reaches
 * campaigns, Lead Gen Forms and audiences that no content cron ever touches.
 *
 * ★THE FAILURE MODE OF MISSING ONE IS THE BUG THIS WHOLE CHANGE FIXES. A
 * Growth panel left holding the previous Page's campaigns does not look stale —
 * it looks like this Page has those campaigns. Which is exactly the report:
 * "Managed Campaigns shows the wrong brand's campaigns."
 */
export const LINKEDIN_PAGE_SCOPED_QUERY_KEYS = [
  // Managed campaigns + the surfaces hanging off them.
  ["linkedin-managed-campaigns"],
  ["linkedin-page-ad-account"],
  // Lead Gen Forms.
  ["growth-asks"],
  // Audiences, outcomes and the optimizer all read per-account figures.
  ["audience-sets"],
  ["audience-set"],
  ["growth-outcomes"],
  ["growth-adjustments"],
] as const;

/**
 * Discard every query whose answer depends on which Page is active — Content
 * AND Growth.
 *
 * The one call the Page switcher makes. Deliberately broader than the cron
 * toolbar's: "switching the active Page refreshes all Content and Growth data"
 * is the requirement, and a switcher that refreshed only the tab it lives on
 * would leave the other pillar quietly describing the Page you just left.
 *
 * ★REMOVE, NOT INVALIDATE, AND THAT IS THE WHOLE DIFFERENCE HERE.
 * `invalidateQueries` marks data stale and refetches — but a mounted panel goes
 * on RENDERING the cached rows until the new ones land. For a cron refresh that
 * is correct: the old rows are the same Page, just older. For a Page switch it
 * means the seconds after you pick Page B are spent looking at Page A's posts,
 * campaigns and engagers, under Page B's name. That is the exact bug being
 * fixed, reproduced as a transient — and a transient wrong answer is harder to
 * report than a permanent one.
 *
 * `removeQueries` drops the entries, so every panel falls to its loading state
 * and comes back with the Page you actually chose. The cost is a spinner; the
 * alternative is briefly lying.
 */
export function removeLinkedInPageScopedQueries(queryClient: QueryClient): void {
  for (const queryKey of [
    ...LINKEDIN_CONTENT_QUERY_KEYS,
    ...LINKEDIN_PAGE_SCOPED_QUERY_KEYS,
  ]) {
    // ★`linkedin-me` IS INVALIDATED, NOT REMOVED, AND THE SWITCHER IS WHY.
    //
    // It is the query the switcher itself renders from — the Page list and the
    // active id both come out of it. Removing it empties `identity` for the
    // duration of the refetch, so the control unmounts the moment you use it:
    // you pick a Page and the thing you picked it with disappears. Invalidation
    // keeps the last identity on screen (showing the Page you just left, for
    // the one beat the spinner is already explaining) and swaps it when the
    // server confirms.
    //
    // Every OTHER key here is data ABOUT the Page, where showing the previous
    // brand's rows is the failure this function exists to prevent.
    if (queryKey[0] === "linkedin-me") {
      void queryClient.invalidateQueries({ queryKey });
      continue;
    }
    queryClient.removeQueries({ queryKey });
  }
}
