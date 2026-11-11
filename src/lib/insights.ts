/**
 * Inbox -> Insights ("What customers are telling you"): the rules of the tab.
 *
 * The rows, counts, trend and next step are the api's (`GET /v1/insights`, Contract C of the Store Assistant programme). This file decides
 * only how they are filtered, labelled and linked. The client never re-derives what the api decided (which asks are shown, which are
 * quiet, what counts as needing action).
 */
import { adminUrl } from "@/lib/demand-insights";

export type InsightType = "product_demand" | "missing_product_info" | "missing_store_info" | "purchase_concern" | "support_issue" | "top_question";
export type InsightTrend = "new" | "up" | "down" | "flat";
export type InsightNextKind = "answer" | "knowledge" | "product" | "add_product" | "products" | "admin" | "conversations" | "none";
export type InsightCauseKind = "missing_store_info" | "missing_product_info" | "not_in_catalog" | "integration_limit";

export interface InsightNextStep {
  label: string;
  kind: InsightNextKind;
  adminPath?: string;
  /** kind "admin" with `/settings`: which section to open once there. */
  where?: string;
  requestIds?: string[];
}

export interface Insight {
  key: string;
  type: InsightType;
  title: string;
  count: number;
  shopperDays: number;
  trend: InsightTrend;
  why: string;
  /** SA-16. Optional here so a page still draws against an api that has not shipped them. */
  summary?: string;
  nextStep: InsightNextStep;
  secondStep?: InsightNextStep;
  cause?: { kind: InsightCauseKind; reason: string };
  impact?: { basis: "conversations" | "asks"; customers?: number; asks: number; line: string };
  conversations?: { count: number; linkable: boolean; reason?: string };
  priority?: { blocked: boolean; top: boolean };
  status: "open" | "closed" | "dismissed";
  closedNote?: string;
  evidence: { available: number; expired: number };
  surfaces: string[];
  lastAskedAt: string;
}

export interface InsightsResponse {
  windowDays: number;
  since: string;
  needsAction: number;
  counts: Record<InsightType, number>;
  quietCount: number;
  items: Insight[];
  topPriorities?: string[];
  assistantMistakes?: { count: number; line: string | null };
  results?: unknown;
}

export const INSIGHT_TYPES: readonly InsightType[] = ["product_demand", "missing_product_info", "missing_store_info", "purchase_concern", "support_issue", "top_question"];

/** The types a merchant can act on: a gap to fill. The api's `needsAction` counts open items of these. */
export const ACTIONABLE_TYPES: readonly InsightType[] = ["product_demand", "missing_product_info", "missing_store_info"];

export const TYPE_LABEL: Record<InsightType, string> = {
  product_demand: "Product demand",
  missing_product_info: "Missing product info",
  missing_store_info: "Missing store info",
  purchase_concern: "Purchase concern",
  support_issue: "Support issue",
  top_question: "Top question",
};

// -- the filter chips (`?type=`) ---------------------------------------------------------------------------------------

export type InsightFilter = "needs_action" | "product_demand" | "missing_info" | "purchase_concern" | "support_issue" | "top_question";

export const INSIGHT_FILTERS: readonly { value: InsightFilter; label: string }[] = [
  { value: "needs_action", label: "Needs action" },
  { value: "product_demand", label: "Product demand" },
  { value: "missing_info", label: "Missing info" },
  { value: "purchase_concern", label: "Purchase concerns" },
  { value: "support_issue", label: "Support issues" },
  { value: "top_question", label: "Top questions" },
];

export const DEFAULT_INSIGHT_FILTER: InsightFilter = "needs_action";

/**
 * Which chip a `?type=` value asks for. The api's own type names are accepted too (a link from the
 * Shopify app names `product_demand`), and `missing_product_info` / `missing_store_info` both land on "Missing info". Anything else is
 * the default, never an error: a stale link must not leave the tab with no chip selected.
 */
export function insightFilterFromParam(value: string | null | undefined): InsightFilter {
  switch (value) {
    case "product_demand":
    case "purchase_concern":
    case "support_issue":
    case "top_question":
      return value;
    case "missing_info":
    case "missing_product_info":
    case "missing_store_info":
      return "missing_info";
    default:
      return DEFAULT_INSIGHT_FILTER;
  }
}

