import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import {
  attemptFor,
  canReply,
  composerMode,
  inboxTemplatePlan,
  memberNameLookup,
  mintIdempotencyKey,
  needsResendConfirm,
  pickableTemplates,
  replyErrorCopy,
  replySignature,
  replySuccessNote,
  replyWindow,
  replyingAsLine,
  replyRequest,
  resumeBody,
  senderLabel,
  templatePreview,
  templateValueProblem,
  textProblem,
  threadPhoneNumberId,
  threadPollInterval,
  type ReplyWindow,
  type StudioTemplate,
  clearAfterSend,
  createComposerStore,
  maySend,
  templateContentProblem,
  templateListTruncated,
  templatePayload,
  EMPTY_MEMORY,
} from "./wa-inbox-reply";

const H = 60 * 60 * 1000;
const M = 60 * 1000;
const END = Date.parse("2026-10-20T12:00:00.000Z");
const ends = new Date(END).toISOString();

const OPEN: ReplyWindow = { open: true, label: "5h left to reply", tone: "ok" };
const CLOSED: ReplyWindow = { open: false, label: "24h window closed", tone: "closed" };

describe("replyWindow", () => {
  it("a null end is closed", () => {
    expect(replyWindow(null, END - H)).toEqual(CLOSED);
  });
  it("an unparseable end is closed, never open", () => {
    expect(replyWindow("not a date", END - H).open).toBe(false);
  });
  it("the end instant itself is closed, as the api's strict less-than rule", () => {
    expect(replyWindow(ends, END).open).toBe(false);
  });
  it("one millisecond before the end is open", () => {
    const w = replyWindow(ends, END - 1);
    expect(w.open).toBe(true);
    expect(w.label).toBe("Under a minute left to reply");
  });
  it("rounds hours down so it never promises more time than is left", () => {
    expect(replyWindow(ends, END - (23 * H + 59 * M)).label).toBe("23h left to reply");
  });
  it("is ok with two hours or more left", () => {
    expect(replyWindow(ends, END - 2 * H).tone).toBe("ok");
  });
  it("warns with under two hours left", () => {
    const w = replyWindow(ends, END - (2 * H - 1));
    expect(w.tone).toBe("warning");
    expect(w.label).toBe("1h left to reply");
  });
  it("counts minutes under an hour", () => {
    expect(replyWindow(ends, END - (H - 1)).label).toBe("59m left to reply");
  });
  it("an api refusal closes the window this browser still thinks is open", () => {
    expect(replyWindow(ends, END - 3 * H, ends).open).toBe(false);
  });
  it("a newer shopper message releases the api's close", () => {
    const later = new Date(END + H).toISOString();
    expect(replyWindow(later, END - 3 * H, ends).open).toBe(true);
  });
  it("a later clock on the same thread data moves the label, which only a ticking now can show", () => {
    const a = replyWindow(ends, END - 3 * H);
    const b = replyWindow(ends, END + 1);
    expect(a.open).toBe(true);
    expect(b.open).toBe(false);
  });
});

describe("senderLabel", () => {
  const ctx = {
    contactName: "Asha",
    currentUserId: "u-me",
    memberName: memberNameLookup([
      { userId: "u-me", name: "Me Myself", email: "me@x.test" },
      { userId: "u-priya", name: "Priya", email: "priya@x.test" },
    ]),
  };
  it("names the shopper by contact name", () => {
    expect(senderLabel({ role: "user" }, ctx)).toBe("Asha");
  });
  it("calls an unnamed shopper the shopper", () => {
    expect(senderLabel({ role: "user" }, { ...ctx, contactName: "  " })).toBe("Shopper");
  });
  it("labels the assistant as the AI", () => {
    expect(senderLabel({ role: "assistant" }, ctx)).toBe("Peakhour AI");
  });
  it("a phone line is the business phone, not you", () => {
    expect(senderLabel({ role: "merchant", source: "phone", authorUserId: null }, ctx)).toBe("Business phone");
  });
  it("an absent source is the business phone", () => {
    expect(senderLabel({ role: "merchant" }, ctx)).toBe("Business phone");
  });
  it("your own inbox line is you", () => {
    expect(senderLabel({ role: "merchant", source: "inbox", authorUserId: "u-me" }, ctx)).toBe("You · Inbox");
  });
  it("a colleague's inbox line carries their name", () => {
    expect(senderLabel({ role: "merchant", source: "inbox", authorUserId: "u-priya" }, ctx)).toBe("Priya · Inbox");
  });
  it("an inbox line with no author is a team member, not you", () => {
    expect(senderLabel({ role: "merchant", source: "inbox", authorUserId: null }, { ...ctx, currentUserId: null })).toBe(
      "A team member · Inbox",
    );
  });
  it("an author we cannot look up is a team member", () => {
    expect(senderLabel({ role: "merchant", source: "inbox", authorUserId: "u-gone" }, ctx)).toBe("A team member · Inbox");
  });
});

