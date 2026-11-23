/**
 * W2-D: the rule that writes a new post each time. What must hold: only connected, picture-free channels are offered; a rule cannot be created without a name, a topic, a channel and a
 * complete rhythm; the body carries only the fields of the chosen rhythm and the topic inside planTemplate; and the setup note says what to switch on, from the api's own status.
 */
import { describe, expect, it } from "vitest";
import type { AutoWriteStatus } from "@/lib/auto-write";
import type { RecurringRuleInput } from "@/components/scheduler/recurring-schedule-editor";
import { FRESH_COPY, TOPIC_MAX, buildFreshRuleBody, freshChannelOptions, freshPriceLine, freshRuleProblems, freshSetup, type FreshRuleDraft } from "./fresh-recurring";

const rule = (over: Partial<RecurringRuleInput> = {}): RecurringRuleInput => ({ freq: "weekly", interval: 1, weekdays: [2], localTime: "09:00", timezone: "Asia/Kolkata", effectiveFrom: "2026-11-24T00:00:00.000Z", ...over });
const draft = (over: Partial<FreshRuleDraft> = {}): FreshRuleDraft => ({ name: "Tuesday tip", topic: "A cooking tip", channels: ["linkedin"], rule: rule(), ...over });

const status = (over: Partial<AutoWriteStatus> = {}, jobOver: Record<string, unknown> = {}): AutoWriteStatus => ({
  monthlyCapPeaks: 5000,
  usedPeaks: 0,
  remainingPeaks: 5000,
  month: "2026-11",
  weeklyPlan: { weekday: 1, count: 3 },
  runs: true,
  jobs: [{ job: "fresh_recurring", label: "Fresh recurring posts", what: "w", enabled: true, pricePerDraftPeaks: 225, acceptedPricePeaks: 225, needsReaccept: false, ...jobOver } as never],
  ...over,
});

describe("freshChannelOptions: connected channels a rule can write words for", () => {
  const row = (provider: string, connected = true) => ({ provider, connected });
  it("offers LinkedIn and X when connected, in picker order, and nothing while the list is unknown", () => {
    expect(freshChannelOptions([row("x"), row("linkedin_content")]).map((o) => o.value)).toEqual(["linkedin", "x"]);
    expect(freshChannelOptions(undefined)).toEqual([]);
    expect(freshChannelOptions([row("x", false), row("linkedin_content", false)])).toEqual([]);
  });
  it("offers Threads and Facebook as the New post sheet reads them, and never Instagram", () => {
    const out = freshChannelOptions([row("threads"), row("facebook_pages"), row("instagram")]).map((o) => o.value);
    expect(out).toEqual(["facebook", "threads"]);
    expect(out).not.toContain("instagram");
  });
});

describe("freshRuleProblems", () => {
  it("a complete weekly rule has none", () => expect(freshRuleProblems(draft())).toEqual([]));
  it("each missing piece is named", () => {
    expect(freshRuleProblems(draft({ name: "  " }))).toEqual(["Give the rule a name."]);
    expect(freshRuleProblems(draft({ topic: "ab" }))).toEqual(["Say what each post should be about."]);
    expect(freshRuleProblems(draft({ topic: "x".repeat(TOPIC_MAX + 1) }))).toEqual([`The topic can be up to ${TOPIC_MAX} characters.`]);
    expect(freshRuleProblems(draft({ channels: [] }))).toEqual(["Choose at least one channel."]);
    expect(freshRuleProblems(draft({ rule: rule({ weekdays: [] }) }))).toEqual(["Choose at least one weekday."]);
    expect(freshRuleProblems(draft({ rule: rule({ freq: "monthly", weekdays: undefined, dayOfMonth: undefined }) }))).toEqual(["Choose a day of the month."]);
    expect(freshRuleProblems(draft({ rule: rule({ timezone: "" }) }))).toEqual(["Choose a time zone."]);
  });
  it("a daily rule needs no weekday", () => expect(freshRuleProblems(draft({ rule: rule({ freq: "daily", weekdays: [] }) }))).toEqual([]));
});

