import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import {
  DEFAULT_STATUS_FILTER,
  INBOX_SUBTITLE,
  SEARCH_MAX,
  SEARCH_MIN,
  STATUS_FILTERS,
  WHATSAPP_CONNECT_HREF,
  browserStorage,
  channelOfThread,
  clockLabel,
  combineListState,
  dayLabel,
  doneAction,
  doneToast,
  emptyListText,
  groupByDay,
  handoverAction,
  isUnread,
  loadReadMarks,
  markRead,
  mergeRows,
  paneClasses,
  previewTime,
  READ_MARKS_MAX,
  readMarksKey,
  rowOfStorefront,
  rowOfWhatsApp,
  threadFromParam,
  saveReadMarks,
  searchTerm,
  waInboxState,
  waNotice,
  type InboxRow,
  type MarkStorage,
} from "@/lib/inbox-view";

const wa = (over: Partial<Parameters<typeof rowOfWhatsApp>[0]> = {}) =>
  rowOfWhatsApp({ threadId: "whatsapp:1:a", waId: "919800000000", contactName: "Asha", status: "active", updatedAt: "2026-11-03T10:00:00Z", lastInboundAt: "2026-11-03T09:59:00Z", preview: "hello", ...over });
const sf = (over: Partial<Parameters<typeof rowOfStorefront>[0]> = {}) =>
  rowOfStorefront({ threadId: "storefront:m:t", contactName: "Storefront visitor", status: "active", updatedAt: "2026-11-03T11:00:00Z", preview: "Assistant: Yes", ...over });

describe("the subtitle", () => {
  it("names storefront conversations, because they are listed here now", () => {
    expect(INBOX_SUBTITLE).toBe("Your WhatsApp and storefront conversations, leads and reviews in one place.");
  });
});

describe("a link that opens a conversation", () => {
  it("accepts a WhatsApp or a storefront thread key", () => {
    expect(threadFromParam("whatsapp:123456:abc_DEF-9")).toBe("whatsapp:123456:abc_DEF-9");
    expect(threadFromParam("storefront:6ae984c67f3ad17464f76ea3:tab-1")).toBe("storefront:6ae984c67f3ad17464f76ea3:tab-1");
  });
  it("refuses anything else: nothing, other text, another scheme, a script, a very long value", () => {
    for (const v of [null, undefined, "", "hello", "slack:1:2", "whatsapp:", "whatsapp:1:2 3", "whatsapp:<script>", "storefront:" + "a".repeat(300)]) expect(threadFromParam(v as string | null), String(v)).toBeNull();
  });
});

describe("rows from both channels", () => {
  it("a storefront row carries the visitor label it was given, never a name of its own", () => {
    expect(sf().title).toBe("Storefront visitor");
    expect(sf().channel).toBe("storefront");
    expect(sf().needsYou).toBe(false);
  });
  it("a WhatsApp row is titled by the contact's name, then the number it came from", () => {
    expect(wa().title).toBe("Asha");
    expect(wa({ contactName: null }).title).toBe("919800000000");
    expect(wa({ contactName: null, waId: "" }).title).toBe("WhatsApp contact");
  });
  it("tells a thread's channel from its key", () => {
    expect(channelOfThread("storefront:abc:tab")).toBe("storefront");
    expect(channelOfThread("whatsapp:1:k")).toBe("whatsapp");
  });
});

describe("the merged list and its channel filter", () => {
  const rows = { w1: wa({ threadId: "w1", updatedAt: "2026-11-03T08:00:00Z" }), w2: wa({ threadId: "w2", updatedAt: "2026-11-03T12:00:00Z" }), s1: sf({ threadId: "s1", updatedAt: "2026-11-03T10:00:00Z" }) };
  const ids = (r: InboxRow[]) => r.map((x) => x.threadId);

  it("all: both channels, newest first", () => {
    expect(ids(mergeRows([rows.w1, rows.w2], [rows.s1], "all"))).toEqual(["w2", "s1", "w1"]);
  });
  it("whatsapp and storefront each show only their own", () => {
    expect(ids(mergeRows([rows.w1, rows.w2], [rows.s1], "whatsapp"))).toEqual(["w2", "w1"]);
    expect(ids(mergeRows([rows.w1, rows.w2], [rows.s1], "storefront"))).toEqual(["s1"]);
  });
  it("a conversation that needs you comes first, however old", () => {
    const needs = wa({ threadId: "old", updatedAt: "2026-10-01T00:00:00Z", needsYou: true });
    expect(ids(mergeRows([rows.w2, needs], [rows.s1], "all"))[0]).toBe("old");
  });
  it("a row with no time sorts last, not first", () => {
    expect(ids(mergeRows([wa({ threadId: "none", updatedAt: null }), rows.w1], [], "all"))).toEqual(["w1", "none"]);
  });
  it("does not change the lists it is given", () => {
    const a = [rows.w1, rows.w2];
    mergeRows(a, [rows.s1], "all");
    expect(ids(a)).toEqual(["w1", "w2"]);
  });
});