describe("memberNameLookup", () => {
  const look = memberNameLookup([
    { userId: "a", name: "Ana", email: "ana@x.test" },
    { userId: "b", name: "  ", email: "bo@x.test" },
  ]);
  it("prefers the name", () => expect(look("a")).toBe("Ana"));
  it("falls back to the email for a blank name", () => expect(look("b")).toBe("bo@x.test"));
  it("answers null for a stranger", () => expect(look("c")).toBeNull());
  it("answers null before the members load", () => expect(memberNameLookup(undefined)("a")).toBeNull());
});

describe("replying as", () => {
  const T = "whatsapp:111:919800000000";
  it("reads the phone number id from the thread id", () => {
    expect(threadPhoneNumberId(T)).toBe("111");
  });
  it("refuses a thread id that is not a WhatsApp one", () => {
    expect(threadPhoneNumberId("sms:111:9198")).toBeNull();
  });
  it("names the number when the connection is the thread's number", () => {
    expect(replyingAsLine(T, { phoneNumberId: "111", phoneNumber: "+91 98000 00000" })).toBe("Replying as +91 98000 00000");
  });
  it("names no number when the connection is another number", () => {
    expect(replyingAsLine(T, { phoneNumberId: "222", phoneNumber: "+91 98000 00000" })).toBe(
      "Replying from your WhatsApp Business number",
    );
  });
  it("names no number before the connection loads", () => {
    expect(replyingAsLine(T, undefined)).toBe("Replying from your WhatsApp Business number");
  });
  it("names no number when the display number is blank", () => {
    expect(replyingAsLine(T, { phoneNumberId: "111", phoneNumber: " " })).toBe("Replying from your WhatsApp Business number");
  });
});

describe("composerMode", () => {
  it("an editor can reply", () => expect(canReply("editor")).toBe(true));
  it("an owner can reply", () => expect(canReply("owner")).toBe(true));
  it("an admin can reply", () => expect(canReply("admin")).toBe(true));
  it("a viewer cannot reply", () => expect(canReply("viewer")).toBe(false));
  it("an unknown role cannot reply", () => expect(canReply(null)).toBe(false));
  it("a viewer gets the reason and no composer, even on an escalated thread", () => {
    const m = composerMode({ status: "escalated", role: "viewer", window: OPEN });
    expect(m.kind).toBe("readonly");
    expect(m.kind === "readonly" && m.reason).toMatch(/Editor access/);
  });
  it("an active thread asks for a takeover first", () => {
    expect(composerMode({ status: "active", role: "editor", window: OPEN }).kind).toBe("takeover");
  });
  it("a resolved thread asks for a takeover first", () => {
    expect(composerMode({ status: "resolved", role: "owner", window: OPEN }).kind).toBe("takeover");
  });
  it("an escalated thread inside the window offers free text", () => {
    expect(composerMode({ status: "escalated", role: "editor", window: OPEN })).toEqual({ kind: "text" });
  });
  it("an escalated thread outside the window offers templates", () => {
    expect(composerMode({ status: "escalated", role: "editor", window: CLOSED }).kind).toBe("template");
  });
});

