import { describe, it, expect } from "vitest";
import {
  ASSIGNEE_FILTERS,
  AUTO_CLOSE_DEFAULT_DAYS,
  deskListParams,
  formFromSettings,
  insertMention,
  isViewActive,
  mentionNames,
  mentionsIn,
  pageOfView,
  patchFromForm,
  priorityFilterFromParam,
  pruneAvailable,
  searchWithFilters,
  validateForm,
  viewFiltersOfPage,
  viewNameError,
  viewSummary,
  viewersLine,
  type DeskForm,
  type DeskSettings,
  type PageFilters,
  type SavedView,
} from "@/lib/inbox-desk";
import { emptyListText, rowOfStorefront, rowOfWhatsApp } from "@/lib/inbox-view";
import { dismissedItems, type Insight } from "@/lib/insights";

/** Team desk parity (SA-10): the page's decisions for waiting, priority, who is viewing, mentions, saved views and the three new settings. */

const settings = (over: Partial<DeskSettings> = {}): DeskSettings => ({
  aiPaused: false,
  aiPausedAt: null,
  autoAssign: { enabled: false, availableUserIds: [] },
  firstResponseMinutes: 15,
  hours: null,
  awayMessage: null,
  ...over,
});
const form = (over: Partial<DeskForm> = {}): DeskForm => ({ ...formFromSettings(settings(), "UTC"), ...over });

describe("who is viewing", () => {
  const v = (userId: string, name: string, replying = false) => ({ userId, name, replying });
  it("one person, two, and more than two", () => {
    expect(viewersLine([v("a", "Asha")], "me")).toBe("Asha is viewing");
    expect(viewersLine([v("a", "Asha"), v("b", "Ravi")], "me")).toBe("Asha and Ravi are viewing");
    expect(viewersLine([v("a", "Asha"), v("b", "Ravi"), v("c", "Meera"), v("d", "Vik")], "me")).toBe("Asha, Ravi and 2 more are viewing");
  });
  it("typing is named as replying, separately from looking", () => {
    expect(viewersLine([v("a", "Asha", true)], "me")).toBe("Asha is replying");
    expect(viewersLine([v("a", "Asha", true), v("b", "Ravi")], "me")).toBe("Asha is replying · Ravi is viewing");
  });
  it("★never yourself, and nothing at all when nobody else is there", () => {
    expect(viewersLine([v("me", "Ada")], "me")).toBeNull();
    expect(viewersLine([v("me", "Ada"), v("a", "Asha")], "me")).toBe("Asha is viewing");
    expect(viewersLine([], "me")).toBeNull();
    expect(viewersLine(undefined, "me")).toBeNull();
    expect(viewersLine(null)).toBeNull();
  });
});

describe("@mentions", () => {
  const ravi = { userId: "u2", name: "Ravi" };
  const ravindra = { userId: "u3", name: "Ravindra" };
  it("inserting adds @Name on a word of its own", () => {
    expect(insertMention("", ravi)).toBe("@Ravi ");
    expect(insertMention("please check", ravi)).toBe("please check @Ravi ");
    expect(insertMention("please check ", ravi)).toBe("please check @Ravi ");
  });
  it("★only people whose @Name is still in the text are sent, and a name is matched whole", () => {
    expect(mentionsIn("hello @Ravi can you look", [ravi])).toEqual(["u2"]);
    expect(mentionsIn("hello, I deleted the name", [ravi])).toEqual([]);
    expect(mentionsIn("hello @Ravindra", [ravi, ravindra])).toEqual(["u3"]);
    expect(mentionsIn("@Ravi and @Ravi again", [ravi])).toEqual(["u2"]);
    expect(mentionsIn("@Ravi.", [ravi])).toEqual(["u2"]);
  });
  it("★a name inside another word or an address is not a mention", () => {
    expect(mentionsIn("mail ops@Ravi.example", [ravi])).toEqual([]);
    expect(mentionsIn("see (@Ravi)", [ravi])).toEqual(["u2"]);
    expect(mentionsIn("@Ravi", [ravi])).toEqual(["u2"]);
  });
  it("a name with regex characters is matched as text", () => {
    expect(mentionsIn("hi @A.B. there", [{ userId: "u9", name: "A.B." }])).toEqual(["u9"]);
    expect(mentionsIn("hi @AxBx", [{ userId: "u9", name: "A.B." }])).toEqual([]);
  });
  it("a note shows the names of the people it mentions; someone who has left is skipped", () => {
    const team = [{ userId: "u2", name: "Ravi", role: "editor" }];
    expect(mentionNames({ mentions: ["u2", "gone"] }, team)).toEqual(["Ravi"]);
    expect(mentionNames({}, team)).toEqual([]);
  });
});

