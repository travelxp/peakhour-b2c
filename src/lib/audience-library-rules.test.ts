import { describe, it, expect } from "vitest";
import type {
  AudienceChannel,
  AudienceResolution,
  AudienceSet,
  AudienceSource,
  AudienceSetStatus,
} from "@/lib/api/audiences";

/**
 * The api's own enums, derived so that a change on EITHER side breaks.
 *
 * ★A TUPLE WITH `satisfies readonly AudienceSource[]` DOES NOT CATCH AN ADDED
 * MEMBER, which is the direction that matters — assignability still holds when
 * the union grows, so the parity test below would have compared one hand-written
 * list against another and stayed green while a row became unreachable. That is
 * the exact defect this test was written for, one level up.
 *
 * An exhaustive `Record` is a COMPILE error the day the api adds a source: the
 * object literal no longer satisfies it, and `tsc --noEmit` covers this file.
 */
const SOURCE_VALUES = Object.keys({
  generated: true,
  fallback: true,
  imported: true,
  user_defined: true,
} satisfies Record<AudienceSource, true>) as AudienceSource[];
const STATUS_VALUES = Object.keys({
  proposed: true,
  applied: true,
  discarded: true,
  superseded: true,
} satisfies Record<AudienceSetStatus, true>) as AudienceSetStatus[];
import { SOURCES, STATUSES, SEARCH_MAX } from "@/app/(site)/dashboard/growth/audiences/filters";
import {
  audienceShape,
  channelNotes,
  detailChannels,
  gapSentence,
  historyLine,
  originIsOurs,
  originLabel,
  outcomeLine,
  reachReading,
  refreshability,
  resolutionReach,
  shouldAskOnMount,
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

  it("never rounds real spend down to zero, at any size", () => {
    // `Math.round(0.49)` is 0, and "INR 0 spent" beside a campaign that did
    // spend is exactly the confident-wrong number this file refuses. A first
    // fix used `toFixed(2)` below 1 — which prints "0.00" for four tenths of a
    // cent, the same lie in more decimal places.
    expect(outcomeLine(outcome({ spend: 0.49, currency: "USD" }))).toContain("USD 0.49 spent");
    expect(outcomeLine(outcome({ spend: 0.004, currency: "USD" }))).toContain("under USD 0.01");
    expect(outcomeLine(outcome({ spend: 12_345.6, currency: "INR" }))).toContain("INR 12,346 spent");
  });

  it("shows no spend at all for a figure the schema forbids", () => {
    // `spend` is `min(0)` server-side, so a negative is impossible — and
    // `Math.round(-0.4)` is JavaScript's `-0`, which renders as "-0". A number
    // we cannot explain is one we do not show.
    expect(outcomeLine(outcome({ spend: -1, currency: "USD" }))).not.toContain("spent");
  });
});

describe("resolutionReach — the per-channel view knows one thing the list does not", () => {
  const resolution = (over: Partial<AudienceResolution> = {}): AudienceResolution => ({
    resolvedAt: "2026-08-01T00:00:00Z",
    ...over,
  });

  it("★tells 'nobody asked' from 'the channel has no count'", () => {
    // The list gets a stored entry and cannot separate these — the api reports
    // "the platform publishes none" and "our call failed" identically, on
    // purpose. Here we also know whether anybody asked at all, and that is a
    // third fact.
    expect(resolutionReach(resolution(), "x")).toEqual({
      text: "We haven't asked X for a size.",
      sourced: false,
    });
    expect(resolutionReach(resolution({ reach: { supported: false } }), "x")).toEqual({
      text: "X doesn't give us a size for this audience.",
      sourced: false,
    });
  });

  it("gives the number, and marks it as one we sourced", () => {
    expect(
      resolutionReach(resolution({ reach: { supported: true, value: 2_400_000 } }), "linkedin"),
    ).toEqual({ text: "About 2,400,000 people on LinkedIn", sourced: true });
  });

  it("★never prints a zero, and says what a floor MEANS", () => {
    // LinkedIn's masked `total: 0` means "fewer than 300" — so the useful
    // sentence is not the number, it is that the campaign will not deliver.
    for (const reach of [
      { supported: true, belowFloor: true },
      { supported: true, value: 0 },
    ]) {
      const out = resolutionReach(resolution({ reach }), "linkedin");
      expect(out.sourced).toBe(false);
      expect(out.text).toContain("wouldn't deliver");
      expect(out.text).not.toMatch(/\b0\b/);
    }
  });

  it("refuses a supported reach with no number rather than rendering undefined", () => {
    expect(resolutionReach(resolution({ reach: { supported: true } }), "x").sourced).toBe(false);
  });
});

