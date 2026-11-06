import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import {
  DELETE_VISITOR_BODY,
  STOREFRONT_REPLY_MAX,
  deliveryLine,
  emailLine,
  noteHeading,
  safeAdminUrl,
  storefrontFooter,
  storefrontMount,
  storefrontReplyError,
  storefrontReplyRequest,
  storefrontResumeBody,
  storefrontTextProblem,
} from "./storefront-handover";

describe("what sits under a storefront thread", () => {
  it("the reply box only while the chat is with the team and the person is an editor or above", () => {
    expect(storefrontFooter({ readOnly: false, role: "editor" }).kind).toBe("composer");
    expect(storefrontFooter({ readOnly: false, role: "owner" }).kind).toBe("composer");
    expect(storefrontFooter({ readOnly: true, role: "editor" }).kind).toBe("takeover");
    expect(storefrontFooter({ readOnly: true, role: "admin" }).kind).toBe("takeover");
  });
  it("a viewer and the merchant's own test chat get a note and no button", () => {
    expect(storefrontFooter({ readOnly: false, role: "viewer" }).kind).toBe("readonly");
    expect(storefrontFooter({ readOnly: true, role: "viewer" }).kind).toBe("readonly");
    expect(storefrontFooter({ readOnly: true, role: "owner", test: true }).kind).toBe("readonly");
  });
});

describe("the delivery line", () => {
  it("says each state in plain words", () => {
    expect(deliveryLine("visitor_here")).toBe("The visitor has this chat open and sees your reply now.");
    expect(deliveryLine("visitor_away")).toBe("The visitor is not in the chat right now. They see your reply if they come back to it.");
    expect(deliveryLine("visitor_away_email")).toBe("The visitor is not in the chat right now. They left an email: follow up there as well.");
    expect(deliveryLine(undefined)).toBeNull();
  });
  it("never says delivered when the visitor is away", () => {
    for (const d of ["visitor_away", "visitor_away_email"] as const) expect(deliveryLine(d)).not.toMatch(/deliver|sees your reply now/i);
  });
});

describe("the requests", () => {
  it("a reply goes to the storefront mount, trimmed, with its key", () => {
    expect(storefrontReplyRequest("storefront:abc", "  hi  ", "k1")).toEqual({ path: "/v1/storefront-chats/storefront%3Aabc/reply", body: { text: "hi", idempotencyKey: "k1" } });
    expect(storefrontMount("storefront:abc")).toBe("/v1/storefront-chats/storefront%3Aabc");
  });
  it("resume sends the version it rendered, zero included", () => {
    expect(storefrontResumeBody({ statusVersion: 0 })).toEqual({ statusVersion: 0 });
    expect(storefrontResumeBody({ statusVersion: 4 })).toEqual({ statusVersion: 4 });
    expect(storefrontResumeBody({})).toBeUndefined();
    expect(storefrontResumeBody(null)).toBeUndefined();
  });
  it("2000 characters at most", () => {
    expect(STOREFRONT_REPLY_MAX).toBe(2000);
    expect(storefrontTextProblem("")).toMatch(/Write a reply/);
    expect(storefrontTextProblem("a".repeat(2000))).toBeNull();
    expect(storefrontTextProblem("a".repeat(2001))).toMatch(/At most 2,000/);
  });
});

describe("refusals", () => {
  const e = (code: string, status: number, message = "x") => new ApiError(code, message, status);
  it("an unknown outcome is marked unknown and never invites a blind resend", () => {
    const c = storefrontReplyError(e("REPLY_OUTCOME_UNKNOWN", 409));
    expect(c.attempt).toBe("unknown");
    expect(c.detail).toMatch(/Check this chat/);
  });
  it("an unknown outcome on a 5xx is still unknown: it never says a resend is safe (SA-12)", () => {
    for (const status of [500, 502, 503]) {
      const c = storefrontReplyError(e("REPLY_OUTCOME_UNKNOWN", status));
      expect(c.attempt).toBe("unknown");
      expect(`${c.title} ${c.detail}`).not.toMatch(/is safe|fail/i);
      expect(c.detail).toMatch(/Check this chat/);
    }
    expect(storefrontReplyError(e("REPLY_IN_PROGRESS", 503)).title).toMatch(/still being handled/);
    // a website chat has no carrier: a 5xx that happens to say SEND_FAILED is a bare 5xx here, not WhatsApp's refusal
    expect(storefrontReplyError(e("SEND_FAILED", 502)).title).toMatch(/lost touch/);
    // a bare 5xx stays the lost-touch answer
    expect(storefrontReplyError(e("INTERNAL", 500)).title).toMatch(/lost touch/);
  });
  it("a changed status says nothing was sent, and nothing mentions WhatsApp", () => {
    const c = storefrontReplyError(e("STATUS_CHANGED", 409, "Taken back by a colleague."));
    expect(c.detail).toContain("Taken back by a colleague.");
    expect(c.detail).toContain("Nothing was sent.");
    for (const code of ["REPLY_IN_PROGRESS", "CHANNEL_UNAVAILABLE", "TEXT_TOO_LONG", "FORBIDDEN", "NOT_FOUND", "WHATEVER"]) {
      const m = storefrontReplyError(e(code, 400));
      expect(`${m.title} ${m.detail}`).not.toMatch(/whatsapp/i);
    }
    expect(storefrontReplyError(new Error("offline")).detail).toMatch(/can't tell/);
  });
});

describe("the handover card words", () => {
  it("heads the prepared note by kind and order", () => {
    expect(noteHeading("refund", "#1001")).toBe("Refund request for order #1001");
    expect(noteHeading("discount", null)).toBe("Discount request");
    expect(noteHeading("payment", "#7")).toBe("Payment problem for order #7");
    expect(noteHeading(null, null)).toBe("Note from the assistant");
  });
  it("an editor sees the address, a viewer only that one was left", () => {
    expect(emailLine("a@b.co", true)).toBe("The visitor left an email: a@b.co");
    expect(emailLine(null, true)).toBe("The visitor left an email");
    expect(emailLine(undefined, false)).toBeNull();
    expect(emailLine(null, true)).not.toContain("@");
  });
  it("opens only the Shopify admin over https", () => {
    expect(safeAdminUrl("https://admin.shopify.com/store/x/orders/1")).toBe("https://admin.shopify.com/store/x/orders/1");
    for (const bad of ["http://admin.shopify.com/x", "https://evil.example/x", "javascript:alert(1)", "", null, undefined]) expect(safeAdminUrl(bad as string | null | undefined)).toBeNull();
  });
  it("the erase copy is about the visitor and the email", () => {
    expect(DELETE_VISITOR_BODY).toContain("including an email");
  });
});
