import { describe, it, expect } from "vitest";
import {
  serviceKey,
  addableServices,
  buildPostValue,
  charsLeft,
  deleteNote,
  detailLine,
  detailsValue,
  drawnExtraFields,
  drawsPanel,
  emptyPostDraft,
  extraValueLines,
  extrasAccess,
  humanize,
  inFlightChanges,
  isListChanged,
  newDraftId,
  preparedWords,
  waitingWords,
  withCustomService,
  linksValue,
  liveDraft,
  nextDraft,
  postDraftUnchanged,
  isTime,
  draftDroppedWords,
  offeredDetails,
  pendingForPost,
  postControls,
  postDraftOf,
  postStateWords,
  servicesValue,
  settledSince,
  withChangesKnown,
  withChoice,
  withDetail,
  withLink,
  withoutDetail,
  withoutLink,
  withoutService,
  withPreferred,
  withService,
  type AttributeEntry,
  type AttributeOption,
  type PostsDeclaration,
  type ServiceEntry,
} from "@/lib/presence-extras";
import { fieldTitle, valueLines, type ChangeCardData } from "@/lib/presence-edit";

/**
 * The posts, services, details and links rules (PE-12), pure. PASS cases come first in each block, then the refusals. Nothing here names a network:
 * the declaration is a fixture, and the network's name only ever arrives as `label`.
 */

const DECL: PostsDeclaration = { kinds: ["update", "event", "offer"], actions: ["BOOK", "ORDER", "CALL"], actionWithoutUrl: "CALL", limits: { summaryMaxLength: 100 }, edit: true, removal: { restorable: false } };
const create = { op: "create", draftId: "0123456789abcdef01234567" } as const;
const draft = (over: Record<string, string> = {}) => ({ ...emptyPostDraft(), summary: "Open late on Friday.", ...over });
const change = (over: Partial<ChangeCardData> = {}): ChangeCardData =>
  ({ id: "c1", listingId: "l1", network: "net_a", field: "posts", status: "validated", riskTier: "ordinary", notes: [], source: "form", before: null, after: { op: "delete", ref: "p/1" }, reason: null, held: null, validation: null, createdAt: "", expiresAt: "", submittedAt: null, liveAt: null, liveCheck: null, undone: false, ...over }) as ChangeCardData;

describe("which panels a network draws", () => {
  it("a panel is drawn only when the network's declaration offers it; an older api that sends none draws none", () => {
    const cap = { panels: { posts: true, links: false, services: true, attributes: false } };
    expect(drawsPanel(cap, "posts")).toBe(true);
    expect(drawsPanel(cap, "services")).toBe(true);
    expect(drawnExtraFields(cap)).toEqual(["posts", "services"]);
    expect(drawsPanel(cap, "links")).toBe(false);
    expect(drawsPanel(cap, "attributes")).toBe(false);
    expect(drawsPanel({}, "posts")).toBe(false);
    expect(drawsPanel(undefined, "posts")).toBe(false);
    expect(drawnExtraFields({})).toEqual([]);
  });
});