describe("gapSentence — two kinds of gap, two different complaints", () => {
  it("uses the channel's OWN reason when it cannot express the attribute at all", () => {
    expect(
      gapSentence(
        {
          attribute: "seniority",
          variant: "any",
          unsupported: true,
          reason: "X has no way to target seniority.",
          values: [],
        },
        "x",
      ),
    ).toBe("X has no way to target seniority.");
  });

  it("falls back to a sentence rather than rendering nothing", () => {
    // ★A GAP WITH NO PROSE IS STILL A GAP. The stored shape records no reason —
    // only `attribute|variant` — so a reader that showed nothing would report a
    // clean audience over one that lost an attribute.
    expect(
      gapSentence({ attribute: "job_title", variant: "current", unsupported: true, values: [] }, "x"),
    ).toBe("X can't target job title.");
  });

  it("★counts the VALUES separately, because that is a different fact", () => {
    // "X can't target job title" is about the channel. "X couldn't match 2 of
    // your job titles" is about those two values, and a customer can act on it.
    expect(
      gapSentence(
        {
          attribute: "job_title",
          variant: "current",
          unsupported: false,
          values: [
            { value: "Head of Corporate Travel", reason: "no match" },
            { value: "Travel Ops Lead", reason: "no match" },
          ],
        },
        "x",
      ),
    ).toBe("X couldn't match 2 job title values.");
  });
});

describe("refreshability — three questions, and none of them is the other two", () => {
  it("★never re-asks a channel shape a HUMAN built", () => {
    // There is no producer for it to be out of date with, and re-resolving
    // would run the platform's typeahead on the customer's own chip text and
    // replace their entity ids with whatever ranks first today. The api refuses
    // it too, `force` included; offering the button would be a dead control.
    const out = refreshability({ authored: true }, { rematerialisable: true });
    expect(out.canRefresh).toBe(false);
    expect(out.reason).toContain("by hand");
  });

  it("★never re-asks an IMPORTED set either, and for a different reason", () => {
    // Its criteria are a record of what somebody actually ran. Nothing to
    // re-derive — and the sentence has to say that rather than "you built this",
    // which would be false.
    const out = refreshability({}, { rematerialisable: false });
    expect(out.canRefresh).toBe(false);
    expect(out.reason).toContain("read off a campaign");
  });

  it("★says 'you built this' about a set that is BOTH authored and importless", () => {
    // A captured set carries a human-built channel shape AND a hypothesis. Both
    // reasons are true of the row; only one of them is true of the SHAPE, and
    // "read off a campaign as it ran" would be a false sentence about it.
    expect(refreshability({ authored: true }, { rematerialisable: false }).reason).toContain(
      "by hand",
    );
  });

  it("offers the refresh on an ordinary derived shape", () => {
    expect(refreshability({}, { rematerialisable: true })).toEqual({ canRefresh: true });
  });
});

describe("shouldAskOnMount — a cache read is free and a stale entry is not", () => {
  it("★never fires a metered resolution just because a page opened", () => {
    // The route is a cache read only when the stored entry is CURRENT. On a
    // stale, re-expressible one it takes an ORG-WIDE rate-limit token and runs
    // a full typeahead round, a reach call and a write — and the pre-E1
    // `resolved` block is stale BY CONSTRUCTION, so opening a detail page used
    // to spend several of those before the customer touched anything.
    expect(shouldAskOnMount(channel({ stale: true, rematerialisable: true }))).toBe(false);
  });

  it("asks for a fresh entry, which costs nothing", () => {
    expect(shouldAskOnMount(channel({ stale: false }))).toBe(true);
  });

  it("asks for a stale IMPORTED entry, which the api cannot re-resolve anyway", () => {
    // No hypothesis to re-express, so the api returns the cached entry after
    // one findOne. Withholding it would hide what we already have for nothing.
    expect(shouldAskOnMount(channel({ stale: true, rematerialisable: false }))).toBe(true);
  });

  it("asks nothing about a channel we have never resolved", () => {
    expect(shouldAskOnMount(undefined)).toBe(false);
  });
});

describe("detailChannels", () => {
  it("★shows every channel the SET carries, not only the ones we hardcode", () => {
    // A set resolved against a platform this client does not list still shows a
    // reach line on the library ROW; dropping it here would make the page whose
    // premise is that it knows more than the row know less.
    expect(detailChannels({ channels: [channel({ platform: "meta" })] })).toEqual([
      "linkedin",
      "x",
      "meta",
    ]);
  });

  it("★leads with the channels a customer can act on, not with alphabet", () => {
    // A plain `.sort()` put `google_ads` — the kind of row this union exists
    // for, and one no adapter can answer for — at the TOP of the page, above
    // the two channels that work.
    expect(detailChannels({ channels: [channel({ platform: "google_ads" })] })[0]).toBe("linkedin");
  });

  it("offers the unasked ones too, without duplicating the asked", () => {
    expect(detailChannels({ channels: [channel({ platform: "linkedin" })] })).toEqual([
      "linkedin",
      "x",
    ]);
    expect(detailChannels({ channels: [] })).toEqual(["linkedin", "x"]);
  });
});
