import { ApiError } from "@/lib/api";
import { formatPeaks } from "@/lib/pricing";
import type { RateCardUseCase } from "@/hooks/use-credits";

/**
 * ★★M-16 — every decision the Meta ads panel makes, outside the component.
 *
 * peakhour-b2c has no DOM test harness, so a rule written inline in JSX is a
 * rule nothing can run. Everything here that the panel branches on is a pure
 * function with a spec beside it.
 */

// ── Money ────────────────────────────────────────────────────────────────

/**
 * ⚠️★META SENDS BUDGETS IN MINOR UNITS, AS STRINGS — and "minor" is not always
 * cents. Currencies with no minor unit take an offset of **1**, so a JPY budget
 * of `"5000"` is ¥5,000, not ¥50. Dividing every currency by 100 would show a
 * Japanese merchant a hundredth of what they are spending.
 *
 * ★A COPY OF `metaCurrencyOffsetDecimals` in peakhour-api's
 * `helpers/meta-ads.ts`, and deliberately so — the panel cannot import the api.
 * `meta-ads-view.test.ts` reads that file off disk and fails if the two lists
 * disagree, which is how the copy is kept honest rather than by hoping.
 */
export const META_OFFSET_ONE_CURRENCIES: ReadonlySet<string> = new Set([
  "CLP", "COP", "CRC", "HUF", "IDR", "ISK", "JPY", "KRW", "PYG", "TWD", "VND",
]);
export const ISO_ZERO_DECIMAL_NOT_IN_META_TABLE: ReadonlySet<string> = new Set([
  "XAF", "XOF", "XPF", "BIF", "DJF", "GNF", "KMF", "MGA", "RWF", "UGX", "VUV",
  "XAG", "XAU",
]);

export function metaCurrencyOffsetDecimals(currency?: string): number {
  if (!currency) return 2;
  const c = currency.toUpperCase();
  return META_OFFSET_ONE_CURRENCIES.has(c) || ISO_ZERO_DECIMAL_NOT_IN_META_TABLE.has(c) ? 0 : 2;
}

/**
 * Money in the account's currency, grouped in a PINNED locale — the rule
 * `lib/pricing.ts` records for why: a host-locale formatter renders one card
 * in two grouping systems.
 */
export function formatMetaMoney(major: number, currency: string | undefined): string {
  const code = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: metaCurrencyOffsetDecimals(code),
    }).format(major);
  } catch {
    return `${code} ${major.toFixed(metaCurrencyOffsetDecimals(code))}`;
  }
}

/**
 * A Meta minor-unit string as a major-unit number, or `undefined` for anything
 * that is not one. ⚠️`Number("")` is 0, so an empty string would otherwise read
 * as a budget of nothing — the same trap `fmtPrice` on the Peaks page records.
 */
export function metaMinorToMajor(minor: string | undefined, currency: string | undefined): number | undefined {
  if (typeof minor !== "string" || !/^\d+$/.test(minor)) return undefined;
  return Number(minor) / 10 ** metaCurrencyOffsetDecimals(currency);
}

export interface BudgetLabel {
  kind: "daily" | "lifetime" | "elsewhere";
  text: string;
}

/**
 * What a campaign or ad set's budget line says.
 *
 * ★"ELSEWHERE" IS A REAL ANSWER, NOT A MISSING ONE. A Meta campaign without
 * campaign budget optimisation carries no budget at all — its ad sets do — so
 * an absent budget on a CAMPAIGN means "set on its ad sets", and rendering it
 * as "—" or "0" would tell a merchant a running campaign spends nothing.
 */
export function metaBudgetLabel(
  node: { dailyBudget?: string; lifetimeBudget?: string },
  currency: string | undefined,
  level: "campaign" | "adSet",
): BudgetLabel {
  const daily = metaMinorToMajor(node.dailyBudget, currency);
  if (daily !== undefined && daily > 0) {
    return { kind: "daily", text: `${formatMetaMoney(daily, currency)}/day` };
  }
  const lifetime = metaMinorToMajor(node.lifetimeBudget, currency);
  if (lifetime !== undefined && lifetime > 0) {
    return { kind: "lifetime", text: `${formatMetaMoney(lifetime, currency)} total` };
  }
  return {
    kind: "elsewhere",
    text: level === "campaign" ? "Set on its ad sets" : "Set on its campaign",
  };
}

// ── Absent is not zero ───────────────────────────────────────────────────