describe("a post value", () => {
  it("a plain update is built from the words, trimmed", () => {
    expect(buildPostValue(draft({ summary: "  Hello  " }), DECL, create)).toEqual({ ok: true, value: { op: "create", draftId: create.draftId, kind: "update", summary: "Hello" } });
  });
  it("an edit carries the ref, a button with an https address, an event with its dates and an offer with its terms", () => {
    const r = buildPostValue(draft({ kind: "offer", eventTitle: "Sale", start: "2026-12-01", end: "2026-12-05", startTime: "18:00", endTime: "24:00", offerCode: "X1", redeemUrl: "https://a.example/r", terms: "T", actionType: "ORDER", actionUrl: "https://a.example/o" }), DECL, { op: "update", ref: "p/1" });
    expect(r).toEqual({
      ok: true,
      value: { op: "update", ref: "p/1", kind: "offer", summary: "Open late on Friday.", action: { type: "ORDER", url: "https://a.example/o" }, event: { title: "Sale", start: "2026-12-01", end: "2026-12-05", startTime: "18:00", endTime: "24:00" }, offer: { code: "X1", redeemUrl: "https://a.example/r", terms: "T" } },
    });
  });
  it("the button that calls the listing's number takes no address", () => {
    expect(buildPostValue(draft({ actionType: "CALL" }), DECL, create)).toMatchObject({ ok: true, value: { action: { type: "CALL" } } });
    expect(buildPostValue(draft({ actionType: "CALL", actionUrl: "https://a.example" }), DECL, create)).toMatchObject({ ok: false });
  });
  it("the length edge: the limit passes, one over is refused and is not shortened for you", () => {
    expect(buildPostValue(draft({ summary: "x".repeat(100) }), DECL, create).ok).toBe(true);
    const over = buildPostValue(draft({ summary: "x".repeat(101) }), DECL, create);
    expect(over).toMatchObject({ ok: false });
    expect((over as { message: string }).message).toContain("not shortened for you");
    expect(charsLeft("x".repeat(101), 100)).toBe(-1);
    expect(charsLeft(" ab ", 100)).toBe(98);
  });
  it("refuses empty words, a kind or a button the network did not declare", () => {
    expect(buildPostValue(draft({ summary: "   " }), DECL, create)).toMatchObject({ ok: false });
    // a complete event, refused only because this network did not declare events
    expect(buildPostValue(draft({ kind: "event", eventTitle: "T", start: "2026-12-01" }), { ...DECL, kinds: ["update"] }, create)).toEqual({ ok: false, message: "That kind of post is not offered." });
    expect(buildPostValue(draft({ actionType: "SHOP", actionUrl: "https://a.example" }), DECL, create)).toEqual({ ok: false, message: "That button is not offered." });
  });
  it("a button needs an https address, and an address needs a button", () => {
    expect(buildPostValue(draft({ actionType: "BOOK" }), DECL, create)).toEqual({ ok: false, message: "That button needs a web address." });
    expect(buildPostValue(draft({ actionType: "BOOK", actionUrl: "http://a.example" }), DECL, create)).toMatchObject({ ok: false });
    expect(buildPostValue(draft({ actionUrl: "https://a.example" }), DECL, create)).toMatchObject({ ok: false });
  });
  it("an event and an offer need a title, a real start AND end date and both times; the end must not be before the start; an update sends no dates", () => {
    const ok = { kind: "event", eventTitle: "T", start: "2026-12-01", end: "2026-12-01", startTime: "18:00", endTime: "21:00" } as const;
    expect(buildPostValue(draft(ok), DECL, create)).toMatchObject({ ok: true, value: { event: { title: "T", start: "2026-12-01", end: "2026-12-01", startTime: "18:00", endTime: "21:00" } } });
    expect(buildPostValue(draft({ kind: "event" }), DECL, create)).toMatchObject({ ok: false });
    expect(buildPostValue(draft({ ...ok, eventTitle: "" }), DECL, create)).toEqual({ ok: false, message: "An event needs a title." });
    expect(buildPostValue(draft({ ...ok, kind: "offer", eventTitle: "" }), DECL, create)).toEqual({ ok: false, message: "An offer needs a title." });
    expect(buildPostValue(draft({ ...ok, start: "2026-13-45" }), DECL, create)).toEqual({ ok: false, message: "Choose a start date." });
    expect(buildPostValue(draft({ ...ok, end: "" }), DECL, create)).toEqual({ ok: false, message: "Choose a real end date." });
    expect(buildPostValue(draft({ ...ok, start: "2026-12-02", end: "2026-12-01" }), DECL, create)).toEqual({ ok: false, message: "The end date is before the start date." });
    expect(buildPostValue(draft({ ...ok, startTime: "" }), DECL, create)).toMatchObject({ ok: false, message: expect.stringContaining("start time") });
    expect(buildPostValue(draft({ ...ok, endTime: "" }), DECL, create)).toMatchObject({ ok: false, message: expect.stringContaining("end time") });
    expect(buildPostValue(draft({ ...ok, startTime: "7pm" }), DECL, create)).toMatchObject({ ok: false });
    expect(buildPostValue(draft({ eventTitle: "T", start: "2026-12-01" }), DECL, create)).toEqual({ ok: true, value: { op: "create", draftId: create.draftId, kind: "update", summary: "Open late on Friday." } });
  });
  it("24:00 is the end of the day, everywhere a time is read; 25:00 and 24:01 are not times", () => {
    for (const t of ["00:00", "09:05", "23:59", "24:00"]) expect(isTime(t), t).toBe(true);
    for (const t of ["24:01", "25:00", "7:00", "18:60", "", "18"]) expect(isTime(t), t).toBe(false);
    expect(buildPostValue(draft({ kind: "event", eventTitle: "T", start: "2026-12-01", end: "2026-12-01", startTime: "00:00", endTime: "24:00" }), DECL, create).ok).toBe(true);
  });
  it("the redeem link of an offer must be https", () => {
    const o = { kind: "offer", eventTitle: "T", start: "2026-12-01", end: "2026-12-01", startTime: "10:00", endTime: "12:00" } as const;
    expect(buildPostValue(draft({ ...o, redeemUrl: "http://a.example" }), DECL, create)).toMatchObject({ ok: false });
    expect(buildPostValue(draft(o), DECL, create)).toMatchObject({ ok: true });
  });
  it("★on an edit only what the person CHANGED is judged: a held redeem link, an empty summary and an event without times pass when left as they are", () => {
    const heldPost = { kind: "offer" as const, summary: "", action: { type: "GET_OFFER", url: "http://old.example/x" }, event: { title: "Sale", start: "2026-12-01" }, offer: { redeemUrl: "http://old.example/r", code: "X" } };
    const same = draft({ kind: "offer", summary: "", actionType: "GET_OFFER", actionUrl: "http://old.example/x", eventTitle: "Sale", start: "2026-12-01", offerCode: "X", redeemUrl: "http://old.example/r" });
    const r = buildPostValue(same, DECL, { op: "update", ref: "p/1" }, heldPost);
    expect(r).toMatchObject({ ok: true, value: { summary: "", action: { type: "GET_OFFER", url: "http://old.example/x" }, event: { title: "Sale", start: "2026-12-01" }, offer: { redeemUrl: "http://old.example/r" } } });
    // the same edit with no held post is judged on every part
    expect(buildPostValue(same, DECL, { op: "update", ref: "p/1" })).toMatchObject({ ok: false });
    // change the redeem link to another http one: judged now
    expect(buildPostValue({ ...same, redeemUrl: "http://other.example/r" }, DECL, { op: "update", ref: "p/1" }, heldPost)).toEqual({ ok: false, message: "The redeem link must start with https://." });
    // change the event: all four parts are required now
    expect(buildPostValue({ ...same, eventTitle: "Big sale" }, DECL, { op: "update", ref: "p/1" }, heldPost)).toMatchObject({ ok: false, message: expect.stringContaining("end date") });
    // change the words: an empty or over-long summary is judged again
    expect(buildPostValue({ ...same, summary: "x".repeat(101) }, DECL, { op: "update", ref: "p/1" }, heldPost)).toMatchObject({ ok: false });
  });
  it("an edit that changes nothing is refused by the form, not prepared", () => {
    const d = draft({ summary: "Hello" });
    expect(postDraftUnchanged(d, { ...d })).toBe(true);
    expect(postDraftUnchanged(d, { ...d, summary: "  Hello  " })).toBe(true);
    expect(postDraftUnchanged(d, { ...d, summary: "Hello!" })).toBe(false);
    expect(postDraftUnchanged(d, { ...d, endTime: "21:00" })).toBe(false);
    expect(postDraftUnchanged(d, { ...d, actionType: "book" })).toBe(false);
  });
  it("an existing post becomes an editable draft", () => {
    expect(postDraftOf({ ref: "p/1", kind: "event", summary: "S", state: "live", languageCode: "en", action: { type: "BOOK", url: "https://a.example" }, event: { title: "T", start: "2026-12-01" }, offer: null, createdAt: null, updatedAt: null, url: null, hasPhoto: false })).toMatchObject({ kind: "event", summary: "S", actionType: "BOOK", actionUrl: "https://a.example", eventTitle: "T", start: "2026-12-01", end: "" });
  });
});

