/**
 * WA T4: the Inbox composer's decisions, kept out of the markup so each one can
 * be tested with a fixed clock and a fixed error.
 *
 * Contract: api#1528 (WA T3), `POST /v1/meta/whatsapp/conversations/:threadId/reply`
 * and `/reply-template`, and the thread read's `replyWindowEndsAt`, `source`
 * and `authorUserId`.
 *
 * ★★THE ONE RULE EVERY FUNCTION HERE SERVES: A REPLY MUST NEVER REACH A SHOPPER
 * TWICE BECAUSE OF SOMETHING THIS SCREEN SAID. The api makes a repeat of the
 * same idempotency key and the same words harmless (it answers from the first
 * attempt), so the composer keeps the key for as long as the words are the
 * same, and the copy only ever invites a resend when the key makes it safe.
 *
 * @package peakhour-b2c
 */

import { ApiError } from "@/lib/api";
import { STUDIO_LIST_CAP } from "@/lib/wa-studio-limits";

export { STUDIO_LIST_CAP };

/** The api's own bound on a free-text reply (`HUMAN_REPLY_MAX_LENGTH`). */
export const REPLY_TEXT_MAX = 4096;
/** The api's bound on one template value (`zTemplateValue`). */
export const TEMPLATE_VALUE_MAX = 1024;
/** The api's bounds on a template's value counts (`zHumanReplyTemplateBody`). */
export const TEMPLATE_HEADER_VALUES_MAX = 10;
export const TEMPLATE_BODY_VALUES_MAX = 20;
/** How often an escalated thread is re-read, so a shopper's answer shows up
 *  while somebody is replying to them (spec-wa T4: every 5s). */
export const THREAD_POLL_MS = 5_000;
/** How often any other open thread is re-read: the list's own 30s. */
export const THREAD_IDLE_POLL_MS = 30_000;
/** How often the 24h badge re-reads the clock. Its finest unit is a minute. */
export const WINDOW_TICK_MS = 30_000;

// ── The 24-hour window ───────────────────────────────────────────────

