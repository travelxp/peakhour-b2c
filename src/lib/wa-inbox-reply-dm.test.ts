import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ApiError } from "@/lib/api";
import {
  composerMode,
  dmChannelOfThread,
  dmOutsideWindowMessage,
  replyErrorCopy,
  replyWindow,
  replyingAsLine,
  savedReplyChannelFor,
  windowFor,
} from "./wa-inbox-reply";

/** MR-M1: the Inbox reply box speaks Messenger and Instagram on their threads, not WhatsApp. */

const KEY = "mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm";
const M = `messenger:123456:${KEY}`;
const I = `instagram:998877:${KEY}`;
const W = "whatsapp:111:919800000000";
const X = `x:abc:${KEY}`;

const NOW = Date.parse("2026-11-17T12:00:00.000Z");
const HOUR = 3_600_000;
const OPEN = replyWindow(new Date(NOW + 5 * HOUR).toISOString(), NOW);
const CLOSED = replyWindow(new Date(NOW - 2 * HOUR).toISOString(), NOW);

const apiErr = (code: string, status: number, message = "Request failed") => new ApiError(code, message, status);

describe("which thread is a DM thread", () => {
  it("reads the channel from the key's first part", () => {
    expect(dmChannelOfThread(M)).toBe("messenger");
    expect(dmChannelOfThread(I)).toBe("instagram");
    for (const t of [W, X, "storefront:a:b", "", null, undefined]) expect(dmChannelOfThread(t)).toBeNull();
  });
});

describe("the composer on a Messenger or Instagram thread", () => {
  it("windowFor keeps the api's window: it is never rewritten into an open one", () => {
    expect(windowFor(M, CLOSED)).toBe(CLOSED);
    expect(windowFor(I, CLOSED)).toBe(CLOSED);
    expect(windowFor(X, CLOSED).open).toBe(true);
  });

  it("an open window is plain text mode", () => {
    for (const threadId of [M, I]) {
      expect(composerMode({ status: "active", role: "editor", window: windowFor(threadId, OPEN), threadId })).toEqual({ kind: "text", takesOver: true });
    }
  });

  it("a closed window is never template mode: the box is disabled and says the api's sentence", () => {
    const m = composerMode({ status: "escalated", role: "editor", window: windowFor(M, CLOSED), threadId: M });
    expect(m).toEqual({ kind: "readonly", reason: dmOutsideWindowMessage("messenger") });
    const i = composerMode({ status: "active", role: "owner", window: windowFor(I, CLOSED), threadId: I });
    expect(i).toEqual({ kind: "readonly", reason: dmOutsideWindowMessage("instagram") });
    expect((i as { reason: string }).reason).not.toMatch(/template|WhatsApp|shopper/i);
  });

  it("a DM thread whose customer never messaged (no window) is closed the same way", () => {
    const none = replyWindow(null, NOW);
    expect(composerMode({ status: "active", role: "editor", window: windowFor(M, none), threadId: M }).kind).toBe("readonly");
  });

  it("a viewer still gets the Editor-access reason first", () => {
    const m = composerMode({ status: "active", role: "viewer", window: CLOSED, threadId: M });
    expect(m.kind).toBe("readonly");
    expect((m as { reason: string }).reason).toMatch(/Editor access/);
  });

  it("a WhatsApp thread still falls to the template picker after 24 hours", () => {
    expect(composerMode({ status: "active", role: "editor", window: CLOSED, threadId: W }).kind).toBe("template");
    expect(composerMode({ status: "active", role: "editor", window: CLOSED }).kind).toBe("template");
  });

  it("the sentence is the api's, word for word (peakhour-api OUTSIDE_WINDOW_DM_MESSAGE)", () => {
    expect(dmOutsideWindowMessage("messenger")).toBe(
      "It has been more than 24 hours since this customer last messaged, and Messenger only allows replies within 24 hours. You can reply once they message you again.",
    );
    expect(dmOutsideWindowMessage("instagram")).toBe(
      "It has been more than 24 hours since this customer last messaged, and Instagram only allows replies within 24 hours. You can reply once they message you again.",
    );
  });
});