describe("what a post says about itself", () => {
  it("states: showing, processing (may not show yet), not published, and not said; the label is the api's", () => {
    expect(postStateWords("live", "NetA")).toEqual({ text: "Showing on NetA", tone: "good" });
    expect(postStateWords("processing", "NetA").text).toContain("may not show yet");
    expect(postStateWords("rejected", "NetA")).toMatchObject({ tone: "bad" });
    expect(postStateWords("unknown", "NetA").text).toContain("did not say");
  });
  it("a delete says before approval whether it can be brought back", () => {
    expect(deleteNote({ removal: { restorable: false } }, "NetA")).toContain("cannot bring it back");
    expect(deleteNote({ removal: { restorable: true } }, "NetA")).not.toContain("cannot bring it back");
  });
  it("buttons are made readable", () => {
    expect(humanize("LEARN_MORE")).toBe("Learn more");
    expect(humanize("attributes/has_wifi")).toBe("Has wifi");
  });
});

describe("what a person may press", () => {
  const edit = { mode: "edit" } as const;
  it("an editor may edit and delete a post with nothing waiting on it", () => {
    expect(postControls(edit, DECL, undefined)).toEqual({ edit: true, remove: true });
  });
  it("a network that does not let posts be edited offers delete only", () => {
    expect(postControls(edit, { edit: false }, undefined)).toEqual({ edit: false, remove: true });
  });
  it("a post with a change already waiting has neither, and a role that cannot propose has neither", () => {
    expect(postControls(edit, DECL, change())).toEqual({ edit: false, remove: false });
    expect(postControls({ mode: "view", why: "Ask an editor." }, DECL, undefined)).toEqual({ edit: false, remove: false });
  });
  it("only an answer that says no is the role's", () => {
    expect(extrasAccess({ propose: true }, "posts")).toEqual({ mode: "edit" });
    expect(extrasAccess({ propose: false }, "posts")).toMatchObject({ mode: "view", why: expect.stringContaining("Your role can look at your posts") });
    // an answer that does not say is not blamed on the role
    const unsaid = extrasAccess(undefined, "posts");
    expect(unsaid.mode === "view" && unsaid.why).toContain("We could not check what your role can do");
    expect(unsaid.mode === "view" && unsaid.why).not.toContain("Your role can look");
  });
  it("adding and removing wait until the change list has answered, keeping the role's own reason", () => {
    expect(withChangesKnown(edit, "data", "posts")).toEqual(edit);
    expect(withChangesKnown(edit, "data_stale", "posts")).toEqual(edit);
    expect(withChangesKnown(edit, "loading", "posts")).toMatchObject({ mode: "view", why: expect.stringContaining("Checking") });
    expect(withChangesKnown(edit, "failed", "posts")).toMatchObject({ mode: "view", why: expect.stringContaining("could not load") });
    const no = { mode: "view", why: "role" } as const;
    expect(withChangesKnown(no, "loading", "posts")).toBe(no);
  });
  it("★a draft keeps the base of the list it STARTED from: later edits do not move it, and a draft from another list is dropped, never re-based", () => {
    const first = nextDraft<string[]>(null, ["a"], "base-1");
    expect(first).toEqual({ value: ["a"], base: "base-1" });
    // the list was refetched meanwhile: the edit goes on under the base it started from
    expect(nextDraft(first, ["a", "b"], "base-2")).toEqual({ value: ["a", "b"], base: "base-1" });
    expect(liveDraft(first, "base-1")).toEqual({ draft: first, dropped: false });
    expect(liveDraft(first, "base-2")).toEqual({ draft: null, dropped: true });
    expect(liveDraft(null, "base-2")).toEqual({ draft: null, dropped: false });
    expect(draftDroppedWords("NetA", "links")).toContain("while you were editing");
  });
});

