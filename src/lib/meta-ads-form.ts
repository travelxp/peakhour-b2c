import { metaCurrencyOffsetDecimals } from "@/lib/meta-ads-view";

/**
 * MR-F1 — what the Meta "New campaign" form and the edit sheet send, as pure
 * functions so each rule can be tested without a screen.
 *
 * ★MONEY IS THE AD ACCOUNT'S, IN ITS SMALLEST UNIT. The merchant types 25.50;
 * Meta takes the string "2550" for USD and "26" for JPY (which has no minor
 * unit). The conversion is done on the DIGITS, never through a float, and uses
 * the same offset table as the read side (`metaCurrencyOffsetDecimals`).
 */

/** What a merchant can aim a new campaign at. Both take a website link and need no pixel. */
export const META_CREATE_OBJECTIVES = [
  {
    value: "OUTCOME_TRAFFIC",
    label: "Visits to my website",
    hint: "People who click your ad land on your link.",
    optimizationGoal: "LINK_CLICKS",
  },
  {
    value: "OUTCOME_AWARENESS",
    label: "Reach more people",
    hint: "Show your ad to as many people as your budget allows.",
    optimizationGoal: "REACH",
  },
] as const;

export type MetaCreateObjective = (typeof META_CREATE_OBJECTIVES)[number]["value"];

export const META_CTAS = [
  { value: "LEARN_MORE", label: "Learn more" },
  { value: "SHOP_NOW", label: "Shop now" },
  { value: "SIGN_UP", label: "Sign up" },
  { value: "CONTACT_US", label: "Contact us" },
] as const;

export type MetaCta = (typeof META_CTAS)[number]["value"];

/** Markets worth offering first; the picker adds any other by name. ISO 3166-1 alpha-2. */
export const META_COUNTRY_CODES: readonly string[] = [
  "IN", "GB", "US", "CA", "AU", "NZ", "IE", "AE", "SA", "SG", "MY", "ZA", "NG", "KE",
  "DE", "FR", "ES", "IT", "NL", "SE", "NO", "DK", "FI", "CH", "AT", "BE", "PT", "PL",
  "BR", "MX", "AR", "CO", "CL", "JP", "KR", "ID", "PH", "TH", "VN", "BD", "LK", "PK", "NP", "EG", "TR",
];

/** A country's English name, or the code itself when the runtime has no name for it. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const META_MIN_AGE = 18;
export const META_MAX_AGE = 65;
export const META_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const META_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;

// ── Money ────────────────────────────────────────────────────────────────

/**
 * "25.5" → "2550" (USD) or "26"→"26" (JPY). `null` for anything that is not a
 * positive amount with no more decimals than the currency has.
 *
 * ⚠️DIGIT ARITHMETIC, NOT `Math.round(x * 100)`: 1.15 * 100 is 114.99999999999999.
 */
export function metaMajorToMinor(input: string, currency: string | undefined): string | null {
  const text = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const decimals = metaCurrencyOffsetDecimals(currency);
  const [whole = "0", frac = ""] = text.split(".");
  if (frac.length > decimals) {
    // Trailing zeros past the unit ("25.500") are harmless; anything else is a number we would have to round.
    if (/[1-9]/.test(frac.slice(decimals))) return null;
  }
  const digits = (whole + frac.slice(0, decimals).padEnd(decimals, "0")).replace(/^0+(?=\d)/, "");
  if (!/^[1-9]\d{0,14}$/.test(digits)) return null;
  return digits;
}

/** A Meta minor-unit string as the text a budget box shows: "2550" → "25.5", "26" (JPY) → "26". */
export function metaMinorToInput(minor: string | undefined, currency: string | undefined): string {
  if (typeof minor !== "string" || !/^\d+$/.test(minor)) return "";
  const decimals = metaCurrencyOffsetDecimals(currency);
  if (decimals === 0) return String(Number(minor));
  const padded = minor.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

// ── Time zones: a calendar day in the ad account's zone, as the instant Meta takes ──

/** The offset, in minutes east of UTC, that `zone` has at the instant `at`. */
function zoneOffsetMinutes(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/**
 * "2026-12-01" in `zone` as an ISO instant: the day's first moment for a start, its last for an end,
 * so "ends 1 December" means the 1st is a full day of ads. `null` for a date or zone we cannot read.
 */
export function dayInZoneToIso(date: string, zone: string | undefined, edge: "start" | "end"): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  const [hh, mm, ss] = edge === "start" ? [0, 0, 0] : [23, 59, 59];
  const wall = Date.UTC(y, m - 1, d, hh, mm, ss);
  try {
    const zoneName = zone || "UTC";
    // Two passes settle the offset across a DST change on that very day.
    let offset = zoneOffsetMinutes(zoneName, new Date(wall));
    offset = zoneOffsetMinutes(zoneName, new Date(wall - offset * 60_000));
    return new Date(wall - offset * 60_000).toISOString();
  } catch {
    return null;
  }
}

/** An instant as the calendar day it falls on in `zone`, for a date box. "" when absent or unreadable. */
export function isoToDayInZone(iso: string | undefined, zone: string | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(at);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return "";
  }
}

