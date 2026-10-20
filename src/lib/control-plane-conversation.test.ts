import { describe, expect, it } from "vitest";
import type {
  ConversationMessage,
  MerchantContact,
} from "@/lib/api/control-plane";
import {
  CONTROL_PLANE_CONVERSATION_KEY,
  CONVERSATION_NUMBERS_HREF,
  CONVERSATION_REFUSED_TEXT,
  CONVERSATION_SCOPE_NOTE,
  conversationEmptyCopy,
  conversationEmptyReason,
  conversationKey,
  conversationView,
  fetchConversationEntry,
  groupConversationByDay,
  isNearBottom,
  nextConversationCursor,
  orderedMessages,
  scrollTopAfterPrepend,
  senderLabel,
  shouldRetryConversation,
  type ConversationEntry,
} from "./control-plane-conversation";
import {
  WHATSAPP_ACTIVITY_TAB,
  WHATSAPP_CONVERSATION_TAB,
  WHATSAPP_SETTINGS_HREF,
  WHATSAPP_SETTINGS_TAB,
  whatsappTabFromParam,
  whatsappTabQuery,
} from "./control-plane";

/**
 * WA M6, the Conversation tab. Titles carry an id ([C01]) so the mutation
 * runner can select exactly one test.
 */

function msg(sender: ConversationMessage["sender"], text: string, sentAt: string): ConversationMessage {
  return { sender, text, sentAt };
}

function page(messages: ConversationMessage[], nextCursor: string | null = null): ConversationEntry {
  return { kind: "page", messages, nextCursor };
}

function contact(over: Partial<MerchantContact>): MerchantContact {
  return {
    id: "c1",
    waId: "919800000001",
    userId: "u_me",
    status: "verified",
    verifiedAt: "2026-10-01T00:00:00.000Z",
    revokedAt: null,
    locale: null,
    register: null,
    quietHours: null,
    codeExpiresAt: null,
    codeSentAt: null,
    ...over,
  };
}

class FakeApiError extends Error {
  constructor(public status: number) {
    super(`status ${status}`);
  }
}

/** ICU may put a narrow or plain no-break space before AM/PM. */
function plain(s: string): string {
  return s.replace(/[  ]/g, " ");
}

describe("the query function and pager", () => {
  it("[C01] a 403 is stored as a refused entry, not thrown", async () => {
    const entry = await fetchConversationEntry(async () => {
      throw new FakeApiError(403);
    }, null);
    expect(entry).toEqual({ kind: "refused" });
  });

  it("[C02] a 400 or a 500 is thrown, so react-query reports a failure", async () => {
    for (const status of [400, 500]) {
      await expect(
        fetchConversationEntry(async () => {
          throw new FakeApiError(status);
        }, null),
      ).rejects.toThrow(`status ${status}`);
    }
  });

  it("[C03] a page keeps its messages and its cursor, and the cursor reaches the api", async () => {
    const seen: (string | null)[] = [];
    const m = msg("merchant", "hi", "2026-10-21T10:00:00.000Z");
    const entry = await fetchConversationEntry(async (cursor) => {
      seen.push(cursor);
      return { messages: [m], nextCursor: "1760000000000.abcdef0123456789" };
    }, "1760000000001.0000000000000000");
    expect(seen).toEqual(["1760000000001.0000000000000000"]);
    expect(entry).toEqual(page([m], "1760000000000.abcdef0123456789"));
  });

  it("[C04] the next page is fetched with the last page's nextCursor", () => {
    expect(nextConversationCursor(page([], "1760000000000.abcdef0123456789"))).toBe(
      "1760000000000.abcdef0123456789",
    );
  });

  it("[C05] there is no next page after the last page or after a refusal", () => {
    expect(nextConversationCursor(page([], null))).toBeNull();
    expect(nextConversationCursor({ kind: "refused" })).toBeNull();
  });

  it("[C06] a 4xx is never retried", () => {
    expect(shouldRetryConversation(0, new FakeApiError(400))).toBe(false);
    expect(shouldRetryConversation(0, new FakeApiError(401))).toBe(false);
    expect(shouldRetryConversation(0, new FakeApiError(499))).toBe(false);
  });

  it("[C07] a server or network failure, a 408 or a 429 is retried once", () => {
    expect(shouldRetryConversation(0, new FakeApiError(408))).toBe(true);
    expect(shouldRetryConversation(0, new FakeApiError(429))).toBe(true);
    expect(shouldRetryConversation(1, new FakeApiError(429))).toBe(false);
    expect(shouldRetryConversation(0, new FakeApiError(500))).toBe(true);
    expect(shouldRetryConversation(0, new TypeError("fetch failed"))).toBe(true);
    expect(shouldRetryConversation(1, new FakeApiError(500))).toBe(false);
  });
});

