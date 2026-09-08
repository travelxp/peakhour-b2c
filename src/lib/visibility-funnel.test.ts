import { describe, it, expect } from "vitest";
import {
  absenceText,
  brandLine,
  incompleteLine,
  partialLine,
  shortestSpan,
} from "./visibility-funnel";
import type { VisibilityResponse, VisibilityStage } from "@/lib/api/growth";

/**
 * ★★THESE TEST WHAT IS SAID, NOT WHAT IS TRUE. Every judgement — may a stage be
 * totalled, has a source stopped, may an amount be shown — is already made in
 * the api. What can still go wrong here is a surface that renders a true figure
 * inside a false sentence, and that is what each case below is about.
 */

const stage = (over: Partial<VisibilityStage> = {}): VisibilityStage => ({
  key: "found",
  question: "Did anyone see you?",
  total: 4900,
  figures: [
    { source: "google_search", available: true, value: 4000, days: 28 },
    { source: "google_business_profile", available: true, value: 900, days: 28 },
  ],
  ...over,
});

describe("absenceText", () => {
  it("★says RECONNECT for a lapsed grant, not CONNECT", () => {
    // ★★THE api SENDS TWO REASONS SO THEY GET TWO SENTENCES. "Connect Google"
    // is the wrong instruction for somebody whose grant lapsed — they already
    // did, and the thing to do is authorise it again.
    expect(absenceText("needs_reconnect")).toBe("reconnect Google");
    expect(absenceText("not_connected")).toBe("not connected");
    expect(absenceText("needs_reconnect")).not.toBe(absenceText("not_connected"));
  });

  it("does not tell a merchant to fix something that is OUR failure", () => {
    // `unavailable` means we could not read it. Anything actionable-sounding
    // sends somebody to check a connection that is fine.
    expect(absenceText("unavailable")).toBe("couldn't be read");
  });

  it("distinguishes a source that never reported from one that stopped", () => {
    expect(absenceText("pending")).toBe("gathering data");
    expect(absenceText("stale")).toBe("stopped updating");
    expect(absenceText("pending")).not.toBe(absenceText("stale"));
  });
});

describe("incompleteLine", () => {
  /** ★A COHERENT nothing_connected STAGE, which the first fixture was not: it
   *  carried two AVAILABLE figures, a state the api cannot produce. That
   *  incoherence let a mutant deleting the whole branch survive, because the
   *  fall-through happened to answer something else. */
  const nothingConnected = () =>
    stage({
      total: undefined,
      incomplete: "nothing_connected",
      figures: [
        { source: "google_search", available: false, reason: "not_connected" },
        { source: "google_business_profile", available: false, reason: "not_connected" },
      ],
    });

  it("★never renders an untotalled stage as a zero", () => {
    // "0 people found you" is a verdict on a business that has simply connected
    // nothing — the single most misleading thing this surface could print.
    const line = incompleteLine(nothingConnected());
    expect(line).toBe("Nothing connected yet");
    expect(line).not.toMatch(/\b0\b/);
  });

  it("gives the two states different sentences, because they have different fixes", () => {
    const nothing = incompleteLine(nothingConnected());
    expect(nothing).toBe("Nothing connected yet");
    const waiting = incompleteLine(
      stage({
        total: undefined,
        incomplete: "awaiting_data",
        figures: [
          { source: "google_search", available: true, value: 4000, days: 28 },
          { source: "google_business_profile", available: false, reason: "pending" },
        ],
      }),
    );
    expect(waiting).toBe("Waiting on a connection");
    expect(nothing).not.toBe(waiting);
  });

  it("★★does not blame the merchant's connection for OUR read failure", () => {
    // ★THE HEADLINE CONTRADICTED THE ROW BENEATH IT. "Waiting on a connection"
    // sat directly above "couldn't be read", pointing at the merchant's setup
    // for a timeout of ours. `stage.figures` was in hand and unread.
    const line = incompleteLine(
      stage({
        total: undefined,
        incomplete: "awaiting_data",
        figures: [{ source: "google_search", available: false, reason: "unavailable" }],
      }),
    );
    expect(line).toBe("We couldn't read this");
  });

  it("★names the fix when there IS one, rather than telling somebody to wait", () => {
    const line = incompleteLine(
      stage({
        total: undefined,
        incomplete: "awaiting_data",
        figures: [
          { source: "google_search", available: false, reason: "needs_reconnect" },
          { source: "google_business_profile", available: false, reason: "pending" },
        ],
      }),
    );
    expect(line).toBe("Reconnect Google to see this");
  });

  it("★★does not call it OUR failure when only SOME of the blockers are ours", () => {
    // ★ONE UNREADABLE SOURCE BESIDE ONE STILL GATHERING IS NOT "we couldn't
    // read this" — there is a real wait in there, and saying otherwise sends
    // somebody to chase an outage that is half a new connection.
    const line = incompleteLine(
      stage({
        total: undefined,
        incomplete: "awaiting_data",
        figures: [
          { source: "google_search", available: false, reason: "unavailable" },
          { source: "google_business_profile", available: false, reason: "pending" },
        ],
      }),
    );
    expect(line).toBe("Waiting on a connection");
  });

  it("★ignores a NOT-CONNECTED source when choosing the sentence", () => {
    // A channel the merchant does not use never blocks a total, so it must not
    // decide the words either — otherwise a business with no Business Profile
    // would be told to reconnect something they never connected.
    const line = incompleteLine(
      stage({
        total: undefined,
        incomplete: "awaiting_data",
        figures: [
          { source: "google_business_profile", available: false, reason: "not_connected" },
          { source: "google_search", available: false, reason: "unavailable" },
        ],
      }),
    );
    expect(line).toBe("We couldn't read this");
  });
});