/** The chip for the address: `?tab=questions` with no `?type=` is the old Questions lane, which is now Insights narrowed to missing info. */
export function insightFilterFromSearch(tab: string | null | undefined, type: string | null | undefined): InsightFilter {
  if (tab === "questions" && !type) return LEGACY_QUESTIONS_FILTER;
  return insightFilterFromParam(type);
}

function inFilter(item: Insight, f: InsightFilter): boolean {
  switch (f) {
    case "needs_action":
      return ACTIONABLE_TYPES.includes(item.type);
    case "missing_info":
      return item.type === "missing_product_info" || item.type === "missing_store_info";
    default:
      return item.type === f;
  }
}

/** The open items a chip shows, in the api's order (needs-action first, then by count). Closed and dismissed items are never in a chip. */
export function itemsForFilter(items: readonly Insight[], f: InsightFilter): Insight[] {
  return items.filter((i) => i.status === "open" && inFilter(i, f));
}

/** The items under "Dismissed": ones the merchant set aside, which come back by themselves only when their count at least doubles (SA-10 gives them a Restore). */
export function dismissedItems(items: readonly Insight[]): Insight[] {
  return items.filter((i) => i.status === "dismissed");
}

/** The items under "Recently fixed": closed ones, whatever the chip. */
export function closedItems(items: readonly Insight[]): Insight[] {
  return items.filter((i) => i.status === "closed");
}

/** The number on a chip: the open items it would show. "Needs action" shows the api's own `needsAction` when it has one. */
export function chipCount(data: Pick<InsightsResponse, "items" | "needsAction">, f: InsightFilter): number {
  if (f === "needs_action" && Number.isFinite(data.needsAction)) return data.needsAction;
  return itemsForFilter(data.items, f).length;
}

// -- the tab (`?tab=`) -------------------------------------------------------------------------------------------------

/** `?tab=questions` was the old lane. It lands on Insights, filtered to missing info, so a saved link stays alive. */
export const LEGACY_QUESTIONS_FILTER: InsightFilter = "missing_info";

/** The address of Insights, optionally on one chip. The default chip is left out of the address. */
export function insightsHref(filter: InsightFilter = DEFAULT_INSIGHT_FILTER): string {
  return filter === DEFAULT_INSIGHT_FILTER ? "/dashboard/inbox?tab=insights" : `/dashboard/inbox?tab=insights&type=${filter}`;
}


// -- the conversation filter (`?topic=`) -------------------------------------------------------------------------------

/** "See conversations": the Conversations lane narrowed to one insight. */
export function conversationsHref(key: string): string {
  return `/dashboard/inbox?tab=conversations&topic=${encodeURIComponent(key)}`;
}

/** The page's own query string with the topic written in or removed (the other keys, such as `tab`, are kept). */
export function searchWithTopic(current: string, topic: string | null): string {
  const search = new URLSearchParams(current);
  search.delete("topic");
  if (topic) search.set("topic", topic);
  return search.toString();
}

/** How many of an insight's conversations have aged out of the retention window, said plainly; null when none have. */
export function expiredNote(expired: number): string | null {
  if (!Number.isFinite(expired) || expired <= 0) return null;
  return expired === 1 ? "1 conversation has aged out and is no longer kept." : `${expired} conversations have aged out and are no longer kept.`;
}

// -- lines on a card ---------------------------------------------------------------------------------------------------

/** "Asked 14 times on 6 shopper-days, last 30 days". Shopper-days, not people: the same shopper on two days counts twice. */
export function countLine(item: Pick<Insight, "count" | "shopperDays">, windowDays: number): string {
  const asks = item.count === 1 ? "Asked once" : `Asked ${item.count} times`;
  const days = item.shopperDays === 1 ? "on 1 shopper-day" : `on ${item.shopperDays} shopper-days`;
  return `${asks} ${days}, last ${windowDays} days`;
}