export interface ReplyWindow {
  /** Free text is allowed. */
  open: boolean;
  label: string;
  tone: "ok" | "warning" | "closed";
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * The 24-hour customer-service window, as the api judges it.
 *
 * ★OPEN ONLY WHILE `now < endsAt`: the api's rule is
 * `now - lastInboundAt < 24h`, so the instant itself is closed. A null
 * `replyWindowEndsAt` means the window never opened; an unparseable one is
 * read the same way, never as open.
 *
 * ★`now` IS A PARAMETER, from a ticking clock (`createSharedClock`). An idle page does not
 * re-render, and a poll that returns the same thread does not re-render it
 * either, so a badge reading `Date.now()` in render would keep "1h left" on a
 * window that closed an hour ago.
 *
 * ★THE LABEL ROUNDS DOWN. "3h left" with 3h59m to go understates; "4h left"
 * with 3h01m to go is a promise the api will break.
 */
export function replyWindow(
  endsAt: string | null | undefined,
  now: number,
  closedFor: string | null = null,
): ReplyWindow {
  const end = endsAt ? Date.parse(endsAt) : NaN;
  // ★`closedFor`: the api answered OUTSIDE_24H while this window's end was
  //  current (review R1). A browser clock running behind the server's would
  //  otherwise keep offering free text, and every Send would be the same 409.
  //  A newer shopper message moves `endsAt`, which releases it.
  if (!Number.isFinite(end) || now >= end || (closedFor !== null && closedFor === endsAt)) {
    return { open: false, label: "24h window closed", tone: "closed" };
  }
  const left = end - now;
  if (left >= HOUR) {
    return { open: true, label: `${Math.floor(left / HOUR)}h left to reply`, tone: left < 2 * HOUR ? "warning" : "ok" };
  }
  if (left >= MINUTE) {
    return { open: true, label: `${Math.floor(left / MINUTE)}m left to reply`, tone: "warning" };
  }
  return { open: true, label: "Under a minute left to reply", tone: "warning" };
}

// ── Who wrote each message ───────────────────────────────────────────

export interface SenderContext {
  contactName: string | null;
  currentUserId: string | null;
  /** A team member's display name, or null when we cannot name them. */
  memberName: (userId: string) => string | null;
}

export interface MessageLike {
  role: string;
  source?: "phone" | "inbox";
  authorUserId?: string | null;
}

/**
 * Who sent a message, as the bubble labels it.
 *
 * ★A MERCHANT LINE HAS TWO ORIGINS AND THEY ARE NOT THE SAME PERSON. `phone` is
 * the business's own WhatsApp app (a coexistence echo), which any of the team
 * may be holding, so it is not "You". `inbox` names its author where the api
 * recorded one (`authorUserId`); a reply from the Shopify admin records none,
 * and a member we cannot look up is "a team member" rather than a guess.
 */
export function senderLabel(m: MessageLike, ctx: SenderContext): string {
  if (m.role === "user") return ctx.contactName?.trim() || "Shopper";
  if (m.role === "assistant") return "Peakhour AI";
  if (m.source === "inbox") {
    const id = m.authorUserId ?? null;
    if (id && ctx.currentUserId && id === ctx.currentUserId) return "You · Inbox";
    const name = id ? ctx.memberName(id) : null;
    return `${name || "A team member"} · Inbox`;
  }
  return "Business phone";
}

/** `SenderContext.memberName` from the org's member list (`GET /v1/auth/team/members`):
 *  the name, else the email, else null. */
export function memberNameLookup(
  members: Array<{ userId: string; name: string | null; email: string }> | undefined,
): (userId: string) => string | null {
  return (userId) => {
    const m = members?.find((x) => x.userId === userId);
    return m?.name?.trim() || m?.email?.trim() || null;
  };
}

// ── "Replying as" ────────────────────────────────────────────────────

/** The phone-number id a thread belongs to: `whatsapp:<phoneNumberId>:<waId>`. */
export function threadPhoneNumberId(threadId: string): string | null {
  const parts = threadId.split(":");
  if (parts.length < 3 || parts[0] !== "whatsapp" || !parts[1]) return null;
  return parts[1];
}

export interface ConnectionLike {
  phoneNumberId?: string;
  phoneNumber?: string;
}

/**
 * The line above the composer.
 *
 * ★THE NUMBER IS NAMED ONLY WHEN THE CONNECTION'S NUMBER IS THE THREAD'S. The
 * api sends from the thread's own number, never from the client's choice, so
 * naming the connection's display number for a thread on another number would
 * tell the merchant the reply comes from somewhere it does not.
 *
 * ⚠️THE REMAINING GAP IS THE API'S (review R2): `GET /connection` takes
 * `phoneNumber` from the first listed number of the first WABA, not from the
 * active one, so a WABA with several numbers can still be named wrongly here.
 * Nothing b2c reads maps a phone-number id to its display number; the fix is
 * for /connection to return the active number's display (api follow-up).
 */
export function replyingAsLine(threadId: string, conn: ConnectionLike | null | undefined): string {
  const pnid = threadPhoneNumberId(threadId);
  if (pnid && conn?.phoneNumberId === pnid && conn.phoneNumber?.trim()) {
    return `Replying as ${conn.phoneNumber.trim()}`;
  }
  return "Replying from your WhatsApp Business number";
}

// ── What the composer offers ─────────────────────────────────────────

const ROLE_RANK: Record<string, number> = { owner: 40, admin: 30, editor: 20, viewer: 10 };

/** The api's `requireRole("editor")`: editor, admin or owner. */
export function canReply(role: string | null | undefined): boolean {
  return (ROLE_RANK[role ?? ""] ?? 0) >= ROLE_RANK.editor;
}

export type ComposerMode =
  | { kind: "readonly"; reason: string }
  | { kind: "takeover"; reason: string }
  | { kind: "text" }
  | { kind: "template"; reason: string };

/**
 * What sits under the message pane.
 *
 * ★ONLY AN ESCALATED THREAD IS REPLIED TO (spec-wa T4). The api would take an
 * active thread over on the first send, but a composer under a conversation
 * the assistant is still answering invites two voices at once; Take over is
 * the deliberate step.
 */
export function composerMode(args: { status: string; role: string | null | undefined; window: ReplyWindow }): ComposerMode {
  if (!canReply(args.role)) {
    return {
      kind: "readonly",
      reason: "You can read this conversation, but replying to shoppers needs Editor access or above.",
    };
  }
  if (args.status !== "escalated") {
    return {
      kind: "takeover",
      reason: "Take over to reply. The assistant stops answering this shopper while you do.",
    };
  }
  if (args.window.open) return { kind: "text" };
  return {
    kind: "template",
    reason:
      "It has been more than 24 hours since this shopper last messaged, so WhatsApp only allows an approved template.",
  };
}

// ── One idempotency key per compose attempt ──────────────────────────

export interface Attempt {
  /** The words this key was minted for (`replySignature`). */
  sig: string;
  key: string;
  /** The api answered REPLY_OUTCOME_UNKNOWN for this key: it will never send
   *  under it again, and a fresh key is a deliberate second send. */
  unknown: boolean;
}

export type ReplyPayload =
  | { kind: "text"; text: string }
  | { kind: "template"; templateId: string; params?: { header?: string[]; body?: string[] } };

/**
 * The words a key is bound to, as the api binds them (`payloadOf`): the text,
 * or the template id and its values.
 *
 * ★THE TEXT IS TRIMMED HERE AND IN WHAT IS SENT. The api does not trim, so "hi"
 * and "hi " are two replies to it; a space added while waiting on a lost
 * connection would otherwise mint a new key and send the reply twice.
 */
export function replySignature(p: ReplyPayload): string {
  return p.kind === "text"
    ? JSON.stringify(["text", p.text.trim()])
    : JSON.stringify(["template", p.templateId.toLowerCase(), p.params?.header ?? [], p.params?.body ?? []]);
}

/**
 * The attempt a send goes out under.
 *
 * ★THE SAME WORDS KEEP THE SAME KEY, so pressing Send again after a lost
 * connection, a SEND_FAILED or a double click asks the api about the first
 * attempt instead of making a second. New words get a new key. A key the api
 * called unknown is never reused (it answers "unknown" for ever); the caller
 * asks the person to confirm before this mints its replacement.
 */
export function attemptFor(prev: Attempt | null, sig: string, mint: () => string): Attempt {
  if (prev && prev.sig === sig && !prev.unknown) return prev;
  return { sig, key: mint(), unknown: false };
}

/**
 * Whether Send must first be confirmed: a reply may already have reached the
 * shopper and nobody has checked yet.
 *
 * ★ANY WORDS, NOT ONLY THE SAME ONES (review R3). Adding a full stop to the
 * reply that may have arrived made it "new words", which skipped the confirm,
 * minted a key and could send a near-identical second copy. The warning says
 * "before sending anything else", and the confirm holds it to that until a
 * send succeeds.
 */
export function needsResendConfirm(prev: Attempt | null): boolean {
  return Boolean(prev?.unknown);
}

/**
 * The error left on screen once the person edits the draft: an unknown outcome
 * stays (it is about what the shopper may already have), and anything else is
 * about words that are no longer in the box (review R3).
 */
export function errorAfterEdit(error: ReplyErrorCopy | null, prev: Attempt | null): ReplyErrorCopy | null {
  return prev?.unknown ? error : null;
}

/**
 * The request a send makes (api#1528). ★The text goes out trimmed, the same
 * words `replySignature` bound the key to; the template's values only when it
 * has some.
 */
export function replyRequest(
  threadId: string,
  payload: ReplyPayload,
  idempotencyKey: string,
): { path: string; body: Record<string, unknown> } {
  const base = `/v1/meta/whatsapp/conversations/${encodeURIComponent(threadId)}`;
  if (payload.kind === "text") {
    return { path: `${base}/reply`, body: { text: payload.text.trim(), idempotencyKey } };
  }
  return {
    path: `${base}/reply-template`,
    body: { templateId: payload.templateId, ...(payload.params ? { params: payload.params } : {}), idempotencyKey },
  };
}

/**
 * Whether a send may start. ★THE KEYBOARD NEVER CONFIRMS (review R2): after an
 * unknown outcome the confirmation IS the "Send again anyway" button, and a
 * Ctrl/Cmd+Enter from someone typing as usual has not read it.
 */
export function maySend(args: { problem: string | null; pending: boolean; confirm: boolean; via: "button" | "keyboard" }): boolean {
  if (args.problem || args.pending) return false;
  return !(args.via === "keyboard" && args.confirm);
}

/**
 * A key the api accepts (`[A-Za-z0-9._:-]`, 8..128).
 *
 * ★`crypto.randomUUID` IS ONLY THERE IN A SECURE CONTEXT (review R3). Over
 * plain http (a LAN address, a staging host) it is undefined, and a throw here
 * happened before the send's try, so a click did nothing and said nothing. The
 * fallback is unique enough for a key that is scoped to one thread and words.
 */
export function mintIdempotencyKey(rand: { randomUUID?: () => string } | undefined = globalThis.crypto): string {
  if (typeof rand?.randomUUID === "function") return `inbox-${rand.randomUUID()}`;
  return `inbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ── What a refusal means ─────────────────────────────────────────────

export interface ReplyErrorCopy {
  title: string;
  detail: string;
  /** "unknown" marks the attempt so the next send of the same words must be
   *  confirmed and goes out under a new key. */
  attempt: "keep" | "unknown";
  /** Re-read the template list: the error says it is out of date. */
  refetchTemplates: boolean;
  /** The api says the 24h window is closed: believe it over this browser's
   *  clock (`replyWindow`'s `closedFor`). */
  closesWindow: boolean;
}

const NOTHING_SENT = "Nothing was sent.";
const SAME_TEXT_IS_SAFE =
  "Pressing Send again without changing anything is safe: if it did reach WhatsApp, it will not go out twice.";

function serverMessage(err: ApiError, fallback: string): string {
  const m = err.message?.trim();
  return m && m !== "Request failed" ? m : fallback;
}

/**
 * The sentence for each way a reply can fail.
 *
 * ★★EACH ONE SAYS WHETHER THE SHOPPER GOT SOMETHING, because that is what the
 * person decides on:
 *  - `REPLY_OUTCOME_UNKNOWN` never says "failed, try again". The api could not
 *    tell whether WhatsApp delivered it; a resend could be a second copy.
 *  - `SEND_FAILED` is two cases on the wire (a refusal that sent nothing, or a
 *    cut connection that may have delivered) told apart only by the api's
 *    sentence, so its sentence is shown, and the advice given is the one that
 *    holds for both: the same words under the same key cannot send twice.
 *  - A lost connection or a 5xx is the same unknown, with the same safe advice.
 */
export function replyErrorCopy(err: unknown, kind: ReplyPayload["kind"] = "text"): ReplyErrorCopy {
  const base = { attempt: "keep" as const, refetchTemplates: false, closesWindow: false };
  if (!(err instanceof ApiError) || err.code === "PARSE_ERROR" || (err.status >= 500 && err.code !== "SEND_FAILED")) {
    return {
      ...base,
      title: "We lost touch before WhatsApp answered",
      detail: `We can't tell yet whether this reply went. ${SAME_TEXT_IS_SAFE}`,
    };
  }
  switch (err.code) {
    case "REPLY_OUTCOME_UNKNOWN":
      return {
        ...base,
        attempt: "unknown",
        title: "We can't tell whether this reply arrived",
        detail:
          "WhatsApp didn't confirm it either way. Check this conversation, or the shopper's chat, before sending anything else: sending it again could deliver it twice.",
      };
    case "REPLY_IN_PROGRESS":
      return {
        ...base,
        title: "This reply is still being handled",
        detail: "We are still waiting on WhatsApp for this exact message, and it will not go out twice. Check the conversation in a moment.",
      };
    case "SEND_FAILED":
      // ★MARKED UNKNOWN (review R2). On a cut connection the api has already
      //  settled this key as unknown and says "check before sending it again";
      //  adding "pressing Send again is safe" beneath that contradicted it, and
      //  invited an edit, which is a new key and a possible second copy. On a
      //  certain refusal the confirm costs one click and sends once.
      return {
        ...base,
        attempt: "unknown",
        title: "This reply may not have been sent",
        detail: `${serverMessage(err, "WhatsApp did not accept the message.")} Check this conversation before sending it again.`,
      };
    case "OUTSIDE_24H":
      return {
        ...base,
        title: "The 24-hour window has closed",
        detail: `WhatsApp only allows an approved template for this shopper now. ${NOTHING_SENT}`,
        closesWindow: true,
      };
    case "STATUS_CHANGED":
      return {
        ...base,
        title: "This conversation changed hands",
        detail: `${serverMessage(err, "Refresh it and try again.")} ${NOTHING_SENT}`,
      };
    case "WHATSAPP_UNAVAILABLE":
      return {
        ...base,
        title: "WhatsApp isn't available right now",
        detail: `${serverMessage(err, "Check your WhatsApp connection in Integrations.")} ${NOTHING_SENT}`,
      };
    case "NOT_FOUND":
      return {
        ...base,
        title: "This conversation isn't available any more",
        detail: `It may now belong to a different WhatsApp number. ${NOTHING_SENT}`,
      };
    case "TEMPLATE_NOT_FOUND":
      return {
        ...base,
        title: "That template no longer exists",
        detail: `Pick another one. ${NOTHING_SENT}`,
        refetchTemplates: true,
      };
    case "TEMPLATE_NOT_APPROVED":
      return {
        ...base,
        title: "That template isn't approved",
        detail: `WhatsApp has not approved it, or no longer does, so it cannot be sent. ${NOTHING_SENT}`,
        refetchTemplates: true,
      };
    case "TEMPLATE_UNSUPPORTED":
      return {
        ...base,
        title: "This template can't be sent from the Inbox",
        detail: `${serverMessage(err, "Pick another one.")} ${NOTHING_SENT}`,
      };
    case "TEMPLATE_PARAMS":
      return {
        ...base,
        title: "The template's values don't fit",
        detail: `${serverMessage(err, "Check each value.")} ${NOTHING_SENT}`,
      };
    case "MARKETING_NOT_ALLOWED":
      return {
        ...base,
        title: "This shopper hasn't agreed to marketing messages",
        // ★"COUNTS AS", because the api also goes by Meta's re-categorisation,
        //  which this screen cannot see (review R1): a template the picker
        //  calls utility can be refused here.
        detail: `This template counts as marketing (by its category, or because Meta re-categorised it), so it cannot be sent to them. A utility template can. ${NOTHING_SENT}`,
      };
    case "VALIDATION_ERROR":
      return {
        ...base,
        title: "This reply can't be sent as written",
        // ★/reply-template answers VALIDATION_ERROR too (review R1): its values,
        //  not a text length, are what it judged.
        detail:
          kind === "template"
            ? `Each template value must be filled in, at most ${TEMPLATE_VALUE_MAX.toLocaleString("en-US")} characters, with no line break or tab. ${NOTHING_SENT}`
            : `It must not be empty, and must be at most ${REPLY_TEXT_MAX.toLocaleString("en-US")} characters. ${NOTHING_SENT}`,
      };
    case "FORBIDDEN":
      return {
        ...base,
        title: "You don't have permission to reply",
        detail: `Replying to shoppers needs Editor access or above. ${NOTHING_SENT}`,
      };
    default:
      // ★NOT "NOTHING WAS SENT" (review R2). The api client answers with the
      //  FIRST response's code when its 401-refresh or CSRF retry gets back
      //  something unreadable, and that retry may have reached the api and
      //  sent. The same words keep the same key, so a resend is still safe.
      return {
        ...base,
        title: "We couldn't confirm this reply",
        detail: `${serverMessage(err, "Something went wrong while sending.")} ${SAME_TEXT_IS_SAFE}`,
      };
  }
}

