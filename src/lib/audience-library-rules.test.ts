import { describe, it, expect } from "vitest";
import type { AudienceChannel, AudienceSet, AudienceSource, AudienceSetStatus } from "@/lib/api/audiences";

/** The api's own enums, restated so a change to either side is a failing test
 *  rather than a filter option nobody can reach. Kept as literal tuples: a
 *  `satisfies` against the union catches a value that leaves the api, and the
 *  comparisons below catch one that joins it. */
const SOURCE_VALUES = [
  "generated",
  "fallback",
  "imported",
  "user_defined",
] as const satisfies readonly AudienceSource[];
const STATUS_VALUES = [
  "proposed",
  "applied",
  "discarded",
  "superseded",
] as const satisfies readonly AudienceSetStatus[];
import { SOURCES, STATUSES, SEARCH_MAX } from "@/app/(site)/dashboard/growth/audiences/filters";
import {
  audienceShape,
  channelNotes,
  historyLine,
  originIsOurs,
  originLabel,
  outcomeLine,
  reachReading,
  unaskedChannels,
} from "./audience-library-rules";

/**
 * The library's judgement, which is almost entirely about ABSENCES.
 *
 * Every test below is one collapse this surface is not allowed to make. They
 * are here rather than in a render test because this repo is vitest
 * `environment: "node"` by design — and because these are the decisions that
 * would be wrong SILENTLY.
 */

const channel = (over: Partial<AudienceChannel> = {}): AudienceChannel => ({
  platform: "linkedin",
  stale: false,
  rematerialisable: true,
  reachSupported: true,
  reachValue: 2_400_000,
  belowFloor: false,
  droppedAttributes: 0,
  ...over,
});

describe("originLabel", () => {
  it("tells our suggestion from their fact", () => {
    // The brief's own distinction. `generated` is something we thought of;
    // `imported` is something they ran with their own money; `user_defined` is
    // something they wrote, usually while disagreeing with us.
    expect(originLabel("generated")).toBe("Peakhour suggested");
    expect(originLabel("imported")).toBe("From your past campaigns");
    expect(originLabel("user_defined")).toBe("You built this");
    expect(originIsOurs("generated")).toBe(true);
    expect(originIsOurs("fallback")).toBe(true);
    expect(originIsOurs("imported")).toBe(false);
    expect(originIsOurs("user_defined")).toBe(false);
  });

  it("★gives every source its OWN label, because the filter sends one value", () => {
    // `fallback` shared "Peakhour suggested" with `generated` in a first cut,
    // and the api's `source` filter takes ONE enum member — so the baseline set
    // every plan carries was badged identically to the rows the filter returned
    // and reachable from no option in any dropdown. Two sources, one label, is
    // an accepted-then-ignored filter with extra steps.
    const labels = SOURCE_VALUES.map(originLabel);
    expect(new Set(labels).size).toBe(SOURCE_VALUES.length);
  });
});

describe("the filter options and the api's enums", () => {
  it("★offers every source the api accepts", () => {
    // The seam nothing covered, and where the fallback defect lived. A value
    // the api takes and the UI never offers is a row a customer cannot reach.
    expect([...SOURCES].map((s) => s.value).sort()).toEqual([...SOURCE_VALUES].sort());
  });

  it("offers every status the api accepts", () => {
    expect([...STATUSES].map((s) => s.value).sort()).toEqual([...STATUS_VALUES].sort());
  });

  it("never sends a search longer than the api will take", () => {
    // `q` is `.min(1).max(80)` server-side, and an over-long one is a 400 whose
    // only offered action refetches the same invalid query.
    expect(SEARCH_MAX).toBeLessThanOrEqual(80);
  });
});