// ── New campaign ─────────────────────────────────────────────────────────

export interface NewCampaignForm {
  name: string;
  objective: MetaCreateObjective;
  dailyBudget: string;
  countries: string[];
  ageMin: string;
  ageMax: string;
  headline: string;
  text: string;
  link: string;
  cta: MetaCta;
  /** The picked file's type and size; the bytes are read at submit. */
  image: { type: string; size: number } | null;
}

export const EMPTY_NEW_CAMPAIGN: NewCampaignForm = {
  name: "",
  objective: "OUTCOME_TRAFFIC",
  dailyBudget: "",
  countries: [],
  ageMin: String(META_MIN_AGE),
  ageMax: String(META_MAX_AGE),
  headline: "",
  text: "",
  link: "",
  cta: "LEARN_MORE",
  image: null,
};

export type FormErrors = Partial<Record<keyof NewCampaignForm, string>>;

/** One age box as a whole number inside Meta's range, or null. */
export function parseAge(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= META_MIN_AGE && n <= META_MAX_AGE ? n : null;
}

/** An http(s) link, or null. Anything else (a javascript: URL, a bare word) is not an ad destination. */
export function parseLink(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function validateNewCampaign(form: NewCampaignForm, currency: string | undefined): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "Give the campaign a name.";
  else if (form.name.trim().length > 100) errors.name = "Keep the name under 100 characters.";
  if (metaMajorToMinor(form.dailyBudget, currency) === null) {
    errors.dailyBudget = `Enter a daily budget in ${currency ?? "your account's currency"}, like 10 or 25.50.`;
  }
  if (form.countries.length === 0) errors.countries = "Choose at least one country.";
  const min = parseAge(form.ageMin);
  const max = parseAge(form.ageMax);
  if (min === null) errors.ageMin = `Youngest age must be ${META_MIN_AGE} to ${META_MAX_AGE}.`;
  if (max === null) errors.ageMax = `Oldest age must be ${META_MIN_AGE} to ${META_MAX_AGE}.`;
  if (min !== null && max !== null && min > max) errors.ageMax = "The oldest age can't be below the youngest.";
  if (!form.headline.trim()) errors.headline = "Add a short headline.";
  else if (form.headline.trim().length > 80) errors.headline = "Keep the headline under 80 characters.";
  if (!form.text.trim()) errors.text = "Write the text people will read.";
  else if (form.text.trim().length > 500) errors.text = "Keep the text under 500 characters.";
  if (parseLink(form.link) === null) errors.link = "Enter the full web address, starting with https://";
  if (!form.image) errors.image = "Choose an image.";
  else if (!(META_IMAGE_TYPES as readonly string[]).includes(form.image.type)) errors.image = "Use a JPEG or PNG image.";
  else if (form.image.size > META_IMAGE_MAX_BYTES) errors.image = "That image is over 3 MB. Use a smaller one.";
  return errors;
}

export interface CreateContext {
  adAccountId: string;
  currency: string | undefined;
  pageId: string;
  imageHash: string;
}

/**
 * The three bodies the api's create routes take. ⏸EVERYTHING IS CREATED `PAUSED`: nothing here can spend, and
 * the merchant turns the campaign on from the list. The budget sits on the CAMPAIGN, so the api's ceiling
 * check and the budget cap see it on the row it writes; the ad set carries none.
 */
export function buildCreateBodies(form: NewCampaignForm, ctx: CreateContext) {
  const objective = META_CREATE_OBJECTIVES.find((o) => o.value === form.objective) ?? META_CREATE_OBJECTIVES[0];
  const name = form.name.trim();
  const link = parseLink(form.link)!;
  return {
    campaign: {
      adAccountId: ctx.adAccountId,
      name,
      objective: objective.value,
      status: "PAUSED" as const,
      dailyBudget: metaMajorToMinor(form.dailyBudget, ctx.currency)!,
    },
    adSet: (campaignId: string) => ({
      adAccountId: ctx.adAccountId,
      name: `${name} - audience`.slice(0, 256),
      campaignId,
      status: "PAUSED" as const,
      billingEvent: "IMPRESSIONS" as const,
      optimizationGoal: objective.optimizationGoal,
      targeting: {
        geoLocations: { countries: form.countries },
        ageMin: parseAge(form.ageMin)!,
        ageMax: parseAge(form.ageMax)!,
      },
    }),
    ad: (adsetId: string) => ({
      adAccountId: ctx.adAccountId,
      name: `${name} - ad`.slice(0, 256),
      adsetId,
      status: "PAUSED" as const,
      creative: {
        name: `${name} - creative`.slice(0, 256),
        objectStorySpec: {
          pageId: ctx.pageId,
          linkData: {
            link,
            message: form.text.trim(),
            name: form.headline.trim(),
            imageHash: ctx.imageHash,
            callToAction: { type: form.cta, value: { link } },
          },
        },
      },
    }),
  };
}

// ── Edit ─────────────────────────────────────────────────────────────────

