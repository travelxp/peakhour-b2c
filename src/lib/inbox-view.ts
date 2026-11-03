import { ApiError } from "@/lib/api";
import type { ListFetchState } from "@/lib/list-fetch-state";

/**
 * What the Inbox's Conversations tab decides, kept apart from the markup so it can be tested without a DOM (Inbox phase 1).
 *
 * The rules that matter live in the API: which threads are this business's, what "needs you" means, what a connection state is.
 * This file is what the page does with the answer.
 */

// ── the one subtitle ───────────────────────────────────────────────────────────────────────────────────────────────

/** The line under the page title. Storefront chats are listed beside WhatsApp, so it says so. */
export const INBOX_SUBTITLE = "Your WhatsApp and storefront conversations, leads and reviews in one place.";

// ── channels ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type Channel = "whatsapp" | "storefront";
export type ChannelFilter = "all" | Channel;

export const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: "WhatsApp", storefront: "Storefront" };

export const CHANNEL_FILTERS: Array<{ value: ChannelFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "whatsapp", label: CHANNEL_LABEL.whatsapp },
  { value: "storefront", label: CHANNEL_LABEL.storefront },
];

// ── status chips and search (Inbox phase 2) ───────────────────────────────────────────────────────────────────────────

export type StatusFilter = InboxState;

/**
 * The chips. ★"Open" IS EVERY CONVERSATION NOBODY HAS MARKED DONE (Needs you included), as the api's chip is; it is the page's
 * starting chip, so a conversation marked Done leaves the list a person works from, and "Done" is one tap away.
 */
export const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "open", label: "Open" },
  { value: "needs_you", label: "Needs you" },
  { value: "done", label: "Done" },
];
export const DEFAULT_STATUS_FILTER: StatusFilter = "open";

/** The shortest search sent to the api: one character matches everyone and is not a search. */
export const SEARCH_MIN = 2;
/** The longest (the api's bound); anything past it is cut here so what is sent is what is shown. */
export const SEARCH_MAX = 40;
/** How long typing pauses before the search is sent. */
export const SEARCH_DEBOUNCE_MS = 350;

/** The text to search for, or "" for none: whitespace collapsed, bounded, and too short to search treated as nothing. */
export function searchTerm(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX);
  return t.length >= SEARCH_MIN ? t : "";
}

/** One line in the list, whichever channel it came from. */
export interface InboxRow {
  threadId: string;
  channel: Channel;
  title: string;
  preview: string;
  status: string;
  updatedAt: string | null;
  /** The shopper's last message, for the unread dot (WhatsApp); the last activity for a storefront chat. */
  activityAt: string | null;
  held: "conversation" | "business" | null;
  /** The assistant handed it to the team and nobody has picked it up. */
  needsYou: boolean;
  /** Open / Needs you / Done: the one state the api says the row is in (Inbox phase 2). */
  state: InboxState;
  /** The merchant's own "Test on your store" chat: labelled "Test" in the list. */
  test: boolean;
}

/** What a conversation is, as the api decides it (Done wins over Needs you; a new shopper message re-opens a Done one). */
export type InboxState = "open" | "needs_you" | "done";

interface WaLike {
  threadId: string;
  waId: string;
  contactName: string | null;
  status: string;
  updatedAt: string | null;
  lastInboundAt: string | null;
  preview: string;
  held?: "conversation" | "business" | null;
  needsYou?: boolean;
  state?: InboxState;
}
interface StorefrontLike {
  threadId: string;
  contactName: string;
  status: string;
  updatedAt: string | null;
  preview: string;
  held?: "conversation" | "business" | null;
  state?: InboxState;
  test?: boolean;
}

export function rowOfWhatsApp(c: WaLike): InboxRow {
  return {
    threadId: c.threadId,
    channel: "whatsapp",
    title: c.contactName || c.waId || "WhatsApp contact",
    preview: c.preview,
    status: c.status,
    updatedAt: c.updatedAt,
    // ★THE SHOPPER'S LAST MESSAGE ONLY. `updatedAt` moves on the team's own replies and on status changes too, and a dot for your own
    //  action is wrong; a conversation with no inbound message has nothing to be unread.
    activityAt: c.lastInboundAt,
    held: c.held ?? null,
    needsYou: c.needsYou === true,
    // ★THE API'S WORD. An older api sends none: derive it from the flag it did send, never from the chat's age.
    state: c.state ?? (c.needsYou === true ? "needs_you" : "open"),
    test: false,
  };
}

