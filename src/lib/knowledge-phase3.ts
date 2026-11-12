/**
 * Knowledge base, Phase 3 screens (KE-3.8b): how your policies compare with similar stores, the policy that was live when an order was placed, Messenger and
 * Instagram conversation starters, seasonal entries that expire, and the coverage map.
 *
 * The api (`/v1/kb`, peakhour-api) decides every fact. This file decides which section shows, the words, and what is sent. Nothing here names a channel:
 * a section is drawn from what `publish/capabilities` returns.
 */
import { channelLabel } from "@/lib/knowledge-base";
import { isSetSlot, publishErrorLine, slotWords, type CapabilitiesResponse, type CapabilitySlot } from "@/lib/policy-builder";

const errorOf = (e: unknown): { code?: string; status?: number; message: string } => {
  const o = (e ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  return { code: typeof o.code === "string" ? o.code : undefined, status: typeof o.status === "number" ? o.status : undefined, message: typeof o.message === "string" ? o.message : "" };
};

// -- Dates ---------------------------------------------------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "18 Oct 2026" from "2026-10-18" (a calendar day: no zone, nothing to shift). Null when it is not a real day. */
export function dayLabel(ymd: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

const nextDay = (ymd: string): string => {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10);
};

/** "12 Nov 2026, 19:35 (Asia/Kolkata)": an instant in a named zone. An unreadable zone is read as UTC, and says so. */
export function instantInZone(iso: string | null | undefined, zone: string): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  const at = new Date(t);
  const format = (z: string) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: z, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
    const p = (k: string) => parts.find((x) => x.type === k)?.value ?? "";
    return `${p("day")} ${p("month")} ${p("year")}, ${p("hour")}:${p("minute")} (${z})`;
  };
  try {
    return format(zone);
  } catch {
    return format("UTC");
  }
}

// -- Expiry (KE-3.6) ---------------------------------------------------------------------------------------------------------

export interface Expiring {
  validUntil?: string | null;
  expired?: boolean;
  seasonal?: { eventKey: string; eventDate: string } | null;
  /** On a suggestion: the calendar day the seasonal entry is about. */
  eventDate?: string | null;
}

/** The last day the entry is used: the day it is about when it has one (it stops at the end of that day), else the date of `validUntil`. */
function lastDay(e: Expiring): string | null {
  const day = dayLabel(e.seasonal?.eventDate ?? e.eventDate);
  if (day) return day;
  // `validUntil` is the first instant it is NOT used, so the last day of use is the one before it
  const t = e.validUntil ? Date.parse(e.validUntil) : NaN;
  return Number.isFinite(t) ? dayLabel(new Date(t - 1).toISOString().slice(0, 10)) : null;
}

/** "Used until 18 Oct 2026" on a seasonal entry or suggestion that has not run out; null on any other. */
export function usedUntilLine(e: Expiring): string | null {
  if (e.expired) return null;
  if (!e.validUntil && !e.seasonal && !e.eventDate) return null;
  const d = lastDay(e);
  return d ? `Used until ${d}` : null;
}

/** "Expired on 19 Oct 2026": the day after the last day it was used. Never shown as live. */
export function expiredLine(e: Expiring): string | null {
  if (!e.expired) return null;
  const ymd = e.seasonal?.eventDate ?? e.eventDate;
  const day = ymd && dayLabel(ymd) ? dayLabel(nextDay(ymd)) : null;
  if (day) return `Expired on ${day}`;
  const t = e.validUntil ? Date.parse(e.validUntil) : NaN;
  const fallback = Number.isFinite(t) ? dayLabel(new Date(t).toISOString().slice(0, 10)) : null;
  return fallback ? `Expired on ${fallback}` : "Expired";
}

export const LAPSED_REASON = "This was for a day that has passed. Dismiss it.";

/** Approve is not offered for a suggestion whose day has passed: it would become an entry that is already expired. */
export function lapsedState<S extends { enabled: boolean }>(state: S, lapsed: boolean): S | { enabled: false; reason: string } {
  return lapsed ? { enabled: false, reason: LAPSED_REASON } : state;
}

export const EXPIRED_NOTE = "Your assistant no longer uses this. Write a new entry if you still need it.";
export const EXPIRED_EMPTY = "Nothing has expired.";

// -- Benchmarks (KE-3.5) -----------------------------------------------------------------------------------------------------

export type PolicyFigure =
  | { state: "compared"; key: string; label: string; sentence: string }
  | { state: "too_small"; key: string; label: string }
  | { state: "not_measured"; key: string; label: string; reason: "no_answer" | "too_few_orders" | "unreadable" };