describe("one idempotency key per compose attempt", () => {
  let n = 0;
  const mint = () => `key-${++n}-abcdef`;
  const sig = replySignature({ kind: "text", text: "Your order ships today" });
  it("the first send mints a key", () => {
    const a = attemptFor(null, sig, mint);
    expect(a.sig).toBe(sig);
    expect(a.unknown).toBe(false);
    expect(a.key).toMatch(/^key-/);
  });
  it("a retry of the same words keeps the key", () => {
    const a = attemptFor(null, sig, mint);
    expect(attemptFor(a, sig, mint)).toBe(a);
  });
  it("new words get a new key", () => {
    const a = attemptFor(null, sig, mint);
    const b = attemptFor(a, replySignature({ kind: "text", text: "Ships tomorrow" }), mint);
    expect(b.key).not.toBe(a.key);
  });
  it("a key the api called unknown is never reused", () => {
    const a = { ...attemptFor(null, sig, mint), unknown: true };
    expect(attemptFor(a, sig, mint).key).not.toBe(a.key);
  });
  it("the same words after an unknown outcome need a confirm", () => {
    expect(needsResendConfirm({ sig, key: "k-12345678", unknown: true }, sig)).toBe(true);
  });
  it("other words after an unknown outcome need no confirm", () => {
    expect(needsResendConfirm({ sig, key: "k-12345678", unknown: true }, replySignature({ kind: "text", text: "x" }))).toBe(false);
  });
  it("a known attempt needs no confirm", () => {
    expect(needsResendConfirm({ sig, key: "k-12345678", unknown: false }, sig)).toBe(false);
  });
  it("edge whitespace does not make new words", () => {
    expect(replySignature({ kind: "text", text: " hi \n" })).toBe(replySignature({ kind: "text", text: "hi" }));
  });
  it("a template id is the same in either case", () => {
    expect(replySignature({ kind: "template", templateId: "ABCDEF0123456789abcdef01" })).toBe(
      replySignature({ kind: "template", templateId: "abcdef0123456789abcdef01" }),
    );
  });
  it("different template values are different words", () => {
    const t = "abcdef0123456789abcdef01";
    expect(replySignature({ kind: "template", templateId: t, params: { body: ["a"] } })).not.toBe(
      replySignature({ kind: "template", templateId: t, params: { body: ["b"] } }),
    );
  });
  it("a text send goes out trimmed with its key", () => {
    expect(replyRequest("whatsapp:1:91 98", { kind: "text", text: "  hi there \n" }, "key-12345678")).toEqual({
      path: "/v1/meta/whatsapp/conversations/whatsapp%3A1%3A91%2098/reply",
      body: { text: "hi there", idempotencyKey: "key-12345678" },
    });
  });
  it("a template send carries its values and key", () => {
    expect(
      replyRequest("t", { kind: "template", templateId: "a".repeat(24), params: { body: ["Asha"] } }, "key-12345678"),
    ).toEqual({
      path: "/v1/meta/whatsapp/conversations/t/reply-template",
      body: { templateId: "a".repeat(24), params: { body: ["Asha"] }, idempotencyKey: "key-12345678" },
    });
  });
  it("a template with no values sends no params", () => {
    expect(replyRequest("t", { kind: "template", templateId: "a".repeat(24) }, "key-12345678").body).toEqual({
      templateId: "a".repeat(24),
      idempotencyKey: "key-12345678",
    });
  });
  it("the button sends after an unknown outcome", () => {
    expect(maySend({ problem: null, pending: false, confirm: true, via: "button" })).toBe(true);
  });
  it("the keyboard does not confirm a resend after an unknown outcome", () => {
    expect(maySend({ problem: null, pending: false, confirm: true, via: "keyboard" })).toBe(false);
  });
  it("the keyboard sends an ordinary reply", () => {
    expect(maySend({ problem: null, pending: false, confirm: false, via: "keyboard" })).toBe(true);
  });
  it("nothing sends while a send is in flight", () => {
    expect(maySend({ problem: null, pending: true, confirm: false, via: "button" })).toBe(false);
  });
  it("nothing sends with a problem", () => {
    expect(maySend({ problem: "Write a reply first.", pending: false, confirm: false, via: "button" })).toBe(false);
  });
  it("a minted key passes the api's key rule and is fresh each time", () => {
    const k = mintIdempotencyKey();
    expect(k).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    expect(mintIdempotencyKey()).not.toBe(k);
  });
});

const apiErr = (code: string, status: number, message = "Request failed") => new ApiError(code, message, status);

