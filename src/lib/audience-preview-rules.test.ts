import { describe, it, expect } from "vitest";
import { MAX_COUNTRIES, parseCountryCodes, unusableCountryTokens } from "./audience-preview-rules";

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

  it("caps at the limit both routes accept", () => {
    // ⚠️ This asserts the CLIENT's constant only. Nothing here can see either
    // route's zod, so if /propose regressed to 10 this would stay green — the
    // cross-check lives in the api's own tests, and saying so is better than
    // implying this file guards it.
    // The preview and the boost resolve the same audience from the same list.
    // While /propose capped at 10 and /boost at 25, confirming eleven countries
    // gave a 400 from one and a working campaign from the other — and this
    // test, asserting 25, certified the mismatch rather than catching it. Both
    // are 25 now.
    const many = Array.from({ length: 40 }, (_, i) =>
      String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)),
    ).join(",");
    expect(parseCountryCodes(many)).toHaveLength(25);
  });
});

describe("unusableCountryTokens — wired into the editor, not decorative", () => {
  it("★names what was dropped, which the editor shows", () => {
    // This was exported and imported by nobody, so the module's promise that a
    // silent loss is impossible was false: the UI dropped every unusable token
    // without a word. The editor now blocks on it or names it.
    expect(unusableCountryTokens("IN, India, SGP")).toEqual(["India", "SGP"]);
  });

  it("says nothing when everything was usable", () => {
    expect(unusableCountryTokens("IN, sg")).toEqual([]);
  });
});

describe("the distinction the editor has to make", () => {
  it("★an EMPTY box and an UNREADABLE box are different answers", () => {
    // Empty is "none of these", a real statement that produces an untargeted
    // campaign. "India" is somebody naming a country we could not read — and
    // treating them the same is how confirming an audience came to delete it.
    expect(parseCountryCodes("")).toEqual([]);
    expect(unusableCountryTokens("")).toEqual([]);

    expect(parseCountryCodes("India")).toEqual([]);
    expect(unusableCountryTokens("India")).toEqual(["India"]);
  });

  it("a full country name is DISTINGUISHABLE from an empty box", () => {
    // Both parse to [], and the editor must not treat them the same: empty is
    // "none of these", a real statement, while "India, Singapore" is somebody
    // naming countries we could not read. The parser cannot tell them apart on
    // its own — `unusableCountryTokens` is what the editor blocks on, and this
    // pins that the two inputs differ THERE.
    const typed = "India, Singapore";
    expect(parseCountryCodes(typed)).toEqual(parseCountryCodes(""));
    expect(unusableCountryTokens(typed)).not.toEqual(unusableCountryTokens(""));
  });

  it("★names the 26th country instead of dropping it", () => {
    // 26 well-formed codes are all "usable", so the unusable-token hint says
    // nothing — the editor has to block on the COUNT, or a country vanishes
    // with no word at all.
    const codes = Array.from({ length: 26 }, (_, i) =>
      String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)),
    );
    expect(unusableCountryTokens(codes.join(","))).toEqual([]);
    expect(parseCountryCodes(codes.join(","))).toHaveLength(MAX_COUNTRIES);
    expect(codes.length).toBeGreaterThan(MAX_COUNTRIES);
  });
});
