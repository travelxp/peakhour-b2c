import { describe, it, expect } from "vitest";
import {
  flightEndBanner,
  flightEndDetail,
  flightEndState,
  elapsedSince,
  type FlightEndRow,
} from "./flight-end-copy";

/**
 * ★THE BANNER'S FIRST CUT ASSERTED A CAUSE THE API NEVER ESTABLISHED.
 *
 * It said, above every row, "We could not stop them on LinkedIn, so they may
 * still be spending." `flightEndAlarm` is derived from two facts — `active`
 * and past `endsAt` — which is also what a campaign looks like when the sweep
 * has not reached it (forever, on dev, where crons do not run), and when the
 * platform stop SUCCEEDED and only our local write failed. In that last case
 * every clause was false and the customer was sent to Campaign Manager to stop
 * an already-stopped campaign.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-08-07T12:00:00Z");
const endedIso = new Date(NOW - 4 * DAY).toISOString();

function row(over: Partial<FlightEndRow["flightEndAlarm"]> = {}, id = "1"): FlightEndRow {
  return {
    _id: id,
    name: "Q3 demand gen",
    flightEndAlarm: { pastEnd: true, endsAt: endedIso, checkedSinceEnd: true, ...over },
  };
}

describe("flightEndState — the three absences stay distinct", () => {
  it("a recorded reason is the ONLY evidence that a stop failed", () => {
    expect(flightEndState({ pastEnd: true, endsAt: endedIso, checkedSinceEnd: true, reason: "x" }))
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
      flightEndState({ pastEnd: true, endsAt: endedIso, checkedSinceEnd: false, reason: "x" }),
    ).toBe("stop_failed");
  });
});

describe("flightEndDetail — one row's sentence", () => {
  it("★only claims a failure when one was recorded", () => {
    const failed = flightEndDetail(row({ reason: "the connection needs a reconnect" }).flightEndAlarm!, "3 Aug 2026", NOW);
    expect(failed).toContain("We could not stop it");
    expect(failed).toContain("the connection needs a reconnect");

    const unchecked = flightEndDetail(row({ checkedSinceEnd: false }).flightEndAlarm!, "3 Aug 2026", NOW);
    expect(unchecked).not.toContain("could not stop");
    expect(unchecked).toContain("cannot tell whether it is still running");

    const quiet = flightEndDetail(row().flightEndAlarm!, "3 Aug 2026", NOW);
    expect(quiet).not.toContain("could not stop");
    expect(quiet).toContain("may already be stopped");
  });

  it("★never doubles the full stop on an api-authored sentence", () => {
    const withStop = flightEndDetail(row({ reason: "LinkedIn refused the ad account." }).flightEndAlarm!, "3 Aug 2026", NOW);
    expect(withStop).not.toContain("..");
    const without = flightEndDetail(row({ reason: "LinkedIn refused the ad account" }).flightEndAlarm!, "3 Aug 2026", NOW);
    expect(without.endsWith(".")).toBe(true);
  });

  it("carries how long ago, which is the number that conveys urgency", () => {
    expect(flightEndDetail(row().flightEndAlarm!, "3 Aug 2026", NOW)).toContain("(4 days ago)");
  });

  it("survives an empty formatted date rather than rendering an empty clause", () => {
    const s = flightEndDetail(row().flightEndAlarm!, "", NOW);
    expect(s).toContain("past its end date");
    expect(s).not.toContain("ended .");
  });
});

describe("elapsedSince", () => {
  it("reads in hours below two days and days above", () => {
    expect(elapsedSince(new Date(NOW - 5 * 3_600_000).toISOString(), NOW)).toBe("5 hours");
    expect(elapsedSince(new Date(NOW - 1 * 3_600_000).toISOString(), NOW)).toBe("1 hour");
    expect(elapsedSince(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe("3 days");
    expect(elapsedSince(new Date(NOW - 1 * DAY).toISOString(), NOW)).toBe("24 hours");
  });

  it("says nothing rather than something wrong", () => {
    expect(elapsedSince(undefined, NOW)).toBeNull();
    expect(elapsedSince("not-a-date", NOW)).toBeNull();
    // A future end date is not "0 hours ago" — it is not past at all.
    expect(elapsedSince(new Date(NOW + DAY).toISOString(), NOW)).toBeNull();
    expect(elapsedSince(new Date(NOW - 60_000).toISOString(), NOW)).toBeNull();
  });
});

describe("flightEndBanner — the headline makes the weakest claim that covers every row", () => {
  it("returns nothing when no campaign is past its end date", () => {
    expect(flightEndBanner([])).toBeNull();
    expect(flightEndBanner([{ _id: "1", name: "x" }])).toBeNull();
  });

  it("★says `we could not stop them` ONLY when every row recorded a failure", () => {
    const all = flightEndBanner([row({ reason: "a" }, "1"), row({ reason: "b" }, "2")], NOW)!;
    expect(all.headline).toContain("we could not stop them");
    expect(all.hedgeApplies).toBe(true);

    // One row without a recorded failure and the strong claim is gone.
    const mixed = flightEndBanner([row({ reason: "a" }, "1"), row({}, "2")], NOW)!;
    expect(mixed.headline).not.toContain("could not stop");
    expect(mixed.headline).toContain("our records still show them running");
    expect(mixed.hedgeApplies).toBe(false);
  });

  it("★drops the `it will fail again` hedge when nothing failed — it steers users off the fix", () => {
    // That hedge is earned on the spend banner, where the alarm implies a stop
    // was attempted. Here it usually was not, and the row's own Pause works.
    const quiet = flightEndBanner([row({}, "1")], NOW)!;
    expect(quiet.body).not.toContain("fail again");
    expect(quiet.body).toContain("Pause on the row below");

    const failed = flightEndBanner([row({ reason: "a" }, "1")], NOW)!;
    expect(failed.body).toContain("fail again");
  });

  it("counts and singularises correctly", () => {
    const one = flightEndBanner([row({}, "1")], NOW)!;
    expect(one.count).toBe(1);
    expect(one.headline).toBe("A campaign passed its end date and our record still shows it running");

    const three = flightEndBanner([row({}, "1"), row({}, "2"), row({}, "3")], NOW)!;
    expect(three.count).toBe(3);
    expect(three.headline).toBe(
      "3 campaigns passed their end date and our records still show them running",
    );
    expect(flightEndBanner([row({ reason: "a" }, "1"), row({ reason: "b" }, "2")], NOW)!.headline).toBe(
      "2 campaigns passed their end date and we could not stop them",
    );
  });

  it("ignores rows without the flag when counting", () => {
    const b = flightEndBanner([row({}, "1"), { _id: "2", name: "healthy" }], NOW)!;
    expect(b.count).toBe(1);
  });

  it("★always explains that LinkedIn has no end date of its own", () => {
    // The single fact that makes this banner's existence make sense: the flight
    // cap is ours alone, so our stop is the only one there is.
    for (const b of [flightEndBanner([row({}, "1")], NOW)!, flightEndBanner([row({ reason: "a" }, "1")], NOW)!]) {
      expect(b.body).toMatch(/never given an end date|was not given an end date/);
    }
  });
});