export function trendText(trend: InsightTrend): string | null {
  switch (trend) {
    case "new":
      return "New";
    case "up":
      return "Up on the period before";
    case "down":
      return "Down on the period before";
    default:
      return null;
  }
}

const SURFACE_NAMES: Record<string, string> = { storefront: "Storefront chat", whatsapp: "WhatsApp", woocommerce: "WooCommerce", messenger: "Messenger", instagram: "Instagram" };

/** "Storefront chat, WhatsApp"; a surface this tab has no name for is left out rather than shown raw. */
export function surfacesLine(surfaces: readonly string[]): string {
  return surfaces
    .map((s) => SURFACE_NAMES[s])
    .filter((s): s is string => Boolean(s))
    .join(", ");
}

// -- the primary action ------------------------------------------------------------------------------------------------

export type InsightAction =
  /** Answer the shoppers' questions inline: the existing knowledge-base answer call, one card per request id. */
  | { kind: "answer"; label: string; requestIds: string[] }
  /** Open the Knowledge base, or the Shopify admin (allow-listed path, built from the store's own handle). */
  | { kind: "link"; label: string; href: string; external: boolean }
  /** Narrow the Conversations lane to this insight. */
  | { kind: "conversations"; label: string; href: string }
  | { kind: "none" };

export const KNOWLEDGE_HREF = "/dashboard/commerce/knowledge";

/**
 * What the primary button does, from `nextStep.kind`. A KIND THAT CANNOT BE HONOURED IS NO BUTTON, never a dead one: an `answer`
 * with no request ids, or a product kind whose path is outside the allow-list or whose store is not known, shows the step as text.
 */
export function actionFor(item: Pick<Insight, "key" | "nextStep">, shop: string | null | undefined): InsightAction {
  const s = item.nextStep;
  switch (s.kind) {
    case "answer": {
      const ids = (s.requestIds ?? []).filter((id) => typeof id === "string" && id.length > 0);
      return ids.length > 0 ? { kind: "answer", label: s.label, requestIds: ids } : { kind: "none" };
    }
    case "knowledge":
      return { kind: "link", label: s.label, href: KNOWLEDGE_HREF, external: false };
    case "product":
    case "add_product":
    case "products":
    case "admin": {
      // adminUrl is the allow-list: the store handle must be a myshopify.com one and the path one the api builds
      const href = adminUrl(shop, s.adminPath);
      return href ? { kind: "link", label: s.label, href, external: true } : { kind: "none" };
    }
    case "conversations":
      return { kind: "conversations", label: s.label, href: conversationsHref(item.key) };
    default:
      return { kind: "none" };
  }
}

/** The second option (answer it here, or write it in Knowledge, or read the conversations), with the same rules as the first. */
export function secondActionFor(item: Pick<Insight, "key" | "secondStep">, shop: string | null | undefined): InsightAction {
  return item.secondStep ? actionFor({ key: item.key, nextStep: item.secondStep }, shop) : { kind: "none" };
}

/** What each cause is called on a card. */
export const CAUSE_LABEL: Record<InsightCauseKind, string> = {
  missing_store_info: "Missing store info",
  missing_product_info: "Missing product info",
  not_in_catalog: "Not in your catalog",
  integration_limit: "A limit of the assistant",
};

/**
 * The impact line. The api says whether it counted customers (by conversation) or only asks, and prints which; an older api that says neither falls
 * back to the asks-and-shopper-days line it always had.
 */
export function impactLine(item: Pick<Insight, "count" | "shopperDays" | "impact">, windowDays: number): string {
  return item.impact?.line ? `${item.impact.line}, last ${windowDays} days` : countLine(item, windowDays);
}

/**
 * Whether "See conversations" can be a link. The api says (an item built from logged questions has no conversation to open); an older api says nothing, and the
 * link is drawn as it always was.
 */
export function conversationsLinkable(item: Pick<Insight, "conversations">): { linkable: boolean; reason: string | null } {
  const c = item.conversations;
  if (!c) return { linkable: true, reason: null };
  return c.linkable ? { linkable: true, reason: null } : { linkable: false, reason: c.reason ?? "There is no conversation to open for this." };
}

