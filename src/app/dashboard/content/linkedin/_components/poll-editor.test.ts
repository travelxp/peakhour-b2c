import { describe, it, expect } from "vitest";
import { emptyPoll, isPollValid, type PollState } from "./poll-editor";

/** Build a PollState from plain option strings (the editor stores {id,text}). */
function pollFrom(question: string, options: string[]): PollState {
  return {
    question,
    options: options.map((text, i) => ({ id: `opt-${i}`, text })),
    duration: "ONE_DAY",
  };
}

describe("emptyPoll", () => {
  it("starts with two blank options (with ids) and a default duration", () => {
    const p = emptyPoll();
    expect(p.question).toBe("");
    expect(p.duration).toBe("SEVEN_DAYS");
    expect(p.options).toHaveLength(2);
    expect(p.options.every((o) => o.text === "")).toBe(true);
    // ids are present and distinct so React keys are stable across edits
    expect(p.options[0].id).not.toBe(p.options[1].id);
  });
});

describe("isPollValid", () => {
  it("accepts a question with 2 non-blank distinct options", () => {
    expect(isPollValid(pollFrom("Best framework?", ["A", "B"]))).toBe(true);
  });

  it("accepts up to 4 options", () => {
    expect(isPollValid(pollFrom("Q", ["A", "B", "C", "D"]))).toBe(true);
  });

  it("rejects an empty / whitespace-only question", () => {
    expect(isPollValid(pollFrom("", ["A", "B"]))).toBe(false);
    expect(isPollValid(pollFrom("   ", ["A", "B"]))).toBe(false);
  });

  it("rejects a question longer than 140 chars (140 ok)", () => {
    expect(isPollValid(pollFrom("x".repeat(141), ["A", "B"]))).toBe(false);
    expect(isPollValid(pollFrom("x".repeat(140), ["A", "B"]))).toBe(true);
  });

  it("rejects fewer than 2 non-blank options (blanks dropped)", () => {
    expect(isPollValid(pollFrom("Q", ["A", "   "]))).toBe(false);
    expect(isPollValid(pollFrom("Q", ["A", ""]))).toBe(false);
  });

  it("rejects more than 4 options", () => {
    expect(isPollValid(pollFrom("Q", ["A", "B", "C", "D", "E"]))).toBe(false);
  });

  it("rejects an option longer than 30 chars (30 ok, trim-before-length)", () => {
    expect(isPollValid(pollFrom("Q", ["A", "y".repeat(31)]))).toBe(false);
    expect(isPollValid(pollFrom("Q", ["A", "y".repeat(30)]))).toBe(true);
    // length is measured AFTER trimming
    expect(isPollValid(pollFrom("Q", ["A", "  " + "y".repeat(30) + "  "]))).toBe(true);
  });

  it("rejects duplicate options (case-insensitive, trimmed)", () => {
    expect(isPollValid(pollFrom("Q", ["Yes", "Yes"]))).toBe(false);
    expect(isPollValid(pollFrom("Q", ["Yes", " yes "]))).toBe(false);
    expect(isPollValid(pollFrom("Q", ["Yes", "No"]))).toBe(true);
  });
});
