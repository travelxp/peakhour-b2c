import { describe, expect, it } from "vitest";
import { fabHiddenAfterScroll } from "./fab-visibility";

describe("fabHiddenAfterScroll", () => {
  it("hides on scrolling down", () => {
    expect(fabHiddenAfterScroll(100, 140, false, false)).toBe(true);
  });
  it("shows on scrolling up", () => {
    expect(fabHiddenAfterScroll(140, 100, true, false)).toBe(false);
  });
  it("keeps state for jitter below the threshold", () => {
    expect(fabHiddenAfterScroll(100, 103, true, false)).toBe(true);
    expect(fabHiddenAfterScroll(100, 97, false, false)).toBe(false);
  });
  it("is never hidden at the top (including overscroll)", () => {
    expect(fabHiddenAfterScroll(50, 0, true, false)).toBe(false);
    expect(fabHiddenAfterScroll(5, -20, true, false)).toBe(false);
  });
  it("is never hidden while the panel is open", () => {
    expect(fabHiddenAfterScroll(100, 400, false, true)).toBe(false);
    expect(fabHiddenAfterScroll(100, 400, true, true)).toBe(false);
  });
});
