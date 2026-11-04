/**
 * What the Presence Listing and Insights panels are allowed to SAY (PE-04a).
 *
 * The decisions live here and the components hold markup, because vitest in this
 * repo runs without JSDOM (same split as `review-summary.ts` and
 * `components/presence/gbp-card-state.ts`).
 *
 * Three rules shape everything below:
 *  - Absent is not zero. No data for a metric is `null`, never `0`.
 *  - "Google differs" has three answers, not two: it differs, it matches, or we
 *    did not check. The api only compares a fixed set of fields, so a field
 *    outside that set is NOT "matches".
 *  - A failed read is not an empty listing.
 */

export type PresenceSetup =
  | "not_connected"
  | "needs_reconnect"
  | "needs_location"
  | "sync_failing"
  | "importing"
  | "ready";

export interface HoursPeriod {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  open: string;
  close: string;
}

export interface SpecialHours {
  /** ISO date; a UTC calendar day. */
  date: string;
  closed: boolean;
  open?: string;
  close?: string;
  note?: string;
}

export interface PresenceListing {
  id: string;
  name: string;
  status: string;
  description: string | null;
  primaryCategory: string | null;
  additionalCategories: string[];
  contact: {
    phone?: string;
    email?: string;
    website?: string;
    bookingUrl?: string;
    orderUrl?: string;
  } | null;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  } | null;
  geo: { lat: number; lng: number } | null;
  regularHours: HoursPeriod[];
  specialHours: SpecialHours[];
  updatedAt: string | null;
}

/** `GET /v1/presence/listing`. */
export interface PresenceListingResponse {
  setup: PresenceSetup;
  connection: {
    status: string;
    locationName: string | null;
    lastSyncAt: string | null;
    lastError: string | null;
  } | null;
  listing: PresenceListing | null;
  google: {
    externalId: string | null;
    status: string | null;
    syncMode: string | null;
    lastSyncedAt: string | null;
    driftFields: string[];
  } | null;
  verification: { state?: string } | null;
}

export interface InsightDay {
  date: string;
  calls: number;
  directions: number;
  websiteClicks: number;
  messagingClicks: number;
  bookings: number;
  views: number;
}

/** `GET /v1/presence/insights`. */
export interface PresenceInsightsResponse {
  days: number;
  locationName: string | null;
  totals: Omit<InsightDay, "date">;
  series: InsightDay[];
}

export const PRESENCE_LISTING_QUERY_KEY = ["presence", "listing"] as const;
export const presenceInsightsQueryKey = (days: number) =>
  ["presence", "insights", days] as const;

// ── Fetch state ──────────────────────────────────────────────────────────────

export type FetchView = "loading" | "paused" | "failed" | "data" | "data_stale";

/**
 * ★`isPending`, NOT `isLoading` (react-query v5: `isLoading` is
 * `isPending && isFetching`, so a paused query is neither loading nor failed).
 * ★AND AN ERROR WITH DATA IN HAND IS NOT LOST: a failed refetch keeps the last
 * good data and says it could not refresh, rather than dropping to a blank or
 * hiding the failure.
 */
export function fetchView(q: {
  hasData: boolean;
  isPending: boolean;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
}): FetchView {
  if (q.hasData) return q.isError ? "data_stale" : "data";
  if (q.isError) return "failed";
  if (q.isPending) return q.fetchStatus === "paused" ? "paused" : "loading";
  return "failed";
}

// ── Setup (shared by both panels) ────────────────────────────────────────────

export interface SetupMessage {
  headline: string;
  body: string;
}

