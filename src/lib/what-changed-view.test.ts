import { describe, expect, it } from "vitest";
import { draftButtonState, emptyNote, DRAFT_BUTTON_LABEL } from "./what-changed-view";

describe("the Draft this post button's price", () => {
  it("says the price in Peaks before anything runs, and may be pressed", () => {
    const s = draftButtonState({ state: "priced", peaks: 8, upTo: false });
    expect(s.label).toBe(`${DRAFT_BUTTON_LABEL} · 8 Peaks`);
    expect(s.enabled).toBe(true);
    expect(s.hint).toContain("8 Peaks");
    expect(s.hint).toContain("charged when the draft arrives");
    expect(s.hint).toContain("Nothing is posted");
  });
  it("never shows a currency", () => {
    const s = draftButtonState({ state: "priced", peaks: 1250, upTo: false });
    expect(s.label).not.toMatch(/[₹$£€]/);
    expect(s.label).toContain("1,250 Peaks");
  });
  it("a free action says Free", () => {
    expect(draftButtonState({ state: "free" })).toMatchObject({ label: `${DRAFT_BUTTON_LABEL} · Free`, enabled: true });
  });
  it("with no price in hand the button is off: nothing runs unquoted", () => {
    expect(draftButtonState({ state: "loading" })).toMatchObject({ label: DRAFT_BUTTON_LABEL, enabled: false, hint: "Checking the price…" });
    const unknown = draftButtonState({ state: "unknown" });
    expect(unknown.enabled).toBe(false);
    expect(unknown.label).not.toMatch(/Free|Peaks/);
  });
});

describe("the note when there is nothing to say", () => {
  it("says 'not enough history yet' with how far along it is", () => {
    expect(emptyNote({ state: "not_enough_history", measuredPosts: 1, needed: 3, name: "X" })).toBe(
      "Not enough history yet. We compare 3 or more posts with results from the last 28 days against the 28 before; you have 1 post so far.",
    );
    expect(emptyNote({ state: "not_enough_history", measuredPosts: 2, needed: 3, name: "X" })).toContain("2 posts so far");
  });
  it("steady is not the same as too little", () => {
    expect(emptyNote({ state: "steady", measuredPosts: 9, needed: 3, name: "LinkedIn" })).toBe("Nothing has changed enough on LinkedIn to mention.");
  });
});