export interface ReportedTotal {
  total: number;
  /** How many rows actually carried the figure. */
  reported: number;
  /** How many rows there were. */
  of: number;
}

/**
 * Sum a metric over rows where Meta reported it.
 *
 * ⚠️★`undefined` WHEN NOTHING WAS REPORTED, not 0. The api's insights type says
 * so in terms — *"absent means META DID NOT REPORT IT — never zero"* — and a
 * spend KPI of 0 beside campaigns that are serving is §2.5 FINDING 3's "0
 * impressions" on money. `reported < of` is surfaced by the panel as a partial
 * total rather than folded into one that looks complete.
 */
export function sumReported(values: readonly (number | undefined)[]): ReportedTotal | undefined {
  const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (present.length === 0) return undefined;
  return { total: present.reduce((a, b) => a + b, 0), reported: present.length, of: values.length };
}

// ── Status ───────────────────────────────────────────────────────────────

/**
 * Whether a node's status can be flipped here, and to what.
 *
 * ⏸ONLY `ACTIVE` ↔ `PAUSED`. Meta also has `DELETED` and `ARCHIVED`; the api
 * accepts `DELETED`, and this panel does not offer it — a delete is not a
 * toggle, and nothing here can undo one.
 */
export function metaStatusToggle(status: string): { next: "ACTIVE" | "PAUSED" } | null {
  if (status === "ACTIVE") return { next: "PAUSED" };
  if (status === "PAUSED") return { next: "ACTIVE" };
  return null;
}

/**
 * ★★WHY AN ACTIVE NODE IS NOT SERVING, when its parent says so.
 *
 * §1.2: Meta is THREE levels, and delivery needs campaign AND ad set AND ad all
 * ACTIVE. So an `ACTIVE` ad under a `PAUSED` ad set serves exactly as much as
 * no ad at all — the reason the api's launch charge asks `servingBlocked` one
 * level deeper than X does. A status badge alone would show "ACTIVE" on
 * something that is spending nothing.
 *
 * Returns the sentence, or `null` when the node itself is not ACTIVE (its own
 * badge already says why) or every ancestor is ACTIVE.
 */
export function metaNotServingBecause(
  own: string,
  ancestors: { campaign?: string; adSet?: string },
): string | null {
  if (own !== "ACTIVE") return null;
  if (ancestors.campaign !== undefined && ancestors.campaign !== "ACTIVE") {
    return `Not serving — its campaign is ${metaStatusWord(ancestors.campaign)}.`;
  }
  if (ancestors.adSet !== undefined && ancestors.adSet !== "ACTIVE") {
    return `Not serving — its ad set is ${metaStatusWord(ancestors.adSet)}.`;
  }
  return null;
}

/**
 * The parent's status, in words.
 *
 * ⚠️★NOT ALWAYS "PAUSED" (review R2.2). An ARCHIVED or DELETED parent printed
 * "its campaign is paused", which sends a merchant looking for a paused
 * campaign to resume — and that row has no switch, because `metaStatusToggle`
 * offers none for either. The sentence names what the parent actually is.
 */
function metaStatusWord(status: string): string {
  switch (status) {
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
    case "DELETED":
      return "deleted";
    default:
      return "not active";
  }
}

// ── The price before the ask (§7.0.1 requirement 4) ──────────────────────

/** The outcome row a first activation can bill. Seeded by mongodb mig 342. */
export const META_LAUNCH_USE_CASE = "meta.campaign_launched";

/**
 * The sentence beside Activate.
 *
 * ★THE PRICE IS THE ROW'S `creditMultiplier`, which is what the rollup charges
 * per event — not `minCreditsPerCall`, which no priced row sets.
 *
 * ⚠️★AND IT SAYS WHICH CAMPAIGNS IT APPLIES TO, because the api is precise and
 * a vaguer sentence would be false in both directions: the charge is raised
 * only for a campaign that has an `ad_campaigns` row — one created through
 * PeakHour — only the FIRST time it goes live, and only when something under it
 * can actually serve. A campaign built in Meta Ads Manager is never charged.
 * `undefined` (the card has not loaded) says so, rather than guessing a number.
 */