describe("buildFreshRuleBody", () => {
  it("carries the topic in planTemplate as ai_generated, the channels as keys, and only a weekly rule's weekdays", () => {
    const b = buildFreshRuleBody(draft({ name: " Tuesday tip ", topic: " A cooking tip " }));
    expect(b.name).toBe("Tuesday tip");
    expect(b.planTemplate).toEqual({ sourceType: "ai_generated", topic: "A cooking tip", channels: [{ channel: "linkedin" }] });
    expect(b.weekdays).toEqual([2]);
    expect("dayOfMonth" in b).toBe(false);
  });
  it("a monthly rule sends dayOfMonth and no weekdays; a daily rule neither", () => {
    const m = buildFreshRuleBody(draft({ rule: rule({ freq: "monthly", weekdays: [2], dayOfMonth: 5 }) }));
    expect(m.dayOfMonth).toBe(5);
    expect("weekdays" in m).toBe(false);
    const d = buildFreshRuleBody(draft({ rule: rule({ freq: "daily", weekdays: [2], dayOfMonth: 5 }) }));
    expect("weekdays" in d).toBe(false);
    expect("dayOfMonth" in d).toBe(false);
  });
  it("sends the end date and the run limit only when set", () => {
    expect("effectiveUntil" in buildFreshRuleBody(draft())).toBe(false);
    expect(buildFreshRuleBody(draft({ rule: rule({ effectiveUntil: "2027-01-01T00:00:00.000Z", maxRuns: 8 }) }))).toMatchObject({ effectiveUntil: "2027-01-01T00:00:00.000Z", maxRuns: 8 });
  });
});

describe("freshSetup: will a rule that writes a new post each time actually write?", () => {
  it("is ready when the job is on, priced at the accepted price, with a limit and room", () => {
    expect(freshSetup(status())).toEqual({ state: "ready", pricePeaks: 225, text: null });
  });
  it("loading says nothing yet", () => expect(freshSetup(undefined)).toEqual({ state: "loading", pricePeaks: null, text: null }));
  it("off: says to switch it on and set a limit, and still shows today's price", () => {
    const s = freshSetup(status({}, { enabled: false }));
    expect(s.state).toBe("off");
    expect(s.pricePeaks).toBe(225);
    expect(s.text).toMatch(/Switch on Fresh recurring posts in Automatic writing and set a monthly limit/);
  });
  it("on with no monthly limit says to set one", () => expect(freshSetup(status({ monthlyCapPeaks: null, remainingPeaks: null }))).toMatchObject({ state: "no_limit", text: expect.stringMatching(/Set a monthly limit/) }));
  it("a price that cannot be read, and one that changed, are said", () => {
    expect(freshSetup(status({}, { pricePerDraftPeaks: null }))).toMatchObject({ state: "not_priced", pricePeaks: null });
    expect(freshSetup(status({}, { needsReaccept: true }))).toMatchObject({ state: "reaccept", text: expect.stringMatching(/Accept the new price/) });
  });
  it("a month with no room for another post says so", () => {
    expect(freshSetup(status({ remainingPeaks: 100, usedPeaks: 4900 }))).toMatchObject({ state: "no_room" });
    expect(freshSetup(status({ remainingPeaks: 225 }))).toMatchObject({ state: "ready" });
  });
});

describe("the words", () => {
  it("a price is in Peaks only, and null says nothing", () => {
    expect(freshPriceLine(225)).toBe("Each post costs 225 Peaks, charged only when it is written.");
    expect(freshPriceLine(1)).toBe("Each post costs 1 Peak, charged only when it is written.");
    expect(freshPriceLine(null)).toBeNull();
    expect(freshPriceLine(225)).not.toMatch(/[$£₹€]/);
  });
  it("the copy promises nothing posts without approval", () => {
    expect(FRESH_COPY.intro).toMatch(/If you do not approve it, nothing is posted/);
  });
});