describe("saved views", () => {
  const page = (over: Partial<PageFilters> = {}): PageFilters => ({ status: "open", assignee: "all", tag: null, topic: null, priority: "all", channel: "all", ...over });
  it("a view keeps only what narrows the page, and always the status chip", () => {
    expect(viewFiltersOfPage(page())).toEqual({ status: "open" });
    expect(viewFiltersOfPage(page({ status: "waiting", assignee: "unassigned", tag: "t1", topic: "delivery_times", priority: "high", channel: "whatsapp" }))).toEqual({
      status: "waiting",
      assignee: "unassigned",
      tag: "t1",
      topic: "delivery_times",
      priority: "high",
      channel: "whatsapp",
    });
  });
  it("★opening a view REPLACES the filters: whatever it does not name goes back to all", () => {
    expect(pageOfView({ priority: "high" })).toEqual(page({ priority: "high" }));
    expect(pageOfView({ status: "done", tag: "t1" })).toEqual(page({ status: "done", tag: "t1" }));
    // a view from another surface or an odd value never produces a filter the page cannot hold
    expect(pageOfView({ assignee: "someone-else" })).toEqual(page());
    expect(pageOfView({ assignee: "assigned" }).assignee).toBe("assigned");
  });
  it("a page round-trips through a view", () => {
    const p = page({ status: "needs_you", assignee: "mine", tag: "t2", topic: "returns", priority: "high", channel: "storefront" });
    expect(pageOfView(viewFiltersOfPage(p))).toEqual(p);
  });
  it("the picker marks the view the page is showing, and no other", () => {
    const view = (id: string, filters: SavedView["filters"]): SavedView => ({ id, name: id, filters, createdAt: "2026-11-06T00:00:00Z" });
    expect(isViewActive(view("a", { status: "open", priority: "high" }), page({ priority: "high" }))).toBe(true);
    expect(isViewActive(view("a", { status: "open", priority: "high" }), page())).toBe(false);
    expect(isViewActive(view("a", { status: "open" }), page({ tag: "t1" }))).toBe(false);
    // a view for one named teammate degrades to "all" when opened, so it is never reported as the open one
    expect(isViewActive(view("t", { status: "open", assignee: "a".repeat(24) }), page())).toBe(false);
  });
  it("a name is checked the way the api checks it", () => {
    const existing = [{ name: "Urgent" }];
    expect(viewNameError("Late orders", existing)).toBeNull();
    expect(viewNameError("   ", existing)).toMatch(/name/);
    expect(viewNameError("urgent", existing)).toMatch(/already/);
    expect(viewNameError("x".repeat(41), existing)).toMatch(/40/);
    expect(viewNameError("one more", Array.from({ length: 20 }, (_, i) => ({ name: `v${i}` })))).toMatch(/20/);
  });
  it("the summary is plain words, and a removed tag does not blank it", () => {
    expect(viewSummary({ status: "open", assignee: "unassigned", priority: "high" }, [])).toBe("Open, Unassigned, High priority");
    expect(viewSummary({ status: "waiting", tag: "t9" }, [{ id: "t1", name: "VIP" }])).toBe("Waiting, A removed tag");
    expect(viewSummary({ tag: "t1", channel: "x" }, [{ id: "t1", name: "VIP" }])).toBe("VIP, X");
  });
});