export type PolicyStanding = { state: "unavailable"; reason: "pin_disabled" | "not_connected" | "not_consented" | "no_cohort" } | { state: "too_small" } | { state: "ready"; figures: PolicyFigure[] };

/** The benchmarks the merchant already has (Growth -> Learning, "You vs businesses like you"). */
export const BENCHMARKS_HREF = "/dashboard/growth/learning";

export const TOO_SMALL_LINE = "Not enough stores like yours yet to compare.";

export const BENCHMARKS_NOTE = "This is what other stores do, not advice. None of it is better or worse.";

const UNAVAILABLE: Record<Extract<PolicyStanding, { state: "unavailable" }>["reason"], string> = {
  pin_disabled: "Comparing with other stores is not switched on yet.",
  not_connected: "Connect your store to compare your policies with similar stores.",
  not_consented: "You have not joined Benchmarks, so there is nothing to compare yet. Join Benchmarks to see how your policies compare with stores like yours.",
  no_cohort: "There are no stores like yours to compare with yet.",
};

const NOT_MEASURED: Record<"no_answer" | "too_few_orders" | "unreadable", string> = {
  no_answer: "You have not answered this under Policies yet, so there is nothing to compare.",
  too_few_orders: "There are not enough orders yet to measure this.",
  unreadable: "We could not read this just now.",
};

export type BenchmarkView =
  | { kind: "figures"; figures: { key: string; label: string; text: string; tone: "compared" | "quiet" }[] }
  | { kind: "note"; text: string; href: string | null; linkLabel: string | null };

/** What the Benchmarks card shows. The api's own sentence is shown as it is; every other state gets a plain line, and only `not_consented` links out. */
export function benchmarkView(s: PolicyStanding | undefined): BenchmarkView | null {
  if (!s) return null;
  if (s.state === "too_small") return { kind: "note", text: TOO_SMALL_LINE, href: null, linkLabel: null };
  if (s.state === "unavailable") {
    const text = UNAVAILABLE[s.reason] ?? "Comparing with other stores is not available right now.";
    return s.reason === "not_consented" ? { kind: "note", text, href: BENCHMARKS_HREF, linkLabel: "Go to Benchmarks" } : { kind: "note", text, href: null, linkLabel: null };
  }
  return {
    kind: "figures",
    figures: s.figures.map((f) => {
      if (f.state === "compared") return { key: f.key, label: f.label, text: f.sentence, tone: "compared" as const };
      if (f.state === "too_small") return { key: f.key, label: f.label, text: TOO_SMALL_LINE, tone: "quiet" as const };
      return { key: f.key, label: f.label, text: NOT_MEASURED[f.reason] ?? NOT_MEASURED.unreadable, tone: "quiet" as const };
    }),
  };
}

// -- Chargeback evidence (KE-3.7) ---------------------------------------------------------------------------------------------

export type EvidenceKind = "published" | "as_found" | "removed" | "no_record_before";

export interface EvidenceItem {
  title: string;
  channel: string;
  channelLabel: string;
  slot: string;
  target: string;
  kind: EvidenceKind;
  text: string | null;
  hash: string | null;
  recordedAt: string | null;
  firstRecordAt: string;
  textMayBeCut: boolean;
  sentence: string;
}

export interface PolicyEvidence {
  order: { id: string; name: string | null; number: number | null; placedAtUtc: string; placedAtLocal: string; timeZone: string; timeZoneNote: string | null };
  policies: EvidenceItem[];
  noRecord: boolean;
  summary: string;
  notes: string[];
  generatedAtUtc: string;
}

export const EVIDENCE_EXPORT_PATH = "/v1/kb/policies/evidence/export";
export const EVIDENCE_PATH = "/v1/kb/policies/evidence";

/** What the merchant typed, as the api reads it (number, `#name` or id): trimmed, not empty, and no longer than the api takes. */
export function evidenceOrder(raw: string): { ok: true; order: string } | { ok: false; error: string } {
  const order = raw.trim();
  if (!order) return { ok: false, error: "Enter an order number or id." };
  if (order.length > 64) return { ok: false, error: "That is too long for an order number or id." };
  return { ok: true, order };
}

export const evidenceExportPath = (order: string): string => `${EVIDENCE_EXPORT_PATH}?order=${encodeURIComponent(order)}`;

/** The api's refusal for an order, in plain words. 409 is the one that asks for the platform id (two stores share a number) or says the order has no placed-at time: the api's own sentence says which. */
export function evidenceError(e: unknown): string {
  const { status, message } = errorOf(e);
  if (status === 404) return "We could not find that order. Check the order number or id.";
  if (status === 409) return message || "More than one order matches that. Use the order's platform id (the number in the order's address in your store admin) instead of its number.";
  if (status === 400) return "Enter an order number or id.";
  return "We could not look that order up just now. Please try again.";
}