describe("the change list of a panel", () => {
  const rows = [
    change({ id: "a", status: "validated", network: "net_a" }),
    change({ id: "b", status: "submitted", network: "net_a" }),
    change({ id: "c", status: "live", network: "net_a" }),
    change({ id: "d", status: "failed", network: "net_a" }),
    change({ id: "e", status: "live", network: "net_a" }),
    change({ id: "f", status: "validated", network: "net_b" }),
    change({ id: "g", status: "validated", network: "net_a", field: "services" }),
  ];
  it("is one field's, for one network; sent ones are in flight", () => {
    expect(inFlightChanges(rows, "net_a", "posts").map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("what waits on a post is read from the change list, and a create waits on no existing post", () => {
    expect(pendingForPost([change({ after: { op: "update", ref: "p/1" } })], "net_a", "p/1")?.id).toBe("c1");
    expect(pendingForPost([change({ after: { op: "update", ref: "p/1" } })], "net_a", "p/2")).toBeUndefined();
    expect(pendingForPost([change({ after: { op: "create", ref: "p/1" } })], "net_a", "p/1")).toBeUndefined();
    expect(pendingForPost([change({ status: "live", after: { op: "delete", ref: "p/1" } })], "net_a", "p/1")).toBeUndefined();
  });
  it("the panel is read again when a change leaves the in-flight statuses, and not for one still open or new", () => {
    expect(settledSince(new Set(["b"]), [change({ id: "b", status: "live", network: "net_a" })], "net_a", "posts")).toBe(true);
    expect(settledSince(new Set(["a"]), [], "net_a", "posts")).toBe(true);
    expect(settledSince(new Set(["a"]), [change({ id: "a", status: "submitted", network: "net_a" })], "net_a", "posts")).toBe(false);
    expect(settledSince(new Set(), [change({ id: "n", status: "validated", network: "net_a" })], "net_a", "posts")).toBe(false);
  });
});

describe("services: a whole list that keeps what you did not touch", () => {
  const held: ServiceEntry[] = [
    { kind: "listed", id: "svc/coffee", description: "Hot", price: { currencyCode: "INR", units: "120" } },
    { kind: "custom", categoryId: "c/cafe", name: "Latte art", description: "Class" },
  ];
  const options = [{ id: "svc/coffee", label: "Coffee" }, { id: "svc/tea", label: "Tea" }];
  it("adding a service keeps every other entry exactly as read, price and description included", () => {
    const next = withService(held, "svc/tea");
    expect(next).toEqual([...held, { kind: "listed", id: "svc/tea" }]);
    expect(next[0]).toBe(held[0]);
  });
  it("removing one keeps the others exactly as read", () => {
    const next = withoutService(held, "listed:svc/coffee");
    expect(next).toEqual([held[1]]);
    expect(next[0]).toBe(held[1]);
  });
  it("the network's list offers only what is not held, and adding one already held adds nothing", () => {
    expect(addableServices(held, options)).toEqual([{ id: "svc/tea", label: "Tea" }]);
    expect(addableServices(held, null)).toEqual([]);
    expect(withService(held, "svc/coffee")).toEqual(held);
  });
  it("an unchanged list is no change; a changed one is sent whole", () => {
    expect(servicesValue(held, [...held].reverse())).toMatchObject({ ok: false });
    expect(servicesValue(held, withService(held, "svc/tea"))).toMatchObject({ ok: true });
  });
});

describe("details: only what is offered, and clearing removes", () => {
  const option = (over: Partial<AttributeOption> = {}): AttributeOption => ({ id: "a/wifi", label: "Wi-Fi", kind: "yesno", values: [], deprecated: false, ...over });
  const held: AttributeEntry[] = [{ id: "a/wifi", kind: "yesno", value: true }, { id: "a/seating", kind: "choice", values: ["INDOOR"] }];
  it("a deprecated detail is never offered", () => {
    expect(offeredDetails([option(), option({ id: "a/old", deprecated: true })]).map((o) => o.id)).toEqual(["a/wifi"]);
    expect(offeredDetails(null)).toEqual([]);
  });
  it("setting a detail replaces its entry and keeps the others exactly as read", () => {
    const next = withDetail(held, { id: "a/wifi", kind: "yesno", value: false });
    expect(next).toEqual([{ id: "a/wifi", kind: "yesno", value: false }, held[1]]);
    expect(next[1]).toBe(held[1]);
    expect(withDetail(held, { id: "a/new", kind: "yesno", value: true })).toHaveLength(3);
  });
  it("CLEARING A DETAIL REMOVES IT from the list", () => {
    expect(withoutDetail(held, "a/wifi")).toEqual([held[1]]);
  });
  it("one value of a several-choice detail changes alone; none said removes the detail", () => {
    const a = withChoice([], "a/pay", "CARD", "set");
    expect(a).toEqual([{ id: "a/pay", kind: "choices", set: ["CARD"], unset: [] }]);
    const b = withChoice(a, "a/pay", "CASH", "unset");
    expect(b).toEqual([{ id: "a/pay", kind: "choices", set: ["CARD"], unset: ["CASH"] }]);
    expect(withChoice(b, "a/pay", "CARD", "unset")).toEqual([{ id: "a/pay", kind: "choices", set: [], unset: ["CASH", "CARD"] }]);
    expect(withChoice(withChoice(b, "a/pay", "CARD", "unknown"), "a/pay", "CASH", "unknown")).toEqual([]);
  });
  it("an unchanged list is no change", () => {
    expect(detailsValue(held, [...held].reverse())).toMatchObject({ ok: false });
    expect(detailsValue(held, withoutDetail(held, "a/wifi"))).toMatchObject({ ok: true });
  });
  it("a detail reads as a line with the network's own words", () => {
    const o = [option({ id: "a/seating", label: "Seating", kind: "choice", values: [{ value: "INDOOR", label: "Indoor" }] })];
    expect(detailLine({ id: "a/seating", kind: "choice", values: ["INDOOR"] }, o)).toBe("Seating: Indoor");
    // a repeatable detail shows every value it holds
    expect(detailLine({ id: "a/seating", kind: "choice", values: ["INDOOR", "OTHER"] }, o)).toBe("Seating: Indoor, Other");
    expect(detailLine({ id: "a/wifi", kind: "yesno", value: false }, null)).toBe("Wifi: No");
    expect(detailLine({ id: "a/pay", kind: "choices", set: ["CARD"], unset: ["CASH"] }, null)).toBe("Pay: Card, not Cash");
  });
});

describe("links: https, and one preferred per kind", () => {
  const types = [{ type: "BOOK", label: "Book" }, { type: "ORDER", label: "Order" }];
  const held = [{ type: "BOOK", uri: "https://a.example/1", preferred: true }, { type: "BOOK", uri: "https://a.example/2" }, { type: "ORDER", uri: "https://a.example/o", preferred: true }];
  it("marking one preferred clears the mark on the others of its kind only", () => {
    const next = withPreferred(held, 1);
    expect(next[0]).toEqual({ type: "BOOK", uri: "https://a.example/1" });
    expect(next[1]).toEqual({ type: "BOOK", uri: "https://a.example/2", preferred: true });
    expect(next[2]).toBe(held[2]);
  });
  it("adding does not add the same address twice for a kind; removing keeps the others", () => {
    expect(withLink(held, { type: "BOOK", uri: "https://a.example/2" })).toEqual(held);
    expect(withLink(held, { type: "ORDER", uri: "https://a.example/2" })).toHaveLength(4);
    expect(withoutLink(held, 0)).toEqual([held[1], held[2]]);
  });
  it("a changed list passes; an unchanged one is no change", () => {
    expect(linksValue(held, withPreferred(held, 1), types)).toMatchObject({ ok: true });
    expect(linksValue(held, [...held].reverse(), types)).toMatchObject({ ok: false });
  });
  it("refuses an address that is not https, a kind not offered, and two preferred of one kind", () => {
    expect(linksValue([], [{ type: "BOOK", uri: "http://a.example" }], types)).toMatchObject({ ok: false });
    expect(linksValue([], [{ type: "SHOP", uri: "https://a.example" }], types)).toMatchObject({ ok: false });
    expect(linksValue([], [{ type: "BOOK", uri: "https://a/1", preferred: true }, { type: "BOOK", uri: "https://a/2", preferred: true }], types)).toMatchObject({ ok: false });
  });
});

describe("the lines of a change card (never raw JSON)", () => {
  it("a post shows its kind and words, its button, dates and offer; a delete says it will be removed", () => {
    expect(valueLines("posts", { op: "create", kind: "event", summary: "Join us", action: { type: "BOOK", url: "https://a.example" }, event: { title: "Party", start: "2026-12-01", end: "2026-12-02" } })).toEqual([
      "Event: Join us",
      "Button: Book (https://a.example)",
      "Party: 2026-12-01 to 2026-12-02",
    ]);
    expect(valueLines("posts", { op: "delete", ref: "p/1" })).toEqual(["This post will be removed"]);
    expect(valueLines("posts", { kind: "update", summary: "Old words", ref: "p/1" })).toEqual(["Update: Old words"]);
    expect(valueLines("posts", null)).toEqual([]);
  });
  it("services, details and links list their entries", () => {
    expect(valueLines("services", [{ kind: "listed", id: "job_type_id:coffee" }, { kind: "custom", categoryId: "c", name: "Latte art" }])).toEqual(["Coffee", "Latte art"]);
    expect(valueLines("attributes", [{ id: "attributes/has_wifi", kind: "yesno", value: true }])).toEqual(["Has wifi: Yes"]);
    expect(valueLines("links", [{ type: "FOOD_ORDERING", uri: "https://a.example/o", preferred: true }])).toEqual(["Food ordering: https://a.example/o (preferred)"]);
    expect(valueLines("services", [])).toEqual([]);
    expect(extraValueLines("nonsense", [1])).toEqual([]);
    const samples: Record<string, unknown> = { posts: { op: "delete", ref: "x" }, services: [{ kind: "listed", id: "x" }], attributes: [{ id: "x", kind: "yesno", value: true }], links: [{ type: "X", uri: "https://a.example" }] };
    for (const [f, v] of Object.entries(samples)) expect(valueLines(f, v).join(" "), f).not.toMatch(/[{}[\]]/);
  });
  it("each field has a title", () => {
    expect([fieldTitle("posts"), fieldTitle("services"), fieldTitle("attributes"), fieldTitle("links")]).toEqual(["Post", "Services", "Details", "Links"]);
  });
});

describe("round one: only what the person added or changed is judged, and nothing a person did not touch is lost", () => {
  const types = [{ type: "BOOK", label: "Book" }];
  it("a held http link passes when the person changes something else; a NEW link needs https", () => {
    const held = [{ type: "BOOK", uri: "http://old.example/book" }];
    expect(linksValue(held, [...held, { type: "BOOK", uri: "https://new.example" }], types)).toMatchObject({ ok: true });
    expect(linksValue(held, [{ ...held[0]!, preferred: true }], types)).toMatchObject({ ok: true });
    expect(linksValue(held, [...held, { type: "BOOK", uri: "http://new.example" }], types)).toMatchObject({ ok: false });
  });
  it("a held link of a kind no longer offered passes; a new one of that kind does not", () => {
    const held = [{ type: "RETIRED", uri: "https://old.example" }];
    expect(linksValue(held, [...held, { type: "BOOK", uri: "https://new.example" }], types)).toMatchObject({ ok: true });
    expect(linksValue(held, [...held, { type: "RETIRED", uri: "https://other.example" }], types)).toMatchObject({ ok: false });
  });
  it("a held detail link keeps its scheme; a changed one needs a web address", () => {
    const held: AttributeEntry[] = [{ id: "a/menu", kind: "link", values: ["ftp://old.example"] }, { id: "a/wifi", kind: "yesno", value: true }];
    expect(detailsValue(held, withDetail(held, { id: "a/wifi", kind: "yesno", value: false }))).toMatchObject({ ok: true });
    expect(detailsValue(held, withDetail(held, { id: "a/menu", kind: "link", values: ["ftp://new.example"] }))).toMatchObject({ ok: false });
  });
  it("a removed service comes back from what the network holds, price and description included, not as a bare one", () => {
    const held: ServiceEntry[] = [{ kind: "listed", id: "svc/coffee", description: "Hot", price: { currencyCode: "INR", units: "0" } }];
    const removed = withoutService(held, "listed:svc/coffee");
    expect(withService(removed, "svc/coffee", held)).toEqual(held);
    expect(withService(removed, "svc/coffee")).toEqual([{ kind: "listed", id: "svc/coffee" }]);
  });
  it("a service the person names is filed under the network's category; without one, or empty, or twice, nothing is added", () => {
    const held: ServiceEntry[] = [{ kind: "listed", id: "svc/coffee" }];
    expect(withCustomService(held, "cat/cafe", "  Latte art  ")).toEqual({ ok: true, value: [...held, { kind: "custom", categoryId: "cat/cafe", name: "Latte art" }] });
    expect(withCustomService(held, null, "Latte art")).toMatchObject({ ok: false });
    expect(withCustomService(held, "cat/cafe", "   ")).toMatchObject({ ok: false });
    const once = withCustomService(held, "cat/cafe", "Latte art");
    expect(once.ok && withCustomService(once.value, "cat/cafe", "latte ART")).toMatchObject({ ok: false });
  });
  it("a service of the person's own that they removed in this draft comes back as the network held it (description and price)", () => {
    const own: ServiceEntry = { kind: "custom", categoryId: "cat/cafe", name: "Latte art", description: "Class", price: { currencyCode: "INR", units: "0" } };
    const removed = withoutService([own], serviceKey(own));
    expect(withCustomService(removed, "cat/cafe", "latte ART", [own])).toEqual({ ok: true, value: [own] });
    expect(withCustomService(removed, "cat/cafe", "Latte art")).toEqual({ ok: true, value: [{ kind: "custom", categoryId: "cat/cafe", name: "Latte art" }] });
  });
  it("a post keeps its language and its event times through an edit", () => {
    const item = { ref: "p/1", kind: "event" as const, summary: "S", state: "live" as const, languageCode: "en", action: null, event: { title: "T", start: "2026-12-01", startTime: "18:00", endTime: "21:30" }, offer: null, createdAt: null, updatedAt: null, url: null, hasPhoto: false };
    const d = postDraftOf(item);
    expect(buildPostValue(d, DECL, { op: "update", ref: "p/1" }, item)).toEqual({
      ok: true,
      value: { op: "update", ref: "p/1", kind: "event", summary: "S", languageCode: "en", event: { title: "T", start: "2026-12-01", startTime: "18:00", endTime: "21:30" } },
    });
  });
  it("a button the network no longer offers is kept as it is when the person leaves it, and refused when they set it anew", () => {
    const heldButton = { type: "SHOP", url: "https://a.example" };
    const held = { action: heldButton };
    const d = draft({ actionType: "SHOP", actionUrl: "https://a.example" });
    expect(buildPostValue(d, DECL, { op: "update", ref: "p/1" }, held)).toMatchObject({ ok: true, value: { action: heldButton } });
    expect(buildPostValue(d, DECL, { op: "update", ref: "p/1" })).toEqual({ ok: false, message: "That button is not offered." });
    expect(buildPostValue(draft({ actionType: "SHOP", actionUrl: "https://b.example" }), DECL, { op: "update", ref: "p/1" }, held)).toMatchObject({ ok: false });
    // cleared: no button at all
    expect(buildPostValue(draft({}), DECL, { op: "update", ref: "p/1" }, held)).toEqual({ ok: true, value: { op: "update", ref: "p/1", kind: "update", summary: "Open late on Friday." } });
  });
  it("a button with an empty kind does not leave an address behind", () => {
    expect(buildPostValue(draft({ actionType: "", actionUrl: "https://a.example" }), DECL, create)).toMatchObject({ ok: false });
  });
  it("a new post gets a fresh 24-hex draft id each time", () => {
    const a = newDraftId();
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(newDraftId()).not.toBe(a);
  });
  it("success and waiting words follow the role: only an admin is told to approve", () => {
    expect(preparedWords({ approve: true }, "NetA", true)).toContain("then approve it");
    expect(preparedWords({ approve: false }, "NetA", true)).toContain("an admin or owner to approve");
    expect(preparedWords({ approve: false }, "NetA", true)).not.toContain("then approve it");
    expect(preparedWords({ approve: true }, "NetA", false)).toContain("NetA could not check it");
    expect(waitingWords("links", { approve: true })).toContain("Approve or decline it");
    expect(waitingWords("links", { approve: false })).not.toContain("Approve or decline it before");
  });
  it("the api's refusal of a stale list is recognised by its code only", () => {
    expect(isListChanged({ code: "LIST_CHANGED" })).toBe(true);
    expect(isListChanged({ code: "RULES_FAILED" })).toBe(false);
    expect(isListChanged(null)).toBe(false);
  });
});
