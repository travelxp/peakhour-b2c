/**
 * The knowledge base page's rules (Commerce -> Knowledge base).
 *
 * The page lives in the dashboard but the words live here, because a rule in a
 * render closure is a rule nothing can check. The api (`/v1/kb`, peakhour-api
 * services/kb/kb-editor.ts) is the authority on every bound below; they are
 * repeated so the form can say "too long" before a round trip, and a test pins
 * them to the api's numbers.
 */

export const KB_TITLE_MAX = 256;
export const KB_CONTENT_MAX = 8192;
export const KB_TAG_MAX = 64;
export const KB_TAGS_MAX = 32;

/** `cmrc_merchants.channel`, the api's enum (kb-editor.ts KB_CHANNELS): the editor's checkboxes never wait on a fetch. */
export const KB_CHANNELS = ["shopify", "woocommerce"] as const;

export type KbSource = "owner" | "import" | "learned";

export interface KbEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source: KbSource;
  status: "active" | "archived";
  /** Empty = every channel. */
  channels: string[];
  readOnly: boolean;
  managedIn: string | null;
  url: string | null;
  syncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface KbRequest {
  id: string;
  question: string;
  timesAsked: number;
  lastAskedAt: string | null;
  createdAt: string | null;
  status: "open" | "answered" | "dismissed";
  answeredEntryId: string | null;
}

export interface KbForm {
  title: string;
  content: string;
  /** Comma- or newline-separated. */
  tags: string;
  channels: string[];
}

export interface KbPayload {
  title: string;
  content: string;
  tags: string[];
  channels: string[];
}

export const EMPTY_FORM: KbForm = { title: "", content: "", tags: "", channels: [] };

/** "a, b\nc" -> ["a","b","c"], trimmed, no blanks, no repeats. */
export function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean)));
}

export function entryToForm(e: KbEntry): KbForm {
  return { title: e.title, content: e.content, tags: e.tags.join(", "), channels: [...e.channels] };
}

/** The form as the api wants it, or the sentence to show beside the field. */
export function formToPayload(f: KbForm): { ok: true; payload: KbPayload } | { ok: false; error: string; field: "title" | "content" | "tags" } {
  const title = f.title.trim();
  const content = f.content.trim();
  const tags = parseTags(f.tags);
  if (!title) return { ok: false, field: "title", error: "Give the entry a title - the question it answers works well." };
  if (title.length > KB_TITLE_MAX) return { ok: false, field: "title", error: `The title can be at most ${KB_TITLE_MAX} characters.` };
  if (!content) return { ok: false, field: "content", error: "Write the answer your assistant should give." };
  if (content.length > KB_CONTENT_MAX) return { ok: false, field: "content", error: `The answer can be at most ${KB_CONTENT_MAX} characters.` };
  if (tags.length > KB_TAGS_MAX) return { ok: false, field: "tags", error: `Use at most ${KB_TAGS_MAX} tags.` };
  if (tags.some((t) => t.length > KB_TAG_MAX)) return { ok: false, field: "tags", error: `A tag can be at most ${KB_TAG_MAX} characters.` };
  return { ok: true, payload: { title, content, tags, channels: f.channels } };
}

/** An answer to a question: only the answer is required; the title defaults to the question. */
export function answerToPayload(content: string): { ok: true; payload: { content: string } } | { ok: false; error: string } {
  const c = content.trim();
  if (!c) return { ok: false, error: "Write the answer first." };
  if (c.length > KB_CONTENT_MAX) return { ok: false, error: `The answer can be at most ${KB_CONTENT_MAX} characters.` };
  return { ok: true, payload: { content: c } };
}

export function charsLeft(content: string): number {
  return KB_CONTENT_MAX - content.length;
}

const CHANNEL_LABELS: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce" };
export const channelLabel = (c: string): string => CHANNEL_LABELS[c] ?? c;