describe("honest states", () => {
  it("a 404 is 'not available yet', not a failure", () => {
    expect(waInboxState({ error: new ApiError("NOT_FOUND", "WhatsApp is not available", 404) })).toBe("not_available");
  });
  it("another error is not read as a WhatsApp state (the page shows its retry card)", () => {
    expect(waInboxState({ error: new ApiError("INTERNAL", "boom", 500) })).toBe("ok");
    expect(waInboxState({ error: new Error("offline") })).toBe("ok");
  });
  it("not connected, and needs re-auth, from the list's own fields", () => {
    expect(waInboxState({ data: { available: true, connected: false, needsReauth: false } })).toBe("not_connected");
    expect(waInboxState({ data: { available: true, connected: false, needsReauth: true } })).toBe("needs_reauth");
  });
  it("PASS: connected is ok, and so is a reply from an older api that sends neither field (nothing is claimed)", () => {
    expect(waInboxState({ data: { available: true, connected: true, needsReauth: false } })).toBe("ok");
    expect(waInboxState({ data: {} })).toBe("ok");
    expect(waInboxState({})).toBe("ok");
  });

  it("each state says what to do, and 'Connect' and 'Reconnect' go to the WhatsApp page", () => {
    expect(waNotice("not_connected")).toMatchObject({ title: "Connect WhatsApp to see your conversations", cta: { label: "Connect WhatsApp", href: WHATSAPP_CONNECT_HREF } });
    expect(waNotice("needs_reauth")).toMatchObject({ title: "Reconnect WhatsApp", cta: { label: "Reconnect WhatsApp", href: "/dashboard/content/whatsapp" } });
    expect(waNotice("not_available")).toEqual({ title: "WhatsApp isn't available yet", body: "Your storefront chats, leads and reviews are still here." });
    expect(waNotice("ok")).toBeNull();
  });
  it("'not available' offers no button: there is nothing the merchant can do", () => {
    expect(waNotice("not_available")?.cta).toBeUndefined();
  });
  it("no state says 'Couldn't load'", () => {
    for (const s of ["not_connected", "needs_reauth", "not_available"] as const) expect(JSON.stringify(waNotice(s))).not.toMatch(/couldn.t load/i);
  });
  it("the empty sentence belongs to the channel chosen", () => {
    expect(emptyListText("all", "ok")).toBe("No conversations yet.");
    expect(emptyListText("storefront", "ok")).toMatch(/^No storefront chats yet/);
    expect(emptyListText("whatsapp", "not_connected")).toBe("No WhatsApp conversations to show.");
  });
});

