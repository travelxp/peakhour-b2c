import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import type { GoogleCampaignTargeting } from "@/lib/api/google-ads";
import {
  GOOGLE_DEFAULT_MATCH_TYPE,
  GOOGLE_MATCH_TYPES,
  draftFromRead,
  googleAddressProblem,
  googleKeywordProblem,
  googleRadiusLabel,
  googleRadiusProblem,
  googleStartTargetingHint,
  googleTargetingDescription,
  googleTargetingProblem,
  keywordCriterionId,
  pausedOf,
  targetingInputFromDraft,
  type TargetingDraft,
} from "./google-targeting-view";

/**
 * ★★G-14a — the targeting step's words and rules (RMF C.20, C.30, C.260,
 * C.270, C.300, M.140). Pure, so each decision is pinned here; the dialog only
 * renders them.
 */

const C = "customers/1234567890";
const MADRID = { latitudeInMicroDegrees: 40416775, longitudeInMicroDegrees: -3703790 };
const READ: GoogleCampaignTargeting = {
  locations: [
    { resourceName: `${C}/campaignCriteria/222~1`, status: "ENABLED", geoTargetConstant: "geoTargetConstants/2724", name: "Spain" },
    { resourceName: `${C}/campaignCriteria/222~2`, status: "PAUSED", geoTargetConstant: "geoTargetConstants/2250" },
  ],
  radii: [{ resourceName: `${C}/campaignCriteria/222~5`, status: "ENABLED", geoPoint: MADRID, radius: 10, radiusUnits: "KILOMETERS", address: { cityName: "Madrid", countryCode: "ES" } }],
  languages: [{ resourceName: `${C}/campaignCriteria/222~3`, status: "ENABLED", languageConstant: "languageConstants/1003", name: "Spanish" }],
  keywords: [
    { resourceName: `${C}/adGroupCriteria/333~10`, status: "ENABLED", text: "linen shirts", matchType: "EXACT" },
    { resourceName: `${C}/adGroupCriteria/333~11`, status: "PAUSED", text: "linen", matchType: "BROAD" },
  ],
  negativeKeywords: [{ resourceName: `${C}/campaignCriteria/222~7`, status: "ENABLED", text: "free", matchType: "PHRASE" }],
};

describe("★★C.300 — every match type, BROAD only when picked", () => {
  it("offers all three of Google's match types", () => {
    expect(GOOGLE_MATCH_TYPES.map((m) => m.value).sort()).toEqual(["BROAD", "EXACT", "PHRASE"]);
  });
  it("★★the control starts on PHRASE, never BROAD", () => {
    expect(GOOGLE_DEFAULT_MATCH_TYPE).toBe("PHRASE");
    expect(GOOGLE_MATCH_TYPES[0]!.value).toBe("PHRASE");
  });
  it("★BROAD says it is the widest", () => {
    expect(GOOGLE_MATCH_TYPES.find((m) => m.value === "BROAD")!.hint).toMatch(/widest/);
  });
  it("★the dialog's control is seeded from the default, so BROAD is sent only after a pick", () => {
    const dialog = readFileSync("src/app/(site)/dashboard/ads/_components/google-targeting-dialog.tsx", "utf8");
    expect(dialog).toContain("useState<GoogleMatchType>(GOOGLE_DEFAULT_MATCH_TYPE)");
    expect(dialog).not.toMatch(/useState<GoogleMatchType>\("BROAD"\)/);
  });
});

describe("★the api's own bounds, said before sending", () => {
  it("keyword text: brackets, quotes, length and words", () => {
    expect(googleKeywordProblem("linen shirts")).toBeNull();
    expect(googleKeywordProblem("  ")).toMatch(/Type a keyword/);
    expect(googleKeywordProblem("[linen]")).toMatch(/match type instead/);
    expect(googleKeywordProblem("x".repeat(80))).toMatch(/79 characters/);
    expect(googleKeywordProblem("x".repeat(79))).toBeNull();
    expect(googleKeywordProblem("a b c d e f g h i j k")).toMatch(/10 words/);
  });
  it("★a radius of at least 1 km, in either unit", () => {
    expect(googleRadiusProblem(1, "KILOMETERS")).toBeNull();
    expect(googleRadiusProblem(0.9, "KILOMETERS")).toMatch(/at least 1 km/);
    expect(googleRadiusProblem(1, "MILES")).toBeNull();
    expect(googleRadiusProblem(0.5, "MILES")).toMatch(/at least 1 km/);
    expect(googleRadiusProblem(Number.NaN, "KILOMETERS")).toMatch(/number/);
  });
  it("an address needs a country and a city, postal code or street", () => {
    expect(googleAddressProblem({ cityName: "Madrid", countryCode: "ES" })).toBeNull();
    expect(googleAddressProblem({ postalCode: "28001", countryCode: "es" })).toBeNull();
    expect(googleAddressProblem({ cityName: "Madrid" })).toMatch(/country code/);
    expect(googleAddressProblem({ countryCode: "ES" })).toMatch(/city, postal code or street/);
  });
});