export function metaLaunchChargeSentence(
  row: Pick<RateCardUseCase, "free" | "creditMultiplier"> | undefined,
): string {
  const scope = "Campaigns you created in Meta Ads Manager are never charged.";
  if (!row) {
    return `A campaign PeakHour created may be charged Peaks the first time it goes live. ${scope}`;
  }
  if (row.free) return `Activating a campaign is free. ${scope}`;
  return (
    `A campaign PeakHour created is charged ${formatPeaks(row.creditMultiplier)} Peaks, once, ` +
    `the first time it goes live and can serve. Pausing and resuming it costs nothing. ${scope}`
  );
}

// ── Errors ───────────────────────────────────────────────────────────────

/**
 * Codes whose `message` the api writes FOR THE MERCHANT, so rendering it is the
 * most useful thing we can do.
 *
 * ⚠️★AN ALLOWLIST, NOT A DENYLIST — the Peaks page's `BUYER_FACING_CODES` rule.
 * The routes' fallback codes (`FETCH_FAILED`, `UPDATE_FAILED`, …) carry the raw
 * error text, which for a Graph failure is Meta's own message and can name ids.
 * A code added to the api later defaults to the safe copy, not to its string.
 *
 * ★`STATUS_PERSIST_FAILED` IS HERE ON PURPOSE AND MUST STAY: its message is the
 * one telling a merchant that Meta has ALREADY moved and to contact support
 * *"before leaving it running"*. Replacing it with "couldn't update" would say
 * the opposite of what happened, about money.
 */
export const META_MERCHANT_FACING_CODES: ReadonlySet<string> = new Set([
  "AD_ACCOUNT_NOT_ALLOWED",
  "NEEDS_REAUTH",
  "META_UNAVAILABLE",
  "META_NOT_CONNECTED",
  "CAPABILITY_DISABLED",
  "CAPABILITY_SCOPE_MISSING",
  "NO_BUSINESS",
  "ADS_HALTED",
  "STATUS_PERSIST_FAILED",
  "DATASET_NOT_FOUND",
  "DATASET_UNAVAILABLE",
  "DATASET_ID_UNSUPPORTED",
  "CONNECTION_GONE",
]);

/** What to show for a failed Meta ads call. */
export function metaAdsErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (META_MERCHANT_FACING_CODES.has(err.code)) return err.message;
    return err.requestId ? `${fallback} (reference ${err.requestId})` : fallback;
  }
  return fallback;
}

/** Whether the failure means the connection itself needs attention. */
export function metaAdsNeedsReconnect(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.code === "NEEDS_REAUTH" ||
      err.code === "META_NOT_CONNECTED" ||
      err.code === "CAPABILITY_SCOPE_MISSING" ||
      err.code === "CONNECTION_GONE")
  );
}

// ── Dates ────────────────────────────────────────────────────────────────

/**
 * `[startDate, endDate]` for the last `days` days, as the date-only strings the
 * api's `^\d{4}-\d{2}-\d{2}$` accepts — X's panel records that a full ISO
 * timestamp 400s and every KPI silently renders "—".
 *
 * ⚠️★BOTH ENDS ARE INCLUSIVE (review R1.5). Meta's `time_range` counts `since`
 * and `until` both, so `now − days` to `now` is `days + 1` days — a "30d" KPI
 * that read 31, about 3% above Ads Manager's own 30-day figure. The start is
 * `days − 1` back, so the window holds exactly `days` dates.
 */
export function metaInsightsRange(days: number, now: Date = new Date()): [string, string] {
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return [start, end];
}

// ── KPIs and list completeness ───────────────────────────────────────────

export type MetaKpiState = "loading" | "error" | "none" | "ready";

/**
 * Which state the KPI cards are in.
 *
 * ⚠️★`isLoading` IS NOT ENOUGH, AND REVIEW R1.3 IS WHY. The insights query is
 * DISABLED until the campaign list arrives, and a disabled query reports
 * `isLoading: false` in react-query v5 — so while campaigns loaded, and after
 * they FAILED, the cards said "Not reported": a claim about Meta made while we
 * had not asked it. The campaign read is consulted first, and a failure of
 * either read is its own state.
 */
export function metaKpiState(q: {
  campaignsPending: boolean;
  campaignsError: boolean;
  campaignCount: number;
  insightsPending: boolean;
  insightsError: boolean;
}): MetaKpiState {
  if (q.campaignsError) return "error";
  if (q.campaignsPending) return "loading";
  if (q.campaignCount === 0) return "none";
  if (q.insightsError) return "error";
  if (q.insightsPending) return "loading";
  return "ready";
}

