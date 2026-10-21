import { ApiError } from "@/lib/api";
import type {
  ConversationMessage,
  ConversationPage,
  ConversationPageParam,
  MerchantContact,
} from "@/lib/api/control-plane";
import { WHATSAPP_SETTINGS_HREF } from "@/lib/control-plane";

/**
 * The pure half of the Conversation tab (WA M6) on `/dashboard/settings/whatsapp`.
 *
 * The tab shows the signed-in user's own WhatsApp conversation with Peakhour,
 * read from `GET /v1/control-plane/conversation` (api#1529). As with the rest
 * of this page, `vitest` runs in `environment: "node"` with no render tests, so
 * every decision the tab makes lives here and the component does layout.
 *
 * What the api returns, and so what every sentence below must agree with:
 * - the platform threads of the numbers THIS USER verified on THIS BUSINESS;
 * - a number another user also holds verified, on any business, is skipped;
 * - ONLY THIS BUSINESS'S TURNS (owner answer 2026-10-21, item 19). The thread
 *   is per number, so the api decides per line (`lineBelongsToBusiness`):
 *   - a line Peakhour labelled with this business shows from the time the
 *     user verified the number HERE;
 *   - an unlabelled line (from before the labels, or sent while the number was
 *     verified on more than one business) shows only when the number is
 *     verified on this business alone, and only from its `historyBoundary`:
 *     the newest `verifiedAt`/`revokedAt` on any of its rows, on any business;
 * - a thread keeps at most its latest 50 messages;
 * - a verification code is never recorded, and the digest and alerts are not
 *   sent from Peakhour's number yet, so they are not in the thread;
 * - a refusal is a 403, never an empty page;
 * - pages (item 20): a date window (`since`/`until`), then `nextCursor` for
 *   older and `newerCursor` for newer, both walking out of the window.
 */

// ── The cache entry ───────────────────────────────────────────────────────

export const CONTROL_PLANE_CONVERSATION_KEY = "/v1/control-plane/conversation";

/**
 * One cache entry per org, business AND user, and per place the tab opened on.
 * The api answers for the caller's own numbers on the session's business, so
 * the same business reads a different conversation for each teammate. The
 * anchor (`anchorKeyPart`) is last: a jump to a date is a different list of
 * pages from the latest one. The path stays first so a prefix invalidation
 * reaches every entry.
 */
export function conversationKey(
  orgId: string | null | undefined,
  businessId: string | null | undefined,
  userId: string | null | undefined,
  anchor: string = LATEST_KEY_PART,
) {
  return [
    CONTROL_PLANE_CONVERSATION_KEY,
    orgId ?? null,
    businessId ?? null,
    userId ?? null,
    anchor,
  ] as const;
}

// ── Where the tab opens (owner answer 2026-10-21, item 20) ─────────────────

/** The tab opens on the last this-many days, then loads older ones on scroll. */
export const RECENT_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where the tab opens: the latest messages (the last `RECENT_DAYS` days), or a
 * day the reader jumped to, which is a calendar day IN `timeZone`, the zone the
 * tab shows its dates in.
 */
export type ConversationAnchor =
  | { kind: "latest" }
  | { kind: "day"; day: string; timeZone: string };

export const LATEST_ANCHOR: ConversationAnchor = { kind: "latest" };
const LATEST_KEY_PART = "latest";

export function anchorKeyPart(anchor: ConversationAnchor): string {
  return anchor.kind === "latest" ? LATEST_KEY_PART : `day:${anchor.day}@${anchor.timeZone}`;
}