describe("shortestSpan / partialLine", () => {
  it("★takes the WORST-covered source, not the best", () => {
    // The line exists to disclose a gap; reporting the best-covered source
    // would understate exactly the thing it is there to warn about.
    const s = stage({
      partial: true,
      figures: [
        { source: "google_search", available: true, value: 4000, days: 28 },
        { source: "google_business_profile", available: true, value: 900, days: 7 },
      ],
    });
    expect(shortestSpan(s)).toBe(7);
    expect(partialLine(s, 28)).toBe("Part of the period — 7 of 28 days");
  });

  it("ignores sources that did not answer when working out the span", () => {
    const s = stage({
      partial: true,
      figures: [
        { source: "google_search", available: true, value: 4000, days: 12 },
        { source: "google_business_profile", available: false, reason: "pending" },
      ],
    });
    expect(shortestSpan(s)).toBe(12);
  });

  it("says nothing when every source covered the whole window", () => {
    expect(partialLine(stage(), 28)).toBeNull();
  });

  it("★says nothing beside a stage that has no number at all", () => {
    // A coverage note next to "Nothing connected yet" reads as though something
    // WAS measured, over part of the period.
    const s = stage({ total: undefined, incomplete: "nothing_connected", partial: true });
    expect(partialLine(s, 28)).toBeNull();
  });
});

