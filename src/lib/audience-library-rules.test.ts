import { describe, it, expect } from "vitest";
import type { AudienceChannel, AudienceSet } from "@/lib/api/audiences";
import {
  audienceShape,
  channelNote,
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
    expect(originLabel("fallback")).toBe("Peakhour suggested");
    expect(originLabel("imported")).toBe("From your past campaigns");
    expect(originLabel("user_defined")).toBe("You built this");
    expect(originIsOurs("generated")).toBe(true);
    expect(originIsOurs("imported")).toBe(false);
    expect(originIsOurs("user_defined")).toBe(false);
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
    expect(reading.text).not.toMatch(/\b0\b/);
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

describe("channelNote", () => {
  it("names what a channel could not express, in the plural a person would use", () => {
    expect(channelNote(channel({ platform: "x", droppedAttributes: 1 }))).toBe(
      "1 thing X can't express",
    );
    expect(channelNote(channel({ platform: "x", droppedAttributes: 2 }))).toBe(
      "2 things X can't express",
    );
  });

  it("★never calls an IMPORTED audience out of date", () => {
    // An imported set has no hypothesis: its criteria are a record of what
    // somebody actually ran, so there is nothing to re-derive and nothing it
    // could be out of date WITH. "May be out of date" over it invites an
    // action that does not exist — the exact collapse `rematerialisable`
    // exists to prevent, and one the api has already made once.
    expect(channelNote(channel({ stale: true, rematerialisable: false }))).toBeNull();
    expect(channelNote(channel({ stale: true, rematerialisable: true }))).toBe("May be out of date");
  });

  it("leads with what was lost rather than with staleness", () => {
    // A dropped attribute is a fact about the audience the customer would be
    // buying; staleness is a fact about our cache.
    expect(channelNote(channel({ stale: true, droppedAttributes: 1 }))).toBe(
      "1 thing LinkedIn can't express",
    );
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
});