export function rowOfStorefront(c: StorefrontLike): InboxRow {
  return {
    threadId: c.threadId,
    channel: "storefront",
    // the API sends the label; the page never invents a name
    title: c.contactName,
    preview: c.preview,
    status: c.status,
    updatedAt: c.updatedAt,
    activityAt: c.updatedAt,
    held: c.held ?? null,
    needsYou: false,
    state: c.state ?? "open",
    test: c.test === true,
  };
}

const time = (iso: string | null): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/**
 * The conversation an email link opens: `/dashboard/inbox?tab=conversations&thread=<key>`. ★A KEY, NOT ANYTHING: it must look like
 * one of our two thread keys, so a hand-written link cannot put arbitrary text where the page expects an id. Whether the thread is
 * this business's is the api's to say (it answers 404 for another's); the page then shows "couldn't load this conversation".
 */
export function threadFromParam(value: string | null | undefined): string | null {
  return typeof value === "string" && /^(?:whatsapp|storefront):[A-Za-z0-9._:~-]{1,250}$/.test(value) ? value : null;
}

/** The channel a thread id belongs to, from its key. */
export function channelOfThread(threadId: string): Channel {
  return threadId.startsWith("storefront:") ? "storefront" : "whatsapp";
}

/**
 * Both channels as one list: the conversations that NEED YOU first, then the most recently updated. ★A FILTER IS APPLIED HERE,
 * NOT BY HIDING ROWS IN THE MARKUP, so what the count and the empty state say is what the list shows.
 */
export function mergeRows(whatsapp: readonly InboxRow[], storefront: readonly InboxRow[], filter: ChannelFilter): InboxRow[] {
  const all = filter === "whatsapp" ? [...whatsapp] : filter === "storefront" ? [...storefront] : [...whatsapp, ...storefront];
  return all.sort((a, b) => Number(b.needsYou) - Number(a.needsYou) || time(b.updatedAt) - time(a.updatedAt));
}

/**
 * The state of the merged list, from the WhatsApp query's and the storefront query's.
 *
 *  - ROWS WIN: with any row to show the list is shown; a failed refresh of either half says so without taking the rows away.
 *  - NO ROWS: a failure of either half is a failure (never "No conversations yet": that is a claim only a completed pair earns).
 *  - The caller passes WhatsApp as "empty" when the api said it is not available or not connected (that is a state with its own card,
 *    not an error and not a spinner).
 */
export function combineListState(wa: ListFetchState, storefront: ListFetchState, rows: number): ListFetchState {
  const parts = [wa, storefront];
  if (rows > 0) return parts.includes("error") || parts.includes("stale") ? "stale" : "ready";
  if (parts.includes("error")) return "error";
  if (parts.includes("loading")) return "loading";
  if (parts.includes("paused")) return "paused";
  if (parts.every((p) => p === "waiting")) return "waiting";
  return "empty";
}

// ── honest states ──────────────────────────────────────────────────────────────────────────────────────────────────

export type WaInboxState = "ok" | "not_available" | "not_connected" | "needs_reauth";

/** Just enough of the list answer to decide. A field an older api does not send is not read as a state. */
export interface WaInboxLike {
  available?: boolean;
  connected?: boolean;
  needsReauth?: boolean;
}

/**
 * What the WhatsApp half of the Inbox is, from the list query's answer or its error.
 *
 *  - A 404 is the api's "WhatsApp is not available" (the integration is hidden): not a failure.
 *  - `connected: false` with no re-auth need is "not connected"; with `needsReauth` it is "reconnect", and the past
 *    conversations are still listed (they are the merchant's).
 *  - ★A FIELD THAT IS ABSENT IS NOT A STATE (an older api): the page claims nothing it was not told.
 */
export function waInboxState(input: { data?: WaInboxLike | undefined; error?: unknown }): WaInboxState {
  if (input.error instanceof ApiError && input.error.status === 404) return "not_available";
  const d = input.data;
  if (!d) return "ok";
  if (d.available === false) return "not_available";
  if (d.needsReauth === true) return "needs_reauth";
  if (d.connected === false) return "not_connected";
  return "ok";
}

export const WHATSAPP_CONNECT_HREF = "/dashboard/content/whatsapp";

export interface InboxNotice {
  title: string;
  body: string;
  cta?: { label: string; href: string };
}

