import { describe, expect, it } from "vitest";
import { edgeFades, fadeMask, scrollTargetFor } from "./scroll-edges";

describe("edgeFades", () => {
  it("shows none when the strip fits", () => {
    expect(edgeFades(0, 500, 500)).toEqual({ start: false, end: false });
    expect(edgeFades(0, 500.5, 500)).toEqual({ start: false, end: false });
  });
  it("shows only the end at the start", () => {
    expect(edgeFades(0, 900, 500)).toEqual({ start: false, end: true });
  });
  it("shows both in the middle", () => {
    expect(edgeFades(100, 900, 500)).toEqual({ start: true, end: true });
  });
  it("shows only the start at the end, tolerating fractions", () => {
    expect(edgeFades(400, 900, 500)).toEqual({ start: true, end: false });
    expect(edgeFades(399.5, 900, 500)).toEqual({ start: true, end: false });
  });
});

describe("fadeMask", () => {
  it("is undefined with no fades", () => {
    expect(fadeMask({ start: false, end: false })).toBeUndefined();
  });
  it("fades only the requested sides", () => {
    expect(fadeMask({ start: true, end: false })).toContain("transparent, #000 32px, #000, #000");
    expect(fadeMask({ start: false, end: true })).toContain("#000 calc(100% - 32px), transparent");
  });
});

describe("scrollTargetFor", () => {
  it("leaves an item that is already comfortably visible", () => {
    expect(scrollTargetFor(200, 80, 100, 500, 900)).toBe(100);
  });
  it("scrolls left to keep a margin before the item", () => {
    expect(scrollTargetFor(120, 80, 100, 500, 900)).toBe(72);
  });
  it("scrolls right to keep a margin after the item", () => {
    expect(scrollTargetFor(480, 80, 0, 500, 900)).toBe(108);
  });
  it("clamps to the scrollable range", () => {
    expect(scrollTargetFor(10, 80, 100, 500, 900)).toBe(0);
    expect(scrollTargetFor(850, 50, 0, 500, 900)).toBe(400);
  });
});
