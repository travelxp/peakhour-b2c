/**
 * The policy builder's rules (Commerce -> Assistant answers -> Policies, KE-2.10).
 *
 * The api (`/v1/kb/policies/*`, `/v1/kb/upload`, `/v1/kb/publish/*`, peakhour-api services/kb) decides every fact: which questions exist, what is prefilled,
 * the price, the market findings, which slots a channel takes. This file decides only the words, the order and which buttons are drawn, so a rule is a
 * function a test can run and not a branch in a render closure.
 *
 * ★NOTHING HERE NAMES A CHANNEL. Publish buttons are drawn from `GET /v1/kb/publish/capabilities` (channel, connection, slot, allowed, reason) and
 *  from nothing else, so a channel the api adds later needs no change here.
 */
import { formatNumber, formatPeaks } from "@/lib/pricing";
import { LEGAL_LINE, approveState, safeUrl, suggestionPayload, type KbEntry } from "@/lib/knowledge-base";

// -- The policies -------------------------------------------------------------------------------------------------------

export const POLICY_TYPES = ["returns", "refunds", "exchanges", "shipping", "cancellation", "cod", "warranty"] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

const POLICY_LABELS: Record<PolicyType, string> = {
  returns: "Returns",
  refunds: "Refunds",
  exchanges: "Exchanges",
  shipping: "Shipping",
  cancellation: "Cancellations",
  cod: "Cash on delivery",
  warranty: "Warranty",
};
export const policyLabel = (t: PolicyType): string => POLICY_LABELS[t];

export type FactSourceId = "merchant" | `prefill:${string}` | `upload:${string}`;
export interface FactSource {
  fact: string;
  source: FactSourceId;
  sampleSize?: number;
  entryId?: string;
}

export interface PolicyRow {
  id: string;
  policyType: PolicyType;
  status: "draft" | "active" | "archived";
  /** Empty = every market. */
  markets: string[];
  marketKey: string;
  facts: Record<string, unknown>;
  factSources: FactSource[];
  updatedAt?: string;
  /** The newest generator draft written from this row, or null. */
  draftEntryId?: string | null;
  /** The newest active entry of this policy, or null. */
  activeEntryId?: string | null;
  /** Where this policy's active entry is published, in brief. */
  publications?: PolicyPublicationRef[];
}

export interface PolicyPublicationRef {
  id: string;
  channel: string;
  slot: string;
  state: string;
}

export interface PoliciesResponse {
  policies: Record<PolicyType, PolicyRow[]>;
  missing: PolicyType[];
}

export type PolicyStatus = "not_started" | "answers_saved" | "live";

/** One card's status from the listing: a live row wins; a draft row alone is "answers saved"; no row is "not started". */
export function policyStatus(rows: readonly Pick<PolicyRow, "status">[] | undefined): PolicyStatus {
  if (!rows || rows.length === 0) return "not_started";
  if (rows.some((r) => r.status === "active")) return "live";
  return rows.some((r) => r.status === "draft") ? "answers_saved" : "not_started";
}

const STATUS_WORDS: Record<PolicyStatus, string> = { not_started: "Not started", answers_saved: "Answers saved, not written yet", live: "Live in your assistant" };
export const policyStatusLine = (s: PolicyStatus): string => STATUS_WORDS[s];

/** "For every country" or "For GB, IN". */
export function marketsLine(markets: readonly string[]): string {
  return markets.length === 0 ? "For every country" : `For ${markets.join(", ")}`;
}

// -- Questions ------------------------------------------------------------------------------------------------------------

export type AnswerShape =
  | { kind: "yesno" }
  | { kind: "choice"; options: ReadonlyArray<{ value: string; label: string }> }
  | { kind: "days" | "hours" | "months" | "money" | "percent"; min: number; max: number }
  | { kind: "markets"; maxItems: number }
  | { kind: "list"; maxItems: number; maxLength: number }
  | { kind: "time" }
  | { kind: "text"; maxLength: number };

export type FactValue = boolean | number | string | string[];

export interface Prefill {
  fact: string;
  kind: string;
  source: "orders" | "catalog" | "entry" | string;
  value?: FactValue;
  sampleSize: number;
  windowDays?: number;
  entryId?: string;
  note: string;
}

export interface Question {
  fact: string;
  ask: string;
  help?: string;
  shape: AnswerShape;
  prefill: Prefill[];
  answer?: unknown;
  answerSource?: FactSource;
}

export interface QuestionsResponse {
  policyType: PolicyType;
  markets: string[];
  marketKey: string;
  prefillNote?: string;
  saved?: { id: string; status: PolicyRow["status"] };
  questions: Question[];
}

/** The text the box holds for an answer. Every shape is edited as a string; `parseAnswer` turns it back. */
export function valueToRaw(shape: AnswerShape, v: unknown): string {
  if (v === undefined || v === null) return "";
  switch (shape.kind) {
    case "yesno":
      return v === true ? "yes" : v === false ? "no" : "";
    case "list":
      return Array.isArray(v) ? v.join("\n") : "";
    case "markets":
      return Array.isArray(v) ? v.join(", ") : "";
    default:
      return String(v);
  }
}

export type Parsed = { ok: true; value: FactValue | undefined } | { ok: false; error: string };

