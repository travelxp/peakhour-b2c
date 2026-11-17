import { isReadableZone } from "@/lib/guardrails-copy";

/**
 * The time-zone list every picker draws from (FR2): ONE place that knows which zones to offer, what to call them, and how a search finds
 * them. `TimeZoneCombobox` is the picker; this is its list.
 *
 * ★OFFER TODAY'S NAMES, NEVER REWRITE A STORED ONE. Node 24 / ICU list legacy ids (Asia/Calcutta, Europe/Kiev) and `Intl` resolves Asia/Kolkata
 *  to Asia/Calcutta, so the list offers the modern names (Asia/Kolkata, Europe/Kyiv); a zone already stored is shown as it is stored, even
 *  when the list lacks it, and is its own option.
 * ★A SEARCH FINDS A ZONE BY CITY, REGION, COUNTRY OR OFFSET: "Kolkata", "Asia", "India", "+05:30".
 */

/**
 * Legacy zone ids some engines list INSTEAD of today's names (V8's supportedValuesOf has Asia/Calcutta and no Asia/Kolkata). Both read the
 * same; the merchant should see, and store, the name they know.
 */
const MODERN_ZONE: Readonly<Record<string, string>> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
};

const modernOf = (z: string): string => {
  const modern = MODERN_ZONE[z];
  return modern && isReadableZone(modern) ? modern : z;
};

/**
 * The zones to offer: the engine's list with legacy ids written as today's names (kept only where this browser can read the modern one),
 * plus UTC, which V8 does not list. Sorted, each once.
 */
export function timeZoneOptions(supported: readonly string[]): string[] {
  const out = new Set<string>(["UTC"]);
  for (const z of supported) out.add(modernOf(z));
  return [...out].sort();
}

const FALLBACK_ZONES = ["UTC", "Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "Pacific/Auckland"];

/** Every zone this browser knows, by today's names; a short list when it cannot say. */
export function supportedZones(): string[] {
  try {
    return timeZoneOptions(Intl.supportedValuesOf("timeZone"));
  } catch {
    return timeZoneOptions(FALLBACK_ZONES);
  }
}

/** The browser's own zone, by today's name, or undefined when it will not say. */
export function browserZone(): string | undefined {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return z ? modernOf(z) : undefined;
  } catch {
    return undefined;
  }
}

/** A zone's offset from UTC right now, "+05:30" ("+00:00" for UTC); empty when this browser cannot read the zone. */
export function zoneOffset(zone: string, now: Date = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = /^GMT(?:([+-]\d{2}):(\d{2}))?$/.exec(name);
    if (!m) return "";
    return m[1] ? `${m[1]}:${m[2]}` : "+00:00";
  } catch {
    return "";
  }
}

let countries: Map<string, string[]> | null = null;

/** Country names by zone, from the browser's own region data (empty where it has none): "Asia/Kolkata" -> ["India"]. Built once, on first search. */
function countriesByZone(): Map<string, string[]> {
  if (countries) return countries;
  const map = new Map<string, string[]>();
  countries = map;
  let names: Intl.DisplayNames;
  try {
    names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  } catch {
    return map;
  }
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const a of letters) {
    for (const b of letters) {
      const cc = `${a}${b}`;
      try {
        const name = names.of(cc);
        if (!name) continue;
        const zones = (new Intl.Locale(`und-${cc}`) as Intl.Locale & { getTimeZones?: () => string[] }).getTimeZones?.() ?? [];
        for (const z of zones) for (const id of new Set([z, modernOf(z)])) map.set(id, [...(map.get(id) ?? []), name]);
      } catch {
        // a code this engine has no data for is simply not a country here
      }
    }
  }
  return map;
}

/** One zone as a picker shows it: its label (with the offset), the place, and the text a search reads. */
export interface ZoneItem {
  value: string;
  /** "Asia/Kolkata (UTC+05:30)". */
  label: string;
  /** "Kolkata". */
  city: string;
  /** "India", or the region ("Asia") where the browser has no country for it. */
  place: string;
  /** "UTC+05:30", or empty. */
  offset: string;
  search: string;
}