describe("replyErrorCopy", () => {
  it("an unknown outcome never says failed or try again, and warns of a second copy", () => {
    const c = replyErrorCopy(apiErr("REPLY_OUTCOME_UNKNOWN", 409));
    expect(`${c.title} ${c.detail}`).not.toMatch(/fail|try again/i);
    expect(c.title).toMatch(/can't tell whether/);
    expect(c.detail).toMatch(/shopper's chat/);
    expect(c.detail).toMatch(/twice/);
  });
  it("an unknown outcome marks the attempt unknown", () => {
    expect(replyErrorCopy(apiErr("REPLY_OUTCOME_UNKNOWN", 409)).attempt).toBe("unknown");
  });
  it("only an unknown outcome marks the attempt", () => {
    for (const code of [
      "OUTSIDE_24H", "REPLY_IN_PROGRESS", "STATUS_CHANGED", "WHATSAPP_UNAVAILABLE", "TEMPLATE_NOT_APPROVED",
      "MARKETING_NOT_ALLOWED", "NOT_FOUND", "TEMPLATE_NOT_FOUND", "TEMPLATE_UNSUPPORTED", "TEMPLATE_PARAMS",
      "VALIDATION_ERROR", "FORBIDDEN",
    ]) {
      expect(replyErrorCopy(apiErr(code, 409)).attempt, code).toBe("keep");
    }
  });
  it("a send failure shows the api's sentence and asks for a check before a resend", () => {
    const c = replyErrorCopy(apiErr("SEND_FAILED", 502, "The connection to WhatsApp failed while sending, so this reply may or may not have arrived."));
    expect(c.title).toBe("This reply may not have been sent");
    expect(c.detail).toMatch(/may or may not have arrived/);
    expect(c.detail).toMatch(/Check this conversation before sending it again/);
    expect(c.detail).not.toMatch(/safe|Nothing was sent/);
  });
  it("a send failure marks the attempt unknown", () => {
    expect(replyErrorCopy(apiErr("SEND_FAILED", 502)).attempt).toBe("unknown");
  });
  it("a lost connection is an unknown that is safe to resend under the same key", () => {
    const c = replyErrorCopy(new TypeError("Failed to fetch"));
    expect(c.title).toBe("We lost touch before WhatsApp answered");
    expect(c.detail).toMatch(/will not go out twice/);
    expect(c.attempt).toBe("keep");
  });
  it("a non-JSON answer below 500 is a lost connection", () => {
    expect(replyErrorCopy(apiErr("PARSE_ERROR", 200)).title).toBe("We lost touch before WhatsApp answered");
  });
  it("a server error is a lost connection", () => {
    expect(replyErrorCopy(apiErr("INTERNAL_ERROR", 500)).title).toBe("We lost touch before WhatsApp answered");
  });
  it("a reply in progress says it will not go out twice and does not say nothing was sent", () => {
    const c = replyErrorCopy(apiErr("REPLY_IN_PROGRESS", 409));
    expect(c.title).toBe("This reply is still being handled");
    expect(c.detail).toMatch(/will not go out twice/);
    expect(c.detail).not.toMatch(/Nothing was sent/);
  });
  it("a closed window says templates only and nothing was sent", () => {
    const c = replyErrorCopy(apiErr("OUTSIDE_24H", 409));
    expect(c.title).toBe("The 24-hour window has closed");
    expect(c.detail).toMatch(/approved template/);
    expect(c.detail).toMatch(/Nothing was sent/);
  });
  it("a lost takeover race keeps the api's sentence", () => {
    const c = replyErrorCopy(apiErr("STATUS_CHANGED", 409, "Someone on your team took this conversation over a moment ago, so it is still with them."));
    expect(c.detail).toMatch(/still with them/);
  });
  it("an unavailable WhatsApp keeps the api's reason", () => {
    expect(replyErrorCopy(apiErr("WHATSAPP_UNAVAILABLE", 409, "WhatsApp Business is disabled.")).detail).toMatch(/is disabled/);
  });
  it("a marketing refusal points at a utility template", () => {
    expect(replyErrorCopy(apiErr("MARKETING_NOT_ALLOWED", 409)).detail).toMatch(/utility template can/);
  });
  it("a marketing refusal allows for Meta's re-categorisation of a utility template", () => {
    expect(replyErrorCopy(apiErr("MARKETING_NOT_ALLOWED", 409)).detail).toMatch(/Meta re-categorised it/);
  });
  it("an OUTSIDE_24H refusal closes this window in the browser", () => {
    expect(replyErrorCopy(apiErr("OUTSIDE_24H", 409)).closesWindow).toBe(true);
  });
  it("only a closed window from the api closes this browser's window", () => {
    for (const code of ["REPLY_OUTCOME_UNKNOWN", "SEND_FAILED", "STATUS_CHANGED", "TEMPLATE_PARAMS", "VALIDATION_ERROR"]) {
      expect(replyErrorCopy(apiErr(code, 409)).closesWindow, code).toBe(false);
    }
  });
  it("a template validation error names the values, not the text length", () => {
    const c = replyErrorCopy(apiErr("VALIDATION_ERROR", 400), "template");
    expect(c.detail).toMatch(/template value/);
    expect(c.detail).not.toMatch(/4,096/);
  });
  it("a text validation error names the text length", () => {
    expect(replyErrorCopy(apiErr("VALIDATION_ERROR", 400), "text").detail).toMatch(/4,096 characters/);
  });
  it("a stale template list is re-read on not approved", () => {
    expect(replyErrorCopy(apiErr("TEMPLATE_NOT_APPROVED", 409)).refetchTemplates).toBe(true);
  });
  it("a stale template list is re-read on not found", () => {
    expect(replyErrorCopy(apiErr("TEMPLATE_NOT_FOUND", 404)).refetchTemplates).toBe(true);
  });
  it("a viewer is told the role it needs", () => {
    expect(replyErrorCopy(apiErr("FORBIDDEN", 403)).detail).toMatch(/Editor access/);
  });
  it("every documented code has its own sentence", () => {
    const fallback = replyErrorCopy(apiErr("SOMETHING_ELSE", 400)).title;
    for (const [code, status] of [
      ["OUTSIDE_24H", 409], ["REPLY_IN_PROGRESS", 409], ["REPLY_OUTCOME_UNKNOWN", 409], ["STATUS_CHANGED", 409],
      ["WHATSAPP_UNAVAILABLE", 409], ["TEMPLATE_NOT_APPROVED", 409], ["MARKETING_NOT_ALLOWED", 409],
      ["NOT_FOUND", 404], ["TEMPLATE_NOT_FOUND", 404], ["TEMPLATE_UNSUPPORTED", 400], ["TEMPLATE_PARAMS", 400],
      ["VALIDATION_ERROR", 400], ["SEND_FAILED", 502], ["FORBIDDEN", 403],
    ] as const) {
      expect(replyErrorCopy(apiErr(code, status)).title, code).not.toBe(fallback);
    }
  });
  it("a refusal with no documented code does not claim nothing was sent", () => {
    const c = replyErrorCopy(apiErr("UNAUTHORIZED", 401, "Session expired"));
    expect(c.title).toBe("We couldn't confirm this reply");
    expect(c.detail).toMatch(/^Session expired /);
    expect(c.detail).toMatch(/will not go out twice/);
    expect(c.detail).not.toMatch(/Nothing was sent/);
    expect(c.attempt).toBe("keep");
  });
});

describe("replySuccessNote", () => {
  it("a repeat says it was not sent again", () => {
    expect(replySuccessNote({ threadId: "t", duplicate: true, sentAt: null })).toMatch(/not sent again/);
  });
  it("a send the thread did not record says it may take a moment", () => {
    expect(
      replySuccessNote({
        threadId: "t", duplicate: false, status: "escalated", escalated: false, sentAt: "x", recorded: false,
        message: { role: "merchant", source: "inbox", content: "hi", timestamp: "x" },
      }),
    ).toMatch(/^Sent\./);
  });
  it("a plain send needs no note", () => {
    expect(
      replySuccessNote({
        threadId: "t", duplicate: false, status: "escalated", escalated: false, sentAt: "x", recorded: true,
        message: { role: "merchant", source: "inbox", content: "hi", timestamp: "x" },
      }),
    ).toBeNull();
  });
});

const tpl = (over: Partial<StudioTemplate> & { components?: StudioTemplate["components"] }): StudioTemplate => ({
  _id: "abcdef0123456789abcdef01",
  name: "order_update",
  language: "en",
  category: "UTILITY",
  status: "approved",
  components: { body: { text: "Hi {{1}}, order {{2}} is on its way." } },
  ...over,
});

describe("templates", () => {
  it("counts positional values in the body", () => {
    expect(inboxTemplatePlan(tpl({}))).toEqual({ ok: true, headerCount: 0, bodyCount: 2 });
  });
  it("counts positional values in a text header", () => {
    expect(inboxTemplatePlan(tpl({ components: { header: { format: "TEXT", text: "Hi {{1}}" }, body: { text: "Thanks" } } }))).toEqual({
      ok: true,
      headerCount: 1,
      bodyCount: 0,
    });
  });
  it("refuses a verification-code template", () => {
    expect(inboxTemplatePlan(tpl({ category: "AUTHENTICATION" })).ok).toBe(false);
  });
  it("refuses a media header", () => {
    expect(inboxTemplatePlan(tpl({ components: { header: { format: "IMAGE" }, body: { text: "x" } } })).ok).toBe(false);
  });
  it("refuses a personalised link button", () => {
    expect(inboxTemplatePlan(tpl({ components: { body: { text: "x" }, buttons: [{ type: "URL", url: "https://x.test/{{1}}" }] } })).ok).toBe(false);
  });
  it("accepts a static link button", () => {
    expect(inboxTemplatePlan(tpl({ components: { body: { text: "x" }, buttons: [{ type: "URL", url: "https://x.test/a" }] } })).ok).toBe(true);
  });
  it("refuses a named value", () => {
    expect(inboxTemplatePlan(tpl({ components: { body: { text: "Hi {{name}}" } } })).ok).toBe(false);
  });
  it("refuses a gapped value", () => {
    expect(inboxTemplatePlan(tpl({ components: { body: { text: "Hi {{1}} and {{3}}" } } })).ok).toBe(false);
  });
  it("refuses a template with no body", () => {
    expect(inboxTemplatePlan(tpl({ components: {} as StudioTemplate["components"] })).ok).toBe(false);
  });
  it("refuses more header values than the api takes", () => {
    const h = Array.from({ length: 11 }, (_, i) => `{{${i + 1}}}`).join(" ");
    expect(inboxTemplatePlan(tpl({ components: { header: { format: "TEXT", text: h }, body: { text: "x" } } })).ok).toBe(false);
  });
  it("refuses more body values than the api takes", () => {
    const b = Array.from({ length: 21 }, (_, i) => `{{${i + 1}}}`).join(" ");
    expect(inboxTemplatePlan(tpl({ components: { body: { text: b } } })).ok).toBe(false);
  });
  it("accepts the most body values the api takes", () => {
    const b = Array.from({ length: 20 }, (_, i) => `{{${i + 1}}}`).join(" ");
    expect(inboxTemplatePlan(tpl({ components: { body: { text: b } } }))).toEqual({ ok: true, headerCount: 0, bodyCount: 20 });
  });
  it("accepts the most header values the api takes", () => {
    const h = Array.from({ length: 10 }, (_, i) => `{{${i + 1}}}`).join(" ");
    expect(inboxTemplatePlan(tpl({ components: { header: { format: "TEXT", text: h }, body: { text: "x" } } })).ok).toBe(true);
  });
  it("a list at the api's cap may be missing older templates", () => {
    expect(templateListTruncated(Array.from({ length: 200 }, () => tpl({})))).toBe(true);
  });
  it("a list under the api's cap is complete", () => {
    expect(templateListTruncated(Array.from({ length: 199 }, () => tpl({})))).toBe(false);
  });
  it("a template with no values has no params", () => {
    expect(templatePayload("a".repeat(24), [], [])).toEqual({ kind: "template", templateId: "a".repeat(24) });
  });
  it("lists only approved templates and counts the approved ones it cannot send", () => {
    const r = pickableTemplates([
      tpl({ _id: "a".repeat(24) }),
      tpl({ _id: "b".repeat(24), status: "submitted" }),
      tpl({ _id: "c".repeat(24), category: "AUTHENTICATION" }),
      tpl({ _id: "d".repeat(24), status: "rejected", category: "AUTHENTICATION" }),
    ]);
    expect(r.sendable.map((s) => s.template._id)).toEqual(["a".repeat(24)]);
    expect(r.unsendable).toBe(1);
  });
  it("previews the copy with values filled and the footer", () => {
    const t = tpl({ components: { header: { format: "TEXT", text: "Order {{1}}" }, body: { text: "Hi {{1}}" }, footer: { text: "Shop" } } });
    expect(templatePreview(t, ["42"], ["Asha"])).toBe("Order 42\n\nHi Asha\n\nShop");
  });
  it("previews an unfilled value as its placeholder", () => {
    expect(templatePreview(tpl({}), [], ["Asha"])).toBe("Hi Asha, order {{2}} is on its way.");
  });
  it("a filled template at the api's length is sendable", () => expect(templateContentProblem("x".repeat(4096))).toBeNull());
  it("a filled template over the api's length is not sendable", () => {
    expect(templateContentProblem("x".repeat(4097))).toMatch(/4,097 characters; the most is 4,096/);
  });
  it("a blank value is not sendable", () => expect(templateValueProblem(" ")).toBe("Fill this in."));
  it("a value with a tab is not sendable", () => expect(templateValueProblem("a\tb")).toMatch(/tab/));
  it("a value with a line break is not sendable", () => expect(templateValueProblem("a\nb")).toMatch(/line break/));
  it("a value at the limit is sendable", () => expect(templateValueProblem("x".repeat(1024))).toBeNull());
  it("a value over the limit is not sendable", () => expect(templateValueProblem("x".repeat(1025))).toMatch(/At most/));
});

describe("textProblem", () => {
  it("blank text cannot be sent", () => expect(textProblem("  \n ")).toBe("Write a reply first."));
  it("text at the limit can be sent", () => expect(textProblem("x".repeat(4096))).toBeNull());
  it("text over the limit cannot be sent", () => expect(textProblem("x".repeat(4097))).toMatch(/At most/));
  it("edge whitespace does not count toward the limit", () => expect(textProblem(` ${"x".repeat(4096)} `)).toBeNull());
});

describe("polling and resume", () => {
  it("an escalated thread is polled every five seconds", () => expect(threadPollInterval("escalated")).toBe(5000));
  it("an active open thread is re-read at the list's thirty seconds", () => expect(threadPollInterval("active")).toBe(30000));
  it("a resolved open thread is re-read at the list's thirty seconds", () => expect(threadPollInterval("resolved")).toBe(30000));
  it("an unloaded thread is not polled here", () => expect(threadPollInterval(undefined)).toBe(false));
  it("resume carries the rendered status version when the read has one", () => {
    expect(resumeBody({ statusVersion: 7 })).toEqual({ statusVersion: 7 });
  });
  it("resume carries a status version of zero", () => {
    expect(resumeBody({ statusVersion: 0 })).toEqual({ statusVersion: 0 });
  });
  it("resume sends no body when the read has no status version", () => {
    expect(resumeBody({})).toBeUndefined();
  });
  it("resume sends no body for a status version that is not a whole number", () => {
    expect(resumeBody({ statusVersion: "7" })).toBeUndefined();
  });
});

describe("the composer's memory", () => {
  it("a write with nothing subscribed is kept for the next reader", () => {
    const store = createComposerStore();
    store.update("t1", { text: "draft", pending: true });
    store.update("t1", (cur) => ({ pending: false, note: cur.text }));
    expect(store.get("t1")).toMatchObject({ text: "draft", pending: false, note: "draft" });
  });
  it("a subscriber hears each write", () => {
    const store = createComposerStore();
    let heard = 0;
    store.subscribe(() => heard++);
    store.update("t1", { text: "a" });
    store.update("t2", { text: "b" });
    expect(heard).toBe(2);
  });
  it("an unsubscribed listener hears nothing", () => {
    const store = createComposerStore();
    let heard = 0;
    const off = store.subscribe(() => heard++);
    off();
    store.update("t1", { text: "a" });
    expect(heard).toBe(0);
  });
  it("threads are kept apart", () => {
    const store = createComposerStore();
    store.update("t1", { text: "for Asha" });
    expect(store.get("t2").text).toBe("");
  });
  it("an untouched thread reads the same empty memory each time", () => {
    const store = createComposerStore();
    expect(store.get("t9")).toBe(store.get("t9"));
  });
  it("a success clears the box that still holds the sent words", () => {
    const sig = replySignature({ kind: "text", text: "Ships today" });
    expect(clearAfterSend({ ...EMPTY_MEMORY, text: "Ships today " }, sig)).toEqual({ text: "" });
  });
  it("a follow-up typed during the send is kept", () => {
    const sig = replySignature({ kind: "text", text: "Ships today" });
    expect(clearAfterSend({ ...EMPTY_MEMORY, text: "Ships today. Also" }, sig)).toEqual({});
  });
  it("a sent template clears its picker", () => {
    const id = "a".repeat(24);
    const sig = replySignature(templatePayload(id, [], ["Asha"]));
    expect(clearAfterSend({ ...EMPTY_MEMORY, templateId: id, body: ["Asha"] }, sig)).toEqual({ templateId: null, header: [], body: [] });
  });
  it("a template changed during the send is kept", () => {
    const id = "a".repeat(24);
    const sig = replySignature(templatePayload(id, [], ["Asha"]));
    expect(clearAfterSend({ ...EMPTY_MEMORY, templateId: id, body: ["Ravi"] }, sig)).toEqual({});
  });
});
