/**
 * Smart Markdowns C.10: the Pricing page runs a TEST of a few products, not a list of every slow one.
 *
 * Everything the page decides is here, as pure functions: the headline, why the rest are waiting, how a start answer reads and how a chain of
 * tests reads. The page only chooses tags. The api owns every decision (which products, how deep, the holdout, the weekly verdict): nothing
 * here computes one. Mirrors peakhour-shopify `src/lib/markdown-test.ts` (C.9), in this repo's idiom.
 *
 * ★THE API AND THE SPA DEPLOY SEPARATELY. Every new field is optional on read, so an older api shows the page it showed before.
 */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** ★OWN KEYS ONLY: a key the api sends that is on Object.prototype ("constructor") must fall back to itself, not resolve to a function. */
const own = <T>(table: Record<string, T>, key: string): T | undefined => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined);

// ── The plan ────────────────────────────────────────────────────────────────

export interface WaitingProduct {
  productId: string;
  sourceProductId: string;
  title: string;
  reason: string;
  /** Optional: an api that predates it sends none, and the list is not grouped. */
  route: string | null;
}

export interface PlanFacts {
  cohortSize: number | null;
  slowTotal: number | null;
  waitingByRoute: Record<string, number>;
  waitingCandidates: number | null;
  waitingProducts: WaitingProduct[];
  /** The api's own answer; null when an older api sends none (the page then counts the proposals against the minimum of 5). */
  tooFewToMeasure: boolean | null;
}

/** What the api says about the test it proposes, read defensively. */
export function planFacts(plan: unknown): PlanFacts {
  const p = isObj(plan) ? plan : {};
  const counts: Record<string, number> = {};
  if (isObj(p.waitingByRoute)) {
    for (const [k, v] of Object.entries(p.waitingByRoute)) if (typeof v === "number" && Number.isFinite(v) && v > 0) counts[k] = v;
  }
  const waiting: WaitingProduct[] = [];
  if (Array.isArray(p.waitingProducts)) {
    for (const w of p.waitingProducts) {
      if (!isObj(w) || typeof w.title !== "string") continue;
      waiting.push({ productId: str(w.productId) ?? "", sourceProductId: str(w.sourceProductId) ?? "", title: w.title, reason: str(w.reason) ?? "", route: str(w.route) });
    }
  }
  return {
    cohortSize: num(p.cohortSize),
    slowTotal: num(p.slowTotal),
    waitingByRoute: counts,
    waitingCandidates: num(p.waitingCandidates),
    waitingProducts: waiting,
    tooFewToMeasure: typeof p.tooFewToMeasure === "boolean" ? p.tooFewToMeasure : null,
  };
}

/** The headline over a plan that proposes a test. "Ready to test", because nothing has changed until the merchant starts it. */
export function headlineOf(proposed: number, f: PlanFacts): string {
  const slow = f.slowTotal !== null && f.slowTotal >= proposed ? f.slowTotal : null;
  return slow !== null ? `Ready to test ${proposed} of your ${plural(slow, "slow product", "slow products")}` : `Ready to test ${plural(proposed, "product", "products")}`;
}

/** Said under the headline. A cohort under five cannot be measured, and a merchant is told before they press. */
export function headlineNote(proposed: number, f: PlanFacts): string {
  const parts = ["Only these few go on markdown, so you can see whether a discount sells them before it touches the rest."];
  if (f.tooFewToMeasure ?? proposed < 5) parts.push("That is too few products to measure a result reliably; you can still run it.");
  return parts.join(" ");
}

// ── Why the rest are waiting ────────────────────────────────────────────────

/** Display order and plain words for every route. A route the page does not know is shown by its own key, never dropped. */
export const ROUTE_WORDS: Record<string, { label: string; says: string }> = {
  price: { label: "Slow at this price", says: "People look at these and do not buy. A markdown is the likely fix, but only a few go on test at a time." },
  broken_run: { label: "Sizes are running out", says: "Only a few sizes or options are left, so a markdown can clear the last of them." },
  clear_end_of_season: { label: "End of their season", says: "Their season is closing and stock will outlast it, so these are first in line." },
  too_new: { label: "Too new", says: "Not on the shelf long enough to call slow. They are shown on your rails first." },
  cooldown: { label: "Resting after a markdown", says: "A markdown on these ended recently. Marking them down again straight away teaches shoppers to wait." },
  hold_off_season: { label: "Waiting for their season", says: "These sell in a season that is still a way off. A discount now would only give the margin away." },
  tail_addon: { label: "Last few units", says: "Too few left for a campaign. They work better as an add-on or in a bundle." },
  exposure: { label: "Not being seen", says: "Hardly anyone looks at these, so price is not the problem. They need to be shown more." },
  protected: { label: "Protected", says: "Tagged no-markdown, so they are never marked down." },
};
const ROUTE_ORDER = Object.keys(ROUTE_WORDS);

