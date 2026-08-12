import type { AnalyticsInsightsResponse } from "@/hooks/use-analytics-insights";

/**
 * What a customer should DO about their web analytics, derived from the numbers
 * the dashboard already has.
 *
 * ★DETERMINISTIC AND FREE, WHICH IS THE POINT. The page already carries a
 * model-written gloss (`ExplainCard`) — it is metered, so a customer clicks it
 * only if they already suspect there is something worth reading, and most never
 * will. "What should I do next" is the one thing on an analytics screen that
 * must never sit behind a spend. So it is computed here, from data already on
 * the response, at no cost.
 *
 * ★EXTRACTED SO THE JUDGEMENT CAN BE TESTED. This repo runs vitest in node with
 * no DOM by design, so the rendering is not what gets asserted — the thresholds
 * are, and every one of them is a claim about somebody's business that a badly
 * chosen constant turns into confident noise.
 *
 * ★AND THE LIST IS SHORT ON PURPOSE. Four rules, each of which a non-marketer
 * can act on this week. A screen that surfaces nine "insights" is the metric
 * dashboard this page is trying to stop being, wearing different clothes.
 */

export interface AnalyticsAction {
  id: string;
  severity: "critical" | "attention" | "opportunity";
  title: string;
  detail: string;
  href?: string;
  cta?: string;
  /** Opens the "what counts as a win" dialog rather than navigating. */
  opensWinDialog?: boolean;
}

/**
 * Share of sessions from ONE channel above which the concentration is the
 * story. Two thirds is deliberately high: most small businesses are direct- or
 * search-dominated and telling every one of them they are over-reliant would be
 * noise rather than a finding.
 */
export const CHANNEL_CONCENTRATION = 0.66;

/**
 * Share of page views on ONE page above which that page IS the site, as far as
 * visitors are concerned.
 *
 * ★A MAJORITY, BECAUSE THE HEADLINE SAYS "MOST OF THE WORK". At 0.3 a four-page
 * site with a 31% top page was told one page was doing most of the work while
 * the detail line underneath quoted 31% — the card disagreeing with itself in
 * two lines. Either the number or the word had to move, and "most" is the part
 * worth keeping: a page carrying a third of a site is not a finding anybody can
 * act on differently from one carrying a quarter.
 */
export const PAGE_CONCENTRATION = 0.5;

/**
 * Engagement rate below which most visits are bounces.
 *
 * ★GA4's OWN DEFINITION, NOT A ROUND NUMBER WE LIKED. An engaged session is one
 * lasting 10+ seconds, or with a key event, or with 2+ page views — so below
 * this most people are arriving and leaving without reading anything, which is
 * a content or an expectation problem rather than a traffic one.
 */
export const LOW_ENGAGEMENT_PCT = 40;

/** A week-over-week fall past this is worth naming as a thing to look at
 *  rather than leaving in the movements list. */
export const NOTABLE_DROP_PCT = -25;