/** The file download's refusal. */
export function evidenceDownloadError(status: number): string {
  if (status === 404) return "We could not find that order. Check the order number or id.";
  if (status === 409) return "More than one order matches that, or it has no placed-at time. Look the order up first and read the message above it.";
  if (status === 401) return "Your session expired. Refresh the page and try again.";
  return "We could not make that file. Try again in a moment.";
}

export interface EvidenceItemView {
  key: string;
  title: string;
  /** "Live since 12 Nov 2026, 19:35 (Asia/Kolkata)" / "As found on ..." / "Taken off on ..." / "No record before ...". */
  status: string;
  /** "Facebook, your store policy" */
  where: string;
  target: string;
  text: string | null;
  hash: string | null;
  sentence: string;
}

export function evidenceItemView(item: EvidenceItem, zone: string): EvidenceItemView {
  const at = instantInZone(item.recordedAt, zone);
  const first = instantInZone(item.firstRecordAt, zone);
  const status =
    item.kind === "published" ? `Live since ${at ?? "an unknown time"}` : item.kind === "as_found" ? `As found on ${at ?? "an unknown time"}` : item.kind === "removed" ? `Taken off on ${at ?? "an unknown time"}` : `No record before ${first ?? "the first record"}`;
  const noun = slotWords(item.slot).noun;
  return { key: `${item.channel}|${item.target}|${item.kind}|${item.recordedAt ?? "none"}`, title: item.title, status, where: `${item.channelLabel}, ${noun === "this" ? item.slot : noun}`, target: item.target, text: item.text, hash: item.hash, sentence: item.sentence };
}

/** The order's placed-at time in the business's zone and in UTC, as the api returned it. */
export function placedLine(o: PolicyEvidence["order"]): string {
  const utc = instantInZone(o.placedAtUtc, "UTC");
  return `Order placed ${o.placedAtLocal}${utc && o.timeZone !== "UTC" ? `, which is ${utc}` : ""}.`;
}

/** The evidence file's name when the api does not send one readable cross-origin. */
export const evidenceFallbackName = (order: string): string => `policy-evidence-${order.replace(/[^A-Za-z0-9_-]/g, "") || "order"}.html`;

// -- Publishing a set: Messenger and Instagram conversation starters (KE-3.2) --------------------------------------------------

export const ICE_BREAKERS_MAX_DEFAULT = 4;

export interface SetSection {
  key: string;
  channel: string;
  channelLabel: string;
  connectionId: string;
  connectionLabel: string;
  slot: string;
  /** "Messenger conversation starters" */
  heading: string;
  /** Drawn as a working section. False = a note only: `note` says why. */
  enabled: boolean;
  note: string | null;
  reconnect: boolean;
}

const SLOT_HEADINGS: Record<string, string> = {
  ice_breakers_messenger: "Messenger conversation starters",
  ice_breakers_instagram: "Instagram conversation starters",
};
export const setHeading = (slot: string): string => SLOT_HEADINGS[slot] ?? "Conversation starters";

/** A short name for what the starters are shown on, from the slot: "Messenger", "Instagram". */
export const setWhere = (slot: string): string => (setHeading(slot).replace(/ conversation starters$/, "") || "your Page");

export const ICE_BREAKERS_HELP = "Shoppers see these as tappable questions when they open a chat with you. Pick up to four of the questions they ask most. Your assistant answers each from the entry you approved.";

/** Every set slot the capabilities list, one section per connection. A section is never invented: no capabilities, no sections. A slot that is not open says why, in the api's words. */
export function setSections(caps: CapabilitiesResponse | undefined): SetSection[] {
  const out: SetSection[] = [];
  for (const ch of caps?.channels ?? []) {
    for (const conn of ch.connections) {
      for (const s of conn.slots) {
        if (!isSetSlot(s.slot)) continue;
        const base = { key: `${ch.channel}:${conn.id}:${s.slot}`, channel: ch.channel, channelLabel: ch.label, connectionId: conn.id, connectionLabel: conn.label, slot: s.slot, heading: setHeading(s.slot) };
        out.push({ ...base, ...setAvailability(s, conn.label) });
      }
    }
  }
  return out;
}