describe("what the tab shows", () => {
  const a = msg("merchant", "a", "2026-10-20T10:00:00.000Z");
  const b = msg("peakhour", "b", "2026-10-20T10:01:00.000Z");
  const c = msg("merchant", "c", "2026-10-21T09:00:00.000Z");
  const d = msg("peakhour", "d", "2026-10-21T09:01:00.000Z");

  it("[C08] pages read oldest first: the newest page, fetched first, is shown last", () => {
    // The cache holds [newest page, older page]; each is oldest first.
    expect(orderedMessages([page([c, d], "x"), page([a, b])])).toEqual([a, b, c, d]);
  });

  it("[C09] a refusal on a later page replaces the messages already shown", () => {
    const view = conversationView({
      entries: [page([c, d], "x"), { kind: "refused" }],
      status: "success",
      fetchStatus: "idle",
    });
    expect(view).toEqual({ kind: "refused" });
  });

  it("[C10] a failure with nothing loaded is failed, not empty", () => {
    expect(
      conversationView({ entries: undefined, status: "error", fetchStatus: "idle" }),
    ).toEqual({ kind: "failed" });
  });

  it("[C11] an offline (paused) query with nothing loaded is offline, not empty", () => {
    expect(
      conversationView({ entries: undefined, status: "pending", fetchStatus: "paused" }),
    ).toEqual({ kind: "offline" });
  });

  it("[C12] a first fetch in flight is loading", () => {
    expect(
      conversationView({ entries: undefined, status: "pending", fetchStatus: "fetching" }),
    ).toEqual({ kind: "loading" });
  });

  it("[C13] only an answered page with no messages is empty", () => {
    expect(
      conversationView({ entries: [page([])], status: "success", fetchStatus: "idle" }),
    ).toEqual({ kind: "empty" });
  });

  it("[C14] held messages stay on screen when a refresh fails", () => {
    expect(
      conversationView({ entries: [page([c, d])], status: "error", fetchStatus: "idle" }),
    ).toEqual({ kind: "messages", messages: [c, d] });
  });

  it("[C32] the viewer's own lines are labelled You, and Peakhour's Peakhour", () => {
    expect(senderLabel("merchant")).toBe("You");
    expect(senderLabel("peakhour")).toBe("Peakhour");
  });
});