const UNIT_WORDS: Record<string, string> = { days: "days", hours: "hours", months: "months", money: "an amount", percent: "a percent" };

/** A blank box is an unanswered fact (`value: undefined`), never a guess. Anything else is checked against the shape's own bounds, so a bad answer is said beside the box and not after a round trip. */
export function parseAnswer(shape: AnswerShape, raw: string): Parsed {
  const text = raw.trim();
  if (text === "") return { ok: true, value: undefined };
  switch (shape.kind) {
    case "yesno":
      return text === "yes" ? { ok: true, value: true } : text === "no" ? { ok: true, value: false } : { ok: false, error: "Choose yes or no." };
    case "choice":
      return shape.options.some((o) => o.value === text) ? { ok: true, value: text } : { ok: false, error: "Choose one of the options." };
    case "days":
    case "hours":
    case "months":
    case "money":
    case "percent": {
      const n = Number(text);
      // plain decimal digits only: Number() also takes 0x10 and 1e3, which nobody means in a days box
      if (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(n)) return { ok: false, error: `Enter ${UNIT_WORDS[shape.kind]} as a number.` };
      if (shape.kind !== "money" && shape.kind !== "percent" && !Number.isInteger(n)) return { ok: false, error: `Enter a whole number of ${UNIT_WORDS[shape.kind]}.` };
      if (n < shape.min || n > shape.max) return { ok: false, error: `Enter a number from ${formatNumber(shape.min)} to ${formatNumber(shape.max)}.` };
      return { ok: true, value: n };
    }
    case "markets": {
      const codes = text.split(/[\s,;]+/).filter(Boolean).map((c) => c.toUpperCase());
      if (codes.some((c) => !/^[A-Z]{2}$/.test(c))) return { ok: false, error: "Use two-letter country codes such as GB or IN, separated by commas." };
      if (new Set(codes).size !== codes.length) return { ok: false, error: "List each country once." };
      if (codes.length > shape.maxItems) return { ok: false, error: `List at most ${shape.maxItems} countries.` };
      return { ok: true, value: codes };
    }
    case "list": {
      const items = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
      if (items.length > shape.maxItems) return { ok: false, error: `List at most ${shape.maxItems} items, one per line.` };
      if (items.some((s) => s.length > shape.maxLength)) return { ok: false, error: `Keep each item under ${shape.maxLength} characters.` };
      return { ok: true, value: items };
    }
    case "time":
      return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(text) ? { ok: true, value: text } : { ok: false, error: "Use a time such as 09:30." };
    case "text":
      return text.length > shape.maxLength ? { ok: false, error: `Keep this under ${shape.maxLength} characters.` } : { ok: true, value: text };
  }
}