/** "Asia/Kolkata (UTC+05:30)": the id with its underscores taken out, and the offset when this browser can read the zone. */
function labelOf(zone: string, off: string): string {
  const spaced = zone.replace(/_/g, " ");
  return off ? `${spaced} (UTC${off})` : spaced;
}

// An item is built once per zone per hour (the offset can change with daylight saving): opening the picker again does not rebuild 400.
let cacheHour = -1;
const itemCache = new Map<string, ZoneItem>();

export function zoneItem(zone: string, now: Date = new Date()): ZoneItem {
  const hour = Math.floor(now.getTime() / 3_600_000);
  if (hour !== cacheHour) {
    itemCache.clear();
    cacheHour = hour;
  }
  const hit = itemCache.get(zone);
  if (hit) return hit;
  const made = buildItem(zone, now);
  itemCache.set(zone, made);
  return made;
}

function buildItem(zone: string, now: Date): ZoneItem {
  const off = zoneOffset(zone, now);
  const spaced = zone.replace(/_/g, " ");
  const parts = spaced.split("/");
  const city = parts[parts.length - 1]!;
  const region = parts.length > 1 ? parts[0]! : "";
  const country = countriesByZone().get(zone)?.[0] ?? "";
  const offset = off ? `UTC${off}` : "";
  // every way a person writes an offset: +05:30, UTC+05:30, GMT+05:30, +5:30
  const short = off && off[1] === "0" ? off.replace(/^([+-])0/, "$1") : "";
  const writings = off ? [off, `utc${off}`, `gmt${off}`, ...(short ? [short, `utc${short}`, `gmt${short}`] : [])] : [];
  return {
    value: zone,
    label: labelOf(zone, off),
    city,
    place: country || region,
    offset,
    search: [spaced, zone, country, ...writings].join(" ").toLowerCase(),
  };
}

export interface ZoneGroup {
  key: "current" | "suggested" | "near" | "all";
  heading: string;
  items: ZoneItem[];
}

/**
 * The picker's groups, in order: the stored zone (and any `keep`) when the list lacks it (it is always an option), the browser's zone (suggested first), the
 * zones `near` the caller names (a listing's country), then everything else. A zone is listed once.
 */
export function zoneGroups(o: { supported?: readonly string[]; stored?: string | undefined; keep?: readonly (string | undefined)[]; browser?: string | undefined; near?: readonly string[]; now?: Date } = {}): ZoneGroup[] {
  const now = o.now ?? new Date();
  const list = timeZoneOptions(o.supported ?? supportedZones());
  const listed = new Set(list);
  const seen = new Set<string>();
  const take = (zones: readonly string[]): ZoneItem[] =>
    zones.filter((z) => z && !seen.has(z) && seen.add(z)).map((z) => zoneItem(z, now));
  // the stored zone, and any other the caller must keep offered (one a conflicting save replaced), are options even when the list lacks them
  const kept = [o.stored, ...(o.keep ?? [])].map((z) => z?.trim() ?? "").filter((z) => z && !listed.has(z));
  const groups: ZoneGroup[] = [];
  if (kept.length) groups.push({ key: "current", heading: "Your current time zone", items: take(kept) });
  const browser = o.browser && (listed.has(o.browser) || isReadableZone(o.browser)) ? o.browser : undefined;
  if (browser) groups.push({ key: "suggested", heading: "Detected on this device", items: take([browser]) });
  const near = take((o.near ?? []).filter((z) => listed.has(z)));
  if (near.length) groups.push({ key: "near", heading: "Where your business is", items: near });
  groups.push({ key: "all", heading: "All time zones", items: take(list) });
  return groups.filter((g) => g.items.length > 0);
}

/** The groups a search leaves: every word typed must be in the zone's city, region, country or offset. A blank search leaves everything. */
export function searchZones(groups: readonly ZoneGroup[], query: string): ZoneGroup[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...groups];
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => words.every((w) => i.search.includes(w))) })).filter((g) => g.items.length > 0);
}

/** How a chosen zone reads on the trigger: its label with the offset, whether or not the list holds it. ★Does not build the country lookup: a closed picker pays for the offset only. */
export const zoneLabel = (zone: string, now: Date = new Date()): string => labelOf(zone, zoneOffset(zone, now));
