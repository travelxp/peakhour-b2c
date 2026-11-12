import type { ListingTimeZone } from "@/lib/presence-edit";
import { mapLink } from "@/components/presence/network-card-state";
/**
 * What the Presence Listing and Insights panels are allowed to SAY (PE-04a).
 *
 * The decisions live here and the components hold markup, because vitest in this
 * repo runs without JSDOM (same split as `review-summary.ts` and
 * `components/presence/network-card-state.ts`).
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
    /** The other numbers we hold. A phone change is the whole list, so putting a number back sends these with it. */
    additionalPhones?: string[];
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
  /** The zone its calendar days are placed in and who gave it; null when none is known. Absent from an api that has not shipped it. */
  timeZone?: ListingTimeZone | null;
}

/** `GET /v1/presence/listing`. */
export interface PresenceListingResponse {
  setup: PresenceSetup;
  connection: {
    /** The network this connection is on (its adapter's key), which `?network=` selects. Never shown. */
    network?: string;
    /** How a merchant hears that network's name: the adapter's declaration. */
    label?: string;
    status: string;
    /** The listing this answer is about: the one asked for, else the first. */
    locationName: string | null;
    /** Every listing the connection manages. */
    locations?: PresenceLocation[];
    lastSyncAt: string | null;
    lastError: string | null;
  } | null;
  listing: PresenceListing | null;
  /** One entry per network on the listing, each shaped the same. A screen draws from this and never names a network. */
  networks: PresenceNetworkEntry[];
}

/** One network's entry on a listing (`networks[]` of `GET /v1/presence/listing`). */
export interface PresenceNetworkEntry {
  /** The network's key, sent back with an edit (PE-07). Never shown. */
  network: string;
  /** How a merchant hears the network's name: the adapter's own declaration. */
  label: string;
  externalId: string | null;
  status: string | null;
  syncMode: string | null;
  lastSyncedAt: string | null;
  driftFields: string[];
  /** Whether the merchant controls the listing. `unknown` is its own state. */
  control: PresenceControl;
  /**
   * Whether approved changes reach the network, from the api's send gates (`publishingOf`). Null for a network that writes nothing; absent on
   * an api that predates it, which draws no publishing status.
   */
  publishing?: PresencePublishing | null;
  /** What the network changed by itself. `items: null` is "never answered"; `[]` is "nothing changed". */
  changes: PresenceNetworkChanges;
  /** What the network can do, from its adapter's declaration. */
  capabilities: PresenceCapabilities;
  searchTerms: PresenceSearchTerms;
}

/**
 * The entry the page is about: the connection's own network, else the first. `null` when the listing has none.
 * ★A LISTING CAN CARRY SEVERAL NETWORKS. The page follows the connection it resolved, so a screen never takes `networks[0]` blindly.
 */
export function primaryEntry(r: Pick<PresenceListingResponse, "connection" | "networks"> | null | undefined): PresenceNetworkEntry | null {
  const list = r?.networks ?? [];
  const want = r?.connection?.network;
  // ★A CONNECTION'S NETWORK WITH NO ENTRY IS NO ENTRY, never another network's: the panels then show their setup states.
  if (want) return list.find((n) => n.network === want) ?? null;
  return list[0] ?? null;
}

/**
 * The network's display name for a page: the entry's, else the connection's, else the chosen connectable network's (so a page never says
 * "nothing is connected" beside a card that is), else `null` (say nothing that names one).
 */
export function networkLabel(r: Pick<PresenceListingResponse, "connection" | "networks"> | null | undefined, fallback?: string | null): string | null {
  return primaryEntry(r)?.label ?? r?.connection?.label ?? fallback ?? null;
}

/** One network a merchant can connect, from `GET /v1/presence/capabilities`. */
export interface ConnectableNetwork {
  network: string;
  label: string;
  /** The product's name as a merchant knows it. */
  title: string;
  /** The app page where the connection is made. */
  connectHref: string;
  /** Where the places one connection manages are listed and saved; `null` when there is nothing to pick. */
  picker: { path: string } | null;
  capabilities: PresenceCapabilities;
}

/** A connection in any of these states is the merchant's own, whatever state it is in: the page shows it (a lapsed one says so). */
export function isConnectedStatus(status: string | undefined): boolean {
  return status === "active" || status === "error" || status === "needs_reauth" || status === "expired";
}