function setAvailability(s: CapabilitySlot, connection: string): Pick<SetSection, "enabled" | "note" | "reconnect"> {
  if (s.allowed) return { enabled: true, note: null, reconnect: false };
  if (s.reason === "grant_missing") {
    // a publish asks the channel again before it refuses, so a recheckable slot keeps its controls
    return { enabled: !!s.recheckable, note: `Peakhour does not have permission to publish to ${connection} yet. Reconnect it and approve the permissions.`, reconnect: true };
  }
  if (s.reason === "not_supported") return { enabled: false, note: s.message?.trim() || `${connection} cannot take these yet.`, reconnect: false };
  return { enabled: false, note: `Publishing these to ${connection} is not available yet.`, reconnect: false };
}

export interface Candidate {
  id: string;
  title: string;
  timesAsked: number;
  lastAskedAt: string | null;
  fits: boolean;
  published: boolean;
}

export interface CandidatesResponse {
  slot: string;
  maxEntries: number | null;
  candidates: Candidate[];
}

export const maxOf = (r: Pick<CandidatesResponse, "maxEntries"> | undefined): number => (r?.maxEntries && r.maxEntries > 0 ? r.maxEntries : ICE_BREAKERS_MAX_DEFAULT);

/** The first pick: the most-asked candidates whose title fits, up to the most the slot shows. The merchant swaps any. */
export function preselect(r: CandidatesResponse | undefined): string[] {
  if (!r) return [];
  return r.candidates.filter((c) => c.fits).slice(0, maxOf(r)).map((c) => c.id);
}

/** A pick holds only entries that are still candidates: one archived or expired elsewhere since drops out, so it neither counts toward the most nor is sent. */
export const keepKnown = (ids: readonly string[], r: Pick<CandidatesResponse, "candidates"> | undefined): string[] => {
  const known = new Set((r?.candidates ?? []).map((c) => c.id));
  return ids.filter((id) => known.has(id));
};

/** Tick or untick one. Ticking past the most the slot shows changes nothing (the box is disabled, and this holds if a click gets through). */
export function toggleChoice(chosen: readonly string[], id: string, max: number): string[] {
  if (chosen.includes(id)) return chosen.filter((x) => x !== id);
  return chosen.length >= max ? [...chosen] : [...chosen, id];
}

/** "Asked 14 times" / "Asked once" / "Not asked yet". */
export function candidateAskedLine(c: Pick<Candidate, "timesAsked">): string {
  return c.timesAsked <= 0 ? "Not asked yet" : c.timesAsked === 1 ? "Asked once" : `Asked ${c.timesAsked} times`;
}

export const TITLE_TOO_LONG_NOTE = "The title is too long to fit there. Shorten it under Entries first.";

export interface SetBody {
  channel: string;
  slot: string;
  entryIds: string[];
  replace?: true;
  connectionId?: string;
}

/** What is sent. The business is the session's; only the choice goes. Nothing is sent for an empty or over-full pick. */
export function setBody(section: Pick<SetSection, "channel" | "slot" | "connectionId">, chosen: readonly string[], replace: boolean, max: number): { ok: true; body: SetBody } | { ok: false; error: string } {
  const entryIds = [...new Set(chosen)];
  if (entryIds.length === 0) return { ok: false, error: "Choose at least one question." };
  if (entryIds.length > max) return { ok: false, error: `Choose at most ${max}.` };
  return { ok: true, body: { channel: section.channel, slot: section.slot, entryIds, ...(replace ? { replace: true as const } : {}), connectionId: section.connectionId } };
}

export const REPLACE_LABEL = "Replace what is on the Page";
export const REPLACE_HELP = "Takes down the other questions Peakhour put there first, so only the ones you ticked are shown. Without this, the ones you ticked are added to what is already there, up to the most it can show.";

export interface SetResult {
  removed: string[];
  results: { entryId: string; outcome: "published" | "refused" | "skipped"; code?: string; error?: string }[];
}

export interface OutcomeLine {
  entryId: string;
  title: string;
  tone: "ok" | "bad" | "quiet";
  text: string;
}

/** One line per entry, in the order sent: on the Page, why it was refused (the title-too-long refusal in words), or not tried because an earlier one was refused. */
export function outcomeLines(res: SetResult, titles: Record<string, string>): { lines: OutcomeLine[]; removedLine: string | null } {
  const lines = res.results.map((r): OutcomeLine => {
    const title = titles[r.entryId] ?? "This question";
    if (r.outcome === "published") return { entryId: r.entryId, title, tone: "ok", text: "Published." };
    if (r.outcome === "skipped") return { entryId: r.entryId, title, tone: "quiet", text: "Not tried, because an earlier question was refused. Try again once that is sorted." };
    return { entryId: r.entryId, title, tone: "bad", text: publishErrorLine({ code: r.code, message: r.error }).message };
  });
  const n = res.removed.length;
  return { lines, removedLine: n === 0 ? null : n === 1 ? "Took down 1 question that was there before." : `Took down ${n} questions that were there before.` };
}