describe("times", () => {
  const NOW = new Date("2026-11-03T12:00:00Z");
  it("a bubble's clock is 24-hour and in the zone asked", () => {
    expect(clockLabel("2026-11-03T08:05:00Z", "UTC")).toBe("08:05");
    expect(clockLabel("2026-11-03T08:05:00Z", "Asia/Kolkata")).toBe("13:35");
    expect(clockLabel(null)).toBe("");
    expect(clockLabel("not a date")).toBe("");
  });
  it("Today, Yesterday, then the date", () => {
    expect(dayLabel("2026-11-03T01:00:00Z", NOW, "UTC")).toBe("Today");
    expect(dayLabel("2026-11-02T23:00:00Z", NOW, "UTC")).toBe("Yesterday");
    expect(dayLabel("2026-10-20T10:00:00Z", NOW, "UTC")).toBe("20 Oct 2026");
  });
  it("'Yesterday' is the calendar day before, also across a daylight-saving change", () => {
    // New York sprang forward on 2026-03-08: 24 hours before 00:30 on the 9th is 23:30 on the 7th, which is NOT yesterday's date
    const now = new Date("2026-03-09T04:30:00Z");
    expect(dayLabel("2026-03-08T12:00:00Z", now, "America/New_York")).toBe("Yesterday");
    expect(dayLabel("2026-03-07T12:00:00Z", now, "America/New_York")).toBe("7 Mar 2026");
  });
  it("the same instant is on different days in different zones (the day is the viewer's)", () => {
    expect(dayLabel("2026-11-02T22:00:00Z", NOW, "UTC")).toBe("Yesterday");
    expect(dayLabel("2026-11-02T22:00:00Z", NOW, "Asia/Kolkata")).toBe("Today");
  });
  it("a list row shows the clock today, 'Yesterday', then day and month", () => {
    expect(previewTime("2026-11-03T08:05:00Z", NOW, "UTC")).toBe("08:05");
    expect(previewTime("2026-11-02T08:05:00Z", NOW, "UTC")).toBe("Yesterday");
    expect(previewTime("2026-10-20T08:05:00Z", NOW, "UTC")).toBe("20 Oct");
    expect(previewTime(null, NOW)).toBe("");
  });
  it("messages are cut into days in order, one separator per day", () => {
    const msgs = [
      { id: 1, timestamp: "2026-11-02T10:00:00Z" },
      { id: 2, timestamp: "2026-11-02T10:05:00Z" },
      { id: 3, timestamp: "2026-11-03T09:00:00Z" },
    ];
    const groups = groupByDay(msgs, NOW, "UTC");
    expect(groups.map((g) => [g.label, g.items.map((m) => m.id)])).toEqual([["Yesterday", [1, 2]], ["Today", [3]]]);
  });
  it("a message with no time stays with the one before it and is never dropped", () => {
    const groups = groupByDay([{ id: 1, timestamp: "2026-11-03T09:00:00Z" }, { id: 2, timestamp: null }], NOW, "UTC");
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((m) => m.id)).toEqual([1, 2]);
    expect(groupByDay([{ id: 1, timestamp: null }], NOW, "UTC")).toEqual([{ key: "unknown", label: "", items: [{ id: 1, timestamp: null }] }]);
  });
});