/** Equal as values; a list of strings is equal ignoring order (the api's own `sameValue`). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b) && a.every((x) => typeof x === "string") && b.every((x) => typeof x === "string")) {
    return a.length === b.length && [...(a as string[])].sort().join("\u0000") === [...(b as string[])].sort().join("\u0000");
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/** What an offered figure reads as. */
export function valueText(v: FactValue | undefined): string {
  if (v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

/** Only a prefill that carries a value can be accepted; one without is context only (the api's own rule). */
export const acceptable = (p: Prefill): p is Prefill & { value: FactValue } => p.value !== undefined;

const SOURCE_NOUN: Record<string, string> = { orders: "orders", catalog: "products", entry: "answers" };

/** Where a saved answer came from, in the merchant's words. */
export function sourceLine(s: FactSource | undefined): string | null {
  if (!s) return null;
  const n = typeof s.sampleSize === "number" && s.sampleSize > 0 ? s.sampleSize : null;
  if (s.source === "merchant") return "Your answer";
  if (s.source === "upload:drive") return "From the file you added";
  if (s.source === "upload:url") return "From the page you added";
  if (s.source.startsWith("prefill:")) {
    const id = s.source.slice("prefill:".length);
    const from = id === "orders" ? "your orders" : id === "catalog" ? "your products" : "an answer you already have";
    return n ? `Suggested from ${from}, based on ${formatNumber(n)} ${SOURCE_NOUN[id] ?? "records"}` : `Suggested from ${from}`;
  }
  return null;
}

/** "From your orders: ..." for an offer not yet accepted. The api's `note` is plain words already; the figure is shown beside it. */
export function offerLine(p: Prefill): string {
  return p.value === undefined ? p.note : `${p.note} (${valueText(p.value)})`;
}

export interface SaveBody {
  facts: Record<string, FactValue>;
  markets?: string[];
  acceptedPrefill?: string[];
}

/**
 * The box texts as `PUT /policies/:type` wants them. A blank box is left out (an unanswered fact is absent). A fact is sent in `acceptedPrefill` only when the
 * merchant clicked "Use this" AND the answer still equals what was offered; the api re-reads the prefill and records the provenance itself, so this is a hint
 * and never trusted. Errors are keyed by fact.
 */
export function buildSaveBody(
  questions: readonly Question[],
  raw: Readonly<Record<string, string>>,
  accepted: ReadonlySet<string>,
  markets: readonly string[],
): { ok: true; body: SaveBody } | { ok: false; errors: Record<string, string>; summary: string } {
  const facts: Record<string, FactValue> = {};
  const errors: Record<string, string> = {};
  const acceptedPrefill: string[] = [];
  for (const q of questions) {
    const r = parseAnswer(q.shape, raw[q.fact] ?? "");
    if (!r.ok) {
      errors[q.fact] = r.error;
      continue;
    }
    if (r.value === undefined) continue;
    facts[q.fact] = r.value;
    if (accepted.has(q.fact) && q.prefill.some((p) => acceptable(p) && sameValue(p.value, r.value))) acceptedPrefill.push(q.fact);
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors, summary: Object.keys(errors).length === 1 ? "Check the answer marked below." : `Check the ${Object.keys(errors).length} answers marked below.` };
  if (Object.keys(facts).length === 0) return { ok: false, errors, summary: "Answer at least one question before saving." };
  return { ok: true, body: { facts, ...(markets.length > 0 ? { markets: [...markets] } : {}), ...(acceptedPrefill.length > 0 ? { acceptedPrefill } : {}) } };
}

/** A market set as one key, order-free (the api's `marketKey`: `*` for every market). */
export const marketsKey = (markets: readonly string[]): string => (markets.length === 0 ? "*" : [...markets].sort().join(","));

/** The api's `?markets=GB,IN` (absent for every market). */
export const marketsParam = (markets: readonly string[]): Record<string, string> => (markets.length > 0 ? { markets: [...markets].sort().join(",") } : {});

/** The merchant's market box as a list, or the sentence to show beside it. Blank is every market. */
export function parseMarketsBox(raw: string): { ok: true; markets: string[] } | { ok: false; error: string } {
  const r = parseAnswer({ kind: "markets", maxItems: 250 }, raw);
  return r.ok ? { ok: true, markets: (r.value as string[] | undefined) ?? [] } : { ok: false, error: r.error };
}

let regionNames: Intl.DisplayNames | null | undefined;
/** A country's name from the platform's own data; the code itself when it has none. */
export function countryName(code: string): string {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * The answers form: what is in the boxes (`raw`), what the merchant started from (`saved`), and the last server answers it adopted (`server`). Every value is the
 * box text (see `valueToRaw`).
 */
export interface AnswersForm {
  raw: Record<string, string>;
  saved: Record<string, string>;
  server: Record<string, string>;
  /** The saved answers changed under edits the merchant had made: a notice is shown and the edits are kept. */
  stale: boolean;
}

export const newAnswersForm = (server: Record<string, string>): AnswersForm => ({ raw: { ...server }, saved: { ...server }, server, stale: false });

const sameBoxes = (a: Record<string, string>, b: Record<string, string>): boolean => {
  for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) if ((a[f] ?? "") !== (b[f] ?? "")) return false;
  return true;
};

/**
 * The form against the server's latest answers. ★IT ACTS ONLY WHEN THE SERVER'S ANSWERS CHANGED SINCE THE LAST ONES ADOPTED, never because the form moved ahead of a refetch
 * (a save sets `saved` at once and the refetch that confirms it lands later). Untouched boxes follow the server (an upload, another tab); a box the merchant edited is NEVER replaced.
 * `external`: the change is not the merchant's own save (the server's answers differ from what the form holds as saved), so a draft written before it is out of date.
 * Returns the same form object when nothing changed, so a render-time sync cannot loop.
 */
export function reconcileAnswers(form: AnswersForm, server: Record<string, string>): { form: AnswersForm; external: boolean; changed: string[] } {
  if (sameBoxes(form.server, server)) return { form, external: false, changed: [] };
  const external = !sameBoxes(server, form.saved);
  const facts = new Set([...Object.keys(form.raw), ...Object.keys(form.saved), ...Object.keys(server)]);
  const edited = new Set([...facts].filter((f) => (form.raw[f] ?? "") !== (form.saved[f] ?? "")));
  const raw = { ...form.raw };
  const changed: string[] = [];
  for (const f of facts) {
    if (!edited.has(f) && (raw[f] ?? "") !== (server[f] ?? "")) {
      raw[f] = server[f] ?? "";
      changed.push(f);
    }
  }
  return { form: { raw, saved: { ...server }, server, stale: form.stale || (external && edited.size > 0) }, external, changed };
}

export const ANSWERS_UPDATED = "Your saved answers changed (for example from a document you added). Your edits are kept.";

/** Why Approve is off: the answers changed after this draft was written, so approving it would state what the answers no longer say. */
export const DRAFT_OUT_OF_DATE = "You changed your answers after this draft was written. Save them and write the policy again.";

// -- The price card (shown BEFORE the click) -----------------------------------------------------------------------------------

export interface PolicyPrice {
  peaks: number;
  free: boolean;
  label: string;
  token: string;
  /** ms since the epoch */
  expiresAt: number;
  balance: { unlimited: boolean; remaining: number | null; enough: boolean } | null;
  ready: boolean;
  policy: { id: string; status: "draft" | "active"; marketKey: string } | null;
  regenerate: boolean;
  chargedWhen: string;
}

export const TOP_UP_HREF = "/dashboard/peaks";

export interface PriceCard {
  /** "60 Peaks" or "Free". Never "0 Peaks". */
  price: string;
  lines: string[];
  /** The balance is known to be short: the card offers the top-up. */
  short: boolean;
  /** Writing is blocked until the answers are saved. */
  needsAnswers: boolean;
}

/** What the card says, from the api's price view. `free` is authoritative; the number is not. */
export function priceCard(p: PolicyPrice): PriceCard {
  const price = p.free ? "Free" : `${formatPeaks(p.peaks)} Peaks`;
  const lines: string[] = [p.free ? "Writing this policy is free." : `Writing this policy costs ${price}. You are charged only when a draft is delivered. If we cannot write one, nothing is charged.`];
  const b = p.balance;
  let short = false;
  if (b && !b.unlimited && b.remaining !== null) {
    short = !b.enough;
    lines.push(short ? `You have ${formatPeaks(b.remaining)} Peaks, which is not enough.` : `You have ${formatPeaks(b.remaining)} Peaks.`);
  } else if (!b) {
    lines.push("We could not check your Peaks balance just now. It is checked again when you click.");
  }
  if (p.regenerate) lines.push("You already have a written draft. Writing again replaces it, including any edits you made to it, and is charged again.");
  return { price, lines, short, needsAnswers: !p.ready };
}

/** The signed quote is refused after it lapses, so the click refreshes the price instead of sending a dead receipt. */
export const quoteLapsed = (p: Pick<PolicyPrice, "expiresAt">, now: number): boolean => !(p.expiresAt > now);

/** The headers of ONE click: a fresh `Idempotency-Key` (one click, one charge) and the quote that was shown. `makeKey` is `newActionKey` in the app. */
export function clickHeaders(token: string | undefined, makeKey: () => Record<string, string>): Record<string, string> {
  return { ...makeKey(), ...(token ? { "x-peaks-quote": token } : {}) };
}

// -- Writing a policy -----------------------------------------------------------------------------------------------------------

export interface MarketFinding {
  ruleKey: string;
  market: string;
  severity: string;
  why: string;
  suggestion: string;
  quote?: string;
  source: { title: string; url: string };
  notLegalAdvice: string;
}

export interface MarketCheck {
  findings: MarketFinding[];
  checked: string[];
  unchecked: string[];
  failed: string[];
  splitMarkets: string[];
}

export interface GeneratedEntry extends Pick<KbEntry, "id" | "title" | "content" | "policyId" | "markets"> {
  draft?: { needsFacts?: string[] } | null;
}

export type GenerateResponse =
  | { drafted: false; charged: false; message: string }
  | {
      drafted: true;
      charged: boolean;
      deduped?: boolean;
      peaks: number;
      entry: GeneratedEntry;
      policy: { id: string; status: string; markets: string[]; marketKey: string };
      needsFacts: string[];
      replaced: boolean;
      marketCheck: "done" | "pending";
      marketFindings: MarketCheck | null;
    };

/** One line for what just happened, with what it cost. */
export function generatedLine(r: Extract<GenerateResponse, { drafted: true }>): string {
  if (r.deduped) return "This is the draft you just wrote. Nothing more was charged.";
  const cost = r.charged && r.peaks > 0 ? ` ${formatPeaks(r.peaks)} Peaks were charged.` : "";
  return `${r.replaced ? "Written again; the earlier draft was replaced." : "Written."}${cost} It is a draft: your assistant does not use it until you approve it.`;
}

export interface ErrorLine {
  message: string;
  /** Offer the top-up link. */
  topUp: boolean;
  /** The price on the card is out of date: read it again. */
  refreshPrice: boolean;
}

const errorOf = (e: unknown): { code?: string; status?: number; message: string } => {
  const o = (e ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  return { code: typeof o.code === "string" ? o.code : undefined, status: typeof o.status === "number" ? o.status : undefined, message: typeof o.message === "string" ? o.message : "" };
};

/** A refused or failed generate click, in plain words. Nothing was charged in any of these; the api's own sentence is kept where it says more. */
export function generateErrorLine(e: unknown): ErrorLine {
  const { code, message } = errorOf(e);
  switch (code) {
    case "CREDITS_EXHAUSTED":
      return { message: `${message || "You do not have enough Peaks for this."} Nothing was started and nothing was charged.`.replace(/\s+/g, " "), topUp: true, refreshPrice: false };
    case "ACT_ALREADY_RUNNING":
      return { message: "A policy is already being written for this business. Wait for it to finish. You are charged once.", topUp: false, refreshPrice: false };
    case "QUOTE_NOT_HONOURED":
      return { message: "The price changed while you were looking. Check the new price below, then click again. Nothing was charged.", topUp: false, refreshPrice: true };
    case "NOT_FOUND":
      return { message: "Answer the questions for this policy and save them first. Nothing was charged.", topUp: false, refreshPrice: false };
    case "GENERATION_FAILED":
      return { message: message || "We could not write this policy just now. Nothing was charged. Please try again in a moment.", topUp: false, refreshPrice: false };
    default:
      return { message: message || "We could not write this policy. Nothing was charged. Please try again.", topUp: false, refreshPrice: false };
  }
}

/** The market findings: grouped by the api's severity, with the "not legal advice" line on every one. A finding never says a thing is illegal; the api words it "worth a revisit". */
export function findingNotice(f: Pick<MarketFinding, "notLegalAdvice">): string {
  return f.notLegalAdvice?.trim() || LEGAL_LINE;
}

export const findingSourceHref = (f: Pick<MarketFinding, "source">): string | null => safeUrl(f.source?.url);

export function marketCheckLines(c: MarketCheck): string[] {
  const out: string[] = [];
  if (c.unchecked.length > 0) out.push(`We did not check ${c.unchecked.map(countryName).join(", ")} this time.`);
  if (c.failed.length > 0) out.push(`We could not check ${c.failed.map(countryName).join(", ")} just now, so its rules may be missing here.`);
  return out;
}

/** "Rules differ in India and the UK: write a separate policy for each." The api lists the markets with a finding when the policy covers several or every market. */
export function splitOffer(c: Pick<MarketCheck, "splitMarkets">, current: readonly string[]): { text: string; markets: string[] } | null {
  // a policy already written for one country has nothing to split
  if (c.splitMarkets.length === 0 || current.length === 1) return null;
  return { text: `Your policy covers more than one country, and ${c.splitMarkets.map(countryName).join(", ")} may need different wording. You can write a separate policy for each.`, markets: c.splitMarkets };
}

export const MARKET_CHECK_PENDING = "We are still checking this draft against the rules of your markets.";
export const MARKET_CHECK_CLEAR = "We checked this draft against the rules of your markets and found nothing to flag.";
export const MARKET_CHECK_GAVE_UP = "We could not finish checking this draft. You can still read it and decide.";

/** How often a pending check is read again. A failed read stops the polling (the screen then says it could not finish). */
export const FINDINGS_POLL_MS = 4000;
/** A pending check is read again after a failed read, this many failures in all, before the screen gives up. */
export const FINDINGS_ERRORS_MAX = 3;

// -- Approving -----------------------------------------------------------------------------------------------------------------

export interface ApproveResponse {
  entry: Pick<KbEntry, "id" | "title" | "content">;
  answered: number;
  /** Imported store pages this approval retired from chat; `null` = it could not retire them (both are live). */
  supersededImported?: { id: string; title: string }[] | null;
}

/** What approving did, beyond "approved". Honest about the imported store page it replaced in chat, and about the one case where it could not. */
export function approvedLine(r: Pick<ApproveResponse, "supersededImported">): string {
  const base = "Approved. Your assistant now answers from this policy on every channel.";
  const s = r.supersededImported;
  if (s === null) return `${base} We could not retire the imported store page that covers the same ground, so your assistant still has both. Archive the imported one under Entries.`;
  if (s && s.length > 0) return `${base} It replaces ${s.length === 1 ? "the store page" : "the store pages"} imported from your store (${s.map((x) => x.title).join(", ")}) in chat. ${s.length === 1 ? "That page stays" : "Those pages stay"} on your store.`;
  return base;
}

/** A refused approval. A 409 is the api saying the answers changed after the draft was written (or the draft was edited meanwhile): its sentence, and the way out. */
export function approveErrorLine(e: unknown): { message: string; stale: boolean } {
  const { status, message } = errorOf(e);
  if (status === 409) return { message: `${message || "This draft is out of date."} Write it again to get a draft from your current answers.`, stale: true };
  return { message: message || "That did not approve. Please try again.", stale: false };
}

/** Approve the written draft: the same checks as any suggestion (a title, an answer within bounds, no [placeholder] left), then the call, and what it did said honestly. */
export async function runPolicyApprove(
  send: (payload: { title: string; content: string }) => Promise<ApproveResponse>,
  title: string,
  content: string,
): Promise<{ ok: true; line: string } | { ok: false; error: string; stale: boolean }> {
  const state = approveState(title, content);
  if (!state.enabled) return { ok: false, error: state.reason, stale: false };
  try {
    const r = await send(suggestionPayload(title, content));
    return { ok: true, line: approvedLine(r) };
  } catch (e) {
    const x = approveErrorLine(e);
    return { ok: false, error: x.message, stale: x.stale };
  }
}

// -- Uploading ----------------------------------------------------------------------------------------------------------------

export interface UploadPrice {
  peaks: number;
  free: boolean;
  label: string;
  token: string;
  expiresAt: number;
  limits: { pdfBytes: number; pdfPages: number; textBytes: number; textChars: number };
}

export interface UploadSummary {
  source: { kind: string; label: string };
  truncated: boolean;
  entries: { drafted: number; replaced: number; evidenceAdded: number; unchanged: number; skippedForCap: number };
  policies: { policyType: PolicyType; added: string[]; saved: boolean }[];
  conflicts: { policyType: PolicyType; fact: string; kept: unknown; found: unknown }[];
  delivered: number;
}

export function uploadPriceLine(p: Pick<UploadPrice, "peaks" | "free">): string {
  return p.free ? "Reading a document is free." : `Reading one document costs ${formatPeaks(p.peaks)} Peaks. You are charged only if we find something to suggest.`;
}

export function uploadLimitsLine(l: UploadPrice["limits"]): string {
  return `We read PDF, text and Markdown files, or a web page. A PDF can be up to ${l.pdfBytes / 1_000_000} MB and ${l.pdfPages} pages; a text file up to ${l.textBytes / 1000} KB. For a Word document, save it as a PDF first.`;
}

/** The body of the upload call: one Drive file or one page address, never both. */
export function uploadBody(input: { driveFileId?: string; url?: string }): { ok: true; body: { driveFileId: string } | { url: string } } | { ok: false; error: string } {
  const id = input.driveFileId?.trim();
  if (id) return { ok: true, body: { driveFileId: id } };
  const url = input.url?.trim();
  if (!url) return { ok: false, error: "Choose a file from Drive, or paste the address of a page." };
  if (!safeUrl(url)) return { ok: false, error: "Paste the full address of the page, starting with https://." };
  return { ok: true, body: { url } };
}

const humanFact = (fact: string): string => fact.replace(/([A-Z])/g, " $1").toLowerCase();

/** What an upload did, one plain sentence each, and the conflicts it reported: the merchant's saved answer is kept, and the document's is said beside it. */
export function uploadResultLines(s: UploadSummary): string[] {
  const out: string[] = [];
  const drafts = s.entries.drafted + s.entries.replaced;
  if (drafts > 0) out.push(`${drafts} ${drafts === 1 ? "suggested answer was" : "suggested answers were"} added under Suggested answers. Nothing is live until you approve it.`);
  if (s.entries.evidenceAdded > 0) out.push(`${s.entries.evidenceAdded} of your existing suggestions now cite this document.`);
  for (const p of s.policies.filter((x) => x.saved && x.added.length > 0)) out.push(`${p.added.length === 1 ? "1 answer was" : `${p.added.length} answers were`} added to your ${policyLabel(p.policyType).toLowerCase()} policy answers.`);
  if (s.entries.skippedForCap > 0) out.push(`${s.entries.skippedForCap} more were left out because you are at your limit. Approve or dismiss some suggestions first.`);
  if (s.truncated) out.push("The document was longer than we read at once, so only the first part was used.");
  return out;
}

export function conflictLine(c: UploadSummary["conflicts"][number]): string {
  return `${policyLabel(c.policyType)}, ${humanFact(c.fact)}: you have ${valueText(c.kept as FactValue)}, the document says ${valueText(c.found as FactValue)}. Yours was kept.`;
}

export const uploadErrorLine = (e: unknown): ErrorLine => {
  const { code, message } = errorOf(e);
  if (code === "CREDITS_EXHAUSTED") return { message: `${message || "You do not have enough Peaks for this."} Nothing was charged.`, topUp: true, refreshPrice: false };
  if (code === "QUOTE_NOT_HONOURED") return { message: "The price changed while you were looking. Check the new price, then click again. Nothing was charged.", topUp: false, refreshPrice: true };
  return { message: message || "We could not read that. Nothing was charged. Please try again.", topUp: false, refreshPrice: false };
};

// -- Publishing: drawn from the api's capabilities, never from a channel name ------------------------------------------------

export type Slot = "page" | "faq" | "legal_policy";

export interface CapabilitySlot {
  slot: Slot;
  allowed: boolean;
  reason?: "not_released" | "grant_missing" | "not_supported";
  recheckable?: boolean;
  /** A slot for policies: the policy types it takes. */
  policyTypes?: readonly string[];
  /** With `not_supported`: what to tell the merchant (for example "update the Peakhour plugin"). */
  message?: string;
}

export interface CapabilityChannel {
  channel: string;
  label: string;
  connections: { id: string; label: string; slots: CapabilitySlot[] }[];
}

export interface CapabilitiesResponse {
  channels: CapabilityChannel[];
}

const SLOT_WORDS: Record<Slot, { button: string; noun: string }> = {
  page: { button: "Publish as a page", noun: "a page" },
  faq: { button: "Publish to the FAQ", noun: "the FAQ" },
  legal_policy: { button: "Publish as your store policy", noun: "your store policy" },
};
export const slotWords = (s: string): { button: string; noun: string } => SLOT_WORDS[s as Slot] ?? { button: "Publish", noun: "this" };

export const FAQ_HELP = "The FAQ shows on your site wherever the Peakhour FAQ block is placed. If it is not on a page yet, add it from your site's editor, in the apps or blocks list. We do not promise any search-engine result from it.";

export interface PublishButton {
  key: string;
  channel: string;
  channelLabel: string;
  connectionId: string;
  connectionLabel: string;
  slot: Slot;
  /** "Publish as a page" */
  label: string;
  /** Where to: the connection's own label. */
  target: string;
  /** Drawn as a working button. False = drawn as a note with `note` beneath. */
  enabled: boolean;
  note: string | null;
  /** The permission is missing: the card shows the re-approve prompt. */
  reapprove: boolean;
  help: string | null;
}

export interface PublishContext {
  /** The policy row the entry was written for (the entry view's `policyId`). A store-wide policy slot is offered only when this is set. */
  policyId?: string | null;
  /** The entry's market set (`[]` = every market). A policy for chosen markets only cannot take a store-wide slot. */
  markets?: readonly string[];
  /** The policy's type, when the screen is on that policy's card: a slot that takes other types is not drawn. */
  policyType?: PolicyType;
}

const slotOrder: Record<Slot, number> = { page: 0, faq: 1, legal_policy: 2 };

/** Whether this slot is offered for this entry. A `policyTypes` slot (a store-wide policy page) is for an entry written as a policy (`policyId` set) that covers every market. */
export function slotFits(slot: CapabilitySlot, ctx: PublishContext): boolean {
  if (!slot.policyTypes) return true;
  if (ctx.policyId == null || (ctx.markets?.length ?? 0) > 0) return false;
  return ctx.policyType === undefined || slot.policyTypes.includes(ctx.policyType);
}

/** Every button the capabilities allow for this entry, and a note for each slot the merchant could unblock. Nothing is invented: no capabilities, no buttons. */
export function publishButtons(caps: CapabilitiesResponse | undefined, ctx: PublishContext = {}): PublishButton[] {
  const out: PublishButton[] = [];
  for (const ch of caps?.channels ?? []) {
    for (const conn of ch.connections) {
      for (const s of conn.slots) {
        if (!slotFits(s, ctx)) continue;
        const words = slotWords(s.slot);
        const base = {
          key: `${ch.channel}:${conn.id}:${s.slot}`,
          channel: ch.channel,
          channelLabel: ch.label,
          connectionId: conn.id,
          connectionLabel: conn.label,
          slot: s.slot,
          label: words.button,
          target: conn.label,
          help: s.slot === "faq" ? FAQ_HELP : null,
        };
        if (s.allowed) out.push({ ...base, enabled: true, note: null, reapprove: false });
        else if (s.reason === "grant_missing") {
          // `recheckable`: a publish asks the channel again before it refuses, so the button stays
          out.push({ ...base, enabled: !!s.recheckable, note: `Peakhour does not have permission to publish ${words.noun} to ${conn.label} yet. Reconnect it and approve the permissions.`, reapprove: true });
        } else if (s.reason === "not_supported") out.push({ ...base, enabled: false, note: s.message?.trim() || `${conn.label} cannot take ${words.noun} yet.`, reapprove: false });
        else out.push({ ...base, enabled: false, note: `Publishing ${words.noun} to ${conn.label} is not available yet.`, reapprove: false });
      }
    }
  }
  return out.sort((a, b) => slotOrder[a.slot] - slotOrder[b.slot]);
}

export const RECONNECT_HREF = "/dashboard/integrations";

/** One line for the screen when nothing can be published anywhere. */
export const NO_CHANNELS_LINE = "Connect your website or store to publish a policy to it.";

/** The api's refusal codes for publish, in plain words. The api's own sentence is used when it says more (a named entry, a plugin version). */
export function publishErrorLine(e: unknown): { message: string; reapprove: boolean } {
  const { code, message } = errorOf(e);
  const words: Record<string, string> = {
    GRANT_MISSING: "Peakhour does not have permission to publish to your store yet. Reconnect it and approve the permissions, then try again.",
    RECONNECT: "Reconnect your store, then try again.",
    NOT_RELEASED: "Publishing to that place is not available yet.",
    NOT_SUPPORTED: message || "Your site cannot take this yet. Update the Peakhour plugin on your site, then try again.",
    MARKET_SCOPED: "This policy is for some countries only, and your store has one policy page for every shopper. Write a policy for every country to publish it there.",
    NOT_A_POLICY: "Only a policy you wrote here under Policies can be published as your store policy. Write it first.",
    POLICY_TYPE_UNSUPPORTED: message || "Your store's policy pages have no place for this kind of policy.",
    POLICY_RETIRED: "The answers this policy was written from have changed, so it is out of date. Write the policy again to publish it.",
    CANNOT_REMOVE: message || "This cannot be removed from here. Change or replace it in your store's admin.",
    TARGET_TAKEN: message || "Another entry already publishes to that page. Take that one off your site first, or edit it instead.",
    IMPORTED: "This entry was imported from your store and is managed there. Take it over to make it yours, then publish it.",
    NOT_ACTIVE: "Only an approved entry can be published. Approve it first.",
    DIVERGED: "This was changed on your site after Peakhour published it. Choose whether to keep Peakhour's text or yours.",
    NOT_CONNECTED: message || "Connect your site or store first.",
    CHOOSE_STORE: message || "You have more than one connection. Choose where to publish.",
  };
  return { message: words[code ?? ""] ?? (message || "That did not publish. Please try again."), reapprove: code === "GRANT_MISSING" || code === "RECONNECT" };
}

export interface Publication {
  id: string;
  channel: string;
  slot: Slot;
  store: string | null;
  state: "pending" | "live" | "diverged" | "failed";
  url: string | null;
  publishedAt: string | null;
  checkedAt: string | null;
  error: string | null;
  outdated: boolean;
  entryStatus: string;
  checkError?: string;
  /** Only on a diverged copy: the words now on the site (null when the site's copy is gone) and when they were read. Absent when the copy is not diverged. */
  remoteText?: string | null;
  remoteSeenAt?: string | null;
}

/** "Live on Acme store as a page", with the states the merchant must see: out of date, changed on the site, failed, or the entry no longer live. */
export function publicationLine(p: Publication, channelLabel: string): { text: string; tone: "ok" | "warn" | "bad" } {
  const where = `${p.store ?? channelLabel} as ${slotWords(p.slot).noun}`;
  if (p.state === "diverged") return { text: `Changed on ${p.store ?? channelLabel} after Peakhour published it (${slotWords(p.slot).noun}).`, tone: "warn" };
  if (p.state === "failed") return { text: `Publishing to ${where} did not work${p.error ? `: ${p.error}` : "."}`, tone: "bad" };
  if (p.state === "pending") return { text: `Publishing to ${where}...`, tone: "warn" };
  if (p.entryStatus !== "active") return { text: `Still live on ${where}, but this entry is no longer live in your assistant. Take it off your site if you do not want it there.`, tone: "warn" };
  if (p.outdated) return { text: `Live on ${where}, but your text has changed since. Publish again to update it.`, tone: "warn" };
  return { text: `Live on ${where}.`, tone: "ok" };
}

/** The publication of this button's slot on this connection. A publication names its connection by the connection's own label (`store`), so two stores on one channel are told apart. */
export function publicationFor<P extends Pick<Publication, "channel" | "slot" | "store">>(pubs: readonly P[], b: Pick<PublishButton, "channel" | "slot" | "connectionLabel">): P | undefined {
  return pubs.find((p) => p.channel === b.channel && p.slot === b.slot && p.store === b.connectionLabel);
}

export function channelLabelFor(caps: CapabilitiesResponse | undefined, channel: string): string {
  return caps?.channels.find((c) => c.channel === channel)?.label ?? channel;
}

/** The two ways out of a divergence. "Keep mine" means the text the merchant put on their site. */
export const DIVERGED_TEXT = "Nothing was overwritten. Choose which text stays.";
export const KEEP_OURS = "Keep Peakhour's";
export const KEEP_THEIRS = "Keep mine";
export const KEEP_OURS_HELP = "Peakhour's text goes back on your site, over what you changed.";
export const KEEP_THEIRS_HELP = "The text on your site becomes a new draft under Suggested answers for you to approve. Your site is left as it is.";
/** After "keep mine" on a store policy the draft has no policy link: the known api gap, stated and not hidden. */
export const KEEP_THEIRS_POLICY_NOTE = "A draft made from your site's text is not linked to your policy answers. To publish it as your store policy again, use Write my policy first.";

export function resolvedLine(keep: "ours" | "theirs", slot: Slot): string {
  if (keep === "ours") return "Peakhour's text is back on your site.";
  return slot === "legal_policy" ? `The text from your site is now a draft under Suggested answers. ${KEEP_THEIRS_POLICY_NOTE}` : "The text from your site is now a draft under Suggested answers. Approve it to use it in your assistant.";
}

/** What the policy row's entries are, for one market set: the draft waiting, the live entry, and the policy row the live entry belongs to. */
export function policyEntryRefs(rows: readonly PolicyRow[] | undefined, markets: readonly string[]): { draftEntryId: string | null; draftPolicyId: string | null; activeEntryId: string | null; policyId: string | null } {
  const mine = (rows ?? []).filter((r) => r.marketKey === marketsKey(markets));
  const active = mine.find((r) => r.activeEntryId);
  const draft = mine.find((r) => r.draftEntryId);
  return { draftEntryId: draft?.draftEntryId ?? null, draftPolicyId: draft?.id ?? null, activeEntryId: active?.activeEntryId ?? null, policyId: active?.id ?? null };
}

/** Per-channel state from the policy rows' publication summaries: "Shopify, your store policy: live". */
export function policyPublicationBadges(rows: readonly PolicyRow[], caps: CapabilitiesResponse | undefined): { key: string; text: string; tone: "ok" | "warn" | "bad" }[] {
  const words: Record<string, { text: string; tone: "ok" | "warn" | "bad" }> = {
    live: { text: "live", tone: "ok" },
    diverged: { text: "changed on your site", tone: "warn" },
    failed: { text: "did not publish", tone: "bad" },
    pending: { text: "publishing", tone: "warn" },
  };
  const out: { key: string; text: string; tone: "ok" | "warn" | "bad" }[] = [];
  for (const r of rows) {
    for (const p of r.publications ?? []) {
      const w = words[p.state] ?? { text: "status unknown", tone: "warn" as const };
      out.push({ key: p.id, text: `${channelLabelFor(caps, p.channel)}, ${slotWords(p.slot).noun}${r.markets.length > 0 ? ` (${r.markets.join(", ")})` : ""}: ${w.text}`, tone: w.tone });
    }
  }
  return out;
}

/** "Read from your site on 4 Nov 2026", or null when the time is unreadable. */
export function remoteSeenLine(iso: string | null | undefined): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  return `Read from your site on ${new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
}

/** The two texts of a divergence. `theirs` is null when the site's copy is gone, and absent from an older api: the banner then says what it can. */
export function divergenceTexts(p: Pick<Publication, "remoteText">, ourText: string | undefined): { ours: string | null; theirs: string | null; gone: boolean } {
  return { ours: ourText?.trim() ? ourText : null, theirs: typeof p.remoteText === "string" && p.remoteText.trim() ? p.remoteText : null, gone: p.remoteText === null };
}

export const REMOTE_GONE = "The page is no longer on your site, so there is no text there to keep.";

/** A copy that can be removed from the channel offers it; one the channel will not let go is explained by the api's refusal. */
export const REMOVE_LABEL = "Take it off";