describe("★★the working copy: ENABLED only, paused shown apart", () => {
  it("★keeps each kept radius's POINT, so a save does not delete it", () => {
    const d = draftFromRead(READ);
    expect(d.radii).toEqual([{ geoPoint: MADRID, address: { cityName: "Madrid", countryCode: "ES" }, radius: 10, radiusUnits: "KILOMETERS" }]);
    expect(targetingInputFromDraft(d, "SEARCH").radii[0]!.geoPoint).toEqual(MADRID);
  });
  it("★★a PAUSED criterion is not in the copy (the api refuses a save naming one) and is counted apart", () => {
    const d = draftFromRead(READ);
    expect(d.locations.map((l) => l.geoTargetConstant)).toEqual(["geoTargetConstants/2724"]);
    expect(d.keywords.map((k) => k.text)).toEqual(["linen shirts"]);
    const p = pausedOf(READ);
    expect(p.places).toBe(1);
    expect(p.keywords.map((k) => k.text)).toEqual(["linen"]);
  });
  it("keeps the keyword's resource name for its own controls", () => {
    expect(draftFromRead(READ).keywords[0]!.resourceName).toBe(`${C}/adGroupCriteria/333~10`);
    expect(keywordCriterionId(`${C}/adGroupCriteria/333~10`)).toBe("333~10");
    expect(keywordCriterionId(`${C}/campaignCriteria/222~7`)).toBeNull();
  });
});

describe("★★the save's body", () => {
  it("★Search: places, keywords and EVERY negative, with names for the ids", () => {
    expect(targetingInputFromDraft(draftFromRead(READ), "SEARCH")).toEqual({
      locations: ["geoTargetConstants/2724"],
      radii: [{ geoPoint: MADRID, address: { cityName: "Madrid", countryCode: "ES" }, radius: 10, radiusUnits: "KILOMETERS" }],
      languages: ["languageConstants/1003"],
      keywords: [{ text: "linen shirts", matchType: "EXACT" }],
      negativeKeywords: [{ text: "free", matchType: "PHRASE" }],
      labels: { "geoTargetConstants/2724": "Spain", "languageConstants/1003": "Spanish" },
    });
  });
  it("★an empty negatives list is still sent — it is the whole of them", () => {
    const d = { ...draftFromRead(READ), negativeKeywords: [] };
    expect(targetingInputFromDraft(d, "SEARCH").negativeKeywords).toEqual([]);
  });
  it.each([["PERFORMANCE_MAX" as const], ["DEMAND_GEN" as const]])("★%s: places only — no keyword or negative is sent", (t) => {
    const body = targetingInputFromDraft(draftFromRead(READ), t);
    expect(body).not.toHaveProperty("keywords");
    expect(body).not.toHaveProperty("negativeKeywords");
  });
  it("keyword text is space-folded as the api folds it", () => {
    const d: TargetingDraft = { ...draftFromRead(READ), keywords: [{ text: "  linen   shirts ", matchType: "BROAD" }] };
    expect(targetingInputFromDraft(d, "SEARCH").keywords).toEqual([{ text: "linen shirts", matchType: "BROAD" }]);
  });
});

describe("★★what can't be saved yet — the conditions Google refuses to start without", () => {
  const base = draftFromRead(READ);
  it("PASS: the read itself saves", () => expect(googleTargetingProblem(base, "SEARCH")).toBeNull());
  it("★no location and no radius, for every type", () => {
    for (const t of ["SEARCH", "PERFORMANCE_MAX", "DEMAND_GEN"] as const) {
      expect(googleTargetingProblem({ ...base, locations: [], radii: [] }, t)).toMatch(/every country/);
    }
  });
  it("★a radius alone is a place", () => {
    expect(googleTargetingProblem({ ...base, locations: [] }, "SEARCH")).toBeNull();
  });
  it("★Search with no keyword; the other types need none", () => {
    expect(googleTargetingProblem({ ...base, keywords: [] }, "SEARCH")).toMatch(/at least one keyword/);
    expect(googleTargetingProblem({ ...base, keywords: [] }, "PERFORMANCE_MAX")).toBeNull();
    expect(googleTargetingProblem({ ...base, keywords: [] }, "DEMAND_GEN")).toBeNull();
  });
  it("★a word both bought and excluded", () => {
    expect(googleTargetingProblem({ ...base, negativeKeywords: [{ text: "Linen Shirts", matchType: "BROAD" }] }, "SEARCH")).toMatch(/both a keyword and a negative keyword/);
  });
});

describe("words", () => {
  it("a radius in words, by address or by point", () => {
    expect(googleRadiusLabel({ radius: 10, radiusUnits: "KILOMETERS", address: { cityName: "Madrid", countryCode: "ES" } })).toBe("10 km around Madrid, ES");
    expect(googleRadiusLabel({ radius: 1, radiusUnits: "MILES", geoPoint: MADRID })).toBe("1 mile around 40.4168, -3.7038");
  });
  it("★★the start confirmation names the step that exists — no dead 'Audience step' pointer", () => {
    for (const t of ["SEARCH", "PERFORMANCE_MAX", "DEMAND_GEN"] as const) {
      expect(googleStartTargetingHint(t)).toMatch(/with Targeting on this campaign first/);
      expect(googleStartTargetingHint(t)).not.toMatch(/Audience step/);
    }
    expect(googleStartTargetingHint("SEARCH")).toMatch(/location or keyword/);
    expect(googleStartTargetingHint("DEMAND_GEN")).toMatch(/takes no keywords/);
    const panel = readFileSync("src/app/(site)/dashboard/ads/_components/google-ads-panel.tsx", "utf8");
    expect(panel).not.toMatch(/Audience step/);
    // ★The step the hint names is mounted on the panel's rows.
    expect(panel).toContain("<GoogleTargetingDialog");
    expect(panel).toMatch(/>\s*Targeting\s*</);
  });
  it("★the description claims no audience and no reach", () => {
    for (const t of ["SEARCH", "PERFORMANCE_MAX", "DEMAND_GEN"] as const) {
      expect(googleTargetingDescription(t)).not.toMatch(/reach|audience|people|who/i);
      expect(googleTargetingDescription(t)).toMatch(/starts nothing/);
    }
  });
});