/** Where an entry applies. An entry with no channel applies to every one. */
export function channelsLine(channels: string[]): string {
  return channels.length ? channels.map(channelLabel).join(", ") : "All channels";
}

export function sourceLabel(e: Pick<KbEntry, "source" | "managedIn">): string {
  if (e.source === "import") return e.managedIn ? `Imported from ${e.managedIn}` : "Imported";
  if (e.source === "learned") return "Learned from a conversation";
  return "Written by you";
}

/** Why an imported entry has no edit button, and what to do about it. */
export function readOnlyNote(e: Pick<KbEntry, "readOnly" | "managedIn">): string | null {
  if (!e.readOnly) return null;
  return `Managed in ${e.managedIn ?? "its source"} and refreshed from there, so it is read-only here. Take it over to write your own version - Peakhour then stops refreshing it.`;
}

/** Only an http(s) address becomes a link: React does not stop a `javascript:` href. */
export function safeUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  return u && /^https?:\/\//i.test(u) ? u : null;
}

/** "Asked once" / "Asked 4 times". */
export function askedLine(r: Pick<KbRequest, "timesAsked">): string {
  return r.timesAsked === 1 ? "Asked once" : `Asked ${r.timesAsked} times`;
}

/** The api's refusal as the sentence to show; its own wording when it sent one. */
export function kbErrorMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : "";
  return m || "That did not save. Please try again.";
}

// -- Suggested answers (KE-1.9) ----------------------------------------------------------------------------------------
// The api (`GET /v1/kb/suggestions`, services/kb/suggestions.ts) decides what is suggested and how often it was asked.
// This file decides only the order, what is highlighted, when Approve is allowed, and the words.

export interface KbEvidence {
  kind: "entry" | "reply" | "fact";
  ref: string;
  quote: string;
}

export interface KbSuggestion {
  id: string;
  title: string;
  content: string;
  topic: string | null;
  origin: "request" | "reply" | "generator" | "upload";
  evidence: KbEvidence[];
  needsFacts: string[];
  hasPlaceholders: boolean;
  timesAsked: number;
  lastAskedAt: string | null;
  requestCount: number;
  draftedAt: string | null;
}

export interface KbRouted {
  count: number;
  topics: { label: string; count: number }[];
  destination: "catalog_manager" | "inbox";
}

export interface KbSuggestionsResponse {
  suggestions: KbSuggestion[];
  routed: { product_info: KbRouted; support: KbRouted };
}

/** The api's own placeholder rule (services/kb/drafts.ts PLACEHOLDER): a [bracketed] detail of 1-120 characters on one line. */
const PLACEHOLDER = /\[[^[\]\n]{1,120}\]/g;

/** The [bracketed] details still to fill in, in order. */
export function placeholdersIn(text: string): string[] {
  return text.match(PLACEHOLDER) ?? [];
}

export type TextPart = { text: string; placeholder: boolean };

/** The text cut into plain and placeholder runs, so the page can highlight the details still missing. */
export function splitPlaceholders(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const m of text.matchAll(PLACEHOLDER)) {
    const i = m.index ?? 0;
    if (i > at) parts.push({ text: text.slice(at, i), placeholder: false });
    parts.push({ text: m[0], placeholder: true });
    at = i + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), placeholder: false });
  return parts;
}

/** Most asked first, then the most recently asked; stable on the id. */
export function sortSuggestions<T extends Pick<KbSuggestion, "id" | "timesAsked" | "lastAskedAt">>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => b.timesAsked - a.timesAsked || (b.lastAskedAt ?? "").localeCompare(a.lastAskedAt ?? "") || a.id.localeCompare(b.id));
}

/** "Asked 14 times · last asked 2 days ago". `now` is passed in so the line is testable. */
export function suggestionAskedLine(s: Pick<KbSuggestion, "timesAsked" | "lastAskedAt">, now: number): string {
  const head = askedLine(s);
  const last = s.lastAskedAt ? Date.parse(s.lastAskedAt) : NaN;
  if (!Number.isFinite(last)) return head;
  const days = Math.floor((now - last) / 86_400_000);
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `${head} · last asked ${when}`;
}