/** The connectable networks the merchant is connected on, in the order the api lists them. */
export function connectedNetworks(
  networks: readonly ConnectableNetwork[] | undefined,
  statusOf: (network: string) => string | undefined,
): ConnectableNetwork[] {
  return (networks ?? []).filter((n) => isConnectedStatus(statusOf(n.network)));
}

/**
 * What the network switcher shows, or `null` when it should not be shown (fewer than two CONNECTED networks, so nothing to choose; an
 * unconnected network stays a connect card and is never an option).
 *
 * ★THE DEFAULT IS WHAT THE MERCHANT IS CONNECTED ON, never the head of a sorted list: the merchant's choice if it is connected, else the
 * network the api's default connection is on (`apiDefault`, read from the default listing answer), else the first connected one.
 */
export function networkSwitcher(
  connected: readonly ConnectableNetwork[] | undefined,
  chosen: string | undefined,
  apiDefault?: string | undefined,
): { options: Array<{ value: string; label: string }>; value: string } | null {
  if (!connected || connected.length < 2) return null;
  const has = (n: string | undefined) => !!n && connected.some((c) => c.network === n);
  const value = has(chosen) ? (chosen as string) : has(apiDefault) ? (apiDefault as string) : connected[0]!.network;
  return { value, options: connected.map((n) => ({ value: n.network, label: n.label })) };
}

/**
 * Whether the previous insights window may stand in while the next loads: only when just the number of days changed. A switch of network or
 * place must never show the old one's figures under the new one's name.
 */
export function keepInsightsWhileLoading(prevKey: readonly unknown[] | undefined, nextKey: readonly unknown[]): boolean {
  // key: ["presence", "insights", days, location, network]
  return !!prevKey && prevKey[3] === nextKey[3] && prevKey[4] === nextKey[4];
}

export type ControlState = "controlled" | "not_controlled" | "unknown";

/** `networks[].publishing` (the api's `PublishingView`). */
export interface PresencePublishing {
  /** on: approved changes are sent. held: Peakhour has not started sending yet. blocked: something on the merchant's side stops every send. */
  state: "on" | "held" | "blocked";
  /** Peakhour's own sentence while held. */
  heldReason: string | null;
  /** What on the merchant's side stops a send, and where it is fixed. Given in `held` too, so it can be fixed while they wait. */
  blocker: { reason: string; action: "reconnect" | "fix_on_network"; href: string | null } | null;
  /** How long a prepared change waits before it is dropped. */
  keptForHours: number;
}

export interface PresenceControl {
  state: ControlState;
  reason: string | null;
  hasPendingVerification: boolean | null;
  ownsBusiness: boolean | null;
  pendingEdits: boolean | null;
  duplicateOf: string | null;
  checkedAt: string | null;
  lastReadFailedAt: string | null;
}

export interface PresenceNetworkChange {
  field: string;
  /** The network's own path. Never shown: a path with no name says "a detail Peakhour doesn't track yet". */
  label?: string;
  suggested?: string;
  /** What we held when the network changed it, in the same text form as `suggested`. */
  before?: string;
}

export interface PresenceNetworkChanges {
  items: PresenceNetworkChange[] | null;
  pendingFields: string[] | null;
  checkedAt: string | null;
  lastReadFailedAt: string | null;
  customerMediaAt: string | null;
}

/** Neutral metric names, as the api declares them. */
export type NeutralMetricKey =
  | "calls"
  | "directionRequests"
  | "websiteClicks"
  | "messagingClicks"
  | "bookings"
  | "impressions";

export interface PresenceCapabilities {
  /** The network gives a listing that can be read, so the listing, score and edit panels draw. Absent on an api that predates the field. */
  listing?: boolean;
  /** The network sends reviews into the inbox. Absent on an api that predates the field. */
  reviews?: boolean;
  /** A listing change can be written to the network. Absent on an api that predates the field. */
  edit?: boolean;
  control: boolean;
  networkChanges: boolean;
  searchTerms: boolean;
  /** The network takes photos from Peakhour (PE-11), so the photos panel draws. Absent on an api that predates the field: not drawn. */
  media?: boolean;
  metricKeys: NeutralMetricKey[];
}

export interface PresenceSearchTerm {
  term: string;
  /** The exact count. Null for a term the network only gave a threshold for. */
  value: number | null;
  /** The real count is below this. Null when `value` is known. */
  threshold: number | null;
}

