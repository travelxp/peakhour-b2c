import type {
  GoogleCampaignTargeting,
  GoogleChannelType,
  GoogleGeoPoint,
  GoogleMatchType,
  GoogleRadiusAddress,
  GoogleRadiusUnit,
  GoogleTargetingInput,
} from "@/lib/api/google-ads";

/**
 * ★★G-14a — what the Google panel's targeting step SAYS and DECIDES, kept pure
 * so every sentence and rule is tested (`google-targeting-view.test.ts`).
 *
 * The step sets what Google refuses to start a campaign without: a location
 * or radius for every type, and for Search a keyword (peakhour-api
 * `updateCampaignStatus`: `no_targeting`, `no_keywords`). Search also takes
 * negative keywords and every match type. The bounds below mirror the api's
 * own (`adapters/ads/google-criteria.ts`), so a value the api would refuse is
 * said here before anything is sent.
 *
 * ★BROAD IS THE MERCHANT'S PICK: the match-type control defaults to PHRASE,
 * and BROAD is sent only when it is chosen.
 */

// ── match types ──────────────────────────────────────────────────────────

/** Every KeywordMatchType Google has, in the order the control lists them. PHRASE is the default pick. */
export const GOOGLE_MATCH_TYPES: ReadonlyArray<{ value: GoogleMatchType; label: string; hint: string }> = [
  { value: "PHRASE", label: "Phrase", hint: "Searches that contain these words in this order." },
  { value: "EXACT", label: "Exact", hint: "Searches with the same meaning as these words." },
  { value: "BROAD", label: "Broad", hint: "Searches Google judges related to these words — the widest, and usually the costliest." },
];
export const GOOGLE_DEFAULT_MATCH_TYPE: GoogleMatchType = "PHRASE";

export function googleMatchTypeLabel(t: string): string {
  return GOOGLE_MATCH_TYPES.find((m) => m.value === t)?.label ?? t;
}

// ── the api's own bounds ─────────────────────────────────────────────────

/** KeywordInfo: "at most 80 characters and 10 words"; the api keeps to 79, which both readings allow. */
export const GOOGLE_KEYWORD_MAX_CHARS = 79;
export const GOOGLE_KEYWORD_MAX_WORDS = 10;
/** Google Ads Help: "Radius targeting requires setting a radius of at least 1 km around any given location." */
export const GOOGLE_RADIUS_MIN_KM = 1;
const KM_PER_MILE = 1.609344;