describe("the unread dot", () => {
  const NOW = new Date("2026-11-03T12:00:00Z");
  const mem = (): MarkStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };
  const row = (activityAt: string | null, threadId = "t") => ({ threadId, activityAt });

  it("the first visit marks nothing unread: older activity is before this browser's baseline", () => {
    const marks = loadReadMarks(mem(), "k", NOW);
    expect(isUnread(row("2026-11-03T11:00:00Z"), marks)).toBe(false);
  });
  it("activity after the baseline is unread until the thread is opened", () => {
    const marks = loadReadMarks(mem(), "k", NOW);
    const r = row("2026-11-03T12:30:00Z");
    expect(isUnread(r, marks)).toBe(true);
    const after = markRead(marks, r, new Date("2026-11-03T12:31:00Z"));
    expect(isUnread(r, after)).toBe(false);
    // PASS: a newer message is unread again
    expect(isUnread(row("2026-11-03T12:40:00Z"), after)).toBe(true);
  });
  it("reading one thread does not clear another", () => {
    const marks = loadReadMarks(mem(), "k", NOW);
    const a = row("2026-11-03T12:30:00Z", "a");
    const b = row("2026-11-03T12:30:00Z", "b");
    expect(isUnread(b, markRead(marks, a, NOW))).toBe(true);
  });
  it("a WhatsApp row's activity is the shopper's last message: the team's own reply or a status change is not unread", () => {
    expect(wa({ lastInboundAt: null, updatedAt: "2026-11-03T11:00:00Z" }).activityAt).toBeNull();
    expect(wa({ lastInboundAt: "2026-11-03T09:00:00Z", updatedAt: "2026-11-03T11:00:00Z" }).activityAt).toBe("2026-11-03T09:00:00Z");
    expect(isUnread(wa({ lastInboundAt: null, updatedAt: "2026-11-03T13:00:00Z" }), loadReadMarks(null, "k", NOW))).toBe(false);
  });
  it("storage that cannot even be reached is no storage, not a crash", () => {
    const g = globalThis as { window?: unknown };
    const saved = g.window;
    g.window = { get localStorage(): never { throw new Error("SecurityError"); } };
    try {
      expect(browserStorage()).toBeNull();
    } finally {
      if (saved === undefined) delete g.window;
      else g.window = saved;
    }
    expect(browserStorage()).toBeNull(); // no window at all (this environment)
  });
  it("a row with no activity time is never unread", () => {
    expect(isUnread(row(null), loadReadMarks(null, "k", NOW))).toBe(false);
  });
  it("opening a thread whose activity is later than the clock still clears it (a skewed clock cannot keep a dot)", () => {
    const marks = loadReadMarks(null, "k", NOW);
    const r = row("2026-11-03T15:00:00Z");
    expect(isUnread(r, markRead(marks, r, NOW))).toBe(false);
  });
  it("the baseline from the FIRST visit survives a visit in which nothing was opened, so a message that came in meanwhile is unread", () => {
    const store = mem();
    saveReadMarks(store, "k", loadReadMarks(store, "k", NOW));
    const later = loadReadMarks(store, "k", new Date("2026-11-05T09:00:00Z"));
    expect(later.baseline).toBe(NOW.toISOString());
    expect(isUnread(row("2026-11-04T10:00:00Z"), later)).toBe(true);
  });
  it("marks survive a reload through storage, and are per person and per business", () => {
    const store = mem();
    const key = readMarksKey("u1", "b1");
    expect(key).not.toBe(readMarksKey("u2", "b1"));
    expect(key).not.toBe(readMarksKey("u1", "b2"));
    const r = row("2026-11-03T12:30:00Z");
    saveReadMarks(store, key, markRead(loadReadMarks(store, key, NOW), r, new Date("2026-11-03T12:31:00Z")));
    const back = loadReadMarks(store, key, new Date("2026-11-04T00:00:00Z"));
    expect(isUnread(r, back)).toBe(false);
    expect(back.baseline).toBe(NOW.toISOString());
  });
  it("storage that is missing, corrupt or throws gives a fresh baseline and never throws", () => {
    expect(loadReadMarks(null, "k", NOW).reads).toEqual({});
    const bad = mem();
    bad.data.set("k", "{not json");
    expect(loadReadMarks(bad, "k", NOW).baseline).toBe(NOW.toISOString());
    bad.data.set("k", JSON.stringify({ baseline: "nope", reads: {} }));
    expect(loadReadMarks(bad, "k", NOW).baseline).toBe(NOW.toISOString());
    const throwing: MarkStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
    expect(loadReadMarks(throwing, "k", NOW).reads).toEqual({});
    expect(() => saveReadMarks(throwing, "k", loadReadMarks(null, "k", NOW))).not.toThrow();
  });
  it("keeps at most READ_MARKS_MAX marks, dropping the oldest", () => {
    let marks = loadReadMarks(null, "k", NOW);
    for (let i = 0; i < READ_MARKS_MAX + 5; i++) marks = markRead(marks, row("2026-11-03T12:30:00Z", `t${i}`), new Date(NOW.getTime() + (i + 1) * 1000));
    expect(Object.keys(marks.reads)).toHaveLength(READ_MARKS_MAX);
    expect(marks.reads["t0"]).toBeUndefined();
    expect(marks.reads[`t${READ_MARKS_MAX + 4}`]).toBeDefined();
  });
});

describe("the handover buttons", () => {
  it("★there is NO 'Take over' button: typing and sending a reply takes the conversation over, so the one step left is the way back", () => {
    expect(handoverAction("active")).toBeNull();
    expect(handoverAction("resolved")).toBeNull();
    expect(handoverAction("escalated")).toEqual({ kind: "return", label: "Return to AI", variant: "outline" });
  });
});

describe("Mark done and Reopen", () => {
  it("a Done conversation offers Reopen; every other state offers Mark done", () => {
    expect(doneAction("open", true)).toEqual({ kind: "done", label: "Mark done" });
    expect(doneAction("needs_you", true)).toEqual({ kind: "done", label: "Mark done" });
    expect(doneAction("done", true)).toEqual({ kind: "reopen", label: "Reopen" });
  });
  it("★a viewer is offered neither (they can read, not change)", () => {
    for (const st of ["open", "needs_you", "done"] as const) expect(doneAction(st, false)).toBeNull();
  });
  it("says what happens next: the assistant answers again if it was handed back, else the conversation returns to Open on a new message", () => {
    expect(doneToast(true, true)).toBe("Marked done. The assistant will answer again if the customer writes back.");
    expect(doneToast(true, false)).toBe("Marked done. If the customer writes back, it will return to your Open list.");
    expect(doneToast(false, false)).toBe("Reopened.");
  });
});