export interface PresenceSearchTerms {
  /** `YYYY-MM`. Null when never answered. */
  month: string | null;
  /** Null: never answered. `[]`: answered with no terms. */
  terms: PresenceSearchTerm[] | null;
  truncated: boolean;
  checkedAt: string | null;
  lastReadFailedAt: string | null;
}

/** One listing the connection manages. */
export interface PresenceLocation {
  locationName: string;
  title: string | null;
  /** The listing's page on the network's map. Present only when the network gave a web address. */
  mapsUri?: string;
}

/**
 * The link to a listing on the network, for "Check it on {label}". The listing's own entry when the connection lists it, else the only place the
 * connection lists. Never a guess between several. Only an http(s) address is a link.
 */
export function listingMapLink(
  locations: readonly PresenceLocation[] | undefined,
  externalId: string | null | undefined,
): string | null {
  if (!locations || locations.length === 0) return null;
  const own = externalId ? locations.find((l) => l.locationName === externalId) : undefined;
  // the only place is the listing's only when the listing names no place of its own; a named place that is not listed is not guessed
  const place = own ?? (!externalId && locations.length === 1 ? locations[0] : undefined);
  return mapLink(place?.mapsUri);
}

/** A field the page has no words for (the api's `other`, or a name added to the api first) is a change we cannot name. */
export const isUnnamedField = (field: string): boolean => field === "other" || !Object.hasOwn(FIELD_WORDS, field);

/**
 * One day. A figure the network did not report is `null`, never 0: those are different things on screen.
 */
export interface InsightDay {
  date: string;
  calls: number | null;
  directions: number | null;
  websiteClicks: number | null;
  messagingClicks: number | null;
  bookings: number | null;
  views: number | null;
}

/** `GET /v1/presence/insights`. */
export interface PresenceInsightsResponse {
  days: number;
  locationName: string | null;
  totals: Omit<InsightDay, "date">;
  series: InsightDay[];
}

/** Keyed by listing, so switching listings never shows another's figures from cache. */
export const presenceListingQueryKey = (location: string | undefined, network?: string) =>
  ["presence", "listing", location ?? "default", network ?? "default"] as const;
export const presenceInsightsQueryKey = (days: number, location: string | undefined, network?: string) =>
  ["presence", "insights", days, location ?? "default", network ?? "default"] as const;
export const presenceCapabilitiesQueryKey = ["presence", "capabilities"] as const;

/**
 * What the location switcher shows, or `null` when it should not be shown.
 *
 * ★ONLY WHEN THERE IS A CHOICE. A one-listing business sees the page exactly as
 * before. The value is the listing the page is about: the merchant's choice if it
 * is still managed, else the first, so a stale choice (a listing since removed)
 * falls back instead of asking the api for a place it refuses.
 */
export function locationSwitcher(
  locations: readonly PresenceLocation[] | undefined,
  chosen: string | undefined,
): { options: Array<{ value: string; label: string }>; value: string; isDefault: boolean } | null {
  if (!locations || locations.length < 2) return null;
  const value = locations.some((l) => l.locationName === chosen) ? (chosen as string) : locations[0]!.locationName;
  return {
    value,
    // The first listing is the api's default, so asking for it by name is the same read as not asking.
    isDefault: value === locations[0]!.locationName,
    options: locations.map((l) => ({ value: l.locationName, label: l.title?.trim() || l.locationName })),
  };
}

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

/**
 * What to say when there is nothing to show yet. `null` means: show the data.
 *
 * @param label the network's display name from the api (the adapter's declaration), or `null` when no network is known yet
 */