describe("the empty state names only a reason it can know", () => {
  it("[C15] a teammate's verified number does not count as mine", () => {
    expect(conversationEmptyReason([contact({ userId: "u_teammate" })], "u_me")).toBe("no-number");
    expect(conversationEmptyReason([], "u_me")).toBe("no-number");
  });

  it("[C16] a revoked number of mine is no number", () => {
    expect(
      conversationEmptyReason([contact({ status: "revoked", revokedAt: "2026-10-02T00:00:00.000Z" })], "u_me"),
    ).toBe("no-number");
  });

  it("[C17] a number of mine still waiting for its code is pending", () => {
    expect(conversationEmptyReason([contact({ status: "pending", verifiedAt: null })], "u_me")).toBe("pending");
  });

  it("[C18] a verified number of mine wins over a pending one", () => {
    expect(
      conversationEmptyReason(
        [contact({ id: "c2", status: "pending", verifiedAt: null }), contact({})],
        "u_me",
      ),
    ).toBe("verified");
  });

  it("[C19] contacts that could not be read claim no reason", () => {
    expect(conversationEmptyReason(undefined, "u_me")).toBe("unknown");
    expect(conversationEmptyReason([contact({})], null)).toBe("unknown");
    expect(conversationEmptyCopy("unknown", true).text).toBe(
      "No messages to show. Peakhour could not check your numbers just now, so it cannot say why.",
    );
  });

  it("[C20] no number links to the Numbers & routing tab, and tells a non-admin who can register it", () => {
    expect(CONVERSATION_NUMBERS_HREF).toBe(WHATSAPP_SETTINGS_HREF);
    const admin = conversationEmptyCopy("no-number", true);
    expect(admin.text).toMatch(/^You have no verified number on this business/);
    expect(admin.link).toEqual({ href: WHATSAPP_SETTINGS_HREF, label: "Go to Numbers & routing" });
    const editor = conversationEmptyCopy("no-number", false);
    expect(editor.text).toContain("Only an Owner or Admin can register your number");
    expect(editor.link?.href).toBe(WHATSAPP_SETTINGS_HREF);
  });

  it("[C21] a verified number with nothing says so, and does not rule out a shared number", () => {
    const copy = conversationEmptyCopy("verified", true);
    expect(copy.text).toMatch(/^No messages since your number was last verified\./);
    expect(copy.text).toContain("A number that someone else has also verified is never shown.");
    expect(copy.link).toBeUndefined();
    const pending = conversationEmptyCopy("pending", false).text;
    expect(pending).toMatch(/^Your number on this business is not verified yet/);
    // The reason does not read `codeExpiresAt`, so the copy covers an expired code.
    expect(pending).toContain("or send a new code if it has expired");
  });

  it("[C31] the scope note says what the api reads, and the refusal is never an empty conversation", () => {
    expect(CONVERSATION_SCOPE_NOTE).toContain("Only your own conversation is shown, never a teammate's.");
    expect(CONVERSATION_SCOPE_NOTE).toContain("last time that number was verified or removed on any business");
    expect(CONVERSATION_SCOPE_NOTE).toContain("keeps its latest 50 messages");
    expect(CONVERSATION_SCOPE_NOTE).toContain("A number that someone else has also verified is left out");
    expect(CONVERSATION_SCOPE_NOTE).toContain("whichever business they were about");
    expect(CONVERSATION_SCOPE_NOTE).toContain("Verification codes are never shown");
    expect(CONVERSATION_REFUSED_TEXT).toMatch(/^Peakhour refused to show this conversation/);
  });
});