/** The card for a WhatsApp state that is not "ok"; null when there is nothing to say. */
export function waNotice(state: WaInboxState): InboxNotice | null {
  switch (state) {
    case "not_connected":
      return {
        title: "Connect WhatsApp to see your conversations",
        body: "Shoppers who message your WhatsApp number show up here, and you can reply to them. Your storefront chats, leads and reviews are already here.",
        cta: { label: "Connect WhatsApp", href: WHATSAPP_CONNECT_HREF },
      };
    case "needs_reauth":
      return {
        title: "Reconnect WhatsApp",
        body: "New WhatsApp messages are not reaching you until you reconnect. Your past conversations are still below.",
        cta: { label: "Reconnect WhatsApp", href: WHATSAPP_CONNECT_HREF },
      };
    case "not_available":
      return {
        title: "WhatsApp isn't available yet",
        body: "Your storefront chats, leads and reviews are still here.",
      };
    default:
      return null;
  }
}

/**
 * The empty-list sentence, only for a list that completed and has nothing to show for the chosen channel, chip and search.
 * ★A SEARCH OR A CHIP THAT FINDS NOTHING SAYS SO; it never claims the inbox is empty.
 */
export function emptyListText(filter: ChannelFilter, state: WaInboxState, view: { status?: StatusFilter; search?: string } = {}): string {
  if (view.search) {
    return filter === "storefront"
      ? "Storefront visitors have no name, number or order, so a search finds none of them. Clear the search to see them."
      : `No conversations match \u201c${view.search}\u201d. Try a name, the last four digits of a number, or an order number.`;
  }
  if (view.status === "needs_you") return "Nothing needs you right now.";
  if (view.status === "done") return "No conversations are marked done.";
  if (filter === "storefront") return "No storefront chats yet. When a visitor talks to the assistant on your store, the chat appears here.";
  if (filter === "whatsapp") return state === "ok" ? "No WhatsApp conversations yet." : "No WhatsApp conversations to show.";
  return "No conversations yet.";
}

// ── time ───────────────────────────────────────────────────────────────────────────────────────────────────────────

// A fixed locale, so a label reads the same on every host (the zone is the viewer's unless a test names one).
const LOCALE = "en-GB";

export function clockLabel(iso: string | null | undefined, timeZone?: string): string {
  const t = time(iso ?? null);
  if (!t) return "";
  return new Date(t).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, ...(timeZone ? { timeZone } : {}) });
}

const dayKey = (t: number, timeZone?: string): string => new Date(t).toLocaleDateString("en-CA", { ...(timeZone ? { timeZone } : {}) });