/** What to say when there is nothing to show yet. `null` means: show the data. */
export function setupMessage(
  setup: PresenceSetup,
  hasListing: boolean,
  subject: "listing" | "performance",
): SetupMessage | null {
  const what = subject === "listing" ? "your listing" : "how your listing is doing";
  switch (setup) {
    case "not_connected":
      return {
        headline: "Google isn't connected yet",
        body: `Connect Google above to see ${what} here.`,
      };
    case "needs_reconnect":
      // A saved listing stays on screen (as sync_failing does); only the figures,
      // which cannot be read, are replaced by the message.
      if (hasListing && subject === "listing") return null;
      return {
        headline: "Google needs you to reconnect",
        body: `Google stopped accepting our access, so we can't read ${what}. Reconnect above.`,
      };
    case "needs_location":
      return {
        headline: "Choose which Google listing is yours",
        body: `Nothing is read until you choose a listing above, so there is no ${subject} to show.`,
      };
    case "importing":
      if (hasListing && subject === "listing") return null;
      return {
        headline:
          subject === "listing" ? "Getting your listing from Google" : "Waiting for your first figures",
        body: `We have not received ${subject === "listing" ? "your listing" : "any figures"} yet. This usually takes a few minutes after you choose a listing.`,
      };
    case "sync_failing":
      return hasListing
        ? null
        : {
            headline: "We couldn't read your listing from Google",
            body: "The last attempt failed and we have nothing saved to show. Try again from the card above.",
          };
    case "ready":
      return null;
  }
}

/** A sentence for a failing sync that still has something to show. */
export function staleSyncNote(setup: PresenceSetup): string | null {
  if (setup === "sync_failing") {
    return "The last sync with Google failed, so this may be out of date.";
  }
  if (setup === "needs_reconnect") {
    return "Google needs you to reconnect, so this may be out of date. Reconnect above.";
  }
  return null;
}

// ── Listing: differences from Google ─────────────────────────────────────────

export type DriftStatus = "differs" | "matches" | "not_checked";

export interface ListingRowSpec {
  key: string;
  label: string;
  /**
   * Api drift field names this row is judged by (`DRIFT_FIELDS` in peakhour-api
   * `gbp-listing-map.ts`). Empty: the api never compares it.
   */
  compares: readonly string[];
}

export const LISTING_ROWS: readonly ListingRowSpec[] = [
  { key: "name", label: "Name", compares: ["name"] },
  {
    key: "address",
    label: "Address",
    compares: ["address.line1", "address.city", "address.postalCode"],
  },
  { key: "phone", label: "Phone", compares: ["contact.phone"] },
  { key: "website", label: "Website", compares: ["contact.website"] },
  { key: "category", label: "Main category", compares: ["primaryCategory"] },
  { key: "otherCategories", label: "Other categories", compares: [] },
  { key: "hours", label: "Opening hours", compares: ["regularHours"] },
  { key: "specialHours", label: "Holiday hours", compares: [] },
];

/**
 * ★THREE ANSWERS. An empty `driftFields` is "we compared and nothing differs";
 * a field the api never compares, or a listing we have never compared at all
 * (`lastSyncedAt` absent), is "not checked". Those must not share a badge.
 */
export function driftStatus(
  compares: readonly string[],
  google: PresenceListingResponse["google"],
): DriftStatus {
  if (compares.length === 0) return "not_checked";
  if (!google || !google.lastSyncedAt) return "not_checked";
  const drifted = google.driftFields ?? [];
  return compares.some((f) => drifted.includes(f)) ? "differs" : "matches";
}

export const DRIFT_LABEL: Record<DriftStatus, string> = {
  differs: "Google shows something different",
  matches: "Same on Google",
  not_checked: "Not compared with Google",
};

// ── Listing: values as words ─────────────────────────────────────────────────

export function addressLines(a: PresenceListing["address"]): string[] {
  if (!a) return [];
  const cityLine = [a.city, a.region, a.postalCode].filter(Boolean).join(", ");
  return [a.line1, a.line2, cityLine, a.country].filter(
    (s): s is string => !!s && s.trim() !== "",
  );
}

const DAYS: HoursPeriod["day"][] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<HoursPeriod["day"], string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export interface HoursLine {
  day: string;
  /** `null` is closed all day. */
  periods: string[] | null;
}

/**
 * Weekly hours, Monday first. A day with no period is closed. An empty list as
 * a whole is "not set", returned as `[]` so the caller says so.
 */
export function hoursLines(hours: HoursPeriod[]): HoursLine[] {
  if (hours.length === 0) return [];
  return DAYS.map((d) => {
    const periods = hours
      .filter((h) => String(h.day).slice(0, 3).toLowerCase() === d)
      .sort((a, b) => a.open.localeCompare(b.open))
      .map((h) => `${h.open} to ${h.close}`);
    return { day: DAY_LABEL[d], periods: periods.length ? periods : null };
  });
}