export function analyticsActions(
  data: Pick<
    AnalyticsInsightsResponse,
    "funnel" | "channels" | "pages" | "digest" | "lockedPages"
  >,
  opts: { winConfigured: boolean },
): AnalyticsAction[] {
  const actions: AnalyticsAction[] = [];
  const funnel = data.funnel;
  const channels = data.channels ?? [];
  const pages = data.pages ?? [];

  // ── Nothing is counting outcomes ────────────────────────────────────────
  //
  // ★FIRST, BECAUSE EVERY OTHER NUMBER ON THE PAGE IS WORTH LESS WITHOUT IT.
  // Traffic with no definition of a win is a number nobody can act on, and the
  // page has been showing a permanent "Conversions: 0" tile over real visitors
  // rather than saying so.
  if (!opts.winConfigured) {
    actions.push({
      id: "no-win-defined",
      severity: "attention",
      title: "Nothing here is counting outcomes",
      detail:
        "We can see who visits, but not what you'd call a good result. Tell us once and every number on this page gets an answer to “so what?”.",
      cta: "Tell us what counts",
      opensWinDialog: true,
    });
  }

  // ── One channel is doing all the work ───────────────────────────────────
  const totalSessions = channels.reduce((sum, c) => sum + c.sessions, 0);
  const topChannel = [...channels].sort((a, b) => b.sessions - a.sessions)[0];
  if (topChannel && totalSessions > 0) {
    const share = topChannel.sessions / totalSessions;
    if (share >= CHANNEL_CONCENTRATION) {
      actions.push({
        id: `channel-concentration-${topChannel.channel}`,
        severity: "attention",
        title: `${Math.round(share * 100)}% of your visitors come from ${topChannel.channel}`,
        detail:
          "That's one road in. If it narrows — an algorithm change, a link that stops being shared — the traffic goes with it. Worth building a second one before you need it.",
        href: "/dashboard/content",
        cta: "Plan content",
      });
    }
  }

  // ── One page IS the site ────────────────────────────────────────────────
  //
  // ★ONLY WHEN WE HAVE THE WHOLE LIST. `pages` is TRUNCATED on the Free plan —
  // the api sends the top three and puts the rest behind `lockedPages` — so the
  // denominator here would be three pages rather than the site. Every Free
  // business with more than one page would be told a single page is "56% of
  // everything read on your site", computed against a list we chose. A share is
  // only sayable when nothing is missing from underneath it.
  const totalViews = pages.reduce((sum, p) => sum + p.views, 0);
  const topPage = [...pages].sort((a, b) => b.views - a.views)[0];
  const haveEveryPage = (data.lockedPages ?? 0) === 0;
  if (topPage && totalViews > 0 && haveEveryPage) {
    const share = topPage.views / totalViews;
    // ★AND ONLY WHEN THERE IS SOMETHING TO BE CONCENTRATED AGAINST. A single
    // page is 100% of one page, which is arithmetic rather than a finding.
    if (share >= PAGE_CONCENTRATION && pages.length > 1) {
      actions.push({
        id: "page-concentration",
        severity: "opportunity",
        title: `${topPage.pagePath} is doing most of the work`,
        detail: `${Math.round(share * 100)}% of everything read on your site is this one page. Whatever it does right is the thing worth doing again.`,
        href: "/dashboard/content",
        cta: "Make more like it",
      });
    }
  }

  // ── People arrive and leave ─────────────────────────────────────────────
  if (funnel && funnel.sessions > 0 && funnel.engagementRatePct < LOW_ENGAGEMENT_PCT) {
    actions.push({
      id: "low-engagement",
      severity: "attention",
      title: `${Math.round(100 - funnel.engagementRatePct)}% of visits end without engagement`,
      detail:
        "People are arriving and leaving within a few seconds. Usually the page isn't answering the question that brought them — the search terms they used are the fastest way to find out what it was.",
      href: "/dashboard/insights/search-console",
      cta: "See what they searched",
    });
  }

  // ── Something fell, and it is worth a look ──────────────────────────────
  const sessionsDelta = data.digest?.hasComparison ? data.digest.trend.sessions.deltaPct : null;
  if (sessionsDelta !== null && sessionsDelta !== undefined && sessionsDelta <= NOTABLE_DROP_PCT) {
    actions.push({
      id: "sessions-drop",
      severity: "critical",
      // ★"BY MORE THAN A QUARTER" RATHER THAN THE FIGURE, because the exact
      // percentage is already in the movements list right above this and a
      // headline restating it makes the same fact look like two findings.
      title: "Visits fell by more than a quarter this week",
      detail:
        "The movements above name which pages and channels moved. A fall this size is usually one of them rather than everything at once.",
      href: "/dashboard/insights/search-console",
      cta: "Check search",
    });
  }

  // ★MOST SEVERE FIRST, and stable within a severity so the list does not
  // reshuffle between renders of the same data.
  const order = { critical: 0, attention: 1, opportunity: 2 } as const;
  return actions.sort((a, b) => order[a.severity] - order[b.severity]);
}