export function setupMessage(
  setup: PresenceSetup,
  hasListing: boolean,
  subject: "listing" | "performance",
  label: string | null,
): SetupMessage | null {
  const what = subject === "listing" ? "your listing" : "how your listing is doing";
  const n = label ?? "The network";
  switch (setup) {
    case "not_connected":
      return {
        headline: label ? `${label} isn't connected yet` : "Nothing is connected yet",
        body: `Connect ${label ?? "a network"} above to see ${what} here.`,
      };
    case "needs_reconnect":
      // A saved listing stays on screen (as sync_failing does); only the figures,
      // which cannot be read, are replaced by the message.
      if (hasListing && subject === "listing") return null;
      return {
        headline: `${n} needs you to reconnect`,
        body: `${n} stopped accepting our access, so we can't read ${what}. Reconnect above.`,
      };
    case "needs_location":
      return {
        headline: `Choose which ${label ?? "network"} listing is yours`,
        body: `Nothing is read until you choose a listing above, so there is no ${subject} to show.`,
      };
    case "importing":
      if (hasListing && subject === "listing") return null;
      return {
        headline:
          subject === "listing" ? `Getting your listing from ${label ?? "the network"}` : "Waiting for your first figures",
        body: `We have not received ${subject === "listing" ? "your listing" : "any figures"} yet. This usually takes a few minutes after you choose a listing.`,
      };
    case "sync_failing":
      return hasListing
        ? null
        : {
            headline: `We couldn't read your listing from ${label ?? "the network"}`,
            body: "The last attempt failed and we have nothing saved to show. Try again from the card above.",
          };
    case "ready":
      return null;
  }
}

/** A sentence for a failing sync that still has something to show. */
export function staleSyncNote(setup: PresenceSetup, label: string | null): string | null {
  const n = label ?? "the network";
  if (setup === "sync_failing") {
    return `The last sync with ${n} failed, so this may be out of date.`;
  }
  if (setup === "needs_reconnect") {
    return `${label ?? "The network"} needs you to reconnect, so this may be out of date. Reconnect above.`;
  }
  return null;
}

// ── Listing: differences from the network ─────────────────────────────────────────

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
  entry: Pick<PresenceNetworkEntry, "lastSyncedAt" | "driftFields"> | null,
): DriftStatus {
  if (compares.length === 0) return "not_checked";
  if (!entry || !entry.lastSyncedAt) return "not_checked";
  const drifted = entry.driftFields ?? [];
  return compares.some((f) => drifted.includes(f)) ? "differs" : "matches";
}

/** What a drift badge says, in the network's own name (`null`: no network known, so "the network"). */
export function driftLabel(status: DriftStatus, label: string | null): string {
  const n = label ?? "the network";
  switch (status) {
    case "differs":
      return `${label ?? "The network"} shows something different`;
    case "matches":
      return `Same on ${n}`;
    case "not_checked":
      return `Not compared with ${n}`;
  }
}

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

export const INSIGHT_METRICS: readonly { key: InsightKey; label: string; neutral: NeutralMetricKey }[] = [
  { key: "views", label: "Profile views", neutral: "impressions" },
  { key: "calls", label: "Calls", neutral: "calls" },
  { key: "directions", label: "Directions", neutral: "directionRequests" },
  { key: "websiteClicks", label: "Website clicks", neutral: "websiteClicks" },
  { key: "messagingClicks", label: "Messages", neutral: "messagingClicks" },
  { key: "bookings", label: "Bookings", neutral: "bookings" },
];

/**
 * The tiles the network declares. With no declaration to go by (an older api), all of them: a tile that
 * says "not available yet" is honest, a missing one is silent.
 */
export function declaredMetrics(
  capabilities: Pick<PresenceCapabilities, "metricKeys"> | null | undefined,
): typeof INSIGHT_METRICS {
  if (!capabilities || !Array.isArray(capabilities.metricKeys)) return INSIGHT_METRICS;
  const declared = new Set<string>(capabilities.metricKeys);
  return INSIGHT_METRICS.filter((m) => declared.has(m.neutral));
}

/**
 * Whether the insights panel is drawn for a network: not when its adapter declares no figures at all (`metricKeys: []`).
 * With no declaration to go by (an older api, or no entry yet) it is drawn, as `declaredMetrics` does.
 */
export function drawsInsights(entry: { capabilities?: Pick<PresenceCapabilities, "metricKeys"> | undefined } | null | undefined): boolean {
  const keys = entry?.capabilities?.metricKeys;
  return !Array.isArray(keys) || keys.length > 0;
}

/**
 * Whether the listing, score and edit panels draw for a network. A network that declares no listing (reviews only) has nothing to show in them,
 * and "still bringing in your listing" would promise one. With no declaration to go by (an older api) they are drawn.
 */
export function drawsListing(entry: { capabilities?: Pick<PresenceCapabilities, "listing"> | undefined } | null | undefined): boolean {
  return entry?.capabilities?.listing !== false;
}

/**
 * Whether the review cards (summary and kit) draw for a network. Called with the network itself (a connect item or a listing entry), like
 * `drawsListing` and `drawsInsights`. With no declaration to go by (an older api) they are drawn.
 */
