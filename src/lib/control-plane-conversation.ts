import { ApiError } from "@/lib/api";
import type {
  ConversationMessage,
  ConversationPage,
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
 * - each number's turns start at its `historyBoundary`: the newest
 *   `verifiedAt`/`revokedAt` on any of that number's rows, on any business;
 * - a thread keeps at most its latest 50 messages;
 * - a verification code is never recorded, and the digest and alerts are not
 *   sent from Peakhour's number yet, so they are not in the thread;
 * - a refusal is a 403, never an empty page.
 */

// ── The cache entry ───────────────────────────────────────────────────────

export const CONTROL_PLANE_CONVERSATION_KEY = "/v1/control-plane/conversation";

/**
 * One cache entry per org, business AND user. The api answers for the caller's
 * own numbers on the session's business, so the same business reads a
 * different conversation for each teammate. The path stays first so a prefix
 * invalidation reaches every entry.
 */
export function conversationKey(
  orgId: string | null | undefined,
  businessId: string | null | undefined,
  userId: string | null | undefined,
) {
  return [
    CONTROL_PLANE_CONVERSATION_KEY,
    orgId ?? null,
    businessId ?? null,
    userId ?? null,
  ] as const;
}

/**
 * A page as the cache holds it. A 403 is an ANSWER, not a transient failure:
 * the api has refused this user this conversation, so it is stored as a
 * `refused` entry. That way it is not retried, it survives a refetch (react-query
 * resets `error` at the start of every fetch of a query with no data), and the
 * view can never fall through to the empty state.
 */
export type ConversationEntry =
  | { kind: "page"; messages: ConversationMessage[]; nextCursor: string | null }
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
  fetchPage: (cursor: string | null) => Promise<ConversationPage>,
  cursor: string | null,
): Promise<ConversationEntry> {
  try {
    const page = await fetchPage(cursor);
    return { kind: "page", messages: page.messages, nextCursor: page.nextCursor };
  } catch (error) {
    if (isConversationRefusal(error)) {
      return { kind: "refused", reason: refusalOf(error) };
    }
    throw error;
  }
}

/** The cursor for the next (OLDER) page, or null when there is none. */
export function nextConversationCursor(last: ConversationEntry): string | null {
  return last.kind === "page" && last.nextCursor ? last.nextCursor : null;
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
 * - "empty" is earned only by a page that answered with no messages.
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
  return messages.length === 0 ? { kind: "empty" } : { kind: "messages", messages };
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
        text: "No messages since your number was last verified. When you message Peakhour from it, or Peakhour messages you, the conversation appears here. A number that someone else has also verified is never shown.",
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
  "Each number's conversation starts from the last time that number was verified or removed on any business, and Peakhour keeps its latest 50 messages.",
  "A number that someone else has also verified is left out, because its conversation would include their messages.",
  "If you verified the same number on another business too, its messages appear here as well, whichever business they were about.",
  "Verification codes are never shown, and weekly digests and alerts are not shown here yet.",
].join(" ");

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
  // "Load older" (which only ever adds lines at the old end) never shifts a
  // key that is already on screen.
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

/** The reader's position when "Load older" was pressed, and the page count then. */
export interface PrependAnchor {
  scrollTop: number;
  scrollHeight: number;
  pages: number;
}

/**
 * The `scrollTop` to restore when the page count changes, or null to leave it.
 * Only the page the anchor was taken for (one more page than then) restores it:
 * a cancelled, failed or refused "Load older" leaves the count as it was, and a
 * refresh never adds a page, so a stale anchor can never move the reader.
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