describe("reachReading", () => {
  it("gives the number when the channel gave us one", () => {
    expect(reachReading(channel())).toEqual({
      kind: "counted",
      text: "2,400,000 on LinkedIn",
    });
  });

  it("never renders a missing size as zero", () => {
    // X publishes no audience count. "We don't know" and "zero" must look
    // different — and this reading may not blame the channel either, because
    // the api reports "the platform has no endpoint" and "our call failed"
    // identically on purpose.
    const reading = reachReading(channel({ platform: "x", reachSupported: false, reachValue: undefined }));
    expect(reading.kind).toBe("unknown");
    expect(reading.text).toBe("No size from X");
    // And a stale VALUE left on the row cannot leak into the sentence when the
    // channel says it has no count — which is how a number nobody sourced
    // reaches a screen.
    expect(
      reachReading(channel({ platform: "x", reachSupported: false, reachValue: 4_200_000 })).text,
    ).toBe("No size from X");
  });

  it("treats a literal zero as the serving floor rather than printing it", () => {
    // LinkedIn's masked `total: 0` means "fewer than 300". The api maps it to
    // belowFloor with no number, so a zero arriving here means something
    // upstream changed — and "0 people" is the sentence this file exists to
    // prevent.
    expect(reachReading(channel({ reachValue: 0 })).kind).toBe("below_floor");
    expect(reachReading(channel({ reachValue: 0 })).text).not.toMatch(/\b0\b/);
  });

  it("carries no figure beside a below-floor audience", () => {
    const reading = reachReading(channel({ belowFloor: true, reachSupported: false, reachValue: undefined }));
    expect(reading.kind).toBe("below_floor");
    expect(reading.text).not.toMatch(/\d/);
  });
});

describe("channelNotes", () => {
  it("names what a channel could not express, in the plural a person would use", () => {
    expect(channelNotes(channel({ platform: "x", droppedAttributes: 1 }))).toEqual([
      "1 thing X can't express",
    ]);
    expect(channelNotes(channel({ platform: "x", droppedAttributes: 2 }))).toEqual([
      "2 things X can't express",
    ]);
  });

  it("★never calls an IMPORTED audience out of date", () => {
    // An imported set has no hypothesis: its criteria are a record of what
    // somebody actually ran, so there is nothing to re-derive and nothing it
    // could be out of date WITH. "May be out of date" over it invites an
    // action that does not exist — the exact collapse `rematerialisable`
    // exists to prevent, and one the api has already made once.
    expect(channelNotes(channel({ stale: true, rematerialisable: false }))).toEqual([]);
    expect(channelNotes(channel({ stale: true, rematerialisable: true }))).toEqual([
      "May be out of date",
    ]);
  });

  it("★says BOTH when a channel is stale and lossy, leading with what was lost", () => {
    // A first cut returned one string and stopped at the dropped-attribute
    // case, so a stale AND lossy channel rendered byte-identically to a fresh
    // one. What was lost is a fact about the audience the customer would be
    // buying; staleness is a fact about our copy of it. Two facts, two
    // sentences — the order says which matters more.
    expect(channelNotes(channel({ stale: true, droppedAttributes: 1 }))).toEqual([
      "1 thing LinkedIn can't express",
      "May be out of date",
    ]);
  });

  it("says nothing about a channel with nothing to report", () => {
    expect(channelNotes(channel())).toEqual([]);
  });
});

describe("unaskedChannels", () => {
  it("★reports the channels nobody has asked, which is not 'it doesn't work there'", () => {
    expect(unaskedChannels({ channels: [channel()] })).toEqual(["x"]);
    expect(unaskedChannels({ channels: [channel(), channel({ platform: "x" })] })).toEqual([]);
    // An audience nobody has resolved anywhere has not failed anywhere either.
    expect(unaskedChannels({ channels: [] })).toEqual(["linkedin", "x"]);
  });
});

