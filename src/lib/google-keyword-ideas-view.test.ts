import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ApiError } from "@/lib/api";
import {
  GOOGLE_IDEA_ALREADY_ADDED,
  GOOGLE_IDEAS_ATTRIBUTION,
  GOOGLE_IDEAS_FIGURES_NOTE,
  GOOGLE_IDEAS_TITLE,
  googleIdeaBidRange,
  googleIdeaCompetitionLabel,
  googleIdeaSearchesSentence,
  googleIdeasMoreSentence,
  googleKeywordIdeasErrorMessage,
  ideaAddProblem,
  ideaAsKeyword,
  keywordIdeasRequest,
  parseSeedWords,
  sameIdeasRequest,
  seedWordsFromDraft,
} from "./google-keyword-ideas-view";
import { GOOGLE_DEFAULT_MATCH_TYPE, keywordKey, type TargetingDraft } from "./google-targeting-view";
import { formatGoogleMicros } from "./google-reports-view";

/**
 * ★★G-14g — Google's Keyword Ideas: labelled as Google's, kept apart from the
 * campaign's keywords, added only by the merchant at the match type they pick.
 */

const draft = (o: Partial<TargetingDraft> = {}): TargetingDraft => ({
  locations: [{ geoTargetConstant: "geoTargetConstants/2724", name: "Spain" }],
  radii: [],
  languages: [{ languageConstant: "languageConstants/1003", name: "Spanish" }],
  keywords: [
    { text: "linen shirts", matchType: "PHRASE", resourceName: "customers/1234567890/adGroupCriteria/1~2" },
    { text: "summer linen", matchType: "EXACT" },
  ],
  negativeKeywords: [{ text: "cheap", matchType: "BROAD" }],
  ...o,
});

const keys = (d: TargetingDraft) => new Set(d.keywords.map(keywordKey));
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const SECTION = "../app/(site)/dashboard/ads/_components/google-keyword-ideas-section.tsx";
const DIALOG = "../app/(site)/dashboard/ads/_components/google-targeting-dialog.tsx";