describe("the chips and the search", () => {
  it("the chips are Open, Needs you and Done, and the page starts on Open", () => {
    expect(STATUS_FILTERS.map((f) => [f.value, f.label])).toEqual([
      ["open", "Open"],
      ["needs_you", "Needs you"],
      ["done", "Done"],
    ]);
    expect(DEFAULT_STATUS_FILTER).toBe("open");
  });
  it("a search shorter than the minimum is no search; whitespace is collapsed; the length is bounded", () => {
    expect(SEARCH_MIN).toBe(2);
    expect(searchTerm("a")).toBe("");
    expect(searchTerm("   ")).toBe("");
    expect(searchTerm("  asha   rao ")).toBe("asha rao");
    expect(searchTerm("4321")).toBe("4321");
    expect(searchTerm("x".repeat(500))).toHaveLength(SEARCH_MAX);
  });
  it("the empty sentence belongs to the chip and the search, and never claims the inbox is empty", () => {
    expect(emptyListText("all", "ok", { status: "needs_you" })).toBe("Nothing needs you right now.");
    expect(emptyListText("all", "ok", { status: "done" })).toBe("No conversations are marked done.");
    expect(emptyListText("all", "ok", { status: "open", search: "asha" })).toMatch(/^No conversations match \u201casha\u201d/);
    expect(emptyListText("all", "ok", { status: "open", search: "asha" })).not.toMatch(/inbox is empty|No conversations yet/);
    expect(emptyListText("storefront", "ok", { search: "asha" })).toMatch(/no name, number or order/);
    expect(emptyListText("all", "ok", { status: "open" })).toBe("No conversations yet.");
  });
});

describe("the rows carry the api's state and the test label", () => {
  it("a WhatsApp row takes the api's state, and derives it from needsYou only when an older api sent none", () => {
    expect(wa({ state: "done" }).state).toBe("done");
    expect(wa({ needsYou: true }).state).toBe("needs_you");
    expect(wa().state).toBe("open");
    expect(wa().test).toBe(false);
  });
  it("a storefront row is Open unless the api says Done, and carries the Test flag", () => {
    expect(sf().state).toBe("open");
    expect(sf({ state: "done" }).state).toBe("done");
    expect(sf({ test: true }).test).toBe(true);
    expect(sf().test).toBe(false);
  });
});

describe("the phone layout", () => {
  it("with nothing open only the list shows below lg; the thread is hidden until lg", () => {
    const p = paneClasses(null);
    expect(p.list).toBe("block");
    expect(p.thread).toBe("hidden lg:flex");
  });
  it("with a conversation open only the thread shows below lg; the list returns at lg", () => {
    const p = paneClasses("whatsapp:1:a");
    expect(p.list).toBe("hidden lg:block");
    expect(p.thread).toBe("flex");
  });
  it("at lg both are visible in either case (neither string hides without an lg override)", () => {
    for (const sel of [null, "x"]) {
      const p = paneClasses(sel);
      for (const cls of [p.list, p.thread]) {
        const tokens = cls.split(" ");
        expect(tokens.every((t) => t !== "hidden") || tokens.some((t) => t.startsWith("lg:"))).toBe(true);
      }
    }
  });
});

describe("the merged list's state", () => {
  it("rows win: any row shows the list", () => {
    expect(combineListState("ready", "empty", 3)).toBe("ready");
    expect(combineListState("loading", "ready", 1)).toBe("ready");
  });
  it("a failed refresh of either half keeps the rows and says so", () => {
    expect(combineListState("error", "ready", 2)).toBe("stale");
    expect(combineListState("ready", "stale", 2)).toBe("stale");
  });
  it("no rows and a failure is a failure, never the empty state", () => {
    expect(combineListState("error", "empty", 0)).toBe("error");
    expect(combineListState("empty", "error", 0)).toBe("error");
  });
  it("no rows and one half still loading is loading, not empty", () => {
    expect(combineListState("empty", "loading", 0)).toBe("loading");
  });
  it("offline is paused; nothing asked is waiting; only two completed answers earn 'empty'", () => {
    expect(combineListState("paused", "empty", 0)).toBe("paused");
    expect(combineListState("waiting", "waiting", 0)).toBe("waiting");
    expect(combineListState("empty", "empty", 0)).toBe("empty");
  });
});
