import { describe, it, expect } from "vitest";
import { parseCountryCodes, unusableCountryTokens } from "./audience-preview-rules";

describe("parseCountryCodes", () => {
  it("★a cleared box is 'none of these', not 'use your guess'", () => {
    // The api distinguishes an ABSENT geo from an EMPTY one. Returning
    // undefined here would hand the user back the inference they just deleted.
    expect(parseCountryCodes("")).toEqual([]);
    expect(parseCountryCodes("   ")).toEqual([]);
  });

  it("uppercases, dedupes and accepts spaces or commas", () => {
    expect(parseCountryCodes("in, sg IN,ae")).toEqual(["IN", "SG", "AE"]);
  });

  it("drops what the api would reject rather than sending it", () => {
    expect(parseCountryCodes("IN, India, S, SGP, AE")).toEqual(["IN", "AE"]);
  });

  it("caps at the server's own limit", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)),
    ).join(",");
    expect(parseCountryCodes(many)).toHaveLength(25);
  });
});

describe("unusableCountryTokens", () => {
  it("names what was dropped, so a silent loss is impossible", () => {
    expect(unusableCountryTokens("IN, India, SGP")).toEqual(["India", "SGP"]);
  });

  it("says nothing when everything was usable", () => {
    expect(unusableCountryTokens("IN, sg")).toEqual([]);
  });
});