/** What an ad set's stored targeting says, in the three fields the sheet edits. */
export function readTargeting(targeting: Record<string, unknown> | undefined): {
  countries: string[];
  ageMin: string;
  ageMax: string;
} {
  const geo = targeting?.geo_locations as { countries?: unknown } | undefined;
  const countries = Array.isArray(geo?.countries) ? geo.countries.filter((c): c is string => typeof c === "string") : [];
  const age = (v: unknown) => (typeof v === "number" ? String(v) : "");
  return { countries, ageMin: age(targeting?.age_min), ageMax: age(targeting?.age_max) };
}

export interface CampaignEditForm {
  name: string;
  /** The text of the budget box; "" when the campaign has no budget of its own. */
  budget: string;
}

/** Only what changed, so an untouched field is never re-sent. `null` when nothing changed. */
export function buildCampaignEdit(
  original: { name: string; dailyBudget?: string; lifetimeBudget?: string },
  form: CampaignEditForm,
  currency: string | undefined,
): { name?: string; dailyBudget?: string; lifetimeBudget?: string } | { error: string } | null {
  const body: { name?: string; dailyBudget?: string; lifetimeBudget?: string } = {};
  const name = form.name.trim();
  if (!name) return { error: "Give the campaign a name." };
  if (name.length > 100) return { error: "Keep the name under 100 characters." };
  if (name !== original.name) body.name = name;
  const hasBudget = original.dailyBudget !== undefined || original.lifetimeBudget !== undefined;
  if (hasBudget) {
    const minor = metaMajorToMinor(form.budget, currency);
    if (minor === null) return { error: `Enter a budget in ${currency ?? "your account's currency"}, like 10 or 25.50.` };
    const key = original.dailyBudget !== undefined ? "dailyBudget" : "lifetimeBudget";
    if (minor !== (original[key] ?? "")) body[key] = minor;
  }
  return Object.keys(body).length ? body : null;
}

export interface AdSetEditForm {
  countries: string[];
  ageMin: string;
  ageMax: string;
  /** The text of the budget box; "" when the ad set has no budget of its own. */
  budget: string;
  /** Calendar days in the ad account's zone, "" for none. */
  start: string;
  end: string;
}

export function buildAdSetEdit(
  original: {
    dailyBudget?: string;
    lifetimeBudget?: string;
    startTime?: string;
    endTime?: string;
    targeting?: Record<string, unknown>;
  },
  form: AdSetEditForm,
  currency: string | undefined,
  zone: string | undefined,
):
  | {
      dailyBudget?: string;
      lifetimeBudget?: string;
      startTime?: string;
      endTime?: string;
      targeting?: { countries?: string[]; ageMin?: number; ageMax?: number };
    }
  | { error: string }
  | null {
  const body: NonNullable<Exclude<ReturnType<typeof buildAdSetEdit>, { error: string } | null>> = {};
  const was = readTargeting(original.targeting);
  const targeting: { countries?: string[]; ageMin?: number; ageMax?: number } = {};

  if (form.countries.length === 0) return { error: "Choose at least one country." };
  const sameCountries =
    form.countries.length === was.countries.length && [...form.countries].sort().join() === [...was.countries].sort().join();
  if (!sameCountries) targeting.countries = form.countries;

  const min = parseAge(form.ageMin);
  const max = parseAge(form.ageMax);
  if (min === null || max === null) return { error: `Ages must be ${META_MIN_AGE} to ${META_MAX_AGE}.` };
  if (min > max) return { error: "The oldest age can't be below the youngest." };
  if (String(min) !== was.ageMin) targeting.ageMin = min;
  if (String(max) !== was.ageMax) targeting.ageMax = max;
  if (Object.keys(targeting).length) body.targeting = targeting;

  const hasBudget = original.dailyBudget !== undefined || original.lifetimeBudget !== undefined;
  if (hasBudget) {
    const minor = metaMajorToMinor(form.budget, currency);
    if (minor === null) return { error: `Enter a budget in ${currency ?? "your account's currency"}, like 10 or 25.50.` };
    const key = original.dailyBudget !== undefined ? "dailyBudget" : "lifetimeBudget";
    if (minor !== (original[key] ?? "")) body[key] = minor;
  }

  const wasStart = isoToDayInZone(original.startTime, zone);
  const wasEnd = isoToDayInZone(original.endTime, zone);
  if (form.start !== wasStart) {
    if (form.start === "") return { error: "A start date can be changed but not removed." };
    const iso = dayInZoneToIso(form.start, zone, "start");
    if (!iso) return { error: "Enter a start date." };
    body.startTime = iso;
  }
  if (form.end !== wasEnd) {
    if (form.end === "") return { error: "An end date can be changed but not removed." };
    const iso = dayInZoneToIso(form.end, zone, "end");
    if (!iso) return { error: "Enter an end date." };
    body.endTime = iso;
  }
  if (form.start && form.end && form.end < form.start) return { error: "The end date can't be before the start date." };

  return Object.keys(body).length ? body : null;
}

/** A file as base64 with no `data:` prefix, the form the api takes. */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const text = String(reader.result);
      resolve(text.slice(text.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}