/** The 200 bodies (`{ ok:true, data }`). A repeat is a different shape. */
export type ReplyResult =
  | { threadId: string; duplicate: true; sentAt: string | null }
  | {
      threadId: string;
      duplicate: false;
      status: "escalated";
      escalated: boolean;
      sentAt: string;
      recorded: boolean;
      message: { role: "merchant"; source: "inbox"; content: string; timestamp: string };
    };

/** What a successful send says, or null for the plain case. */
export function replySuccessNote(r: ReplyResult): string | null {
  if (r.duplicate) return "This reply had already been sent, so it was not sent again.";
  if (!r.recorded) return "Sent. It may take a moment to appear in this conversation.";
  return null;
}

// ── Templates ────────────────────────────────────────────────────────

export interface StudioTemplate {
  _id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION" | string;
  status: string;
  components?: {
    header?: { format?: string; text?: string };
    body?: { text?: string };
    footer?: { text?: string };
    buttons?: Array<{ type?: string; url?: string }>;
  };
}

export type TemplatePlan =
  | { ok: true; headerCount: number; bodyCount: number }
  | { ok: false; reason: string };

const PLACEHOLDER = /\{\{(\d+)\}\}/g;

/** Positional `{{1}}..{{n}}`, or null when gapped or named (the api's `positions`). */
function positions(text: string): number | null {
  const seen = new Set<number>();
  for (const m of text.matchAll(PLACEHOLDER)) seen.add(Number(m[1]));
  const n = seen.size;
  for (let i = 1; i <= n; i++) if (!seen.has(i)) return null;
  if (/\{\{/.test(text.replace(PLACEHOLDER, ""))) return null;
  return n;
}

/**
 * Whether the Inbox can send a template, by the api's own rules
 * (`planInboxTemplate`), so the picker does not offer one that is refused.
 * The api still decides; this only keeps a known refusal off the list.
 */
export function inboxTemplatePlan(t: StudioTemplate): TemplatePlan {
  if (t.category === "AUTHENTICATION") return { ok: false, reason: "Verification-code templates can't be sent from the Inbox." };
  const cmp = t.components ?? {};
  const body = cmp.body?.text;
  if (!body) return { ok: false, reason: "This template has no body to send." };
  const headerFormat = cmp.header ? String(cmp.header.format ?? "TEXT") : null;
  if (headerFormat !== null && headerFormat !== "TEXT") {
    return { ok: false, reason: "Templates with an image, video or document header can't be sent from the Inbox yet." };
  }
  if ((cmp.buttons ?? []).some((b) => typeof b.url === "string" && b.url.includes("{{"))) {
    return { ok: false, reason: "Templates with a personalised link button can't be sent from the Inbox yet." };
  }
  const headerCount = positions(headerFormat === "TEXT" ? (cmp.header?.text ?? "") : "");
  const bodyCount = positions(body);
  if (headerCount === null || bodyCount === null) {
    return { ok: false, reason: "This template uses named parameters, which the Inbox can't fill in yet." };
  }
  // ★The api's own caps (`zHumanReplyTemplateBody`, review R1): more values
  //  than this are refused as a VALIDATION_ERROR.
  if (headerCount > TEMPLATE_HEADER_VALUES_MAX || bodyCount > TEMPLATE_BODY_VALUES_MAX) {
    return { ok: false, reason: "This template has more values than the Inbox can send." };
  }
  return { ok: true, headerCount, bodyCount };
}

/** The approved templates, sendable ones first, in the list's own order. */
export function pickableTemplates(list: StudioTemplate[] | undefined): {
  sendable: Array<{ template: StudioTemplate; headerCount: number; bodyCount: number }>;
  unsendable: number;
} {
  const sendable: Array<{ template: StudioTemplate; headerCount: number; bodyCount: number }> = [];
  let unsendable = 0;
  for (const t of list ?? []) {
    if (t.status !== "approved") continue;
    const plan = inboxTemplatePlan(t);
    if (plan.ok) sendable.push({ template: t, headerCount: plan.headerCount, bodyCount: plan.bodyCount });
    else unsendable += 1;
  }
  return { sendable, unsendable };
}

/** A template send's payload: values only where the copy has some. */
export function templatePayload(templateId: string, header: string[], body: string[]): ReplyPayload {
  return {
    kind: "template",
    templateId,
    ...(header.length || body.length
      ? { params: { ...(header.length ? { header } : {}), ...(body.length ? { body } : {}) } }
      : {}),
  };
}

/** Whether the list may be missing older templates (the api's cap). */
export function templateListTruncated(list: StudioTemplate[] | undefined): boolean {
  return (list?.length ?? 0) >= STUDIO_LIST_CAP;
}

/** The copy as the shopper will read it, values filled in (the api's `content`). */
export function templatePreview(t: StudioTemplate, header: string[], body: string[]): string {
  const fill = (text: string, values: string[]) =>
    text.replace(PLACEHOLDER, (_m, i: string) => values[Number(i) - 1] || `{{${i}}}`);
  const cmp = t.components ?? {};
  const h = cmp.header && String(cmp.header.format ?? "TEXT") === "TEXT" ? (cmp.header.text ?? "") : "";
  return [fill(h, header), fill(cmp.body?.text ?? "", body), cmp.footer?.text ?? ""].filter(Boolean).join("\n\n");
}

/** The api's bound on a filled-in template (`INBOX_TEMPLATE_MAX_CONTENT`). */
export const TEMPLATE_CONTENT_MAX = 4096;

/** Why the filled-in template is too long, or null. ★The api refuses it as
 *  TEMPLATE_PARAMS after the click (review R2); the preview already knows. */
export function templateContentProblem(preview: string): string | null {
  return preview.length > TEMPLATE_CONTENT_MAX
    ? `With these values the message is ${preview.length.toLocaleString("en-US")} characters; the most is ${TEMPLATE_CONTENT_MAX.toLocaleString("en-US")}.`
    : null;
}

/** Why a template value is not sendable yet, or null when it is. */
export function templateValueProblem(v: string): string | null {
  if (!v.trim()) return "Fill this in.";
  if (/[\n\t]/.test(v)) return "A value can't contain a line break or a tab.";
  // ★Meta's own rule (error 132018), which the api does not check (review
  //  R3): it refuses the value, the api answers SEND_FAILED, and the person is
  //  told to check for a message that cannot exist.
  if (/ {5,}/.test(v)) return "A value can't contain more than four spaces in a row.";
  if (v.length > TEMPLATE_VALUE_MAX) return `At most ${TEMPLATE_VALUE_MAX.toLocaleString("en-US")} characters.`;
  return null;
}

/** Why the text cannot be sent yet, or null when it can. */
export function textProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return "Write a reply first.";
  if (t.length > REPLY_TEXT_MAX) return `At most ${REPLY_TEXT_MAX.toLocaleString("en-US")} characters (this is ${t.length.toLocaleString("en-US")}).`;
  return null;
}

// ── Polling and Resume ───────────────────────────────────────────────

/**
 * How often the open thread is re-read: every 5s while a person holds it, and
 * at the list's 30s otherwise. ★NOT NEVER (review R1): the list's poll does
 * not refresh this query, so a colleague's Take over on an open active thread
 * never reached this pane, and nor did the shopper's new messages.
 */
export function threadPollInterval(status: string | undefined): number | false {
  if (status === undefined) return false;
  return status === "escalated" ? THREAD_POLL_MS : THREAD_IDLE_POLL_MS;
}

/**
 * The body a Resume sends.
 *
 * ★WA T2 follow-up: a Resume from a stale view could release a takeover made
 * after it was rendered. The fix is a compare-and-set on the `statusVersion`
 * the view rendered with. ⚠️TODAY THE API NEITHER RETURNS IT ON THE THREAD READ
 * NOR READS A RESUME BODY, so this sends it only when the read carried one,
 * and sends no body otherwise (as before).
 */
export function resumeBody(thread: { statusVersion?: unknown } | null | undefined): { statusVersion: number } | undefined {
  const v = thread?.statusVersion;
  return typeof v === "number" && Number.isInteger(v) ? { statusVersion: v } : undefined;
}

// ── The composer's memory ────────────────────────────────────────────

export interface ComposerMemory {
  text: string;
  attempt: Attempt | null;
  error: ReplyErrorCopy | null;
  note: string | null;
  templateId: string | null;
  header: string[];
  body: string[];
  /** A send is in flight for this thread (it may have been started by a
   *  composer that has since unmounted). */
  pending: boolean;
  /** The `replyWindowEndsAt` the api called closed (`replyWindow`). */
  closedFor: string | null;
}

export const EMPTY_MEMORY: ComposerMemory = {
  text: "",
  attempt: null,
  error: null,
  note: null,
  templateId: null,
  header: [],
  body: [],
  pending: false,
  closedFor: null,
};

export interface ComposerStore {
  get(threadId: string): ComposerMemory;
  update(threadId: string, patch: Partial<ComposerMemory> | ((cur: ComposerMemory) => Partial<ComposerMemory>)): void;
  subscribe(listener: () => void): () => void;
}

/**
 * Per-thread drafts, keys and warnings for the page's life.
 *
 * ★A STORE, NOT COMPONENT STATE (review R1). A send that settles after its
 * composer unmounted (the person opened another thread meanwhile) must still
 * land: an "unknown outcome" warning lost there is a resend with no warning,
 * and a success lost there leaves the sent words in the box. Writes go to the
 * store whether or not anything is mounted, and a mounted composer subscribes.
 */
export function createComposerStore(): ComposerStore {
  const map = new Map<string, ComposerMemory>();
  const listeners = new Set<() => void>();
  const get = (id: string) => map.get(id) ?? EMPTY_MEMORY;
  return {
    get,
    update(id, patch) {
      const cur = get(id);
      map.set(id, { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) });
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * What a successful send clears: the box only if it still holds the words that
 * were sent. ★Typing a follow-up while the first one was in flight must not be
 * wiped by its success (review R1).
 */
export function clearAfterSend(cur: ComposerMemory, sentSig: string): Partial<ComposerMemory> {
  if (replySignature({ kind: "text", text: cur.text }) === sentSig) return { text: "" };
  if (cur.templateId && replySignature(templatePayload(cur.templateId, cur.header, cur.body)) === sentSig) {
    return { templateId: null, header: [], body: [] };
  }
  return {};
}