/** The calendar day before a `YYYY-MM-DD` key. ★CALENDAR ARITHMETIC, NOT "24 hours ago": on a daylight-saving day that lands on the same date. */
const dayBefore = (key: string): string => new Date(Date.parse(`${key}T00:00:00Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** "Today", "Yesterday", or "3 Nov 2026". */
export function dayLabel(iso: string | null | undefined, now: Date, timeZone?: string): string {
  const t = time(iso ?? null);
  if (!t) return "";
  const day = dayKey(t, timeZone);
  if (day === dayKey(now.getTime(), timeZone)) return "Today";
  if (day === dayBefore(dayKey(now.getTime(), timeZone))) return "Yesterday";
  return new Date(t).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", ...(timeZone ? { timeZone } : {}) });
}

/** The time on a list row: the clock today, "Yesterday", then the date. */
export function previewTime(iso: string | null | undefined, now: Date, timeZone?: string): string {
  const label = dayLabel(iso, now, timeZone);
  if (label === "") return "";
  if (label === "Today") return clockLabel(iso, timeZone);
  if (label === "Yesterday") return label;
  const t = time(iso ?? null);
  return new Date(t).toLocaleDateString(LOCALE, { day: "numeric", month: "short", ...(timeZone ? { timeZone } : {}) });
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Messages in the order they came, cut into days. A message with no time joins the group before it (or opens one with no
 * label): it is shown, never dropped or sorted to the top.
 */
export function groupByDay<T extends { timestamp: string | null }>(messages: readonly T[], now: Date, timeZone?: string): Array<DayGroup<T>> {
  const groups: Array<DayGroup<T>> = [];
  for (const m of messages) {
    const t = time(m.timestamp);
    const key = t ? dayKey(t, timeZone) : (groups[groups.length - 1]?.key ?? "unknown");
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(m);
    } else {
      groups.push({ key, label: t ? dayLabel(m.timestamp, now, timeZone) : "", items: [m] });
    }
  }
  return groups;
}

// ── unread ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Which conversations this person has looked at, kept in this browser (there is no server field: nobody else's reading changes
 * your dot, and a new device starts clean). `baseline` is when this browser first saw the Inbox: everything older counts as read,
 * so the first visit is not a wall of dots.
 */
export interface ReadMarks {
  baseline: string;
  reads: Record<string, string>;
}

/** The most threads whose mark is kept; the oldest go first, so the entry cannot grow without bound. */
export const READ_MARKS_MAX = 300;

export function readMarksKey(userId: string | null | undefined, businessId: string | null | undefined): string {
  return `peakhour:inbox-read:${userId ?? "anon"}:${businessId ?? "none"}`;
}

/**
 * The browser's storage, or null when there is none or it cannot be touched. ★THE ACCESSOR ITSELF CAN THROW (Safari with site data
 * blocked, a sandboxed frame): reading `window.localStorage` is guarded here, so it never takes a page down.
 */
export function browserStorage(): MarkStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** A tiny storage seam, so this runs where there is no `window` (a test, a server render) and where storage throws. */
export interface MarkStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadReadMarks(storage: MarkStorage | null, key: string, now: Date): ReadMarks {
  const fresh: ReadMarks = { baseline: now.toISOString(), reads: {} };
  if (!storage) return fresh;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<ReadMarks> | null;
    if (!parsed || typeof parsed.baseline !== "string" || !time(parsed.baseline) || typeof parsed.reads !== "object" || parsed.reads === null) return fresh;
    const reads: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.reads)) if (typeof v === "string" && time(v)) reads[k] = v;
    return { baseline: parsed.baseline, reads };
  } catch {
    return fresh;
  }
}

export function saveReadMarks(storage: MarkStorage | null, key: string, marks: ReadMarks): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(marks));
  } catch {
    // a private window or a full disk: the dot comes back next visit, nothing else breaks
  }
}

/** Unread: the conversation has activity after the later of this browser's baseline and the last time it was opened. */
export function isUnread(row: Pick<InboxRow, "threadId" | "activityAt">, marks: ReadMarks): boolean {
  const activity = time(row.activityAt);
  if (!activity) return false;
  return activity > Math.max(time(marks.baseline), time(marks.reads[row.threadId] ?? null));
}

/** Opening a conversation marks it read as of `at` (or its latest activity if that is later, so a clock skew cannot keep a dot). */
export function markRead(marks: ReadMarks, row: Pick<InboxRow, "threadId" | "activityAt">, at: Date): ReadMarks {
  const readAt = Math.max(at.getTime(), time(row.activityAt));
  const reads = { ...marks.reads, [row.threadId]: new Date(readAt).toISOString() };
  const ids = Object.keys(reads);
  if (ids.length > READ_MARKS_MAX) {
    ids.sort((a, b) => time(reads[a] ?? null) - time(reads[b] ?? null));
    for (const id of ids.slice(0, ids.length - READ_MARKS_MAX)) delete reads[id];
  }
  return { baseline: marks.baseline, reads };
}

// ── the buttons ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * "Return to AI" on a thread a person holds. ★THERE IS NO "TAKE OVER" BUTTON (Inbox phase 2): typing and sending a reply takes the
 * conversation over, so the one hand-over step left is the way back. Null when the assistant holds the thread.
 */
export function handoverAction(status: string): { kind: "return"; label: string; variant: "outline" } | null {
  return status === "escalated" ? { kind: "return", label: "Return to AI", variant: "outline" } : null;
}

/**
 * Mark done / Reopen, for the person who may (editor or above; the api enforces it). Done conversations offer "Reopen"; every other
 * state offers "Mark done". Null for a viewer: they can read, not change.
 */
export function doneAction(state: InboxState, canChange: boolean): { kind: "done" | "reopen"; label: string } | null {
  if (!canChange) return null;
  return state === "done" ? { kind: "reopen", label: "Reopen" } : { kind: "done", label: "Mark done" };
}

/** What a person is told after the mark changes. ★It says what happens next, because Done is also a promise about the customer. */
export function doneToast(done: boolean, resumed: boolean): string {
  if (!done) return "Reopened.";
  return resumed
    ? "Marked done. The assistant will answer again if the customer writes back."
    : "Marked done. If the customer writes back, it will return to your Open list.";
}

// ── the phone layout ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Below `lg` the list and the thread are separate views: with a conversation open only the thread shows (with a back button),
 * without one only the list. From `lg` up both show side by side.
 */
export function paneClasses(selected: string | null): { list: string; thread: string } {
  return {
    list: selected ? "hidden lg:block" : "block",
    thread: selected ? "flex" : "hidden lg:flex",
  };
}
