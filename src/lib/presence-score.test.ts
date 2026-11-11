import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  FIXES_SHOWN,
  canDecide,
  checkPoints,
  fixTitleWithPoints,
  pointsSentence,
  scoreToneNote,
  effectWord,
  fixControl,
  healthMark,
  orderingSentence,
  proposalBody,
  scoreEmptyState,
  scoreHeadline,
  scoreTone,
  sortedChecks,
  sortedHealth,
  statusSentence,
  valueText,
  visibleFixes,
  type FixAction,
  type ScoreCheck,
} from "@/lib/presence-score";

const code = (rel: string) =>
  readFileSync(rel, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const none: FixAction = { kind: "none", reason: "control_unknown", message: "We could not tell whether you manage this listing." };
const form: FixAction = { kind: "form", network: "n", listingId: "L", field: "phone", risky: false };
const card: FixAction = { kind: "card", network: "n", listingId: "L", field: "website", value: "https://x.example", risky: false };

describe("the headline", () => {
  it("a missing score is not a low score", () => {
    expect(scoreHeadline(null)).toBe("Not enough to score yet");
    expect(scoreHeadline(0)).toBe("0 out of 100");
    expect(scoreHeadline(82)).toBe("82 out of 100");
  });
  it("no number, no tone", () => {
    expect(scoreTone(null, 0)).toBe("none");
    expect(scoreTone(0, 0)).toBe("poor");
    expect(scoreTone(59, 0)).toBe("poor");
    expect(scoreTone(60, 0)).toBe("fair");
    expect(scoreTone(84, 0)).toBe("fair");
    expect(scoreTone(85, 0)).toBe("good");
    expect(scoreTone(100, 0)).toBe("good");
    expect(scoreTone(100, 1)).toBe("fair");
    expect(scoreTone(84, 1)).toBe("fair");
    expect(scoreTone(40, 2)).toBe("poor");
  });
});

describe("empty states say what to do next and never blame the listing", () => {
  it("each state", () => {
    expect(scoreEmptyState({ state: "not_connected" })?.headline).toMatch(/Connect your listing/);
    expect(scoreEmptyState({ state: "needs_location" })?.headline).toMatch(/Choose which listing/);
    expect(scoreEmptyState({ state: "importing" })?.description).toMatch(/Nothing is wrong/);
    expect(scoreEmptyState({ state: "needs_reconnect" })?.headline).toMatch(/Reconnect/);
    expect(scoreEmptyState({ state: "sync_failing" })?.description).toMatch(/Nothing is wrong/);
    expect(scoreEmptyState(undefined)).toBeNull();
  });
});

describe("a fix's control", () => {
  it("a fix with no edit is a note and never a button", () => {
    expect(fixControl(none, true)).toEqual({ kind: "note", message: none.kind === "none" ? none.message : "" });
    expect(fixControl(none, false)?.kind).toBe("note");
  });
  it("a card is prepared, not sent", () => {
    expect(fixControl(card, false)).toEqual({ kind: "propose", label: "Prepare this change" });
  });
  it("a form opens only where the page can open one", () => {
    expect(fixControl(form, true)).toEqual({ kind: "form", label: "Add it", risky: false });
    expect(fixControl(form, false)).toBeNull();
    expect(fixControl({ ...form, risky: true }, true)).toMatchObject({ risky: true });
  });
  it("the proposal carries the listing, the network and exactly one field, and no source", () => {
    const body = proposalBody(card as Extract<FixAction, { kind: "card" }>);
    expect(body).toEqual({ listingId: "L", network: "n", changes: [{ field: "website", value: "https://x.example" }] });
    expect(JSON.stringify(body)).not.toMatch(/source/);
  });
});

describe("the list", () => {
  const many = Array.from({ length: 7 }, (_, i) => i);
  it("is short until asked", () => {
    expect(visibleFixes(many, false)).toHaveLength(FIXES_SHOWN);
    expect(visibleFixes(many, true)).toHaveLength(7);
    expect(visibleFixes(many, false)[0]).toBe(0);
  });
  it("checks read: to do, could not check, done, does not apply; stable within a state", () => {
    const c = (id: string, state: ScoreCheck["state"]): ScoreCheck => ({ id, field: id, label: id, state, points: 2, earned: null });
    expect(sortedChecks([c("a", "ok"), c("b", "not_applicable"), c("c", "unknown"), c("d", "gap"), c("e", "gap")]).map((x) => x.id)).toEqual(["d", "e", "c", "a", "b"]);
  });
  it("health reads: needs a look, not checked, fine", () => {
    const h = (id: string, state: "ok" | "attention" | "unknown") => ({ id, state, headline: id });
    expect(sortedHealth([h("a", "ok"), h("b", "unknown"), h("c", "attention")]).map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(healthMark("unknown")).toBe("Not checked");
  });
  it("the effect words do not promise a result", () => {
    for (const e of ["high", "medium", "low"] as const) expect(effectWord(e)).not.toMatch(/rank|boost|more customers|guarantee/i);
  });
});

describe("the order is said truthfully", () => {
  it("by the merchant's figures", () => {
    const o = (calls: number, directions: number) => ({ by: "your_figures" as const, days: 28, measuredDays: 9, calls, directions });
    expect(orderingSentence(o(40, 12))).toBe("Ordered by what your customers did in the last 28 days: 40 calls and 12 requests for directions.");
    expect(orderingSentence(o(1, 0))).toBe("Ordered by what your customers did in the last 28 days: 1 call and no requests for directions.");
    expect(orderingSentence(o(0, 1))).toContain("no calls and 1 request for directions");
  });
  it("by the kind of business, and why", () => {
    const s = (reason: "figures_not_read" | "figures_incomplete" | "too_few_days" | "too_few_actions") => orderingSentence({ by: "kind_of_business", reason, callShare: 0.5, group: "general" });
    expect(s("figures_not_read")).toMatch(/not read your figures/);
    expect(s("figures_incomplete")).toMatch(/not all in yet/);
    expect(s("too_few_days")).toMatch(/too few days/);
    expect(s("too_few_actions")).toMatch(/Too few customers/);
  });
});

describe("a change card", () => {
  it("can be decided only while it waits", () => {
    expect(canDecide({ status: "proposed" })).toBe(true);
    expect(canDecide({ status: "validated" })).toBe(true);
    for (const s of ["approved", "applying", "submitted", "live", "failed", "blocked", "rejected", "expired"]) expect(canDecide({ status: s })).toBe(false);
  });
  it("never says live before a read proves it", () => {
    expect(statusSentence("submitted")).toMatch(/until a later check confirms/);
    expect(statusSentence("approved")).not.toMatch(/live/i);
    expect(statusSentence("live")).toBe("Confirmed live.");
  });
  it("shows an empty value as nothing", () => {
    expect(valueText("")).toBe("Nothing");
    expect(valueText(null)).toBe("Nothing");
    expect(valueText("a")).toBe("a");
  });
});

describe("the UI holds no network name and claims no ranking", () => {
  const sources = ["src/lib/presence-score.ts", "src/components/presence/listing-score-card.tsx", "src/hooks/use-presence-score.ts", "src/lib/api/presence-score.ts"];
  it("no network name", () => {
    for (const f of sources) expect(code(f), f).not.toMatch(/google|bing|yelp|facebook|tripadvisor|trustpilot|gbp/i);
  });
  it("no ranking claim", () => {
    for (const f of sources) expect(code(f), f).not.toMatch(/rank higher|ranking factor|boost your ranking|algorithm/i);
  });
});

describe("the score shows its sum", () => {
  const seen = (over: Partial<Parameters<typeof pointsSentence>[0]> = {}) => ({ scored: 6, unknown: 1, notApplicable: 0, total: 7, pointsEarned: 16, pointsCounted: 18, sentence: "", ...over }) as Parameters<typeof pointsSentence>[0];
  it("16 of 18 from 6 of 7 checks", () => {
    expect(pointsSentence(seen(), 89)).toBe("16 of 18 points, from 6 of 7 checks.");
  });
  it("says all when nothing was skipped, and nothing when nothing was judged", () => {
    expect(pointsSentence(seen({ scored: 7, unknown: 0, pointsCounted: 18 }), 89)).toBe("16 of 18 points, from all 7 checks.");
    expect(pointsSentence(seen({ scored: 0, unknown: 7 }), null)).toBeNull();
  });
  it("one row each: earned, missing, not counted, does not apply", () => {
    expect(checkPoints({ state: "ok", points: 3, earned: 3 })).toBe("+3 of 3");
    expect(checkPoints({ state: "gap", points: 2, earned: 0 })).toBe("0 of 2 — missing");
    expect(checkPoints({ state: "unknown", points: 2, earned: null })).toBe("Not checked, not counted");
    expect(checkPoints({ state: "gap", points: 2, earned: null })).toBe("0 of 2 — missing");
    expect(pointsSentence(seen({ scored: 2 }), null)).toBeNull();
    expect(checkPoints({ state: "not_applicable", points: 3, earned: null })).toBe("Does not apply");
  });
  it("the good tone is explained in words when a check was not done", () => {
    expect(scoreToneNote(92, seen())).toMatch(/not done/);
    expect(scoreToneNote(92, seen({ unknown: 0 }))).toBeNull();
    expect(scoreToneNote(70, seen())).toBeNull();
  });
  it("a fix says what it adds", () => {
    expect(fixTitleWithPoints({ title: "Add photos", points: 2 })).toBe("Add photos (+2 points)");
    expect(fixTitleWithPoints({ title: "X", points: 1 })).toBe("X (+1 point)");
  });
  it("a health row is Fine only when ok", () => {
    expect(healthMark("ok")).toBe("Fine");
    expect(healthMark("unknown")).not.toBe("Fine");
    expect(healthMark("attention")).not.toBe("Fine");
  });
});
