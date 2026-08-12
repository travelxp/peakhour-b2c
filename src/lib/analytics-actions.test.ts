import { describe, it, expect } from "vitest";
import {
  analyticsActions,
  CHANNEL_CONCENTRATION,
  LOW_ENGAGEMENT_PCT,
  NOTABLE_DROP_PCT,
} from "./analytics-actions";

/**
 * The thresholds, because every one of them is a claim about somebody's
 * business. Set too low and the page becomes the nine-insights metric
 * dashboard it exists to replace; set too high and it says nothing when
 * something is genuinely wrong. Neither failure is visible in a screenshot.
 */

const funnel = (over: Partial<{ sessions: number; engagementRatePct: number }> = {}) => ({
  sessions: 1000,
  totalUsers: 800,
  engagedSessions: 600,
  engagementRatePct: 60,
  conversions: 0,
  eventCount: 5000,
  ...over,
});

const CONFIGURED = { winConfigured: true };

describe("analyticsActions", () => {
  it("★leads with the missing win definition, because every other number depends on it", () => {
    const actions = analyticsActions({ funnel: funnel(), channels: [], pages: [] }, {
      winConfigured: false,
    });
    expect(actions.map((a) => a.id)).toContain("no-win-defined");
    // It opens the dialog rather than navigating: the decision is the same
    // whichever surface you reached it from.
    expect(actions.find((a) => a.id === "no-win-defined")?.opensWinDialog).toBe(true);
  });

  it("says nothing about wins once one is configured", () => {
    const actions = analyticsActions({ funnel: funnel(), channels: [], pages: [] }, CONFIGURED);
    expect(actions.map((a) => a.id)).not.toContain("no-win-defined");
  });

  it("★does not call an ordinary traffic mix a concentration", () => {
    // The failure this guards: most small businesses are direct- or
    // search-dominated, and telling every one of them they are over-reliant is
    // noise dressed as a finding.
    const actions = analyticsActions(
      {
        funnel: funnel(),
        channels: [
          { channel: "Direct", sessions: 55, conversions: 0 },
          { channel: "Organic Search", sessions: 45, conversions: 0 },
        ],
        pages: [],
      },
      CONFIGURED,
    );
    expect(actions.map((a) => a.id).join()).not.toContain("channel-concentration");
  });

  it("names a genuine single-channel dependency", () => {
    const actions = analyticsActions(
      {
        funnel: funnel(),
        channels: [
          { channel: "Organic Social", sessions: 80, conversions: 0 },
          { channel: "Direct", sessions: 20, conversions: 0 },
        ],
        pages: [],
      },
      CONFIGURED,
    );
    const hit = actions.find((a) => a.id.startsWith("channel-concentration"));
    expect(hit?.title).toContain("80%");
    expect(hit?.title).toContain("Organic Social");
  });

  it("fires exactly at the threshold, not just past it", () => {
    const top = Math.round(CHANNEL_CONCENTRATION * 100);
    const actions = analyticsActions(
      {
        funnel: funnel(),
        channels: [
          { channel: "Direct", sessions: top, conversions: 0 },
          { channel: "Referral", sessions: 100 - top, conversions: 0 },
        ],
        pages: [],
      },
      CONFIGURED,
    );
    expect(actions.some((a) => a.id.startsWith("channel-concentration"))).toBe(true);
  });

  it("★never calls a single page a concentration", () => {
    // One page is 100% of one page. That is arithmetic, not a finding, and
    // shipping it would put a confident recommendation on every brand-new site.
    const actions = analyticsActions(
      {
        funnel: funnel(),
        channels: [],
        pages: [{ pagePath: "/", views: 500, engagementRatePct: 70, conversions: 0 }],
      },
      CONFIGURED,
    );
    expect(actions.map((a) => a.id)).not.toContain("page-concentration");
  });

  it("names the page carrying the site when there are others to compare", () => {
    const actions = analyticsActions(
      {
        funnel: funnel(),
        channels: [],
        pages: [
          { pagePath: "/guides/turnaround", views: 500, engagementRatePct: 70, conversions: 0 },
          { pagePath: "/about", views: 100, engagementRatePct: 40, conversions: 0 },
        ],
      },
      CONFIGURED,
    );
    const hit = actions.find((a) => a.id === "page-concentration");
    expect(hit?.title).toContain("/guides/turnaround");
  });

  it("flags low engagement, and stays quiet on healthy engagement", () => {
    const low = analyticsActions(
      { funnel: funnel({ engagementRatePct: LOW_ENGAGEMENT_PCT - 1 }), channels: [], pages: [] },
      CONFIGURED,
    );
    expect(low.map((a) => a.id)).toContain("low-engagement");

    const fine = analyticsActions(
      { funnel: funnel({ engagementRatePct: LOW_ENGAGEMENT_PCT }), channels: [], pages: [] },
      CONFIGURED,
    );
    expect(fine.map((a) => a.id)).not.toContain("low-engagement");
  });

  it("★says nothing about engagement on a site with no sessions", () => {
    // A brand-new property reports engagementRatePct 0 over 0 sessions.
    // "100% of visits end without engagement" about nobody is the sort of
    // confident nonsense that makes a customer stop trusting the whole page.
    const actions = analyticsActions(
      { funnel: funnel({ sessions: 0, engagementRatePct: 0 }), channels: [], pages: [] },
      CONFIGURED,
    );
    expect(actions.map((a) => a.id)).not.toContain("low-engagement");
  });

  it("★ignores a delta when there is no comparison to make", () => {
    // `hasComparison: false` is a first week, not a flat one. Reading
    // `trend.sessions.deltaPct` regardless is how a new property gets told its
    // traffic collapsed.
    const actions = analyticsActions(
      {
        funnel: funnel(),
        channels: [],
        pages: [],
        digest: {
          hasComparison: false,
          headline: "",
          trend: {
            sessions: { now: 10, prev: 0, deltaPct: NOTABLE_DROP_PCT - 20 },
            totalUsers: { now: 10, prev: 0, deltaPct: null },
            conversions: { now: 0, prev: 0, deltaPct: null },
            engagementRate: { now: 0.5, prev: 0.5, delta: null },
          },
          movements: [],
        },
      },
      CONFIGURED,
    );
    expect(actions.map((a) => a.id)).not.toContain("sessions-drop");
  });

  it("puts the most severe finding first", () => {
    const actions = analyticsActions(
      {
        funnel: funnel({ engagementRatePct: 20 }),
        channels: [{ channel: "Direct", sessions: 100, conversions: 0 }],
        pages: [],
        digest: {
          hasComparison: true,
          headline: "",
          trend: {
            sessions: { now: 50, prev: 100, deltaPct: -50 },
            totalUsers: { now: 40, prev: 90, deltaPct: -55 },
            conversions: { now: 0, prev: 0, deltaPct: null },
            engagementRate: { now: 0.2, prev: 0.4, delta: -0.2 },
          },
          movements: [],
        },
      },
      { winConfigured: false },
    );
    expect(actions[0]?.severity).toBe("critical");
    expect(actions[0]?.id).toBe("sessions-drop");
  });
});