export function routeLabel(route: string): string {
  return own(ROUTE_WORDS, route)?.label ?? route.replace(/_/g, " ");
}

export interface RouteRow {
  route: string;
  label: string;
  says: string;
  count: number;
  products: WaitingProduct[];
}

/**
 * One row per route that holds products, in a fixed order (unknown routes last). `not_slow` is not waiting and never shown.
 * THE LIST IS THE API'S FIRST FEW, so a row's `products` can be shorter than its `count`: the page says so.
 */
export function waitingRows(f: PlanFacts): RouteRow[] {
  const keys = Object.keys(f.waitingByRoute).filter((k) => k !== "not_slow");
  keys.sort((a, b) => {
    const ia = ROUTE_ORDER.indexOf(a);
    const ib = ROUTE_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  return keys.map((route) => ({
    route,
    label: routeLabel(route),
    says: own(ROUTE_WORDS, route)?.says ?? "",
    count: f.waitingByRoute[route]!,
    products: f.waitingProducts.filter((w) => w.route === route),
  }));
}

/** Products the api named that carry no route (an older api): one ungrouped list. */
export function ungroupedWaiting(f: PlanFacts): WaitingProduct[] {
  return f.waitingProducts.filter((w) => w.route === null);
}

/**
 * Whether "Why the rest are waiting" is worth showing: not when sales could not be read (the routes are a claim about sales) and not when
 * markdowns are switched off.
 */
export function showWaiting(plan: { ordersConnected?: boolean; guardrails: { maxDiscountPct?: number } }): boolean {
  if (plan.ordersConnected === false) return false;
  return !(plan.guardrails.maxDiscountPct !== undefined && plan.guardrails.maxDiscountPct <= 0);
}

// ── The proposed test ───────────────────────────────────────────────────────

export interface ProposalFields {
  route?: unknown;
  costKnown?: unknown;
  struck?: unknown;
  referenceNote?: unknown;
}

export interface ProposalNotes {
  route: string | null;
  /** True only when the api says the "was" price is shown struck through. */
  struck: boolean;
  /** Why there is no strike-through, when the api says so. */
  referenceNote: string | null;
  /** `costKnown` is false: the first step is as deep as it goes until a cost per item is set. */
  needsCost: boolean;
}

export const COST_NOTE = "Set cost per item to go deeper";

/**
 * ★WOOCOMMERCE NEVER SHOWS THE SHOPIFY HOLD SENTENCE. The api's `referenceNote` says "the old price is not shown crossed out", which is true
 * of a Shopify compare-at price and untrue of Woo, which always shows its regular price struck through and instead REFUSES the sale price
 * until the hold is met (the refusal carries its own date sentence, shown in the start answer).
 */
export function proposalNotes(p: ProposalFields, platform: string | null = null): ProposalNotes {
  const woo = platform === "woocommerce";
  const struck = !woo && p.struck === true;
  return {
    route: typeof p.route === "string" ? routeLabel(p.route) : null,
    struck,
    // ★ONLY A STORE KNOWN TO BE SHOPIFY GETS ITS HOLD SENTENCE: with the platform unknown (the stores list did not load), a Woo merchant
    // must not be told the old price is not crossed out.
    referenceNote: struck || platform !== "shopify" ? null : str(p.referenceNote),
    needsCost: p.costKnown === false,
  };
}

// ── Starting the test ───────────────────────────────────────────────────────

/** What a start request came back as, whatever the transport: ok with the api's data, or a refusal with its status and body. */
export interface StartAnswer {
  ok: boolean;
  status: number;
  data: unknown;
}

export const START_UNCERTAIN =
  "We couldn't confirm whether the test started, and it may be running. Check Your tests below, and the Autopilot page, before you press Start again.";
const uncertain = (message: string = START_UNCERTAIN): StartOutcome => ({ kind: "uncertain", tone: "warning", message });
const START_FAILED = "We couldn't start the test just now. Nothing was changed. Please try again.";

export type StartOutcome =
  | { kind: "started"; tone: "success"; message: string }
  /** The products moved since the merchant looked: nothing was changed, and the page reloads the new plan. */
  | { kind: "moved"; tone: "info"; message: string }
  | { kind: "stopped"; tone: "info" | "warning"; message: string }
  /** The request may have reached the store and the answer was lost or unclear: the test may be running. */
  | { kind: "uncertain"; tone: "warning"; message: string };

/** The heading over an outcome. An uncertain start never says "not started". */
export function outcomeHeading(o: StartOutcome): string {
  switch (o.kind) {
    case "started":
      return "Test started";
    case "moved":
      return "The suggested products changed";
    case "uncertain":
      return "We couldn't confirm the test";
    case "stopped":
      return "The test was not started";
  }
}

/** The api's own refusal sentences, once each, for the store that gives a reason worth reading (Woo's date sentence). */
function refusalSentences(results: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const r of results) {
    const m = r.status === "refused" ? str(r.message) : null;
    if (m) seen.add(m);
  }
  return [...seen].slice(0, 3);
}

/**
 * How the answer to "Start this test" reads. ★ANYTHING THAT IS NOT A CLEAR REFUSAL MAY HAVE REACHED THE STORE, so it never says "nothing was
 * changed". `null` is a request that never answered (a thrown network error).
 */
export function startOutcome(r: StartAnswer | null, platform: string | null = null): StartOutcome {
  if (!r) return uncertain();
  const d = isObj(r.data) ? r.data : {};
  const woo = platform === "woocommerce";
  // With the platform unknown the words stay neutral rather than naming a store that may be the wrong one.
  const storeWord = woo ? "WooCommerce" : platform === "shopify" ? "Shopify" : "your store";
  if (r.ok) {
    const t = isObj(d.test) ? d.test : isObj(d) && "cohort" in d ? d : null;
    const onTest = t ? num(t.cohort) : null;
    const holdout = t ? num(t.holdout) : null;
    if (onTest === null) return uncertain();
    const results = Array.isArray(d.results) ? d.results.filter(isObj) : [];
    // REFUSED AND UNKNOWN ARE DIFFERENT: a refusal changed nothing, an unknown may have reached the store.
    const refused = results.filter((x) => x.status === "refused").length;
    const unknown = results.filter((x) => x.status === "unknown").length;
    if (onTest === 0) {
      // Nothing is known to be on markdown, but an unknown answer may be: never "nothing was changed".
      if (unknown > 0) return uncertain(`We couldn't confirm ${plural(unknown, "product", "products")}, so we can't say whether the test started. Check Your tests below, and the Autopilot page, before you press Start again.`);
      return { kind: "stopped", tone: "warning", message: ["None of the markdowns could be applied, so the test did not start. Nothing was changed.", ...(platform === "shopify" ? [] : refusalSentences(results))].join(" ") };
    }
    const parts = [`The test has started: ${plural(onTest, "product is", "products are")} on markdown${holdout ? `, and ${plural(holdout, "similar product is", "similar products are")} left at full price to compare` : ""}.`];
    if (refused > 0) {
      parts.push(`${plural(refused, "product was", "products were")} left out because ${storeWord} or a safety check refused the change.`);
      if (platform !== "shopify") parts.push(...refusalSentences(results));
    }
    if (unknown > 0) parts.push(`We couldn't confirm ${plural(unknown, "product", "products")}; check the Autopilot page.`);
    if (t?.tooFewToMeasure === true) parts.push("That is too few to measure a result reliably.");
    parts.push("Peakhour reviews it every week, and you can undo any markdown from the Autopilot page.");
    return { kind: "started", tone: "success", message: parts.join(" ") };
  }
  const code = str(d.code);
  const said = str(d.error) ?? str(d.message);
  if (r.status === 409 && code === "MOVED") return { kind: "moved", tone: "info", message: said ?? "The suggested products changed since you looked, so nothing was changed. Look at the new test and try again." };
  if (r.status === 409 && code === "NOT_STARTED") return { kind: "stopped", tone: "warning", message: said ?? START_FAILED };
  // 408 and 429 can come from a gateway after the request began: not clear refusals, like a 5xx or a request that never answered (status 0).
  if (r.status < 400 || r.status >= 500 || r.status === 408 || r.status === 429) return uncertain();
  if (r.status === 401 || r.status === 403) return { kind: "stopped", tone: "warning", message: "You don't have access to start this test. Nothing was changed." };
  if (r.status === 409 && code === "SWITCHED_OFF") return { kind: "stopped", tone: "info", message: said ?? "Price changes are not switched on for your store. Nothing was changed." };
  // ★A 409 WITH A CODE THIS PAGE DOES NOT KNOW (a racing second start, a lock) may mean a test is already running: never "not started".
  if (r.status === 409) return uncertain();
  return { kind: "stopped", tone: "warning", message: said ?? START_FAILED };
}

// ── Running tests ───────────────────────────────────────────────────────────

export interface TestRow {
  campaignId: string;
  rootCampaignId: string;
  parentCampaignId: string | null;
  step: number;
  depthPct: number;
  status: string;
  daysRunning: number | null;
  cohortSize: number;
  holdoutSize: number;
  decision: string;
  decisionReason: string | null;
}

/** The api's tests list read defensively; null when the answer is not a list at all (an older api, a failed read). */
export function acceptTests(data: unknown): TestRow[] | null {
  const list = isObj(data) ? data.tests : null;
  if (!Array.isArray(list)) return null;
  const out: TestRow[] = [];
  for (const t of list) {
    if (!isObj(t) || typeof t.campaignId !== "string") continue;
    out.push({
      campaignId: t.campaignId,
      rootCampaignId: str(t.rootCampaignId) ?? t.campaignId,
      parentCampaignId: str(t.parentCampaignId),
      step: num(t.step) ?? 1,
      depthPct: num(t.depthPct) ?? 0,
      status: str(t.status) ?? "unknown",
      daysRunning: num(t.daysRunning),
      cohortSize: num(t.cohortSize) ?? 0,
      holdoutSize: num(t.holdoutSize) ?? 0,
      decision: str(t.decision) ?? "running",
      decisionReason: str(t.decisionReason),
    });
  }
  return out;
}

export interface Chain {
  rootId: string;
  /** Oldest step first. */
  tests: TestRow[];
  /** Any step still active. */
  running: boolean;
}

/** Tests grouped by their root, each oldest step first. Chains with a step still running come first, the api's order otherwise. */
export function chainsOf(tests: readonly TestRow[]): Chain[] {
  const byRoot = new Map<string, TestRow[]>();
  for (const t of tests) byRoot.set(t.rootCampaignId, [...(byRoot.get(t.rootCampaignId) ?? []), t]);
  const chains = [...byRoot.entries()].map(([rootId, rows]) => ({ rootId, tests: [...rows].sort((a, b) => a.step - b.step), running: rows.some((r) => r.status === "active") }));
  return [...chains.filter((c) => c.running), ...chains.filter((c) => !c.running)];
}

export type DecisionTone = "info" | "success" | "neutral" | "caution";
export const DECISION_WORDS: Record<string, { label: string; tone: DecisionTone }> = {
  running: { label: "Running", tone: "info" },
  extend: { label: "Worked: widening", tone: "success" },
  step: { label: "No lift: going deeper", tone: "caution" },
  ended: { label: "Ended", tone: "neutral" },
  stop: { label: "Stopped", tone: "neutral" },
  too_early: { label: "Too early to tell", tone: "neutral" },
};

export function decisionWords(t: TestRow): { label: string; tone: DecisionTone } {
  // A step that has ended with no decision recorded is not "running".
  if (t.decision === "running" && t.status !== "active" && t.status !== "unknown") return { label: "Ended", tone: "neutral" };
  return own(DECISION_WORDS, t.decision) ?? { label: t.decision.replace(/_/g, " "), tone: "neutral" };
}

/** One line a merchant can read: where this step is and what is being compared. */
export function testLine(t: TestRow): string {
  const days = t.daysRunning === null ? "" : t.status === "active" ? `day ${t.daysRunning + 1}, ` : `ran ${plural(t.daysRunning, "day", "days")}, `;
  const compare = t.holdoutSize > 0 ? `${plural(t.holdoutSize, "similar product", "similar products")} left at full price to compare` : "no similar products left at full price to compare";
  return `${days}${plural(t.cohortSize, "product", "products")} on markdown, ${compare}`;
}

/** What the weekly review said, or why it has not said anything yet. */
export function decisionLine(t: TestRow): string {
  if (t.decisionReason) return t.decisionReason;
  if (t.decision === "running" && t.status === "active") return "Peakhour judges this after the first week, then every week.";
  return "";
}