/** Approve is allowed only when the words, as they would be saved, have a title, an answer within bounds and no placeholder left. The reason is text, not only a disabled button. */
export function approveState(title: string, content: string): { enabled: true } | { enabled: false; reason: string } {
  const t = title.trim();
  const c = content.trim();
  if (!t) return { enabled: false, reason: "Give it a title to approve." };
  if (!c) return { enabled: false, reason: "Write the answer to approve." };
  if (t.length > KB_TITLE_MAX) return { enabled: false, reason: `The title can be at most ${KB_TITLE_MAX} characters.` };
  if (c.length > KB_CONTENT_MAX) return { enabled: false, reason: `The answer can be at most ${KB_CONTENT_MAX} characters.` };
  const left = placeholdersIn(`${t}\n${c}`);
  if (left.length > 0) return { enabled: false, reason: left.length === 1 ? "Fill in the detail in [square brackets] to approve." : `Fill in the ${left.length} details in [square brackets] to approve.` };
  return { enabled: true };
}

/** What an approve or a save sends: the edited words, trimmed. */
export function suggestionPayload(title: string, content: string): { title: string; content: string } {
  return { title: title.trim(), content: content.trim() };
}

export const SUGGESTIONS_EMPTY = "No suggested answers right now. When shoppers ask something your assistant cannot answer, a suggestion appears here.";
export const APPROVED_LINE = "Approved. Your assistant now answers this on every channel.";

/** The "Based on" line from the evidence quotes. Null when there is none. */
export function basedOnLine(evidence: readonly KbEvidence[]): string | null {
  const quotes = evidence.map((e) => e.quote.trim()).filter(Boolean);
  if (quotes.length === 0) return null;
  const shown = quotes.slice(0, 3).map((q) => `"${q.length > 140 ? `${q.slice(0, 139)}…` : q}"`);
  return `Based on: ${shown.join("; ")}${quotes.length > 3 ? ` and ${quotes.length - 3} more` : ""}`;
}

export interface RoutedLine {
  text: string;
  linkLabel: string;
  href: string;
}

/** "12 questions were about products: improve them in Catalog Manager" and "5 were support problems: see Inbox". Nothing is drafted for these. */
export function routedLines(routed: KbSuggestionsResponse["routed"] | undefined): RoutedLine[] {
  const out: RoutedLine[] = [];
  const p = routed?.product_info.count ?? 0;
  const s = routed?.support.count ?? 0;
  if (p > 0) out.push({ text: `${p} ${p === 1 ? "question was" : "questions were"} about products:`, linkLabel: "improve them in Catalog Manager", href: "/dashboard/commerce/catalog" });
  if (s > 0) out.push({ text: s === 1 ? "1 was a support problem:" : `${s} were support problems:`, linkLabel: "see Inbox", href: "/dashboard/inbox" });
  return out;
}

// -- Policy health (KE-1.9) --------------------------------------------------------------------------------------------

export type FindingSeverity = "important" | "revisit" | "tip";

export interface KbFinding {
  id: string;
  entryId?: string;
  entryTitle?: string;
  checkKind: string;
  severity: string;
  quote?: string;
  why: string;
  suggestion: string;
  evidence?: { sourceUrl?: string; sourceTitle?: string; claims?: string[]; asked?: number; market?: string };
  state: string;
  lastSeenAt: string;
}

export interface KbFindingsResponse {
  findings: KbFinding[];
  total: number;
  notice: string;
}

export const LEGAL_LINE = "This is guidance, not legal advice.";
export const FINDINGS_EMPTY = "We check your policies regularly. Nothing needs a second look right now.";
export const FINDINGS_DISMISSED_EMPTY = "You have not dismissed anything.";

