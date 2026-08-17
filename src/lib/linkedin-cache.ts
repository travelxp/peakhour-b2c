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
 * LinkedIn ADS keys (`linkedin-managed-campaigns`, `linkedin-targeting-entities`)
 * are deliberately absent: they hang off the ads connection, not the content
 * connection's Page set, and dropping them would refetch an unrelated surface.
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
