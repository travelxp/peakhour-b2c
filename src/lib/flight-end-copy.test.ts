import { describe, it, expect } from "vitest";
import {
  flightEndBanner,
  flightEndDetail,
  flightEndState,
  elapsedSince,
  type FlightEndRow,
} from "./flight-end-copy";

/**
 * ★THE BANNER'S FIRST CUT ASSERTED A CAUSE THE API NEVER ESTABLISHED, AND THE
 * FIX FOR IT ASSERTED THE CAUSE TWICE.
 *
 * Round 1: it said, above every row, "We could not stop them on LinkedIn, so
 * they may still be spending." `flightEndAlarm` is derived from two facts —
 * `active` and past `endsAt` — which is also what a campaign looks like when
 * the sweep has not reached it, and when the platform stop SUCCEEDED and only
 * our local write failed. In that last case every clause was false.
 *
 * Round 2: the fix prefixed the api's own sentence with "We could not stop it:"
 * — and the api composes that string as "the platform stop failed: <cause>", so
 * every row rendered two colons and said the same thing twice.
 *
 * ★WHICH IS WHY THE `stop_failed` FIXTURES BELOW ARE SAMPLED FROM THE WRITER.
 * The round-1 fixtures were invented ("the connection needs a reconnect"), and
 * no invented string has the shape the api can actually emit — which is exactly
 * why the double-prefix shipped green.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-08-07T12:00:00Z");
const endedIso = new Date(NOW - 4 * DAY).toISOString();

/**
 * Verbatim from `peakhour-api/src/v1/services/ads/campaign-monitor.ts`:
 * `recordUnstoppableExpiry` composes `the platform stop failed: ${info.reason}`,
 * and `info.reason` for the commonest case is the no-connection string from
 * `monitorOneCampaign`. If the api's composition changes, this fixture is what
 * should be updated — and the assertions below are what will notice.
 */
const API_REASON = "the platform stop failed: there is no active LinkedIn Ads connection to stop it with";

function row(over: Partial<FlightEndRow["flightEndAlarm"]> = {}, id = "1"): FlightEndRow {
  return {
    _id: id,
    name: "Q3 demand gen",
    flightEndAlarm: { pastEnd: true, endsAt: endedIso, checkedSinceEnd: true, ...over },
  };
}

describe("flightEndState — the three absences stay distinct", () => {
  it("a recorded reason is the ONLY evidence that a stop failed", () => {
    expect(flightEndState({ pastEnd: true, endsAt: endedIso, checkedSinceEnd: true, reason: API_REASON }))
      .toBe("stop_failed");
  });

  it("nobody has asked yet is its own state, not a quiet failure", () => {
    expect(flightEndState({ pastEnd: true, endsAt: endedIso, checkedSinceEnd: false })).toBe(
      "not_checked",
    );
  });

  it("asked, and nothing recorded, is a third thing again", () => {
    expect(flightEndState({ pastEnd: true, endsAt: endedIso, checkedSinceEnd: true })).toBe(
      "no_failure_recorded",
    );
  });

  it("a reason wins over checkedSinceEnd — the evidence outranks the timestamp", () => {
    expect(
      flightEndState({ pastEnd: true, endsAt: endedIso, checkedSinceEnd: false, reason: API_REASON }),
    ).toBe("stop_failed");
  });

  it("★a whitespace-only reason is NOT evidence — the predicate trims too", () => {
    // The render trimmed and the predicate did not, so "   " counted as a
    // failure and then printed an empty clause: the exact hole the trim was
    // added to close, left open on the other side of it.
    expect(flightEndState({ pastEnd: true, endsAt: endedIso, checkedSinceEnd: true, reason: "   " }))
      .toBe("no_failure_recorded");
  });
});

describe("flightEndDetail — one row's sentence", () => {
  const detail = (over: Parameters<typeof row>[0] = {}) =>
    flightEndDetail(row(over).flightEndAlarm!, "3 Aug 2026", NOW);

  it("★does not prefix a sentence the api has already written", () => {
    const s = detail({ reason: API_REASON });
    expect(s).toBe(
      "ended 3 Aug 2026 (4 days ago). The platform stop failed: there is no active LinkedIn Ads connection to stop it with.",
    );
    // One colon, not two, and "the flight window ended" is not restated.
    expect(s.match(/:/g)).toHaveLength(1);
  });

  it("★only claims a failure when one was recorded — full strings, not substrings", () => {
    expect(detail({ checkedSinceEnd: false })).toBe(
      "ended 3 Aug 2026 (4 days ago). We have not checked it since, so we cannot tell whether it is still running.",
    );
    expect(detail()).toBe(
      "ended 3 Aug 2026 (4 days ago). We have no record of stopping it, and none of failing to — check Campaign Manager.",
    );
  });

  it("★never reassures that a campaign is probably fine", () => {
    // `recordUnstoppableExpiry`'s own write has a catch, and a legacy row that
    // fails the validator produces a campaign that could NOT be stopped and has
    // no entry saying so. "It may already be stopped on LinkedIn" is round 1's
    // defect inverted: a claim stronger than the evidence, pointing the other
    // way.
    expect(detail()).not.toMatch(/may already be stopped/);
  });

  it("★never doubles the full stop on an api-authored sentence", () => {
    expect(detail({ reason: "the platform stop failed: LinkedIn refused the ad account." })).not.toContain("..");
    expect(detail({ reason: API_REASON }).endsWith(".")).toBe(true);
  });

  it("carries how long ago, which is the number that conveys urgency", () => {
    expect(detail()).toContain("(4 days ago)");
  });

  it("survives an empty formatted date rather than rendering an empty clause", () => {
    const s = flightEndDetail(row().flightEndAlarm!, "", NOW);
    expect(s).toBe(
      "past its end date. We have no record of stopping it, and none of failing to — check Campaign Manager.",
    );
  });
});