describe("the priority filter and the list query", () => {
  it("priority=high is read back, and anything else is all", () => {
    expect(priorityFilterFromParam("high")).toBe("high");
    for (const v of ["low", "all", "", null, undefined]) expect(priorityFilterFromParam(v), String(v)).toBe("all");
  });
  it("is in the query only when set; the other filters are unchanged", () => {
    expect(deskListParams({ assignee: "all", tag: null })).toEqual({});
    expect(deskListParams({ assignee: "all", tag: null, priority: "all" })).toEqual({});
    expect(deskListParams({ assignee: "mine", tag: "t1", priority: "high" })).toEqual({ assignee: "mine", tag: "t1", priority: "high" });
  });
  it("is written into the address and cleared from it, keeping the other keys", () => {
    expect(searchWithFilters("tab=conversations", { assignee: "all", tag: null, priority: "high" })).toBe("tab=conversations&priority=high");
    expect(searchWithFilters("tab=conversations&priority=high&topic=x", { assignee: "all", tag: null, priority: "all" })).toBe("tab=conversations&topic=x");
  });
  it("Assigned is a chip after Unassigned", () => {
    expect(ASSIGNEE_FILTERS.map((f) => f.value)).toEqual(["all", "mine", "unassigned", "assigned"]);
  });
});

describe("the rows", () => {
  const wa = { threadId: "t", waId: "1", contactName: "A", status: "escalated", updatedAt: null, lastInboundAt: null, preview: "p" };
  it("carry the priority and the viewers, normal and none when the api sends neither", () => {
    expect(rowOfWhatsApp(wa)).toMatchObject({ priority: "normal", viewers: [] });
    expect(rowOfWhatsApp({ ...wa, priority: "high", viewers: [{ userId: "a", name: "Asha", replying: false }] })).toMatchObject({ priority: "high", viewers: [{ name: "Asha" }] });
    expect(rowOfStorefront({ threadId: "s", contactName: "Storefront visitor", status: "active", updatedAt: null, preview: "", priority: "high" })).toMatchObject({ priority: "high", viewers: [] });
  });
  it("the api's waiting state is kept, and an empty Waiting chip says so", () => {
    expect(rowOfWhatsApp({ ...wa, state: "waiting" }).state).toBe("waiting");
    expect(emptyListText("all", "ok", { status: "waiting" })).toBe("Nothing is waiting on a customer right now.");
  });
});