describe("OUTSIDE_24H on a DM thread", () => {
  const sentence = dmOutsideWindowMessage("instagram");
  it("shows the api's sentence and no template advice, and closes the window here", () => {
    const c = replyErrorCopy(apiErr("OUTSIDE_24H", 409, sentence), "text", I);
    expect(c.title).toBe("The 24-hour window has closed");
    expect(c.detail).toContain(sentence);
    expect(c.detail).toMatch(/Nothing was sent/);
    expect(c.detail).not.toMatch(/template|WhatsApp/i);
    expect(c.closesWindow).toBe(true);
    expect(c.attempt).toBe("keep");
  });
  it("falls back to the same sentence when the api sent none", () => {
    expect(replyErrorCopy(apiErr("OUTSIDE_24H", 409), "text", M).detail).toContain(dmOutsideWindowMessage("messenger"));
  });
  it("a WhatsApp thread keeps the template wording", () => {
    for (const threadId of [W, undefined]) {
      const c = replyErrorCopy(apiErr("OUTSIDE_24H", 409, "x"), "text", threadId);
      expect(c.detail).toMatch(/approved template/);
    }
  });
});

describe("the Replying as line", () => {
  const pages = [
    { pageId: "123456", pageName: "Acme Coffee", instagramUsername: "acme.coffee" },
    { pageId: "777", pageName: "Other Page", instagramUsername: null },
  ];
  it("Messenger names the Page the thread belongs to", () => {
    expect(replyingAsLine(M, undefined, pages)).toBe("Replying as Acme Coffee on Messenger");
  });
  it("Messenger with an unknown Page, a blank name or no status says the plain line", () => {
    expect(replyingAsLine(M, undefined, undefined)).toBe("Replying on Messenger");
    expect(replyingAsLine(M, undefined, [])).toBe("Replying on Messenger");
    expect(replyingAsLine(M, undefined, [{ pageId: "123456", pageName: " ", instagramUsername: null }])).toBe("Replying on Messenger");
    expect(replyingAsLine(M, undefined, [{ pageId: "999", pageName: "Not it", instagramUsername: null }])).toBe("Replying on Messenger");
  });
  it("Instagram names the account when exactly one connected Page has one", () => {
    expect(replyingAsLine(I, undefined, pages)).toBe("Replying as @acme.coffee on Instagram");
    expect(replyingAsLine(I, undefined, [{ pageId: "1", pageName: "P", instagramUsername: "@brand" }])).toBe("Replying as @brand on Instagram");
  });
  it("Instagram does not guess between two accounts, or with none", () => {
    const two = [...pages, { pageId: "888", pageName: "Third", instagramUsername: "third" }];
    expect(replyingAsLine(I, undefined, two)).toBe("Replying on Instagram");
    expect(replyingAsLine(I, undefined, undefined)).toBe("Replying on Instagram");
    expect(replyingAsLine(I, undefined, [{ pageId: "1", pageName: "P", instagramUsername: null }])).toBe("Replying on Instagram");
  });
  it("never says WhatsApp on a DM thread, even with a WhatsApp connection loaded", () => {
    const conn = { phoneNumberId: "123456", phoneNumber: "+91 98000 00000" };
    expect(replyingAsLine(M, conn, pages)).not.toMatch(/WhatsApp|\+91/);
  });
  it("a WhatsApp thread is unchanged", () => {
    expect(replyingAsLine(W, undefined, pages)).toBe("Replying from your WhatsApp Business number");
    expect(replyingAsLine(W, { phoneNumberId: "111", phoneNumber: "+91 98000 00000" }, pages)).toBe("Replying as +91 98000 00000");
  });
});

describe("saved replies on a DM thread", () => {
  it("are scoped to the thread's channel, so WhatsApp-only replies are not offered", () => {
    expect(savedReplyChannelFor(M)).toBe("facebook");
    expect(savedReplyChannelFor(I)).toBe("instagram");
    expect(savedReplyChannelFor(W)).toBe("whatsapp");
  });
});

describe("the composer and the pane pass the thread through", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  it("wa-composer hands the thread to composerMode, the error copy and the saved-reply picker", () => {
    const src = read("../components/inbox/wa-composer.tsx");
    expect(src).toMatch(/composerMode\(\{ status, role, window: win, threadId \}\)/);
    expect(src).toMatch(/replyErrorCopy\(e, payload\.kind, threadId\)/);
    expect(src).toMatch(/channel=\{savedReplyChannelFor\(threadId\)\}/);
    expect(src).not.toMatch(/channel="whatsapp"/);
  });
  it("the pane asks for the WhatsApp connection only on a WhatsApp thread, and the Pages on a DM thread", () => {
    const src = read("../components/inbox/conversations-pane.tsx");
    expect(src).toMatch(/useWaConnection\(selectedChannel === "whatsapp" && !isDmThread\)/);
    expect(src).toMatch(/useDmStatus\(isDmThread\)/);
    expect(src).toMatch(/replyingAsLine\(selected, connection\.data, dmStatus\.data\?\.pages\)/);
  });
});