/** The two lines that stand for questions without a topic: never a priority, and always drawn under the list. */
export const QUESTION_LINE_KEYS: ReadonlySet<string> = new Set(["new_questions", "unsorted_questions"]);
/** Items in the api's order, with the question lines moved to the end. */
export function linesLast<T extends { key: string }>(items: readonly T[]): T[] {
  return [...items.filter((i) => !QUESTION_LINE_KEYS.has(i.key)), ...items.filter((i) => QUESTION_LINE_KEYS.has(i.key))];
}

/** The (at most three) open items the api ranked first, in its order. */
export function topPriorityItems(data: Pick<InsightsResponse, "items" | "topPriorities">): Insight[] {
  const keys = [...new Set(data.topPriorities ?? [])].filter((k) => !QUESTION_LINE_KEYS.has(k)).slice(0, 3);
  return keys.map((k) => data.items.find((i) => i.key === k && i.status === "open")).filter((i): i is Insight => Boolean(i));
}

// -- the read ----------------------------------------------------------------------------------------------------------

/** What the tab can be showing. A failed read is its own state: it must never read as "nothing needs your attention". */
export type InsightsState =
  | { kind: "loading" }
  /** Nothing has been asked (the read is disabled until a business is pinned): no skeleton, which would spin for ever, and no claim. */
  | { kind: "waiting" }
  | { kind: "error" }
  | { kind: "no-assistant" }
  | { kind: "empty"; data: InsightsResponse }
  | { kind: "ready"; data: InsightsResponse };

/** Whether an answer has the shape the tab draws. Anything else is a failed read (an older api answers something else entirely). */
export function isInsightsResponse(v: unknown): v is InsightsResponse {
  const d = v as Partial<InsightsResponse> | null;
  return !!d && typeof d === "object" && Array.isArray(d.items) && typeof d.windowDays === "number" && typeof d.needsAction === "number";
}

/**
 * A business with no assistant is its own state, not an error. The api names it (`NO_ASSISTANT`, or `NO_STORE` as the demand read did).
 * A BARE 404 IS NOT THAT: an api that has not shipped the route answers 404 too, and "set up your assistant" would be a false
 * instruction. It reads as a failed load.
 */
export function stateOfError(err: unknown): InsightsState {
  const e = err as { status?: unknown; code?: unknown } | null;
  return e && e.status === 404 && (e.code === "NO_ASSISTANT" || e.code === "NO_STORE") ? { kind: "no-assistant" } : { kind: "error" };
}

export function insightsState(q: { isPending: boolean; isError: boolean; error: unknown; data: unknown; fetchStatus?: "fetching" | "paused" | "idle" }): InsightsState {
  // a failed read is an error even when an older answer is cached behind it only if there is no answer to show
  if (q.isError && !isInsightsResponse(q.data)) return stateOfError(q.error);
  if (q.isPending) {
    // react-query v5: a DISABLED query is pending and idle (nothing in flight, nothing coming); a PAUSED one (offline) never resolves
    if (q.fetchStatus === "idle") return { kind: "waiting" };
    if (q.fetchStatus === "paused") return { kind: "error" };
    return { kind: "loading" };
  }
  if (!isInsightsResponse(q.data)) return { kind: "error" };
  // "empty" means nothing to show on ANY chip: no item at all, not merely none on the chip in view
  return q.data.items.length === 0 ? { kind: "empty", data: q.data } : { kind: "ready", data: q.data };
}

/** The Shopify store the admin links open: the business's primary Shopify store, else its first. Null when it has none (no admin link is drawn). */
export function shopOf(stores: readonly { platform: string; shopDomain: string; primary: boolean }[] | undefined): string | null {
  const shopify = (stores ?? []).filter((s) => s.platform === "shopify");
  return (shopify.find((s) => s.primary) ?? shopify[0])?.shopDomain ?? null;
}

/** The number on the Insights tab: the api's own `needsAction`, once it is known. Zero, a failed read and a read in flight all show no badge. */
export function insightsBadge(data: unknown): number {
  return isInsightsResponse(data) && Number.isFinite(data.needsAction) && data.needsAction > 0 ? data.needsAction : 0;
}