export const SEVERITY_ORDER: readonly FindingSeverity[] = ["important", "revisit", "tip"];
const SEVERITY_HEADINGS: Record<FindingSeverity, string> = { important: "Look at these first", revisit: "Worth a revisit", tip: "Tips" };
export const severityHeading = (s: FindingSeverity): string => SEVERITY_HEADINGS[s];

const isSeverity = (s: string): s is FindingSeverity => (SEVERITY_ORDER as readonly string[]).includes(s);

/** A finding is legal when the api says so, or when it carries an official source. */
export function isLegal(f: Pick<KbFinding, "checkKind" | "evidence">): boolean {
  return f.checkKind === "legal" || typeof f.evidence?.sourceUrl === "string";
}

/**
 * Findings grouped by severity, most important first, each group in the api's order. A tip is its own group: it is never listed with the others, so it is
 * never under a legal heading. An unknown severity is shown as a revisit rather than dropped. Empty groups are left out.
 */
export function groupFindings<T extends Pick<KbFinding, "severity">>(list: readonly T[]): { severity: FindingSeverity; findings: T[] }[] {
  const by = new Map<FindingSeverity, T[]>(SEVERITY_ORDER.map((s) => [s, []]));
  for (const f of list) by.get(isSeverity(f.severity) ? f.severity : "revisit")!.push(f);
  return SEVERITY_ORDER.map((severity) => ({ severity, findings: by.get(severity)! })).filter((g) => g.findings.length > 0);
}

/** What a finding shows under its suggestion. A legal finding always carries the guidance line, and its source as a link when the address is safe. */
export function findingFooter(f: Pick<KbFinding, "checkKind" | "evidence">): { legalLine: string | null; sourceHref: string | null; sourceLabel: string | null } {
  if (!isLegal(f)) return { legalLine: null, sourceHref: null, sourceLabel: null };
  const href = safeUrl(typeof f.evidence?.sourceUrl === "string" ? f.evidence.sourceUrl : null);
  const title = typeof f.evidence?.sourceTitle === "string" ? f.evidence.sourceTitle.trim() : "";
  return { legalLine: LEGAL_LINE, sourceHref: href, sourceLabel: href ? title || "Official source" : null };
}

/** For a reality check: what the answer claims, from the evidence. Null for any other finding. */
export function realityLine(f: Pick<KbFinding, "checkKind" | "evidence">): string | null {
  if (f.checkKind !== "reality") return null;
  const claims = (f.evidence?.claims ?? []).filter((c) => typeof c === "string" && c.trim());
  return claims.length === 0 ? null : `Your answer says: ${claims.slice(0, 3).join("; ")}`;
}

/** An imported policy can change only in Shopify, or be taken over here. */
export function isImportedPolicy(entry: Pick<KbEntry, "readOnly" | "source"> | undefined): boolean {
  return !!entry && entry.readOnly && entry.source === "import";
}

/** The Shopify admin's legal policies settings page, or null without a store handle. The handle is checked, never trusted. */
export function shopifyPoliciesHref(shop: string | null | undefined): string | null {
  if (typeof shop !== "string" || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null;
  return `https://admin.shopify.com/store/${shop.replace(/\.myshopify\.com$/, "")}/settings/legal`;
}

/**
 * Approve with the edited words. The decision (may it be sent, what is sent, what is said when the api refuses) is here so a test can run it with a
 * fake `send`; the page only passes the mutation in. The api's own sentence is shown when it refuses (placeholders left, entry limit, edited meanwhile).
 */
export async function runApprove(
  send: (payload: { title: string; content: string }) => Promise<unknown>,
  title: string,
  content: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = approveState(title, content);
  if (!state.enabled) return { ok: false, error: state.reason };
  try {
    await send(suggestionPayload(title, content));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: kbErrorMessage(e) };
  }
}

/** Run a call whose failure is shown as the api's sentence (dismiss, save, reopen). */
export async function runAction(send: () => Promise<unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await send();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: kbErrorMessage(e) };
  }
}