export function specialHoursText(s: SpecialHours): string {
  if (s.closed) return "Closed";
  if (s.open && s.close) return `${s.open} to ${s.close}`;
  return "Special hours";
}

// ── Insights ─────────────────────────────────────────────────────────────────

export type InsightKey = keyof Omit<InsightDay, "date">;

export const INSIGHT_METRICS: readonly { key: InsightKey; label: string }[] = [
  { key: "views", label: "Profile views" },
  { key: "calls", label: "Calls" },
  { key: "directions", label: "Directions" },
  { key: "websiteClicks", label: "Website clicks" },
  { key: "messagingClicks", label: "WhatsApp and messages" },
  { key: "bookings", label: "Bookings" },
];

export const INSIGHT_WINDOWS: readonly { days: number; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 28, label: "28 days" },
  { days: 90, label: "90 days" },
];
export const DEFAULT_INSIGHT_DAYS = 28;

export type InsightsView = "no_data" | "data";

/**
 * ★NO ROWS IS NOT A ZERO WEEK. The api's `totals` are zeros when the series is
 * empty, so they are never used to answer "how many".
 */
export function insightsView(
  r: PresenceInsightsResponse,
  days: number,
  now: Date,
): InsightsView {
  return windowSeries(r.series, days, now).length === 0 ? "no_data" : "data";
}

/**
 * The rows that fall inside the window the chart draws. Totals, the chart and
 * the coverage note all read this one list, so the tiles can never disagree with
 * the picture. Dates are normalised to `YYYY-MM-DD`.
 */
export function windowSeries(series: InsightDay[], days: number, now: Date): InsightDay[] {
  const inWindow = new Set(chartPoints([], "views", days, now).map((p) => p.date));
  return series
    .map((d) => ({ ...d, date: String(d.date).slice(0, 10) }))
    .filter((d) => inWindow.has(d.date));
}

/** What Google's verification state means, in words. `null`: say nothing. */
export function verificationNote(state: string | undefined | null): string | null {
  switch ((state ?? "").toLowerCase()) {
    case "unverified":
      return "Google hasn't verified this business yet, so it may not show to customers.";
    case "pending":
      return "Google is still verifying this business, so it may not show to customers yet.";
    case "suspended":
      return "Google has suspended this listing, so it may not show to customers.";
    default:
      return null;
  }
}

/** `null` when there is no data at all for the window. */
export function metricTotal(series: InsightDay[], key: InsightKey): number | null {
  if (series.length === 0) return null;
  // A day whose figure is missing or not a number is no figure, not a zero.
  const nums = series.map((d) => d[key]).filter((v): v is number => Number.isFinite(v));
  return nums.length === 0 ? null : nums.reduce((sum, v) => sum + v, 0);
}

export interface ChartPoint {
  date: string;
  /** `null` is a day Google sent nothing for: a gap in the line, not a zero. */
  value: number | null;
}

/**
 * One point per calendar day of the window (UTC days, ending yesterday, as the
 * api reports them). A day with no row is `null`.
 *
 * @param now injected so the window is testable
 */
export function chartPoints(
  rawSeries: InsightDay[],
  key: InsightKey,
  days: number,
  now: Date,
): ChartPoint[] {
  const byDate = new Map(rawSeries.map((d) => [String(d.date).slice(0, 10), d[key]]));
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: ChartPoint[] = [];
  for (let i = days; i >= 1; i--) {
    const date = new Date(todayUtc - i * 86_400_000).toISOString().slice(0, 10);
    const v = byDate.get(date);
    out.push({ date, value: typeof v === "number" && Number.isFinite(v) ? v : null });
  }
  return out;
}

/** Said whenever the window is not full. */
export function coverageNote(series: InsightDay[], days: number): string | null {
  if (series.length === 0 || series.length >= days) return null;
  return `Google has sent figures for ${series.length} of the last ${days} days. The other days are left blank, not counted as zero.`;
}