describe("the three new settings", () => {
  it("★all three open as OFF on a business that has none, and on an api that predates them", () => {
    const f = formFromSettings(settings(), "UTC");
    expect(f).toMatchObject({ autoClose: false, autoCloseDays: String(AUTO_CLOSE_DEFAULT_DAYS), smartTags: false, smartTagRules: [], routing: false, routingRules: [] });
  });
  it("open as saved", () => {
    const f = formFromSettings(
      settings({
        autoClose: { enabled: true, days: 14 },
        smartTags: { enabled: true, map: [{ topic: "returns", tagId: "t1" }] },
        channelRouting: { enabled: true, rules: [{ channel: "whatsapp", userIds: ["u1"] }] },
      }),
      "UTC",
    );
    expect(f).toMatchObject({ autoClose: true, autoCloseDays: "14", smartTags: true, smartTagRules: [{ topic: "returns", tagId: "t1" }], routing: true, routingRules: [{ channel: "whatsapp", userIds: ["u1"] }] });
  });
  it("auto-close needs a whole number of days from 1 to 365, only while it is on", () => {
    for (const days of ["", "0", "366", "2.5", "abc"]) expect(validateForm(form({ autoClose: true, autoCloseDays: days })), days).toMatch(/days/);
    for (const days of ["1", "7", "365"]) expect(validateForm(form({ autoClose: true, autoCloseDays: days })), days).toBeNull();
    expect(validateForm(form({ autoClose: false, autoCloseDays: "abc" }))).toBeNull();
  });
  it("automatic tags need a topic and a tag each, and a topic only once", () => {
    expect(validateForm(form({ smartTags: true, smartTagRules: [{ topic: "", tagId: "t1" }] }))).toMatch(/topic and a tag/);
    expect(validateForm(form({ smartTags: true, smartTagRules: [{ topic: "returns", tagId: "" }] }))).toMatch(/topic and a tag/);
    expect(validateForm(form({ smartTags: true, smartTagRules: [{ topic: "returns", tagId: "t1" }, { topic: "returns", tagId: "t2" }] }))).toMatch(/one tag only/);
    expect(validateForm(form({ smartTags: true, smartTagRules: [{ topic: "returns", tagId: "t1" }] }))).toBeNull();
    expect(validateForm(form({ smartTags: false, smartTagRules: [{ topic: "", tagId: "" }] }))).toBeNull();
  });
  it("routing needs a channel with people, each channel once", () => {
    expect(validateForm(form({ routing: true, routingRules: [] }))).toMatch(/Add a channel/);
    expect(validateForm(form({ routing: true, routingRules: [{ channel: "x", userIds: [] }] }))).toMatch(/X: pick at least one/);
    expect(validateForm(form({ routing: true, routingRules: [{ channel: "x", userIds: ["u1"] }, { channel: "x", userIds: ["u2"] }] }))).toMatch(/twice/);
    expect(validateForm(form({ routing: true, routingRules: [{ channel: "x", userIds: ["u1"] }] }))).toBeNull();
    expect(validateForm(form({ routing: false, routingRules: [] }))).toBeNull();
  });
  it("★the save carries all three, and only complete rules (a half-edited row cannot fail the save)", () => {
    const body = patchFromForm(
      form({
        autoClose: true,
        autoCloseDays: "10",
        smartTags: false,
        smartTagRules: [{ topic: "returns", tagId: "t1" }, { topic: "", tagId: "" }, { topic: "returns", tagId: "t2" }],
        routing: true,
        routingRules: [{ channel: "x", userIds: ["u1"] }, { channel: "whatsapp", userIds: [] }],
      }),
    );
    expect(body.autoClose).toEqual({ enabled: true, days: 10 });
    expect(body.smartTags).toEqual({ enabled: false, map: [{ topic: "returns", tagId: "t1" }] });
    expect(body.channelRouting).toEqual({ enabled: true, rules: [{ channel: "x", userIds: ["u1"] }] });
  });
  it("a bad day count is sent as the default, never as a value the api would refuse", () => {
    expect(patchFromForm(form({ autoClose: false, autoCloseDays: "999" })).autoClose).toEqual({ enabled: false, days: AUTO_CLOSE_DEFAULT_DAYS });
  });
  it("a teammate who left is dropped from a channel's people, and a channel left with nobody goes", () => {
    const f = form({ routing: true, routingRules: [{ channel: "x", userIds: ["u1", "gone"] }, { channel: "whatsapp", userIds: ["gone"] }] });
    const pruned = pruneAvailable(f, [{ userId: "u1", name: "A", role: "editor" }]);
    expect(pruned.routingRules).toEqual([{ channel: "x", userIds: ["u1"] }]);
    // nothing to prune: the same object back, so a render does not loop
    expect(pruneAvailable(pruned, [{ userId: "u1", name: "A", role: "editor" }])).toBe(pruned);
  });
});

describe("dismissed insights", () => {
  const item = (key: string, status: Insight["status"]): Insight =>
    ({ key, type: "missing_store_info", title: key, count: 3, shopperDays: 3, trend: "flat", why: "", nextStep: { label: "", kind: "none" }, status, evidence: { available: 1, expired: 0 }, surfaces: [], lastAskedAt: "" }) as Insight;
  it("are exactly the dismissed ones", () => {
    expect(dismissedItems([item("a", "open"), item("b", "dismissed"), item("c", "closed")]).map((i) => i.key)).toEqual(["b"]);
  });
});