describe("elapsedSince", () => {
  it("reads in hours below two days", () => {
    expect(elapsedSince(new Date(NOW - 5 * 3_600_000).toISOString(), NOW)).toBe("5 hours");
    expect(elapsedSince(new Date(NOW - 1 * 3_600_000).toISOString(), NOW)).toBe("1 hour");
    expect(elapsedSince(new Date(NOW - 1 * DAY).toISOString(), NOW)).toBe("24 hours");
  });

  it("★agrees with the calendar date printed beside it", () => {
    // Flooring elapsed HOURS while the date is a calendar DAY makes the two
    // contradict each other: 49 hours is "2 days", but 4 Aug read on 7 Aug is
    // three calendar days. Two numbers about one fact, disagreeing, in an alert.
    const ended = Date.parse("2026-08-04T23:00:00Z");
    const read = Date.parse("2026-08-07T00:30:00Z");
    expect(elapsedSince(new Date(ended).toISOString(), read)).toBe("3 days");
    expect(elapsedSince(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe("3 days");
  });

  it("says nothing rather than something wrong", () => {
    expect(elapsedSince(undefined, NOW)).toBeNull();
    expect(elapsedSince("not-a-date", NOW)).toBeNull();
    expect(elapsedSince(new Date(NOW + DAY).toISOString(), NOW)).toBeNull();
    expect(elapsedSince(new Date(NOW - 60_000).toISOString(), NOW)).toBeNull();
  });
});

describe("flightEndBanner — the headline makes the weakest claim that covers every row", () => {
  it("returns nothing when no campaign is past its end date", () => {
    expect(flightEndBanner([])).toBeNull();
    // ★A row WITH an alarm object whose `pastEnd` is not true — the round-1
    // fixture omitted the whole object, so the `.pastEnd` check itself was
    // untested and could be reduced to a truthiness check on the object.
    expect(
      flightEndBanner([
        { _id: "1", name: "x", flightEndAlarm: { endsAt: endedIso, checkedSinceEnd: true } as never },
      ]),
    ).toBeNull();
  });

  it("★says `we could not stop them` ONLY when every row recorded a failure", () => {
    const all = flightEndBanner([row({ reason: API_REASON }, "1"), row({ reason: API_REASON }, "2")], true)!;
    expect(all.headline).toBe("2 campaigns passed their end date and we could not stop them");

    const mixed = flightEndBanner([row({ reason: API_REASON }, "1"), row({}, "2")], true)!;
    expect(mixed.headline).toBe(
      "2 campaigns passed their end date and our records still show them running",
    );
  });

  it("★a MIXED set still points at Campaign Manager — Pause would fail on the failed rows", () => {
    // Round 1 applied the hedge to all rows; its fix dropped it unless ALL rows
    // failed, which sent a reader with nine connection-refused campaigns and one
    // merely-unchecked campaign to a Pause button guaranteed to fail on nine.
    // Anything failed => the advice that is safe for every row in the list.
    const mixed = flightEndBanner([row({ reason: API_REASON }, "1"), row({}, "2")], true)!;
    expect(mixed.body).toContain("Campaign Manager");
    expect(mixed.body).toContain("fail again");
    expect(mixed.body).not.toContain("Pause on the row below");
  });

  it("★offers the row's own Pause only when nothing failed AND the row is on screen", () => {
    const connected = flightEndBanner([row({}, "1")], true)!;
    expect(connected.body).toContain("Use Pause on the row below");
    expect(connected.body).not.toContain("fail again");

    // ★Above the connection gate there IS no row below — and a revoked
    // connection is the state most likely to produce these rows, so the
    // disconnected reader is the likeliest one to be sent to a button that is
    // not on their screen.
    const disconnected = flightEndBanner([row({}, "1")], false)!;
    expect(disconnected.body).not.toContain("row below");
    expect(disconnected.body).toContain("Stop it in LinkedIn Campaign Manager.");
  });

  it("counts and singularises off the rows it actually returns", () => {
    const one = flightEndBanner([row({}, "1")], true)!;
    expect(one.rows).toHaveLength(1);
    expect(one.headline).toBe("A campaign passed its end date and our record still shows it running");
    expect(one.body).toContain("Use Pause on the row below, or stop it in");

    const three = flightEndBanner([row({}, "1"), row({}, "2"), row({}, "3")], true)!;
    expect(three.rows).toHaveLength(3);
    expect(three.headline).toBe(
      "3 campaigns passed their end date and our records still show them running",
    );
    expect(flightEndBanner([row({ reason: API_REASON }, "1")], true)!.headline).toBe(
      "A campaign passed its end date and we could not stop it",
    );
  });

  it("★the headline count is the LISTED rows, not the rows it was handed", () => {
    // Two independent filters that must agree by convention is how a count and
    // a list drift apart, so the banner returns the rows it counted.
    const b = flightEndBanner(
      [row({}, "1"), { _id: "2", name: "healthy" }, { _id: "3", name: "also healthy" }],
      true,
    )!;
    expect(b.rows).toHaveLength(1);
    expect(b.headline).toMatch(/^A campaign /);
  });

  it("★always explains that LinkedIn has no end date of its own", () => {
    // The single fact that makes this banner's existence make sense: the flight
    // cap is ours alone, so our stop is the only one there is.
    const expected = "LinkedIn is never given an end date for these campaigns, so our own stop is the only one there is.";
    for (const b of [
      flightEndBanner([row({}, "1")], true)!,
      flightEndBanner([row({}, "1")], false)!,
      flightEndBanner([row({ reason: API_REASON }, "1")], true)!,
    ]) {
      expect(b.body.startsWith(expected)).toBe(true);
    }
  });
});