describe("★★Google's label, and ideas kept apart from ours", () => {
  it("★the title and attribution name Google, and say an idea is not a keyword until added", () => {
    expect(GOOGLE_IDEAS_TITLE).toBe("Keyword ideas from Google");
    expect(GOOGLE_IDEAS_ATTRIBUTION).toMatch(/^Suggested by Google Ads Keyword Planner, not by Peakhour\./);
    expect(GOOGLE_IDEAS_ATTRIBUTION).toMatch(/not one of your keywords until you add it/);
  });
  it("★★the section renders the label, the attribution and the figures note — where shown, not in an import", () => {
    const section = read(SECTION);
    for (const name of ["GOOGLE_IDEAS_TITLE", "GOOGLE_IDEAS_ATTRIBUTION", "GOOGLE_IDEAS_FIGURES_NOTE"]) {
      expect(section.match(new RegExp(`\\{${name}\\}`, "g"))?.length, name).toBe(1);
    }
    expect(section).toContain('<Badge variant="outline">Google Ads</Badge>');
  });
  it("★★the section never writes the keyword list itself: it only hands a pick to onPick", () => {
    const section = read(SECTION);
    expect(section).not.toMatch(/setTargeting|setKeywordStatus|keywords:\s*\[/);
    expect(section).toContain("onPick(ideaAsKeyword(idea, matchType))");
    // Google is reached only through the client, and only on the merchant's click (a mutation, never a query).
    expect(section).toContain("googleAdsApi.getKeywordIdeas(campaignId, input)");
    expect(section).toContain("ask.mutate(request.input)");
    expect(section).not.toMatch(/useQuery|useEffect/);
  });
  it("★★the targeting step only imports and mounts it, once, in its Search part", () => {
    const dialog = read(DIALOG);
    expect(dialog).toContain('import { GoogleKeywordIdeasSection } from "./google-keyword-ideas-section";');
    expect(dialog.match(/<GoogleKeywordIdeasSection\b/g)?.length).toBe(1);
    expect(dialog.indexOf("<GoogleKeywordIdeasSection")).toBeGreaterThan(dialog.indexOf("{search ? ("));
    expect(dialog).not.toContain("getKeywordIdeas");
  });
});

describe("★★D12 — Google's figures are Google's, as Google gives them, never a forecast", () => {
  it("★the average is attributed to Google and said as an average", () => {
    expect(googleIdeaSearchesSentence({ avgMonthlySearches: 1300 })).toBe("Google: about 1,300 searches a month (12-month average)");
    expect(googleIdeaSearchesSentence({ avgMonthlySearches: 1 })).toBe("Google: about 1 search a month (12-month average)");
    expect(googleIdeaSearchesSentence({ avgMonthlySearches: 0 })).toBe("Google: about 0 searches a month (12-month average)");
  });
  it("★absent is never zero: no figure, no sentence", () => {
    expect(googleIdeaSearchesSentence({})).toBeNull();
    expect(googleIdeaCompetitionLabel({})).toBeNull();
    expect(googleIdeaBidRange({ lowTopOfPageBidMicros: 310000 }, "EUR")).toBeNull();
  });
  it("★competition is Google's bucket, named as Google's", () => {
    expect(googleIdeaCompetitionLabel({ competition: "LOW" })).toBe("Google competition: low");
    expect(googleIdeaCompetitionLabel({ competition: "HIGH" })).toBe("Google competition: high");
  });
  it("the bid range is Google's 20th–80th percentile, in the account's currency", () => {
    // The panel's own micros formatter (review round 1), so it says Google's money as the reports do.
    for (const currency of ["EUR", undefined, "XYZ"]) {
      expect(googleIdeaBidRange({ lowTopOfPageBidMicros: 310000, highTopOfPageBidMicros: 1120000 }, currency)).toBe(
        `Google top-of-page bid: ${formatGoogleMicros(310000, currency)}–${formatGoogleMicros(1120000, currency)}`,
      );
    }
    // ★And what it says, not only that it matches itself (review round 2).
    expect(googleIdeaBidRange({ lowTopOfPageBidMicros: 310000, highTopOfPageBidMicros: 1120000 }, "EUR")).toMatch(/^Google top-of-page bid: €0\.31–€1\.12$/);
    expect(googleIdeaBidRange({ lowTopOfPageBidMicros: 310000, highTopOfPageBidMicros: 1120000 }, undefined)).toBe("Google top-of-page bid: 0.31–1.12");
  });
  it("★no copy claims reach, an audience, or a forecast for the campaign", () => {
    for (const s of [GOOGLE_IDEAS_ATTRIBUTION, googleIdeaSearchesSentence({ avgMonthlySearches: 50 })!, googleIdeaCompetitionLabel({ competition: "MEDIUM" })!]) {
      expect(s).not.toMatch(/reach|audience|people|will get|forecast|estimate/i);
    }
    expect(GOOGLE_IDEAS_FIGURES_NOTE).toMatch(/Google's history/);
    expect(GOOGLE_IDEAS_FIGURES_NOTE).toMatch(/They are not a forecast for this campaign\.$/);
    expect(GOOGLE_IDEAS_FIGURES_NOTE).not.toMatch(/reach|audience|people/i);
  });
});

describe("★★a picked idea becomes a keyword at the merchant's match type", () => {
  it("★PHRASE is the default pick; BROAD only when the merchant picks it", () => {
    expect(GOOGLE_DEFAULT_MATCH_TYPE).toBe("PHRASE");
    expect(ideaAsKeyword({ text: " linen  shirts men " }, GOOGLE_DEFAULT_MATCH_TYPE)).toEqual({ text: "linen shirts men", matchType: "PHRASE" });
    expect(ideaAsKeyword({ text: "linen shirts men" }, "BROAD")).toEqual({ text: "linen shirts men", matchType: "BROAD" });
    expect(ideaAsKeyword({ text: "linen shirts men" }, "EXACT")).toEqual({ text: "linen shirts men", matchType: "EXACT" });
    // The section starts every row at the default and keeps the merchant's choice per idea.
    expect(read(SECTION)).toContain("matchTypes[pickKey] ?? GOOGLE_DEFAULT_MATCH_TYPE");
  });
  it("★it joins through the targeting step's own list (and so its Save), de-duplicated", () => {
    const dialog = read(DIALOG);
    expect(dialog).toContain("onPick={(k) => edit((d) => (d.keywords.some((x) => keywordKey(x) === keywordKey(k)) ? d : { ...d, keywords: [...d.keywords, k] }))}");
  });
  it("★already in the list at that match type is said, and the same words at another match type are not", () => {
    expect(ideaAddProblem({ text: "Linen shirts" }, "PHRASE", draft(), keys(draft()))).toBe(GOOGLE_IDEA_ALREADY_ADDED);
    expect(ideaAddProblem({ text: "linen shirts" }, "EXACT", draft(), keys(draft()))).toBeNull();
  });
  it("★the step's keyword rules apply to an idea too", () => {
    expect(ideaAddProblem({ text: "one two three four five six seven eight nine ten eleven" }, "PHRASE", draft(), keys(draft()))).toMatch(/at most 10 words/);
    expect(ideaAddProblem({ text: `"linen"` }, "PHRASE", draft(), keys(draft()))).toMatch(/brackets and quotation marks/);
  });
  it("one paused in Google Ads is not added again", () => {
    expect(ideaAddProblem({ text: "linen" }, "BROAD", draft(), keys(draft()), new Set(["BROAD:linen"]))).toMatch(/Paused in Google Ads/);
  });
  it("★one a campaign negative would silence is said on its row (review round 1), not only once Save is blocked", () => {
    // The fixture's BROAD negative "cheap" silences any keyword containing it.
    expect(ideaAddProblem({ text: "cheap linen shirts" }, "PHRASE", draft(), keys(draft()))).toBe("Your negative keyword “cheap” would stop it from ever showing.");
    expect(ideaAddProblem({ text: "linen shirts men" }, "PHRASE", draft(), keys(draft()))).toBeNull();
  });
});

describe("★the request: the merchant's words or page, the campaign's places and language", () => {
  it("★the words start from the campaign's own keywords, folded, de-duplicated, at most 20", () => {
    expect(seedWordsFromDraft(draft())).toBe("linen shirts, summer linen");
    const many = draft({ keywords: Array.from({ length: 25 }, (_, i) => ({ text: `w${i}`, matchType: "PHRASE" as const })) });
    expect(parseSeedWords(seedWordsFromDraft(many))).toHaveLength(20);
    expect(parseSeedWords("Linen, linen ,\n summer   linen,,")).toEqual(["Linen", "summer linen"]);
  });
  it("★places are the campaign's locations, at most 10; the language is the one picked", () => {
    const locations = Array.from({ length: 12 }, (_, i) => ({ geoTargetConstant: `geoTargetConstants/${i + 1}` }));
    const r = keywordIdeasRequest({ words: "linen", url: " https://linen.example/ ", language: "languageConstants/1003" }, draft({ locations }));
    expect(r.input).toEqual({
      keywords: ["linen"],
      url: "https://linen.example/",
      language: "languageConstants/1003",
      geoTargetConstants: locations.slice(0, 10).map((l) => l.geoTargetConstant),
    });
    expect(r.placesNote).toBe("Google takes 10 locations for ideas, so these use the first 10 of yours.");
    expect(r.problem).toBeNull();
  });
  it("PASS: any language and one location: no language sent, no note", () => {
    const r = keywordIdeasRequest({ words: "linen", url: "", language: "" }, draft());
    expect(r.input).toEqual({ keywords: ["linen"], geoTargetConstants: ["geoTargetConstants/2724"] });
    expect(r.placesNote).toBeNull();
  });
  it("a radius is not a place Google's ideas take, and that is said", () => {
    const r = keywordIdeasRequest({ words: "linen", url: "", language: "" }, draft({ locations: [], radii: [{ radius: 5, radiusUnits: "KILOMETERS", address: { cityName: "Madrid", countryCode: "ES" } }] }));
    expect(r.input.geoTargetConstants).toEqual([]);
    expect(r.placesNote).toMatch(/locations, not a radius/);
  });
  it("★the 80 is counted as the api counts it, in UTF-16 units (review round 2)", () => {
    const astral = "\u{1F9F5}".repeat(41); // 41 code points, 82 units
    expect(keywordIdeasRequest({ words: astral, url: "", language: "" }, draft()).problem).toMatch(/at most 80 characters/);
  });
  it("★a phrase over the api's 80 characters is said here, not as the api's Invalid body (review round 1)", () => {
    expect(keywordIdeasRequest({ words: "x".repeat(81), url: "", language: "" }, draft()).problem).toMatch(/at most 80 characters/);
    expect(keywordIdeasRequest({ words: "x".repeat(80), url: "", language: "" }, draft()).problem).toBeNull();
  });
  it("★the list says when it answers an earlier request, and when Google has more than it shows (review round 1)", () => {
    const now = { keywords: ["linen"], geoTargetConstants: ["geoTargetConstants/2", "geoTargetConstants/1"] };
    expect(sameIdeasRequest({ keywords: ["Linen"], geoTargetConstants: ["geoTargetConstants/1", "geoTargetConstants/2"] }, now)).toBe(true);
    expect(sameIdeasRequest({ keywords: ["wool"], geoTargetConstants: now.geoTargetConstants }, now)).toBe(false);
    expect(sameIdeasRequest({ ...now, language: "languageConstants/1000" }, now)).toBe(false);
    expect(sameIdeasRequest(undefined, now)).toBe(false);
    expect(googleIdeasMoreSentence(100, 2400)).toBe("Google has 2,400 ideas for these; here are its first 100. Narrow the words or the page for others.");
    expect(googleIdeasMoreSentence(40, 40)).toBeNull();
    expect(googleIdeasMoreSentence(40, undefined)).toBeNull();
  });
  it("★nothing to start from, or too many words, can't be sent", () => {
    expect(keywordIdeasRequest({ words: " , ", url: " ", language: "" }, draft()).problem).toMatch(/some words or a page/);
    expect(keywordIdeasRequest({ words: Array.from({ length: 21 }, (_, i) => `w${i}`).join(","), url: "", language: "" }, draft()).problem).toMatch(/at most 20/);
    expect(keywordIdeasRequest({ words: "", url: "linen.example", language: "" }, draft()).problem).toBeNull();
  });
});

describe("★★an access refusal is readable", () => {
  it.each([
    ["KEYWORD_IDEAS_NOT_AVAILABLE", 403, "Google Ads hasn't given Peakhour access to Keyword Planner ideas yet. Your own keywords still work — add them above."],
    ["KEYWORD_IDEAS_THROTTLED", 429, "Google takes a limited number of keyword-idea requests for an account. Try again in 8 seconds."],
    ["KEYWORD_IDEAS_URL_UNREADABLE", 422, "Google Ads couldn't read that page for ideas. Check the address, or start from words instead."],
  ])("★%s is shown as the api says it", (code, status, message) => {
    expect(googleKeywordIdeasErrorMessage(new ApiError(code, message, status), "fallback")).toBe(message);
  });
  it("★a row the api cannot read says contact support, not try again (review round 2)", () => {
    const msg = "This campaign's Google Ads account can't be read, so we can't ask for ideas. Contact support.";
    expect(googleKeywordIdeasErrorMessage(new ApiError("CAMPAIGN_UNREADABLE", msg, 409), "fallback")).toBe(msg);
  });
  it("★a stale list cannot be added from", () => {
    expect(read(SECTION)).toContain("disabled={disabled || stale || !!problem}");
  });
  it("PASS: the panel's own codes still read through, and an unknown one is the fallback", () => {
    expect(googleKeywordIdeasErrorMessage(new ApiError("NOT_SEARCH", "Keyword ideas are for Search campaigns, which have keywords.", 409), "fallback")).toBe(
      "Keyword ideas are for Search campaigns, which have keywords.",
    );
    expect(googleKeywordIdeasErrorMessage(new ApiError("SOMETHING_ELSE", "internal detail", 500), "fallback")).toBe("fallback");
    expect(googleKeywordIdeasErrorMessage(new Error("network"), "fallback")).toBe("fallback");
  });
});