describe("audienceShape", () => {
  it("renders the hypothesis, which is the audience", () => {
    const shape = audienceShape({
      hypothesis: {
        attributes: [
          { attribute: "geo", variant: "any", values: ["India"] },
          { attribute: "job_title", variant: "current", values: ["Head of Corporate Travel"] },
        ],
      },
    });
    expect(shape).toEqual([
      { attribute: "geo", label: "Location", values: ["India"] },
      { attribute: "job_title", label: "Job title", values: ["Head of Corporate Travel"] },
    ]);
  });

  it("shows an unknown attribute rather than dropping it", () => {
    // A silent omission makes a narrower audience look complete.
    const shape = audienceShape({
      hypothesis: { attributes: [{ attribute: "brand_new_facet", variant: "any", values: ["x"] }] },
    });
    expect(shape).toHaveLength(1);
    expect(shape[0]!.label).toBe("brand new facet");
  });

  it("is empty for an imported set, which has no hypothesis at all", () => {
    // Its criteria are the platform's own. An empty shape is the true answer,
    // and the caller says so rather than drawing nothing.
    expect(audienceShape({})).toEqual([]);
    expect(
      audienceShape({ hypothesis: { attributes: [{ attribute: "geo", variant: "any", values: [] }] } }),
    ).toEqual([]);
  });
});

describe("historyLine", () => {
  it("★leads with the discard, even on an audience that ran", () => {
    // A discarded audience that once ran is a rejection with history; leading
    // with its performance would read as a recommendation.
    expect(historyLine({ status: "discarded", discardReason: "too broad" })).toBe(
      'You discarded this — "too broad"',
    );
    expect(historyLine({ status: "discarded" })).toBe("You discarded this");
  });

  it("★keeps the correction count on a discard, which is where it matters most", () => {
    // "Discarded after being corrected four times" is the most informative row
    // in a library: an audience we kept getting wrong until they gave up on it.
    // A first cut computed the figure and then dropped it on exactly the sets
    // most likely to carry one. Suppressing the OUTCOME on a discard is the
    // rule; suppressing this was an accident of ordering.
    expect(
      historyLine({ status: "discarded", userEdits: [{ at: "a" }, { at: "b" }] }),
    ).toBe("You discarded this (corrected 2 times)");
  });

  it("counts the corrections, because an audience corrected four times is one we keep getting wrong", () => {
    expect(historyLine({ status: "proposed", userEdits: [{ at: "x" }] })).toBe(
      "Suggested, corrected 1 time",
    );
    expect(historyLine({ status: "applied", userEdits: [{ at: "x" }, { at: "y" }] })).toBe(
      "On a campaign, corrected 2 times",
    );
  });

  it("says nothing about an audience nothing has happened to", () => {
    // A row that manufactures a sentence for every audience makes the ones
    // with real history invisible.
    expect(historyLine({ status: "proposed" })).toBeNull();
  });
});

describe("outcomeLine", () => {
  const outcome = (over: Partial<NonNullable<AudienceSet["outcome"]>> = {}) => ({
    campaignIds: ["1"],
    impressions: 10_000,
    clicks: 120,
    ctr: 0.012,
    basis: "campaign_performance" as const,
    syncedAt: "2026-08-01T00:00:00Z",
    ...over,
  });

  it("says nothing at all about an audience that has never run", () => {
    expect(outcomeLine(undefined)).toBeNull();
  });

  it("★never invents a click-through rate over zero impressions", () => {
    // The api omits `ctr` when nothing served, so a set whose campaign never
    // delivered is not ranked below one that genuinely underperformed. A
    // client filling in "0.00%" undoes that in the one number a customer reads
    // as a verdict.
    const line = outcomeLine(outcome({ impressions: 0, clicks: 0, ctr: undefined }))!;
    expect(line).toContain("never served");
    expect(line).not.toContain("0.00%");
  });

  it("shows spend only with its currency", () => {
    // The two travel together or neither is written — a figure with no unit is
    // one every reader will nonetheless treat as money.
    expect(outcomeLine(outcome({ spend: 4210, currency: "INR" }))).toContain("INR 4,210 spent");
    expect(outcomeLine(outcome({ spend: 4210 }))).not.toContain("4,210 spent");
  });

  it("never rounds real spend down to zero", () => {
    // `Math.round(0.49)` is 0, and "INR 0 spent" beside a campaign that did
    // spend is exactly the confident-wrong number this file refuses.
    expect(outcomeLine(outcome({ spend: 0.49, currency: "USD" }))).toContain("USD 0.49 spent");
  });
});