describe("brandLine", () => {
  const split = (over: Record<string, unknown> = {}): VisibilityResponse["brandSplit"] => ({
    windowDays: 28,
    split: {
      assertable: true,
      brand: { clicks: 90, impressions: 1000, queries: 3 },
      nonBrand: { clicks: 30, impressions: 3000, queries: 20 },
      terms: ["peakhour"],
      termsSource: "owner",
      ...over,
    } as never,
  });

  it("★★NAMES THE DAYS AND NEVER A PERCENTAGE", () => {
    // ★THE RULE THIS FUNCTION EXISTS FOR. The split classifies the newest
    // Search Console slice, over a FIXED trailing window that is not the
    // page's — so on a 7-day view its clicks cover four times the FOUND figure
    // above them, and a share against that figure can exceed 100%.
    const line = brandLine(split());
    expect(line).toBe(
      "90 of 120 search clicks came from people searching for you by name, over the last 28 days.",
    );
    expect(line).not.toMatch(/%/);
  });

  it("★states the split's OWN window, not the page's", () => {
    // ★★A FIXTURE OF 28 CANNOT TEST THIS, and the first version of this case
    // used one — 28 is the page's own default, so replacing the interpolation
    // with the literal left every spec green. The window has to be a number
    // nothing else on the page would have produced.
    const line = brandLine({ ...split()!, windowDays: 41 });
    expect(line).toContain("last 41 days");
    expect(line).not.toContain("28");
  });

  it("says the terms were guessed when nobody has confirmed them", () => {
    // ★THE SEED IS WRONG OFTEN ENOUGH THAT A MERCHANT MUST BE TOLD IT IS A
    // GUESS. A shop called "The Coffee House" has every stranger searching
    // "coffee house near me" counted as arriving by reputation.
    expect(brandLine(split({ termsSource: "seeded" }))).toContain("the name we worked out");
    expect(brandLine(split({ termsSource: "owner" }))).not.toContain("worked out");
  });

  it("★renders the api's REFUSAL rather than dropping it", () => {
    // "We could not work out which searches are your own name" and "Search
    // Console is not connected" have different fixes; dropping the first makes
    // it look like the second.
    const line = brandLine({
      windowDays: 28,
      split: {
        assertable: false,
        reason: "no_brand_terms",
        message: "We could not work out which searches are your own name.",
      },
    });
    expect(line).toBe("We could not work out which searches are your own name.");
  });

  it("says nothing at all when there is no split", () => {
    expect(brandLine(undefined)).toBeNull();
  });

  it("★turns a measured zero into a sentence rather than `0 of 0`", () => {
    // ★AND THE SENTENCE IS ABOUT THE WHOLE WINDOW, NOT ABOUT THE BRAND HALF.
    // This branch is only reachable when there were no impressions either — the
    // case above takes every other zero — so "nobody searched for you BY NAME"
    // would imply generic search traffic that did not happen.
    const line = brandLine(
      split({ brand: { clicks: 0, impressions: 0, queries: 0 }, nonBrand: { clicks: 0, impressions: 0, queries: 0 } }),
    );
    expect(line).toBe("You did not appear in Google search at all in the last 28 days.");
    expect(line).not.toContain("by name");
  });

  it("★★says the terms were guessed on the NO-CLICK sentence too", () => {
    // ★THE QUALIFIER WAS COMPUTED AFTER BOTH ZERO BRANCHES, so the two
    // sentences most likely to be read as a verdict stated a GUESSED brand
    // classification as a confirmed one.
    const line = brandLine(
      split({
        termsSource: "seeded",
        brand: { clicks: 0, impressions: 420, queries: 6 },
        nonBrand: { clicks: 0, impressions: 900, queries: 40 },
      }),
    );
    expect(line).toContain("the name we worked out");
  });

  it("★★does not say NOBODY SEARCHED over a window with impressions in it", () => {
    // ★★THE FALSE SENTENCE OVER A TRUE FIGURE, COMMITTED BY THE MODULE THAT
    // EXISTS TO PREVENT IT. "Nobody searched Google for you by name" sat
    // directly under a FOUND stage reporting 1,320 impressions, because the
    // zero check looked only at CLICKS. A shop can appear hundreds of times and
    // be clicked never — that is a finding, and a different one.
    const line = brandLine(
      split({
        brand: { clicks: 0, impressions: 420, queries: 6 },
        nonBrand: { clicks: 0, impressions: 900, queries: 40 },
      }),
    );
    expect(line).not.toContain("Nobody searched");
    expect(line).toBe(
      "420 of 1,320 times you appeared in Google were people searching for you by name — " +
        "none of them clicked through, over the last 28 days.",
    );
  });

  it("groups thousands, so a large figure is readable", () => {
    const line = brandLine(
      split({
        brand: { clicks: 9000, impressions: 0, queries: 0 },
        nonBrand: { clicks: 3000, impressions: 0, queries: 0 },
      }),
    );
    expect(line).toContain("9,000 of 12,000");
  });
});

describe("absenceText — a reason this build has never heard of", () => {
  it("★names an absence this build has never heard of", () => {
    // ★THE UNION HAS ALREADY GROWN TWICE, and the two repos deploy separately,
    // so this build can meet a reason the api added after it shipped. The ICON
    // lookup beside this one was hardened for exactly that and the WORDS were
    // not — leaving a row with a warning triangle and nothing next to it, which
    // says less than saying nothing would.
    expect(absenceText("quota_exhausted" as never)).toBe("not available");
  });
});
