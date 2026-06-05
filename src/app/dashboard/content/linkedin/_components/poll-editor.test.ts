import { describe, it, expect } from "vitest";
import { emptyPoll, isPollValid, type PollState } from "./poll-editor";

describe("emptyPoll", () => {
  it("starts with two blank options and a default duration", () => {
    expect(emptyPoll()).toEqual({ question: "", options: ["", ""], duration: "SEVEN_DAYS" });
  });
});

describe("isPollValid", () => {
  const base: PollState = { question: "Best framework?", options: ["A", "B"], duration: "ONE_DAY" };

  it("accepts a question with 2 non-blank options", () => {
    expect(isPollValid(base)).toBe(true);
  });

  it("accepts up to 4 options", () => {
    expect(isPollValid({ ...base, options: ["A", "B", "C", "D"] })).toBe(true);
  });

  it("rejects an empty / whitespace-only question", () => {
    expect(isPollValid({ ...base, question: "" })).toBe(false);
    expect(isPollValid({ ...base, question: "   " })).toBe(false);
  });

  it("rejects a question longer than 140 chars", () => {
    expect(isPollValid({ ...base, question: "x".repeat(141) })).toBe(false);
    expect(isPollValid({ ...base, question: "x".repeat(140) })).toBe(true);
  });

  it("rejects fewer than 2 non-blank options (blanks dropped)", () => {
    expect(isPollValid({ ...base, options: ["A", "   "] })).toBe(false);
    expect(isPollValid({ ...base, options: ["A", ""] })).toBe(false);
  });

  it("rejects more than 4 options", () => {
    expect(isPollValid({ ...base, options: ["A", "B", "C", "D", "E"] })).toBe(false);
  });

  it("rejects an option longer than 30 chars", () => {
    expect(isPollValid({ ...base, options: ["A", "y".repeat(31)] })).toBe(false);
    expect(isPollValid({ ...base, options: ["A", "y".repeat(30)] })).toBe(true);
  });
});