/** A refusal of the whole call (nothing was published): the api's refusal in words. */
export const setCallError = (e: unknown): string => {
  const { code, message } = errorOf(e);
  const words: Record<string, string> = {
    EMPTY: "Choose at least one question.",
    TOO_MANY: message || "You chose more than it can show.",
    BAD_ID: "One of the questions was not found. Reload the page and try again.",
    NOT_A_SET: message || "These are published one at a time, from each entry.",
  };
  return (code && words[code]) || publishErrorLine(e).message;
};

// -- Coverage map (KE-3.8a) -----------------------------------------------------------------------------------------------------

export interface CoverageTopic {
  key: string;
  label: string;
  asked: number;
  covered: boolean;
  entryId?: string;
  requestId?: string;
  policyType?: string;
}

export interface CoverageResponse {
  days: number;
  topics: CoverageTopic[];
  answeredRate: { channels: string[]; weeks: { weekStart: string; asked: number; answered: number }[] };
  notes: string[];
}

export const COVERAGE_DAYS = [30, 90] as const;
export type CoverageDays = (typeof COVERAGE_DAYS)[number];

/** The section is hidden when the route is not there (the api row has not shipped): a 404 says nothing to the merchant. Any other failure is a real one. */
export function coverageHidden(e: unknown): boolean {
  return errorOf(e).status === 404;
}

export const COVERAGE_EMPTY = "Nothing was asked that your assistant could not place in a topic in this time.";

/** Topics most-asked first (the api's order is kept for ties), each with its own words. */
export function topicRows(topics: readonly CoverageTopic[]): { key: string; label: string; askedLine: string; covered: boolean; action: { kind: "request" | "policy" | "none"; label: string; policyType?: string } }[] {
  return [...topics]
    .map((t, i) => ({ t, i }))
    .sort((a, b) => b.t.asked - a.t.asked || a.i - b.i)
    .map(({ t }) => {
      const askedLine = t.asked === 1 ? "Asked once" : `Asked ${t.asked} times`;
      if (t.covered) return { key: t.key, label: t.label, askedLine, covered: true, action: { kind: "none" as const, label: "" } };
      if (t.policyType) return { key: t.key, label: t.label, askedLine, covered: false, action: { kind: "policy" as const, label: "Write it under Policies", policyType: t.policyType } };
      if (t.requestId) return { key: t.key, label: t.label, askedLine, covered: false, action: { kind: "request" as const, label: "Answer this question" } };
      return { key: t.key, label: t.label, askedLine, covered: false, action: { kind: "none" as const, label: "" } };
    });
}

/** "1 Nov" for a week that starts on that day (`YYYY-MM-DD`); the raw text when it is not a day. */
export function weekLabel(weekStart: string): string {
  const d = dayLabel(weekStart);
  return d ? `Week of ${d.replace(/ \d{4}$/, "")}` : weekStart;
}

export interface WeekRow {
  weekStart: string;
  label: string;
  asked: number;
  answered: number;
  /** Whole-number share answered, or null in a week nothing was asked (never 0%). */
  pct: number | null;
  /** The bar: answered over the busiest week's asked, 0 to 100. */
  barPct: number;
  askedBarPct: number;
}

export function weekRows(weeks: readonly { weekStart: string; asked: number; answered: number }[]): WeekRow[] {
  const peak = Math.max(1, ...weeks.map((w) => w.asked));
  return weeks.map((w) => ({
    weekStart: w.weekStart,
    label: weekLabel(w.weekStart),
    asked: w.asked,
    answered: Math.min(w.answered, w.asked),
    pct: w.asked > 0 ? Math.round((Math.min(w.answered, w.asked) / w.asked) * 100) : null,
    barPct: Math.round((Math.min(w.answered, w.asked) / peak) * 100),
    askedBarPct: Math.round((w.asked / peak) * 100),
  }));
}

/** "Counted on: WhatsApp and Website". The channels are the api's; their names are shown as given, with the ones we know spelled out. */
const COUNTED: Record<string, string> = { whatsapp: "WhatsApp", web: "Website chat", website: "Website chat", storefront: "Storefront chat", instagram: "Instagram", messenger: "Messenger", facebook: "Facebook" };
export function channelsCountedLine(channels: readonly string[]): string {
  const names = channels.map((c) => COUNTED[c] ?? channelLabel(c)).filter(Boolean);
  if (names.length === 0) return "Counted across the chats Peakhour can see.";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Counted on: ${list}.`;
}