/** The figure a KPI card shows, or `null` for a skeleton. */
export function metaKpiText(
  state: MetaKpiState,
  total: ReportedTotal | undefined,
  render: (n: number) => string,
): string | null {
  if (state === "loading") return null;
  if (state === "error") return "Unavailable";
  if (state === "none") return "No campaigns";
  // ⚠️REVIEW R3.1 — "Not reported" asserted that Meta WITHHELD a figure. A
  //  campaign that did not deliver in the window may simply get no insights
  //  row, and Meta's docs (checked 2026-09-23: /marketing-api/insights and its
  //  best-practices page) do not say which it returns — an empty `data` or a
  //  zero row. Without a live account neither reading is measured, so the text
  //  claims neither: "No figures" is true under both.
  return total ? render(total.total) : "No figures";
}

/**
 * One campaign's figure in a table cell, by the same rule as the cards; `""`
 * while loading.
 *
 * ⚠️★REVIEW R2.1 — THE ONE-PLACE-OF-TWO SHAPE. R1.3 fixed the cards and left
 * the ROWS reading `value ?? "Not reported"`, so a failed insights read put
 * "Not reported" on every campaign — a claim about Meta made without an answer
 * from it — directly under cards that correctly said "Unavailable".
 */
export function metaFigureText(
  state: MetaKpiState,
  value: number | undefined,
  render: (n: number) => string,
  /** False for a campaign past `META_INSIGHTS_MAX_CAMPAIGNS` — we never asked. */
  requested = true,
): string {
  // ★"NOT LOADED", NOT "NO FIGURES": the second is a statement about what Meta
  //  answered, and for this campaign Meta was never asked.
  if (!requested) return "Not loaded";
  const total = value === undefined ? undefined : { total: value, reported: 1, of: 1 };
  return metaKpiText(state, total, render) ?? "";
}

/**
 * ⚠️★★HOW MANY CAMPAIGNS THE PANEL ASKS META FOR FIGURES ON (b2c#571 R1.2).
 *
 * `/analytics` costs TWO serial Graph calls per campaign id (the api's note on
 * `MAX_ANALYTICS_CAMPAIGNS`). While the list read one page, that was at most
 * 50 ids = 2 requests = ~100 Graph calls per panel load. api#1409 lets the list
 * return up to 500, and asking for all of them would be 20 requests and ~1,000
 * Graph calls on every load — M-11's quota hazard, arriving from the client,
 * and one throttled batch fails every KPI card at once.
 *
 * So the read is capped at the old cost, and the panel SAYS it covers only
 * these: a total over the first 50 presented as the account's is a smaller
 * number that looks true. ⏸The fix that removes the cap is an account-level
 * insights route (one call per page, not two per campaign) — owed to the api.
 */
export const META_INSIGHTS_MAX_CAMPAIGNS = 50;

/**
 * The line under the KPI cards saying what the totals cover, or `null` when
 * they cover every listed campaign.
 *
 * ⚠️#571 R3: when the LIST is itself truncated, "of 500" is a count of what was
 * read, not of the account — and the truncation notice below says there are
 * more. "500+" keeps the two sentences on one screen from disagreeing.
 */
export function metaCoverageLine(requested: number, listed: number, listTruncated: boolean): string | null {
  if (requested >= listed) return null;
  const of = listTruncated ? `${listed}+` : `${listed}`;
  return (
    `Figures cover the first ${requested} of ${of} campaigns — each campaign's figures cost ` +
    `calls to Meta, so this view asks for no more than ${META_INSIGHTS_MAX_CAMPAIGNS}.`
  );
}

/** The campaign ids the panel requests figures for: the first `META_INSIGHTS_MAX_CAMPAIGNS`. */
export function metaInsightsIds(ids: readonly string[]): string[] {
  return ids.slice(0, META_INSIGHTS_MAX_CAMPAIGNS);
}

/**
 * ★WHETHER A LIST IS COMPLETE IS THE API'S ANSWER, NOT A COUNT (api#1409).
 *
 * This file held `META_LIST_PAGE_SIZE = 50` and `metaListMayBeTruncated`,
 * which guessed "maybe more" from a list of exactly 50 — right only while the
 * api read one page. The list routes now follow Meta's cursor and return
 * `truncated`, true only when Meta offered a page they did not fetch; a count
 * would now call a complete 50-row account truncated. Deleted, not kept
 * beside the flag (pre-launch: the newest version, and nothing else).
 */