/** `YYYY-MM-DD`, a real calendar date: the shape a date input gives. */
export function isDayKey(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

function dayKeyFormat(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** The calendar day an instant falls on in `timeZone`, as `YYYY-MM-DD`. */
export function dayKeyIn(ms: number, timeZone: string): string {
  return dayKeyFormat(timeZone).format(new Date(ms));
}

/** The day after `day`, by the calendar (no zone involved). */
export function nextDayKey(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * The first instant of `day` in `timeZone` (epoch ms).
 *
 * ★NOT `Date.UTC(day) - offset`: the offset at local midnight is not the offset
 * at UTC midnight on a DST day, and some zones skip midnight altogether. It is
 * the earliest instant whose local date is `day`, found by bisection between
 * two instants that bracket it for every zone (offsets run from -12h to +14h).
 * ★NEVER THE HOST'S ZONE: no local-time constructor is used.
 */
export function zonedDayStart(day: string, timeZone: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const utcMidnight = Date.UTC(y, m - 1, d);
  let lo = utcMidnight - 15 * 60 * 60 * 1000; // its local date is before `day`
  let hi = utcMidnight + 15 * 60 * 60 * 1000; // its local date is `day` or after
  const fmt = dayKeyFormat(timeZone);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fmt.format(new Date(mid)) >= day) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * A page as the query asks for it: the window the tab opens on (`recent`, the
 * last `RECENT_DAYS` days; or a `day`), or a step older or newer from a page it
 * holds. ★`recent` names no instant: the clock is read when the page is
 * FETCHED (`apiPageParam`), never during render, so a refresh of the latest
 * window measures its 3 days from the refresh.
 */
export type ConversationQueryParam =
  | { kind: "recent" }
  | { kind: "day"; day: string; timeZone: string }
  | { kind: "older"; cursor: string }
  | { kind: "newer"; after: string };

/** The page the tab opens on. */
export function initialConversationParam(anchor: ConversationAnchor): ConversationQueryParam {
  return anchor.kind === "latest" ? { kind: "recent" } : { kind: "day", day: anchor.day, timeZone: anchor.timeZone };
}

/** What the api is asked for: a window becomes its instants (half-open). */
export function apiPageParam(param: ConversationQueryParam, nowMs: number): ConversationPageParam {
  switch (param.kind) {
    case "recent":
      return { kind: "window", since: new Date(nowMs - RECENT_DAYS * DAY_MS).toISOString() };
    case "day":
      return {
        kind: "window",
        since: new Date(zonedDayStart(param.day, param.timeZone)).toISOString(),
        until: new Date(zonedDayStart(nextDayKey(param.day), param.timeZone)).toISOString(),
      };
    case "older":
    case "newer":
      return param;
  }
}

/**
 * A page as the cache holds it. A 403 is an ANSWER, not a transient failure:
 * the api has refused this user this conversation, so it is stored as a
 * `refused` entry. That way it is not retried, it survives a refetch (react-query
 * resets `error` at the start of every fetch of a query with no data), and the
 * view can never fall through to the empty state.
 */
export type ConversationEntry =
  | {
      kind: "page";
      messages: ConversationMessage[];
      nextCursor: string | null;
      newerCursor: string | null;
      /** True for the page the tab opened on (its date window). */
      window: boolean;
    }
  | { kind: "refused"; reason: ConversationRefusal };

/**
 * Which 403 it was. `FORBIDDEN` is a refusal of this user (a lapsed membership,
 * a business outside the org). `NO_ORG`/`NO_BUSINESS` mean the server's session
 * has no org or business selected, which the user fixes by choosing it again.
 */
export type ConversationRefusal = "forbidden" | "no_scope";

function statusOf(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

/** True for the api's refusal (`403 FORBIDDEN`, and `NO_ORG`/`NO_BUSINESS`). */
export function isConversationRefusal(error: unknown): error is ApiError {
  return statusOf(error) === 403;
}

function refusalOf(error: ApiError): ConversationRefusal {
  return error.code === "NO_ORG" || error.code === "NO_BUSINESS" ? "no_scope" : "forbidden";
}

/** The query function: one page, with a refusal turned into an entry. */
export async function fetchConversationEntry(
  fetchPage: (param: ConversationPageParam) => Promise<ConversationPage>,
  param: ConversationQueryParam,
  nowMs: number,
): Promise<ConversationEntry> {
  try {
    const page = await fetchPage(apiPageParam(param, nowMs));
    return {
      kind: "page",
      messages: page.messages,
      nextCursor: page.nextCursor,
      // ★An api from before item 20 sends none: read as "nothing newer".
      newerCursor: page.newerCursor ?? null,
      window: param.kind === "recent" || param.kind === "day",
    };
  } catch (error) {
    if (isConversationRefusal(error)) {
      return { kind: "refused", reason: refusalOf(error) };
    }
    throw error;
  }
}

/**
 * The OLDER page after the last (oldest) one, or null when there is none.
 * react-query's `getNextPageParam`: the cache holds the newest page first.
 */
export function olderConversationParam(last: ConversationEntry): ConversationQueryParam | null {
  return last.kind === "page" && last.nextCursor ? { kind: "older", cursor: last.nextCursor } : null;
}

/**
 * The NEWER page before the first (newest) one, or null when the newest page
 * is loaded. react-query's `getPreviousPageParam`: only a jump to a date has
 * one; the latest window always reaches the newest message.
 */
export function newerConversationParam(first: ConversationEntry): ConversationQueryParam | null {
  return first.kind === "page" && first.newerCursor ? { kind: "newer", after: first.newerCursor } : null;
}

/**
 * Retry once on a server or network failure (the app's default), and on the two
 * transient 4xx (408 timeout, 429 rate limit). Never on any other 4xx: a 400 is
 * a malformed request and a 401 is handled by the api client, so asking again
 * only delays the answer.
 */
export function shouldRetryConversation(failureCount: number, error: unknown): boolean {
  const status = statusOf(error);
  const transient = status === 408 || status === 429;
  if (status !== undefined && status >= 400 && status < 500 && !transient) return false;
  return failureCount < 1;
}

// ── What the tab shows ────────────────────────────────────────────────────

/**
 * Every page in reading order, oldest first. The cache holds the NEWEST page
 * first (each later page is older), and each page is oldest first within itself.
 */
export function orderedMessages(entries: readonly ConversationEntry[]): ConversationMessage[] {
  const out: ConversationMessage[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!;
    if (entry.kind === "page") out.push(...entry.messages);
  }
  return out;
}

export type ConversationView =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "failed" }
  | { kind: "refused"; reason: ConversationRefusal }
  | { kind: "empty" }
  | { kind: "messages"; messages: ConversationMessage[] };

/**
 * Which body the tab renders.
 *
 * - A refusal wins over everything, held messages included: a 403 on a later
 *   page or a refresh means the api no longer lets this user read the
 *   conversation, so the messages already on screen are taken away too.
 * - With nothing loaded, a failure is "failed", a paused (offline) query is
 *   "offline", and only then is it "loading". `isLoading` would miss the paused
 *   case and fall through to the empty state.
 * - "empty" is earned only by pages that answered with no messages AND with
 *   nothing older or newer to load. ★A quiet last 3 days, or a quiet day the
 *   reader jumped to, is not an empty conversation: the box opens and loads
 *   the nearest messages on either side (item 20).
 */
export function conversationView(input: {
  entries: readonly ConversationEntry[] | undefined;
  status: "pending" | "error" | "success";
  fetchStatus: "fetching" | "paused" | "idle";
}): ConversationView {
  const { entries } = input;
  const refused = entries?.find((e) => e.kind === "refused");
  if (refused) return { kind: "refused", reason: refused.reason };
  if (entries === undefined) {
    if (input.status === "error") return { kind: "failed" };
    if (input.fetchStatus === "paused") return { kind: "offline" };
    return { kind: "loading" };
  }
  const messages = orderedMessages(entries);
  if (messages.length > 0) return { kind: "messages", messages };
  const first = entries[0];
  const last = entries[entries.length - 1];
  const more =
    (first?.kind === "page" && first.newerCursor !== null) ||
    (last?.kind === "page" && last.nextCursor !== null);
  return more ? { kind: "messages", messages } : { kind: "empty" };
}

/**
 * Where the page the tab opened on sits among the messages in reading order:
 * the index of its first message, or, when it has none, the index the next
 * newer message has (the nearest line after the quiet window). Null when that
 * page is not loaded (a refusal replaced it).
 */
export function windowPlacement(
  entries: readonly ConversationEntry[],
): { index: number; empty: boolean } | null {
  let index = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]!;
    if (entry.kind !== "page") continue;
    if (entry.window) return { index, empty: entry.messages.length === 0 };
    index += entry.messages.length;
  }
  return null;
}

/**
 * Which way to load next, when the reader has scrolled to an end (a sentinel
 * is in view) or the box is too short to scroll.
 *
 * ★One fetch at a time: in react-query an older and a newer fetch, or either
 * and a refresh, cancel each other, so nothing starts while anything runs.
 * ★A direction that failed waits for the reader's "Try again" rather than
 * retrying on every render. ★Older first when both ends are in view: the
 * conversation reads downward, so the reader is above what they asked for.
 */
export function autoLoadDirection(input: {
  topVisible: boolean;
  bottomVisible: boolean;
  hasOlder: boolean;
  hasNewer: boolean;
  isFetching: boolean;
  olderFailed: boolean;
  newerFailed: boolean;
}): "older" | "newer" | null {
  if (input.isFetching) return null;
  if (input.topVisible && input.hasOlder && !input.olderFailed) return "older";
  if (input.bottomVisible && input.hasNewer && !input.newerFailed) return "newer";
  return null;
}

/**
 * Whether a new newest line should pull the reader down to it: only when they
 * were at the bottom AND the bottom was the live end. ★After a jump to a date,
 * a newer PAGE landing below a reader at the bottom is the reader scrolling,
 * not a message arriving; following it would scroll them to the next sentinel
 * and load the whole history one page at a time.
 */
export function shouldFollowNewest(atBottom: boolean, wasAtLiveEnd: boolean): boolean {
  return atBottom && wasAtLiveEnd;
}

// ── The empty state ───────────────────────────────────────────────────────

/**
 * Why there is nothing to show, as far as the client can tell.
 *
 * The api answers an empty page in several cases it does not tell apart: no
 * verified number, a verified number nobody has written on, and a number that
 * someone else also holds verified (which is skipped). The contacts read
 * (`GET /contacts`, this business only) separates the first from the rest, so:
 * - `no-number`: this user has no verified or pending row on this business (a
 *   revoked row counts as none);
 * - `pending`: they have a row still waiting for its code, and none verified;
 * - `verified`: they hold a verified number, so the empty answer is real, but
 *   the client cannot rule out a shared number;
 * - `unknown`: the contacts could not be read, so no reason is claimed.
 */
export type ConversationEmptyReason = "no-number" | "pending" | "verified" | "unknown";

export function conversationEmptyReason(
  contacts: readonly MerchantContact[] | undefined,
  userId: string | null | undefined,
): ConversationEmptyReason {
  if (contacts === undefined || !userId) return "unknown";
  const mine = contacts.filter((c) => c.userId === userId);
  if (mine.some((c) => c.status === "verified")) return "verified";
  if (mine.some((c) => c.status === "pending")) return "pending";
  return "no-number";
}

export interface ConversationEmptyCopy {
  text: string;
  link?: { href: string; label: string };
}

/** The Numbers & routing tab: the absence of `?tab=` on this page. */
export const CONVERSATION_NUMBERS_HREF = WHATSAPP_SETTINGS_HREF;

export function conversationEmptyCopy(
  reason: ConversationEmptyReason,
  isAdmin: boolean,
): ConversationEmptyCopy {
  switch (reason) {
    case "no-number":
      return isAdmin
        ? {
            text: "You have no verified number on this business, so there is no conversation to show. Register and verify your number, then message Peakhour from it.",
            link: { href: CONVERSATION_NUMBERS_HREF, label: "Go to Numbers & routing" },
          }
        : {
            text: "You have no verified number on this business, so there is no conversation to show. Only an Owner or Admin can register your number; once it is verified, message Peakhour from it.",
            link: { href: CONVERSATION_NUMBERS_HREF, label: "See who is verified" },
          };
    case "pending":
      return {
        text: "Your number on this business is not verified yet, so there is no conversation to show. Enter the code Peakhour sent you to finish verifying it, or send a new code if it has expired.",
        link: { href: CONVERSATION_NUMBERS_HREF, label: "Go to Numbers & routing" },
      };
    case "verified":
      return {
        text: "No messages for this business since your number was verified. When you message Peakhour from it, or Peakhour messages you, the conversation appears here. A number that someone else has also verified is never shown, and while your number is verified on more than one business, a message Peakhour could not tie to one of them is not shown on any.",
      };
    case "unknown":
      return {
        text: "No messages to show. Peakhour could not check your numbers just now, so it cannot say why.",
        link: { href: CONVERSATION_NUMBERS_HREF, label: "Check your numbers" },
      };
  }
}

// ── Copy ──────────────────────────────────────────────────────────────────

export const CONVERSATION_TITLE = "Your conversation with Peakhour";

export const CONVERSATION_LEDE =
  "What you and Peakhour have said to each other on WhatsApp, from the numbers you verified on this business.";

/**
 * What the tab does and does not include. Each sentence is a rule of the api's
 * read (see the module docblock); the multi-business sentence is api#1529's
 * open owner question, described as it behaves today.
 */
export const CONVERSATION_SCOPE_NOTE = [
  "Only your own conversation is shown, never a teammate's.",
  "Only this business's messages are shown: if you verified the same number on another business too, each business shows its own.",
  "A message Peakhour could not tie to one business, because it was sent while the number was verified on more than one, is not shown on any of them.",
  "A message Peakhour labelled with this business shows from when you verified the number here; an older, unlabelled one shows only from the last time that number was verified or removed on any business.",
  "Peakhour keeps each number's latest 50 messages.",
  "A number that someone else has also verified is left out, because its conversation would include their messages.",
  "Verification codes are never shown, and weekly digests and alerts are not shown here yet.",
].join(" ");

/** Under the conversation when it opened on the latest messages. */
export const CONVERSATION_RECENT_NOTE = `Showing the last ${RECENT_DAYS} days first. Scroll up for older messages.`;

/**
 * What the tab says when the window it opened on holds nothing, while older or
 * newer messages exist (otherwise the empty state speaks). `dayLabel` is the
 * jumped-to day, formatted in the viewer's locale and zone.
 */
export function conversationQuietWindowText(anchor: ConversationAnchor, dayLabel: string | null): string {
  return anchor.kind === "latest"
    ? `No messages in the last ${RECENT_DAYS} days. Older messages load as you scroll up.`
    : `No messages on ${dayLabel ?? anchor.day}. Showing the nearest messages before and after it.`;
}

/** The label of a jumped-to day, in the viewer's locale; the zone is the anchor's. */
export function anchorDayLabel(anchor: ConversationAnchor, locale: string | undefined): string | null {
  if (anchor.kind !== "day") return null;
  const start = zonedDayStart(anchor.day, anchor.timeZone);
  return new Intl.DateTimeFormat(locale, {
    timeZone: anchor.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(start));
}

export const CONVERSATION_REFUSED_TITLE = "You can't see this conversation";

export const CONVERSATION_REFUSED_TEXT =
  "Peakhour refused to show this conversation to your account on this business. This happens when you are no longer an active member of the organisation, or the business is not part of it. Ask an Owner to check your access.";

/** `NO_ORG`/`NO_BUSINESS`: the session lost its selection; nothing is wrong with the account. */
export const CONVERSATION_NO_SCOPE_TEXT =
  "Peakhour does not know which business you are working in right now. Choose your business again from the business switcher, then check again.";

export function conversationRefusedText(reason: ConversationRefusal): string {
  return reason === "no_scope" ? CONVERSATION_NO_SCOPE_TEXT : CONVERSATION_REFUSED_TEXT;
}

export const CONVERSATION_FAILED_TEXT = "Could not load your conversation.";

export const CONVERSATION_OFFLINE_TEXT =
  "Waiting for a connection to load your conversation.";

/** Who said a line, from the viewer's side: `merchant` is the viewer's own number. */
export function senderLabel(sender: ConversationMessage["sender"]): string {
  return sender === "merchant" ? "You" : "Peakhour";
}

// ── Timestamps ────────────────────────────────────────────────────────────

export interface ConversationDayItem {
  /** Stable when older pages are prepended. */
  key: string;
  message: ConversationMessage;
  /** The time of day, in the viewer's locale and zone. */
  time: string;
}

export interface ConversationDay {
  /** `YYYY-MM-DD` in the display zone, or `unknown`. */
  key: string;
  /** The date, in the viewer's locale and zone. */
  label: string;
  items: ConversationDayItem[];
}

/**
 * Splits the messages by calendar day in `timeZone` and formats each date and
 * time in `locale`. The component passes `locale: undefined`, which is the
 * viewer's own locale; the tests pin one. No "Today"/"Yesterday", so nothing
 * here depends on the current time.
 */
export function groupConversationByDay(
  messages: readonly ConversationMessage[],
  opts: { locale: string | undefined; timeZone: string },
): ConversationDay[] {
  const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: opts.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayLabelFmt = new Intl.DateTimeFormat(opts.locale, {
    timeZone: opts.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(opts.locale, {
    timeZone: opts.timeZone,
    timeStyle: "short",
  });

  // The text is in the key so that two different lines in one instant do not
  // share a counter. Byte-identical twins are numbered from the NEWEST end, so
  // an older page (which only ever adds lines at the old end) never shifts a
  // key that is already on screen. ⚠️A NEWER page, after a jump to a date, can:
  // when its first line is a twin of the newest one shown, the shown twins are
  // renumbered and remount. Nothing else depends on the key.
  const bases = messages.map((m) => `${m.sentAt}|${m.sender}|${textHash(m.text)}`);
  const ordinal: number[] = new Array<number>(messages.length);
  const seen = new Map<string, number>();
  for (let i = messages.length - 1; i >= 0; i--) {
    const n = seen.get(bases[i]!) ?? 0;
    seen.set(bases[i]!, n + 1);
    ordinal[i] = n;
  }

  const days: ConversationDay[] = [];
  for (const [i, message] of messages.entries()) {
    const at = new Date(message.sentAt);
    const valid = !Number.isNaN(at.getTime());
    const dayKey = valid ? dayKeyFmt.format(at) : "unknown";
    let day = days[days.length - 1];
    if (!day || day.key !== dayKey) {
      day = { key: dayKey, label: valid ? dayLabelFmt.format(at) : "Date unknown", items: [] };
      days.push(day);
    }
    day.items.push({ key: `${bases[i]}|${ordinal[i]}`, message, time: valid ? timeFmt.format(at) : "" });
  }
  return days;
}

/** A short, stable digest of a line's text (FNV-1a), for React keys only. */
function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// ── Scroll position ───────────────────────────────────────────────────────

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Where to put `scrollTop` after older messages were added ABOVE the content,
 * so the line the reader was looking at stays where it was: the distance from
 * the bottom is unchanged.
 */
export function scrollTopAfterPrepend(
  before: Pick<ScrollMetrics, "scrollTop" | "scrollHeight">,
  afterScrollHeight: number,
): number {
  return Math.max(0, afterScrollHeight - before.scrollHeight + before.scrollTop);
}

/** The reader's position when an older page was asked for, and the page count then. */
export interface PrependAnchor {
  scrollTop: number;
  scrollHeight: number;
  pages: number;
}

/**
 * The `scrollTop` to restore when the page count changes, or null to leave it.
 * Only the page the anchor was taken for (one more page than then) restores it:
 * a cancelled or failed older load leaves the count as it was, and a refresh
 * never adds a page, so a stale anchor can never move the reader. A refused one
 * does add a page (the `refused` entry), but the refusal card replaces the box,
 * so there is nothing left to scroll.
 */
export function scrollTopToRestore(
  anchor: PrependAnchor | null,
  pageCount: number,
  afterScrollHeight: number,
): number | null {
  if (!anchor || pageCount !== anchor.pages + 1) return null;
  return scrollTopAfterPrepend(anchor, afterScrollHeight);
}

/** Whether the reader is at (or within `slack` px of) the newest message. */
export function isNearBottom(m: ScrollMetrics, slack = 24): boolean {
  return m.scrollHeight - m.scrollTop - m.clientHeight <= slack;
}