export function drawsReviews(entry: { capabilities?: Pick<PresenceCapabilities, "reviews"> | undefined } | null | undefined): boolean {
  return entry?.capabilities?.reviews !== false;
}

/** The networks whose connection status read failed (parallel to `networks`). A failed read is not "disconnected". */
export function unreadableNetworks<N>(networks: readonly N[], reads: ReadonlyArray<{ isError: boolean } | undefined>): N[] {
  return networks.filter((_, i) => reads[i]?.isError === true);
}

/** What a tile or a chart says for a figure that is missing. It is never "0". */
export const NOT_AVAILABLE_YET = "Not available yet";

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

/** `null` when there is no data at all for the window. */
export function metricTotal(series: InsightDay[], key: InsightKey): number | null {
  if (series.length === 0) return null;
  // A day whose figure is missing or not a number is no figure, not a zero.
  const nums = series.map((d) => d[key]).filter((v): v is number => Number.isFinite(v));
  return nums.length === 0 ? null : nums.reduce((sum, v) => sum + v, 0);
}

export interface ChartPoint {
  date: string;
  /** `null` is a day the network sent nothing for: a gap in the line, not a zero. */
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
export function coverageNote(series: InsightDay[], days: number, label: string | null): string | null {
  if (series.length === 0 || series.length >= days) return null;
  return `${label ?? "The network"} has sent figures for ${series.length} of the last ${days} days. The other days are left blank, not counted as zero.`;
}

/**
 * Whether the chart has a single known day to draw. Days with a row but no figure for this metric are
 * gaps, so a window of only gaps is "not available yet", not a flat line at zero.
 */
export function chartHasData(points: ChartPoint[]): boolean {
  return points.some((p) => p.value !== null);
}

// ── Control: can edits go live? ──────────────────────────────────────────────

export type NoteTone = "good" | "warn" | "unknown";

export interface ControlNote {
  tone: NoteTone;
  headline: string;
  body: string;
  /** Extra sentences, each a separate fact. */
  extras: string[];
}

const NOT_CONTROLLED_BODY: Record<string, (label: string) => string> = {
  under_review: (n) => `${n} is still reviewing this listing, so edits may not show yet.`,
  needs_verification: (n) => `${n} may be waiting for you to verify this business before edits go live.`,
  ownership_conflict: (n) => `Someone else may also be managing this listing on ${n}, so your edits may not go live.`,
  guideline_violation: (n) => `${n} may have held this listing back over its guidelines, so edits may not go live.`,
  suspended: (n) => `${n} may have suspended this listing, so edits may not go live.`,
  disabled: (n) => `${n} may have turned this listing off, so edits may not go live.`,
};

/**
 * Whether edits can go live, in plain words. `null`: the network does not report it, so say nothing.
 *
 * `unknown` IS ITS OWN STATE. It is neither "you have lost control" nor "all good": it says we could
 * not tell. A read that failed is said out loud, and on a `controlled` or `not_controlled` answer it
 * only adds that the answer may be out of date. Words say "may", never a rule the network has not stated.
 *
 * @param label the network's display name, passed in so this file names none
 */
export function controlNote(
  entry: Pick<PresenceNetworkEntry, "control" | "capabilities"> | null,
  label: string,
): ControlNote | null {
  if (!entry || !entry.capabilities?.control || !entry.control) return null;
  const c = entry.control;
  const extras: string[] = [];
  if (c.pendingEdits === true) {
    extras.push(`Some of your edits are waiting for ${label} to publish them.`);
  }
  if (c.duplicateOf) {
    extras.push(`${label} may have this business listed twice.`);
  }
  const failedAfterAnswer =
    !!c.lastReadFailedAt && (!c.checkedAt || new Date(c.lastReadFailedAt) > new Date(c.checkedAt));

  if (c.state === "controlled") {
    if (failedAfterAnswer) extras.push("Our latest check didn't get an answer, so this may be out of date.");
    return {
      tone: "good",
      // ★ABOUT MANAGING, NOT PUBLISHING. Whether changes are sent is the publishing status's one answer (`publishingBanner`); this line
      // said "can go live" while that status said nothing is sent yet.
      headline: "You manage this listing",
      body: `${label} shows you as managing this listing.`,
      extras,
    };
  }
  if (c.state === "not_controlled") {
    const reason = c.reason ?? "other";
    const body =
      NOT_CONTROLLED_BODY[reason]?.(label) ??
      `${label} may not let your edits go live on this listing yet.`;
    if (reason === "needs_verification" && c.hasPendingVerification === true) {
      extras.push("A verification has already been started.");
    }
    if (failedAfterAnswer) extras.push("Our latest check didn't get an answer, so this may be out of date.");
    return { tone: "warn", headline: "Your edits may not go live", body, extras };
  }
  return {
    tone: "unknown",
    headline: "We can't tell yet whether you manage this listing",
    // ★NOT "nothing is wrong": the send blocks on unknown (the api's `controlOf`), so a page must not reassure while it holds every change.
    body: c.lastReadFailedAt
      ? `We asked ${label} and didn't get an answer. Nothing is sent to ${label} until we know.`
      : `We haven't asked ${label} yet. Nothing is sent to ${label} until we know.`,
    extras,
  };
}

// ── What the network changed by itself ───────────────────────────────────────

const FIELD_WORDS: Record<string, string> = {
  name: "name",
  description: "description",
  primaryCategory: "main category",
  additionalCategories: "other categories",
  phone: "phone number",
  website: "website",
  address: "address",
  geo: "map pin",
  regularHours: "opening hours",
  specialHours: "holiday hours",
  temporaryClosure: "temporary closure",
  services: "services",
  attributes: "details such as accessibility",
  links: "links",
  serviceArea: "service area",
  moreHours: "extra opening hours (such as delivery or takeaway)",
  media: "photos",
};

/** The words for a field the api could not name. Said plainly: a path is never shown to a merchant. */
export const UNNAMED_DETAIL = "a detail Peakhour doesn't track yet";

export function fieldWords(field: string): string {
  return Object.hasOwn(FIELD_WORDS, field) ? FIELD_WORDS[field]! : UNNAMED_DETAIL;
}

/** The fields whose held value is plain text a person can put back in one press. */
const PUT_BACK_FIELDS = ["name", "description", "phone", "website"] as const;

/**
 * The value that puts our version back, in the shape the change engine takes, or null where there is none to put back. A phone number is the
 * whole list, so the other numbers we hold go back with it.
 */
export function putBackValue(
  change: Pick<PresenceNetworkChange, "field" | "before">,
  listing: { contact?: { additionalPhones?: string[] | null } | null } | null | undefined,
): unknown {
  // an empty `before` is no value we can name (the field was empty), so there is nothing to put back
  if (change.before === undefined || change.before === "" || !(PUT_BACK_FIELDS as readonly string[]).includes(change.field)) return null;
  if (change.field === "phone") return { primary: change.before, additional: listing?.contact?.additionalPhones ?? [] };
  return change.before;
}

/** A value as it goes into a sentence: one line, bounded, in quotes. */
const quoted = (v: string): string => {
  const one = v.replace(/\s+/g, " ").trim();
  return `"${one.length > 120 ? `${one.slice(0, 117)}...` : one}"`;
};

/**
 * One change, in words: what, and from and to where we know them. An unknown before says only "to"; no value names the field and says where to
 * see it. A change we cannot name says so, and offers no value at all.
 */
export function changeLine(c: PresenceNetworkChange, label: string): string {
  if (isUnnamedField(c.field)) return `${label} changed something on your listing that Peakhour can't show yet.`;
  if (!c.suggested) return `${label} changed your ${fieldWords(c.field)}. See it on ${label}.`;
  const from = c.before ? ` from ${quoted(c.before)}` : "";
  return `${label} changed your ${fieldWords(c.field)}${from} to ${quoted(c.suggested)}.`;
}

export type ChangesView =
  | { kind: "no_answer"; text: string }
  | { kind: "none"; text: string }
  | { kind: "some"; headline: string; lines: ChangeLine[]; pending: string | null };

/** One change as the page draws it: the sentence, and which of the two choices it can offer. */
export interface ChangeLine {
  key: string;
  field: string;
  /** The network's own path, sent back only to say which change is meant. */
  path: string | undefined;
  text: string;
  /** A change we cannot name: it is never offered for approval, only for "I've checked it". */
  unnamed: boolean;
  /** Put ours back: only where we hold a value that is plain text. */
  canPutBack: boolean;
  before: string | undefined;
  /** The value the person is shown, sent back so a change that has since moved is not the one kept. */
  suggested: string | undefined;
}

/**
 * `items: null` AND `items: []` ARE DIFFERENT ANSWERS. Null is "the network has not told us", and must
 * never read as "nothing changed"; an empty list is the network saying nothing changed.
 * `null` return: the network does not report changes, so there is no section.
 */
export function changesView(
  entry: Pick<PresenceNetworkEntry, "changes" | "capabilities"> | null,
  label: string,
): ChangesView | null {
  if (!entry || !entry.capabilities?.networkChanges || !entry.changes) return null;
  const { items, pendingFields } = entry.changes;
  if (items === null) {
    return {
      kind: "no_answer",
      text: `We haven't been able to ask ${label} whether it changed anything yet. That is not the same as no changes.`,
    };
  }
  const waitingOn = (pendingFields ?? []).filter((f) => f !== "hidden");
  const pending = waitingOn.length > 0 ? `Waiting for ${label} to publish your edit to: ${waitingOn.map((f) => fieldWords(f)).join(", ")}.` : null;
  if (items.length === 0) {
    return { kind: "none", text: `${label} hasn't changed anything on its own.${pending ? ` ${pending}` : ""}` };
  }
  return {
    kind: "some",
    headline: `${label} changed ${items.length === 1 ? "something" : `${items.length} things`} on its own`,
    lines: items.map((i, n) => ({
      key: `${i.field}|${i.label ?? ""}|${n}`,
      field: i.field,
      path: i.label,
      text: changeLine(i, label),
      unnamed: isUnnamedField(i.field),
      canPutBack: putBackValue(i, null) !== null,
      before: i.before,
      suggested: i.suggested,
    })),
    pending,
  };
}

// ── Search terms ─────────────────────────────────────────────────────────────

/**
 * One count as words. A THRESHOLD IS "FEWER THAN N", never N: the network said the real count is below
 * it and nothing more. `formatNumber` is passed in so the locale is the caller's.
 */
export function termCountText(t: PresenceSearchTerm, formatNumber: (n: number) => string): string {
  if (t.value !== null) return `${formatNumber(t.value)} ${t.value === 1 ? "search" : "searches"}`;
  if (t.threshold !== null) return `Fewer than ${formatNumber(t.threshold)} searches`;
  return NOT_AVAILABLE_YET.toLowerCase();
}

/**
 * `YYYY-MM` as the first instant of that calendar month (UTC), for the caller to format with its own
 * locale and `timeZone: "UTC"`. A month is a calendar month, not an instant in the viewer's zone.
 * `null` for text that is not a month.
 */
export function monthStartIso(month: string): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  return m ? `${m[1]}-${m[2]}-01T00:00:00Z` : null;
}