/** A keyword's text, space-folded as the api folds it. */
export function foldKeyword(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** Why the api would refuse this keyword text, or null. The api's `checkKeywordText`. */
export function googleKeywordProblem(raw: string): string | null {
  const text = foldKeyword(raw);
  if (!text) return "Type a keyword first.";
  if (/[[\]"\u0000-\u001f]/.test(text)) return "Leave out brackets and quotation marks — pick the match type instead.";
  if ([...text].length > GOOGLE_KEYWORD_MAX_CHARS) return `A keyword is at most ${GOOGLE_KEYWORD_MAX_CHARS} characters.`;
  if (text.split(" ").length > GOOGLE_KEYWORD_MAX_WORDS) return `A keyword is at most ${GOOGLE_KEYWORD_MAX_WORDS} words.`;
  return null;
}

/** Why the api would refuse this radius, or null. */
export function googleRadiusProblem(radius: number, unit: GoogleRadiusUnit): string | null {
  if (!Number.isFinite(radius)) return "Enter the radius as a number.";
  const km = unit === "MILES" ? radius * KM_PER_MILE : radius;
  if (km < GOOGLE_RADIUS_MIN_KM) return "Google takes a radius of at least 1 km (about 0.62 miles).";
  return null;
}

/** Why an address can't be placed by Google, or null: a country and a city, postal code or street. */
export function googleAddressProblem(a: GoogleRadiusAddress): string | null {
  const country = a.countryCode?.trim() ?? "";
  if (!/^[A-Za-z]{2}$/.test(country)) return "Enter the two-letter country code (for example ES).";
  if (!a.cityName?.trim() && !a.postalCode?.trim() && !a.streetAddress?.trim()) return "Enter a city, postal code or street for the centre of the radius.";
  return null;
}

// ── the step's working copy ──────────────────────────────────────────────

export interface DraftKeyword {
  text: string;
  matchType: GoogleMatchType;
  /** Set for a keyword Google already holds; absent for one added in this session. */
  resourceName?: string;
}
export interface DraftRadius {
  geoPoint?: GoogleGeoPoint;
  address?: GoogleRadiusAddress;
  radius: number;
  radiusUnits: GoogleRadiusUnit;
}
export interface TargetingDraft {
  locations: Array<{ geoTargetConstant: string; name?: string }>;
  radii: DraftRadius[];
  languages: Array<{ languageConstant: string; name?: string }>;
  keywords: DraftKeyword[];
  negativeKeywords: DraftKeyword[];
}

const asMatchType = (t: string): GoogleMatchType => (t === "EXACT" || t === "BROAD" ? t : "PHRASE");
const asUnit = (u: string): GoogleRadiusUnit => (u === "MILES" ? "MILES" : "KILOMETERS");

/**
 * The editable copy of what Google holds: ENABLED criteria only. ★A PAUSED ONE
 * IS NOT IN IT: a save leaves a paused criterion as it is (the api never
 * re-enables one, and refuses a save that names it), so it is shown apart,
 * with its own controls (`pausedOf`).
 */
export function draftFromRead(t: GoogleCampaignTargeting): TargetingDraft {
  const on = <T extends { status: string }>(xs: T[]) => xs.filter((x) => x.status === "ENABLED");
  return {
    locations: on(t.locations).map((l) => ({ geoTargetConstant: l.geoTargetConstant, ...(l.name ? { name: l.name } : {}) })),
    radii: on(t.radii).map((r) => ({
      ...(r.geoPoint ? { geoPoint: r.geoPoint } : {}),
      ...(r.address ? { address: r.address } : {}),
      radius: r.radius,
      radiusUnits: asUnit(r.radiusUnits),
    })),
    languages: on(t.languages).map((l) => ({ languageConstant: l.languageConstant, ...(l.name ? { name: l.name } : {}) })),
    keywords: on(t.keywords).map((k) => ({ text: k.text, matchType: asMatchType(k.matchType), resourceName: k.resourceName })),
    negativeKeywords: on(t.negativeKeywords).map((k) => ({ text: k.text, matchType: asMatchType(k.matchType), resourceName: k.resourceName })),
  };
}

/**
 * What Google holds PAUSED: left alone by a save. Keywords among them can be
 * enabled or removed one by one. ★AND WHAT MAY NOT BE ADDED BACK (review round
 * 1): the api refuses a save naming a paused criterion, so the step blocks
 * adding one again (`ids`, `keywordKeys`, `negativeKeys`) and says why.
 */
export function pausedOf(t: GoogleCampaignTargeting) {
  const off = <T extends { status: string }>(xs: T[]) => xs.filter((x) => x.status !== "ENABLED");
  return {
    places: [...off(t.locations), ...off(t.radii), ...off(t.languages)].length,
    keywords: off(t.keywords),
    negativeKeywords: off(t.negativeKeywords),
    ids: new Set<string>([...off(t.locations).map((l) => l.geoTargetConstant), ...off(t.languages).map((l) => l.languageConstant)]),
    keywordKeys: new Set(off(t.keywords).map(keywordKey)),
    negativeKeys: new Set(off(t.negativeKeywords).map(keywordKey)),
  };
}

/** One radius's identity on screen: the same address (or point), radius and unit is the same radius (the api refuses it twice). */
export function radiusKey(r: DraftRadius): string {
  const a = r.address ?? {};
  const where = r.geoPoint
    ? `${r.geoPoint.latitudeInMicroDegrees},${r.geoPoint.longitudeInMicroDegrees}`
    : [a.streetAddress, a.cityName, a.postalCode, a.provinceCode, a.provinceName, a.countryCode].map((x) => (x ?? "").toLowerCase()).join("|");
  return `${where}:${r.radius}:${r.radiusUnits}`;
}

/** The save's toast. A recorded audience that Google takes as signals is said so; places are limits either way. */
export function googleTargetingSavedSentence(res: { targetingApplied?: boolean }): string {
  return res.targetingApplied === false
    ? "Targeting saved on Google Ads. The locations and languages are limits; the campaign's audience signals are hints Google may look past."
    : "Targeting saved on Google Ads.";
}

export const isSearch = (t: GoogleChannelType | undefined): boolean => t !== "PERFORMANCE_MAX" && t !== "DEMAND_GEN";

/** One keyword's identity, as the api compares two (case- and space-folded, match type included). */
export function keywordKey(k: { text: string; matchType: string }): string {
  return `${k.matchType}:${foldKeyword(k.text).toLowerCase()}`;
}

/**
 * The save's body. Search sends its keywords and ALL its negatives (the step
 * shows every one, so its list is the whole of them); the other types send
 * places only.
 */
export function targetingInputFromDraft(d: TargetingDraft, channelType: GoogleChannelType | undefined): GoogleTargetingInput {
  const labels: Record<string, string> = {};
  for (const l of d.locations) if (l.name) labels[l.geoTargetConstant] = l.name;
  for (const l of d.languages) if (l.name) labels[l.languageConstant] = l.name;
  return {
    locations: d.locations.map((l) => l.geoTargetConstant),
    radii: d.radii.map((r) => ({ ...(r.geoPoint ? { geoPoint: r.geoPoint } : {}), ...(r.address ? { address: r.address } : {}), radius: r.radius, radiusUnits: r.radiusUnits })),
    languages: d.languages.map((l) => l.languageConstant),
    ...(isSearch(channelType)
      ? {
          keywords: d.keywords.map((k) => ({ text: foldKeyword(k.text), matchType: k.matchType })),
          negativeKeywords: d.negativeKeywords.map((k) => ({ text: foldKeyword(k.text), matchType: k.matchType })),
        }
      : {}),
    ...(Object.keys(labels).length > 0 ? { labels } : {}),
  };
}

/**
 * Why the step can't be saved yet, or null. ★THE SAME TWO CONDITIONS GOOGLE
 * REFUSES TO START A CAMPAIGN WITHOUT, said while the merchant is choosing.
 */
export function googleTargetingProblem(d: TargetingDraft, channelType: GoogleChannelType | undefined): string | null {
  if (d.locations.length === 0 && d.radii.length === 0) {
    return "Add at least one location or radius. Without one, Google would show the ads in every country, so it won't start the campaign.";
  }
  if (!isSearch(channelType)) return null;
  if (d.keywords.length === 0) return "Add at least one keyword. A Search campaign shows only on searches for its keywords.";
  for (const k of [...d.keywords, ...d.negativeKeywords]) {
    const p = googleKeywordProblem(k.text);
    if (p) return `“${k.text}”: ${p}`;
  }
  const clash = d.negativeKeywords.find((n) => d.keywords.some((k) => googleNegativeSilences(n, k)));
  if (clash) return `The negative keyword “${foldKeyword(clash.text)}” would stop your keyword of the same words from ever showing. Keep one.`;
  return null;
}

/**
 * Whether a negative keyword stops a keyword from ever showing: the api's `silences` (google-criteria.ts). A PHRASE
 * negative whose words run in order inside an EXACT or PHRASE keyword, or a BROAD negative whose words are all inside
 * one, excludes every search it matches; an EXACT negative only an EXACT keyword of the same words; a BROAD keyword
 * only a PHRASE or BROAD negative of the very same words.
 */
export function googleNegativeSilences(negative: { text: string; matchType: string }, keyword: { text: string; matchType: string }): boolean {
  const words = (t: string) => t.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const n = words(negative.text);
  const k = words(keyword.text);
  const same = n.join(" ") === k.join(" ");
  if (negative.matchType === "EXACT") return keyword.matchType === "EXACT" && same;
  if (keyword.matchType === "BROAD") return same;
  if (negative.matchType === "PHRASE") {
    for (let i = 0; i + n.length <= k.length; i++) if (n.every((w, j) => k[i + j] === w)) return true;
    return false;
  }
  return n.every((w) => k.includes(w));
}

// ── words ────────────────────────────────────────────────────────────────

/** A radius in words: "10 km around Madrid, ES" (or the point, when Google gave no address). */
export function googleRadiusLabel(r: DraftRadius): string {
  const size = `${r.radius} ${r.radiusUnits === "MILES" ? (r.radius === 1 ? "mile" : "miles") : "km"}`;
  const a = r.address;
  const place = a ? [a.streetAddress, a.cityName, a.postalCode, a.provinceName ?? a.provinceCode, a.countryCode].filter((x) => x && x.trim()).join(", ") : "";
  if (place) return `${size} around ${place}`;
  if (r.geoPoint) {
    const lat = (r.geoPoint.latitudeInMicroDegrees / 1e6).toFixed(4);
    const lng = (r.geoPoint.longitudeInMicroDegrees / 1e6).toFixed(4);
    return `${size} around ${lat}, ${lng}`;
  }
  return size;
}

/** A location's name, or its id when Google gave none. */
export function googleLocationLabel(l: { geoTargetConstant: string; name?: string }): string {
  return l.name ?? l.geoTargetConstant.replace("geoTargetConstants/", "Location ");
}

/** The keyword status route's id: `{adGroupId}~{criterionId}`, the tail of a keyword's resource name. */
export function keywordCriterionId(resourceName: string): string | null {
  return /\/adGroupCriteria\/([0-9]+~[0-9]+)$/.exec(resourceName)?.[1] ?? null;
}

/**
 * The start confirmation's sentence about what Google needs first, naming the
 * step that sets it (the button on the campaign's row).
 */
export function googleStartTargetingHint(channelType: GoogleChannelType | undefined): string {
  if (channelType === "PERFORMANCE_MAX") return "Google will refuse it if it has no location yet — set one with Targeting on this campaign first.";
  if (channelType === "DEMAND_GEN") return "Google will refuse it if it has no location yet — set one with Targeting on this campaign first (a YouTube video ad takes no keywords).";
  return "Google will refuse it if it has no location or keyword yet — set them with Targeting on this campaign first.";
}

/** The step's lead sentence, per type. Claims no audience and no reach. */
export function googleTargetingDescription(channelType: GoogleChannelType | undefined): string {
  return isSearch(channelType)
    ? "Where your ads may show, in which languages, and which searches they show for. Saving replaces this campaign's targeting on Google Ads and starts nothing."
    : "Where your ads may show, and in which languages. Saving replaces these on Google Ads and starts nothing.";
}

export const GOOGLE_PAUSED_PLACES_NOTE = "paused in Google Ads, left as they are when you save.";