describe("timestamps, in a pinned locale and zone", () => {
  // 18:45 UTC on the 21st is 00:15 on the 22nd in Kolkata.
  const late = msg("merchant", "late", "2026-10-21T18:45:00.000Z");
  const early = msg("peakhour", "early", "2026-10-21T04:00:00.000Z");

  it("[C22] en-US: the date and time are formatted in that locale", () => {
    const [day] = groupConversationByDay([late], { locale: "en-US", timeZone: "Asia/Kolkata" });
    expect(plain(day!.label)).toBe("Thu, Oct 22, 2026");
    expect(plain(day!.items[0]!.time)).toBe("12:15 AM");
  });

  it("[C23] en-GB: the same instant reads day-first and on a 24-hour clock", () => {
    const [day] = groupConversationByDay([late], { locale: "en-GB", timeZone: "Asia/Kolkata" });
    expect(plain(day!.label)).toBe("Thu, 22 Oct 2026");
    expect(plain(day!.items[0]!.time)).toBe("00:15");
  });

  it("[C24] the day a message falls on follows the display zone, not UTC", () => {
    const kolkata = groupConversationByDay([early, late], { locale: "en-GB", timeZone: "Asia/Kolkata" });
    expect(kolkata.map((d) => d.key)).toEqual(["2026-10-21", "2026-10-22"]);
    expect(kolkata.map((d) => d.items.length)).toEqual([1, 1]);
    const utc = groupConversationByDay([early, late], { locale: "en-GB", timeZone: "UTC" });
    expect(utc.map((d) => d.key)).toEqual(["2026-10-21"]);
    expect(plain(utc[0]!.items[1]!.time)).toBe("18:45");
    // On its own the late line is dated the 21st in UTC: the label follows the
    // display zone too (this host is not UTC, so the host zone would say the 22nd).
    const [lateUtc] = groupConversationByDay([late], { locale: "en-GB", timeZone: "UTC" });
    expect(plain(lateUtc!.label)).toBe("Wed, 21 Oct 2026");
  });

  it("[C25] two lines in one instant get distinct keys that survive older pages being prepended", () => {
    const one = msg("peakhour", "one", "2026-10-21T10:00:00.000Z");
    const two = msg("peakhour", "two", "2026-10-21T10:00:00.000Z");
    const older = msg("merchant", "older", "2026-10-20T10:00:00.000Z");
    const keysOf = (ms: ConversationMessage[]) =>
      groupConversationByDay(ms, { locale: "en-GB", timeZone: "UTC" }).flatMap((d) => d.items.map((i) => i.key));
    const before = keysOf([one, two]);
    expect(new Set(before).size).toBe(2);
    expect(keysOf([older, one, two]).slice(1)).toEqual(before);
    // A page boundary between two lines of one instant: "Load older" brings the
    // first of them, and the newer one keeps its key (so it is not remounted
    // and is not read as a new message).
    expect(keysOf([one, two]).slice(1)).toEqual(keysOf([two]));
    // Byte-identical twins are still told apart.
    expect(new Set(keysOf([two, { ...two }])).size).toBe(2);
  });
});

describe("the scroll position", () => {
  it("[C26] loading older keeps the reader's distance from the bottom", () => {
    // Reading 100px from the top of 1000px; 600px of older lines arrive above.
    expect(scrollTopAfterPrepend({ scrollTop: 100, scrollHeight: 1000 }, 1600)).toBe(700);
    expect(scrollTopAfterPrepend({ scrollTop: 0, scrollHeight: 1000 }, 1000)).toBe(0);
  });

  it("[C27] near the bottom means within the slack of the newest line", () => {
    expect(isNearBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
    expect(isNearBottom({ scrollTop: 580, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
    expect(isNearBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 400 })).toBe(false);
  });
});

describe("the cache key and the tab", () => {
  it("[C28] one cache entry per org, business and user", () => {
    expect(conversationKey("org_1", "biz_a", "u_me")).toEqual([CONTROL_PLANE_CONVERSATION_KEY, "org_1", "biz_a", "u_me"]);
    expect(conversationKey("org_1", "biz_a", "u_me")).not.toEqual(conversationKey("org_1", "biz_b", "u_me"));
    expect(conversationKey("org_1", "biz_a", "u_me")).not.toEqual(conversationKey("org_1", "biz_a", "u_teammate"));
    expect(conversationKey(undefined, null, undefined)).toEqual([CONTROL_PLANE_CONVERSATION_KEY, null, null, null]);
  });

  it("[C29] ?tab=conversation and ?tab=activity open their tabs; anything else is settings", () => {
    expect(whatsappTabFromParam("conversation")).toBe(WHATSAPP_CONVERSATION_TAB);
    expect(whatsappTabFromParam("activity")).toBe(WHATSAPP_ACTIVITY_TAB);
    expect(whatsappTabFromParam(null)).toBe(WHATSAPP_SETTINGS_TAB);
    expect(whatsappTabFromParam("conversations")).toBe(WHATSAPP_SETTINGS_TAB);
  });

  it("[C30] selecting settings drops ?tab=, and every tab keeps the other parameters", () => {
    expect(whatsappTabQuery("tab=conversation&x=1", WHATSAPP_SETTINGS_TAB)).toBe("x=1");
    expect(whatsappTabQuery("x=1", WHATSAPP_CONVERSATION_TAB)).toBe("x=1&tab=conversation");
    expect(whatsappTabQuery("tab=conversation", WHATSAPP_ACTIVITY_TAB)).toBe("tab=activity");
  });
});