export type SearchTermsView =
  | { kind: "no_answer"; text: string }
  | { kind: "none"; text: string; month: string }
  | { kind: "terms"; month: string; terms: PresenceSearchTerm[]; note: string | null };

/**
 * `null`: the network does not report search terms, so no section.
 * NEVER ASKED (`terms: null`) IS NOT "NOBODY SEARCHED": the first says we have no answer.
 */
export function searchTermsView(
  entry: Pick<PresenceNetworkEntry, "searchTerms" | "capabilities"> | null,
  label: string,
): SearchTermsView | null {
  if (!entry || !entry.capabilities?.searchTerms || !entry.searchTerms) return null;
  const st = entry.searchTerms;
  if (st.terms === null || st.month === null) {
    return {
      kind: "no_answer",
      text: st.lastReadFailedAt
        ? `We asked ${label} for what people searched for and didn't get an answer. We'll try again.`
        : `${label} reports search terms once a month. We haven't received the first list yet.`,
    };
  }
  if (st.terms.length === 0) {
    return {
      kind: "none",
      month: st.month,
      text: `${label} didn't list any search terms for this month. That doesn't mean nobody searched: ${label} leaves out terms searched only a few times.`,
    };
  }
  const notes: string[] = [];
  if (st.terms.some((t) => t.value === null && t.threshold !== null)) {
    notes.push(`${label} only says "fewer than" for terms searched a few times, so those have no exact count.`);
  }
  if (st.truncated) notes.push("The list was cut short, so it may not include every term.");
  return { kind: "terms", month: st.month, terms: st.terms, note: notes.length ? notes.join(" ") : null };
}
