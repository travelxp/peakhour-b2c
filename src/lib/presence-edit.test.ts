import { describe, it, expect } from "vitest";
import type { DrawnSection } from "@/lib/presence-edit";
import {
  cardActions,
  capabilityFor,
  categoriesValue,
  categoriesDropped,
  categoryQueryReady,
  charsLeft,
  descriptionValue,
  drawnSections,
  errorWords,
  formAccess,
  hoursDraft,
  hoursValue,
  requestedForm,
  offerOutcome,
  offerState,
  outcomeFor,
  outcomeIds,
  outcomesStaleTime,
  outcomeWords,
  phoneValue,
  proposeBody,
  riskWarning,
  showsOutcome,
  specialValue,
  statusWords,
  valueLines,
  websiteValue,
  wipeNote,
  withCategory,
  writesNote,
  type CapabilitiesResponse,
  type ChangeCardData,
  type ChangeStatus,
  type NetworkCapability,
  presenceEditKeys,
} from "./presence-edit";

const cap = (over: Partial<NetworkCapability> = {}): NetworkCapability => ({
  network: "testnet",
  label: "Testnet",
  writableFields: ["regularHours", "specialHours", "description", "phone", "name", "primaryCategory"],
  riskyFields: ["name", "primaryCategory"],
  limits: { descriptionMaxLength: 750, maxAdditionalPhones: 2, maxAdditionalCategories: 2 },
  options: { categories: true },
  writes: { released: false, reason: "Held for review." },
  ...over,
});

const change = (over: Partial<ChangeCardData> = {}): ChangeCardData => ({
  id: "c1",
  listingId: "l1",
  network: "testnet",
  field: "description",
  status: "validated",
  riskTier: "ordinary",
  notes: [],
  source: "form",
  before: "Old.",
  after: "New.",
  reason: null,
  held: null,
  validation: null,
  createdAt: "2026-11-05T10:00:00.000Z",
  expiresAt: "2026-11-08T10:00:00.000Z",
  submittedAt: null,
  liveAt: null,
  liveCheck: null,
  undone: false,
  ...over,
});

const ADMIN = { propose: true, approve: true };
const EDITOR = { propose: true, approve: false };
const VIEWER = { propose: false, approve: false };

describe("the form is drawn from declared capabilities", () => {
  it("draws a section only for a field the network can write, and flags the risky ones", () => {
    const s = drawnSections(cap());
    expect(s.map((x) => x.field)).toEqual(["regularHours", "specialHours", "description", "phone", "name", "primaryCategory"]);
    expect(s.filter((x) => x.risky).map((x) => x.field)).toEqual(["name", "primaryCategory"]);
  });

  it("draws no control for a field the network cannot write", () => {
    const s = drawnSections(cap({ writableFields: ["description"], riskyFields: [] }));
    expect(s.map((x) => x.field)).toEqual(["description"]);
    expect(drawnSections(cap({ writableFields: [] }))).toEqual([]);
  });

  it("draws nothing for a network it was not told about", () => {
    expect(drawnSections(undefined)).toEqual([]);
    const caps: CapabilitiesResponse = { items: [cap()], can: ADMIN };
    expect(capabilityFor(caps, "testnet")?.label).toBe("Testnet");
    expect(capabilityFor(caps, "other")).toBeUndefined();
    expect(capabilityFor(caps, null)).toBeUndefined();
    expect(capabilityFor(undefined, "testnet")).toBeUndefined();
  });

  it("never lets a screen name a network: the word comes from the label", () => {
    expect(statusWords(change({ status: "submitted" }), "Elsewhere", ADMIN).headline).toBe("Sent to Elsewhere, not live yet");
    expect(writesNote(cap({ label: "Elsewhere" }))).toContain("Elsewhere");
  });
});

describe("what a role can press", () => {
  it("lets only an admin approve, and an editor propose, decline and undo", () => {
    const v = change({ status: "validated" });
    expect(cardActions(v, ADMIN)).toMatchObject({ approve: true, reject: true, needsAdmin: false });
    expect(cardActions(v, EDITOR)).toMatchObject({ approve: false, reject: true, needsAdmin: true });
    expect(cardActions(v, VIEWER)).toMatchObject({ approve: false, reject: false, undo: false });
    expect(cardActions(v, undefined)).toMatchObject({ approve: false, reject: false });
  });

  it("offers approval for a change not yet checked, since the api checks again", () => {
    expect(cardActions(change({ status: "proposed" }), ADMIN).approve).toBe(true);
  });

  it("offers nothing on a change that is already decided", () => {
    for (const status of ["approved", "applying", "failed", "blocked", "rejected", "expired", "superseded"] as ChangeStatus[]) {
      expect(cardActions(change({ status }), ADMIN)).toMatchObject({ approve: false, reject: false, undo: false });
    }
  });

  it("offers undo once a change has been sent, once", () => {
    expect(cardActions(change({ status: "submitted" }), EDITOR).undo).toBe(true);
    expect(cardActions(change({ status: "live" }), EDITOR).undo).toBe(true);
    expect(cardActions(change({ status: "live", undone: true }), EDITOR).undo).toBe(false);
    expect(cardActions(change({ status: "live" }), VIEWER).undo).toBe(false);
  });

  it("shows a viewer why there is no control", () => {
    expect(formAccess(ADMIN).mode).toBe("edit");
    expect(formAccess(EDITOR).mode).toBe("edit");
    const v = formAccess(VIEWER);
    expect(v.mode).toBe("view");
    expect(v.mode === "view" && v.why).toMatch(/editor, admin or owner/);
    expect(formAccess(undefined).mode).toBe("view");
  });
});

describe("the state words", () => {
  const words = (status: ChangeStatus, over: Partial<ChangeCardData> = {}) => statusWords(change({ status, ...over }), "Testnet", ADMIN);

  it("says live only for a live change", () => {
    for (const status of ["proposed", "validated", "approved", "applying", "submitted", "failed", "blocked", "rejected", "expired", "superseded"] as ChangeStatus[]) {
      const w = words(status, { reason: { code: "x", message: "A reason." } });
      expect(`${w.headline} ${w.detail ?? ""}`.toLowerCase().replace(/not live/g, "")).not.toMatch(/\blive\b/);
    }
    expect(words("live").headline).toBe("Live on Testnet");
  });

  it("says a submitted change is not live yet", () => {
    expect(words("submitted").headline).toBe("Sent to Testnet, not live yet");
  });

  it("says an approved change was not sent when sending is held, and gives the reason", () => {
    const w = words("approved", { held: { reason: "Held for review." } });
    expect(w.headline).toBe("Approved, but not sent");
    expect(w.detail).toContain("Held for review.");
    expect(w.tone).toBe("warn");
    expect(words("approved").headline).toBe("Approved, waiting to be sent");
  });

  it("gives the reason for a blocked or failed change, or says none was given", () => {
    expect(words("blocked", { reason: { code: "control_lost", message: "Testnet has not confirmed that you control this listing." } }).detail).toContain("has not confirmed");
    expect(words("failed", { reason: { code: "x", message: "It was refused." } }).detail).toBe("It was refused.");
    expect(words("failed").detail).toBe("No reason was given.");
    expect(words("blocked").tone).toBe("bad");
  });

  it("warns when the network is not showing a change it has stopped reviewing", () => {
    const w = words("submitted", { liveCheck: { checkedAt: "x", outcome: "not_shown", note: null } });
    expect(w.tone).toBe("warn");
    expect(w.detail).toContain("not showing it yet");
  });

  it("tells a role who has to approve", () => {
    expect(statusWords(change({ status: "validated" }), "Testnet", EDITOR).detail).toContain("admin or owner");
    expect(statusWords(change({ status: "validated" }), "Testnet", ADMIN).detail).toContain("Approve it");
  });

  it("says nothing was sent for every state before sending", () => {
    for (const status of ["proposed", "validated", "rejected", "expired", "superseded"] as ChangeStatus[]) {
      expect(words(status).detail).toMatch(/nothing (has been sent|was sent)/i);
    }
  });
});

describe("the switch", () => {
  it("says plainly that sending is off, with the reason, and never says saved", () => {
    const n = writesNote(cap())!;
    expect(n).toContain("switched off");
    expect(n).toContain("nothing is sent to Testnet");
    expect(n).toContain("Held for review.");
    expect(n.toLowerCase()).not.toContain("saved");
  });
  it("says nothing when writes are on, or there is no network", () => {
    expect(writesNote(cap({ writes: { released: true, reason: null } }))).toBeNull();
    expect(writesNote(undefined)).toBeNull();
  });
});

describe("building values", () => {
  it("sends the whole week of hours and refuses a period that is not a time or is empty", () => {
    const draft = hoursDraft([
      { day: "mon", open: "09:00", close: "17:00" },
      { day: "mon", open: "18:00", close: "20:00" },
      { day: "tue", open: "09:00", close: "17:00" },
    ]);
    expect(hoursValue(draft)).toEqual({
      ok: true,
      value: [
        { day: "mon", open: "09:00", close: "17:00" },
        { day: "mon", open: "18:00", close: "20:00" },
        { day: "tue", open: "09:00", close: "17:00" },
      ],
    });
    expect(hoursValue(hoursDraft([]))).toEqual({ ok: true, value: [] });
    expect(hoursValue([{ day: "mon", periods: [{ open: "9:00", close: "17:00" }] }])).toMatchObject({ ok: false });
    expect(hoursValue([{ day: "mon", periods: [{ open: "09:00", close: "09:00" }] }])).toMatchObject({ ok: false });
  });

  it("holds a description to the network's limit", () => {
    expect(descriptionValue("  Fresh bread.  ", 750)).toEqual({ ok: true, value: "Fresh bread." });
    expect(descriptionValue("x".repeat(751), 750)).toMatchObject({ ok: false });
    expect(descriptionValue("x".repeat(751), undefined)).toMatchObject({ ok: true });
    expect(charsLeft("abc", 10)).toBe("7 characters left");
    expect(charsLeft("abcdef", 3)).toBe("3 characters over");
    expect(charsLeft("abc", undefined)).toBeNull();
  });

  it("checks a web address", () => {
    expect(websiteValue("")).toEqual({ ok: true, value: "" });
    expect(websiteValue(" https://acme.example ")).toEqual({ ok: true, value: "https://acme.example" });
    expect(websiteValue("acme.example")).toMatchObject({ ok: false });
    expect(websiteValue("javascript:alert(1)")).toMatchObject({ ok: false });
  });

  it("sends phone numbers whole, drops only blank lines, and refuses a lost or repeated number", () => {
    const limits = { maxAdditionalPhones: 2 };
    expect(phoneValue({ primary: " +1 111 ", additional: ["+2 222", "  "] }, limits)).toEqual({ ok: true, value: { primary: "+1 111", additional: ["+2 222"] } });
    expect(phoneValue({ primary: "", additional: [] }, limits)).toEqual({ ok: true, value: { additional: [] } });
    expect(phoneValue({ primary: "", additional: ["+2 222"] }, limits)).toMatchObject({ ok: false });
    expect(phoneValue({ primary: "+1", additional: ["+1"] }, limits)).toMatchObject({ ok: false });
    expect(phoneValue({ primary: "+1", additional: ["a", "b", "c"] }, limits)).toMatchObject({ ok: false });
  });

  it("sends categories whole, once each, up to the limit", () => {
    const a = { id: "c/1", label: "Bakery" };
    const b = { id: "c/2", label: "Cafe" };
    expect(withCategory([a], a)).toEqual([a]);
    expect(withCategory([a], b)).toEqual([a, b]);
    expect(categoriesValue([a, b], { maxAdditionalCategories: 2 })).toMatchObject({ ok: true });
    expect(categoriesValue([a, b, { id: "c/3", label: "Deli" }], { maxAdditionalCategories: 2 })).toMatchObject({ ok: false });
    expect(categoriesValue([a, a], {})).toMatchObject({ ok: false });
  });

  it("sends holiday days whole, sorted, once each, with times for an open day", () => {
    const d = (date: string, over = {}) => ({ date, closed: true, open: "09:00", close: "17:00", note: "", ...over });
    expect(specialValue([d("2026-12-26"), d("2026-12-25", { note: "Christmas Day" })])).toEqual({
      ok: true,
      value: [{ date: "2026-12-25", closed: true, note: "Christmas Day" }, { date: "2026-12-26", closed: true }],
    });
    expect(specialValue([d("2026-12-25", { closed: false })])).toEqual({ ok: true, value: [{ date: "2026-12-25", closed: false, open: "09:00", close: "17:00" }] });
    expect(specialValue([d("2026-12-25"), d("2026-12-25")])).toMatchObject({ ok: false });
    expect(specialValue([d("")])).toMatchObject({ ok: false });
    expect(specialValue([d("2026-12-25", { closed: false, open: "10:00", close: "10:00" })])).toMatchObject({ ok: false });
  });

  it("asks for a category list only after enough is typed", () => {
    expect(categoryQueryReady("b")).toBe(false);
    expect(categoryQueryReady(" b ")).toBe(false);
    expect(categoryQueryReady("ba")).toBe(true);
  });
});

describe("submitting", () => {
  it("submits exactly one field, so a risky field is never mixed with another", () => {
    const b = proposeBody("l1", "testnet", "name", "New name");
    expect(b.changes).toHaveLength(1);
    expect(b).toEqual({ listingId: "l1", network: "testnet", changes: [{ field: "name", value: "New name" }] });
  });

  it("warns with may, never a rule the network has not stated", () => {
    for (const f of ["name", "address", "primaryCategory"] as const) {
      const w = riskWarning(f, "Testnet").join(" ");
      expect(w).toContain("may");
      expect(w).not.toMatch(/\b(will|must|always|suspend)/i);
      expect(w).toContain("Testnet");
    }
    expect(riskWarning("name", "Testnet").join(" ")).toContain("postcard");
    expect(riskWarning("primaryCategory", "Testnet").join(" ")).not.toContain("postcard");
  });

  it("reads a failed request in the api's own words and lists the issues", () => {
    expect(errorWords({ message: "Some rules failed.", details: [{ message: "Too long." }, { message: "Some rules failed." }] })).toBe("Some rules failed. Too long.");
    expect(errorWords(new Error("boom"))).toBe("boom");
    expect(errorWords(null)).toMatch(/Try again/);
  });
});

describe("showing a value", () => {
  it("shows hours by day, special days with their names, and an empty value as nothing", () => {
    expect(valueLines("regularHours", [{ day: "mon", open: "09:00", close: "17:00" }, { day: "sun", open: "10:00", close: "14:00" }])).toEqual(["Monday: 09:00 to 17:00", "Sunday: 10:00 to 14:00"]);
    expect(valueLines("specialHours", [{ date: "2026-12-25T00:00:00.000Z", closed: true, note: "Christmas Day" }])).toEqual(["Fri, 25 Dec 2026 (Christmas Day): closed"]);
    expect(valueLines("specialHours", [])).toEqual([]);
    expect(valueLines("description", "")).toEqual([]);
    expect(valueLines("description", null)).toEqual([]);
    expect(valueLines("temporaryClosure", { closed: true })).toEqual(["Temporarily closed"]);
    expect(valueLines("phone", { primary: "+1", additional: ["+2"] })).toEqual(["+1", "+2"]);
    expect(valueLines("additionalCategories", [{ id: "c/1", label: "Bakery" }])).toEqual(["Bakery"]);
  });
});

describe("not wiping or losing what is there", () => {
  const c = (id: string, label: string) => ({ id, label });
  it("names the categories a new list leaves out, by name", () => {
    expect(categoriesDropped(["Bakery", "Cafe"], [c("c/1", "bakery")])).toEqual(["Cafe"]);
    expect(categoriesDropped(["Bakery"], [c("c/1", " Bakery ")])).toEqual([]);
    expect(categoriesDropped(["Bakery", "Cafe"], [])).toEqual(["Bakery", "Cafe"]);
    expect(categoriesDropped([], [c("c/1", "Deli")])).toEqual([]);
    expect(categoriesDropped(["", " "], [])).toEqual([]);
  });
  it("says what an empty value would wipe, and nothing for a value that is not a wipe", () => {
    expect(wipeNote("regularHours", [])).toContain("closed every day");
    expect(wipeNote("regularHours", [{ day: "mon", open: "09:00", close: "17:00" }])).toBeNull();
    expect(wipeNote("phone", { additional: [] })).toContain("every phone number");
    expect(wipeNote("phone", { primary: "+1", additional: [] })).toBeNull();
    expect(wipeNote("phone", { additional: ["+2"] })).toBeNull();
    expect(wipeNote("website", "")).toContain("website");
    expect(wipeNote("website", "https://a.example")).toBeNull();
    expect(wipeNote("specialHours", [])).toContain("holiday");
    expect(wipeNote("additionalCategories", [])).toContain("every other category");
    expect(wipeNote("description", "")).toBeNull();
  });
  it("reads a category held as plain text", () => {
    expect(valueLines("primaryCategory", "Bakery")).toEqual(["Bakery"]);
    expect(valueLines("additionalCategories", ["Bakery", "Cafe"])).toEqual(["Bakery", "Cafe"]);
  });
});

describe("the holiday offer", () => {
  const offer = (over = {}) => ({ key: "k", date: "2026-12-25", name: "Christmas Day", tentative: false, regionUnknown: false, ...over });
  const resp = (over = {}) => ({ offers: [offer()], needsRegularHours: false, openChange: false, noTimeZone: false, networkUnreadable: false, ...over });
  const L = "Testnet";

  it("shows nothing when there is no day to offer and nothing to say", () => {
    expect(offerState(resp({ offers: [] }), L).show).toBe(false);
  });
  it("says why when there is no calendar to place the days on", () => {
    const s = offerState(resp({ offers: [], noTimeZone: true }), L);
    expect(s).toMatchObject({ show: true, canAccept: false });
    expect(s.message).toContain("time zone");
  });
  it("says so when the network could not be read, with its name", () => {
    const s = offerState(resp({ offers: [], networkUnreadable: true }), L);
    expect(s).toMatchObject({ show: true, canAccept: false });
    expect(s.message).toContain("Testnet");
  });
  it("can be accepted when nothing stands in the way", () => {
    expect(offerState(resp(), L)).toEqual({ show: true, message: null, canAccept: true });
  });
  it("cannot be accepted without regular hours, or while a holiday change waits, and says why even with no days listed", () => {
    expect(offerState(resp({ needsRegularHours: true, offers: [] }), L)).toMatchObject({ show: true, canAccept: false });
    expect(offerState(resp({ needsRegularHours: true }), L).message).toContain("opening hours");
    expect(offerState(resp({ openChange: true, offers: [] }), L)).toMatchObject({ show: true, canAccept: false });
    expect(offerState(resp({ openChange: true }), L).message).toContain("already waiting");
  });

  it("does not call a blocked or failed row prepared, and gives its reason", () => {
    const blocked = offerOutcome([{ status: "blocked", reason: { code: "control_lost", message: "Testnet has not confirmed that you control this listing." } }], "Christmas Day", L);
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toContain("could not be prepared");
    expect(blocked.message).toContain("has not confirmed");
    expect(blocked.message).not.toMatch(/is prepared/);
    expect(offerOutcome([{ status: "failed", reason: null }], "X", L).message).toContain("No reason was given.");
    expect(offerOutcome([], "X", L).ok).toBe(false);
  });
  it("says a checked row is prepared, and an unchecked one has not been checked, and that nothing was sent", () => {
    const ok = offerOutcome([{ status: "validated", reason: null }], "Christmas Day", L);
    expect(ok).toMatchObject({ ok: true });
    expect(ok.message).toContain("is prepared");
    expect(ok.message).toContain("Nothing has been sent to Testnet");
    const waiting = offerOutcome([{ status: "proposed", reason: null }], "Christmas Day", L);
    expect(waiting.ok).toBe(true);
    expect(waiting.message).toContain("has not checked it yet");
  });
});

describe("a form asked for by another card", () => {
  const sections = [{ field: "phone", title: "Phone", blurb: "", risky: false }] as unknown as DrawnSection[];

  it("opens a field the network lets you change", () => {
    expect(requestedForm(sections, { mode: "edit" }, "phone")).toEqual({ open: "phone", notice: null });
  });
  it("says so when the field has no form", () => {
    expect(requestedForm(sections, { mode: "edit" }, "media")).toEqual({ open: null, notice: "That detail cannot be changed from Peakhour yet." });
  });
  it("gives the role's reason and opens nothing for someone who cannot edit", () => {
    expect(requestedForm(sections, { mode: "view", why: "Ask an editor." }, "phone")).toEqual({ open: null, notice: "Ask an editor." });
  });
});

describe("presenceEditKeys: two networks never share a cached offers or categories answer", () => {
  it("offers and categories differ by network", () => {
    expect(presenceEditKeys.offers("l1", "net_a")).not.toEqual(presenceEditKeys.offers("l1", "net_b"));
    expect(presenceEditKeys.categories("l1", "net_a", "cafe")).not.toEqual(presenceEditKeys.categories("l1", "net_b", "cafe"));
    expect(presenceEditKeys.categories("l1", "net_a", " Cafe ")).toEqual(presenceEditKeys.categories("l1", "net_a", "cafe"));
  });
});

describe("what followed a live change (PE-13)", () => {
  const item = (reason: string, over: Record<string, unknown> = {}) =>
    ({
      id: "c1",
      outcome: { status: reason === "compared" ? "measured" : "x", reason, message: "The sentence.", lines: [{ text: "Calls: 40 in the 28 days before, 60 in the 28 days after (higher)." }], ...over },
    }) as never;

  it("a comparison shows the api's sentence and its lines, under a headline that says what followed", () => {
    expect(outcomeWords(item("compared"))).toEqual({
      headline: "What followed this change",
      message: "The sentence.",
      lines: ["Calls: 40 in the 28 days before, 60 in the 28 days after (higher)."],
    });
  });

  it("the headline is picked by the reason, and only a running stretch is 'too early'", () => {
    const head = (reason: string) => outcomeWords(item(reason))!.headline;
    expect(head("window_not_finished")).toBe("Too early to tell");
    expect(head("figures_not_in")).toBe("Too early to tell");
    // a finished stretch with too few is not early
    expect(head("too_few_actions")).toBe("Too few to compare");
    expect(head("too_few_actions")).not.toMatch(/early/i);
    // an unreadable calendar is not called a holiday
    expect(head("calendar_unknown")).not.toMatch(/holiday period/i);
    expect(head("calendar_unknown")).toMatch(/cannot be checked/);
    expect(head("holiday_in_window")).toBe("Not compared: a holiday period");
    expect(head("other_change")).toBe("Not tied to this one change");
    for (const r of ["after_unread", "not_connected", "no_location", "no_figures"]) expect(head(r), r).toBe("Cannot compare");
    for (const r of ["no_baseline", "too_few_days", "windows_differ", "figures_missing"]) expect(head(r), r).toBe("Not enough figures to compare");
  });

  it("every state that is not a comparison draws its sentence and no list of figures", () => {
    for (const r of ["window_not_finished", "other_change", "holiday_in_window", "too_few_actions", "not_connected"]) {
      expect(outcomeWords(item(r)), r).toMatchObject({ message: "The sentence.", lines: [] });
    }
  });

  it("no answer, an empty sentence, a status that says nothing and a reason this screen has no words for draw nothing", () => {
    expect(outcomeWords(null)).toBeNull();
    expect(outcomeWords(undefined)).toBeNull();
    expect(outcomeWords(item("compared", { message: "  " }))).toBeNull();
    expect(outcomeWords(item("not_live", { status: "none" }))).toBeNull();
    expect(outcomeWords(item("a_reason_from_a_newer_api"))).toBeNull();
  });

  it("the headlines claim no cause", () => {
    const heads = ["compared", "window_not_finished", "too_few_actions", "calendar_unknown", "holiday_in_window", "other_change", "no_baseline", "not_connected"].map((r) => outcomeWords(item(r))!.headline);
    for (const h of heads) expect(h).not.toMatch(/because|caused|due to|thanks to|result of|improved|ranking/i);
  });

  it("a headline is not repeated in the sentence the api sends under it (fixtures in the api's own wording)", () => {
    const fixtures: Record<string, string> = {
      compared: "The 28 days before (12 Sep to 9 Oct) against the 28 days after (11 Oct to 7 Nov). Figures are from NetA. This shows a difference, not proof the change caused it.",
      window_not_finished: "The 28 days after this change run to 7 Nov, and the figures arrive a day or so later. Check back from 8 Nov.",
      too_few_actions: "There were fewer than 10 calls in all across the days before and after, which is too few to say anything about this change.",
      calendar_unknown: "Your holiday calendar cannot be read for these days yet, so a holiday cannot be ruled out and no comparison is shown.",
      not_connected: "This listing is not connected to NetA any more, so there are no figures to compare.",
    };
    for (const [reason, message] of Object.entries(fixtures)) {
      const w = outcomeWords(item(reason, { message }))!;
      expect(message.toLowerCase().startsWith(w.headline.toLowerCase()), reason).toBe(false);
      expect(message.toLowerCase().includes(w.headline.toLowerCase()), reason).toBe(false);
    }
  });
});

describe("which changes ask for what followed them", () => {
  const caps = { items: [{ ...cap({ network: "net_a" }), metrics: true }, { ...cap({ network: "net_b" }), metrics: false }, cap({ network: "net_c" })], can: { propose: true, approve: true } } as never;
  const ch = (id: string, status: string, network: string) => ({ id, status, network }) as never;

  it("a live change on a network that declares figures does; nothing else does", () => {
    expect(showsOutcome(ch("1", "live", "net_a"), caps)).toBe(true);
    expect(showsOutcome(ch("1", "submitted", "net_a"), caps)).toBe(false);
    expect(showsOutcome(ch("1", "live", "net_b"), caps)).toBe(false);
    // an older api that sends no flag, a network the capabilities do not list, and no capabilities yet
    expect(showsOutcome(ch("1", "live", "net_c"), caps)).toBe(false);
    expect(showsOutcome(ch("1", "live", "net_z"), caps)).toBe(false);
    expect(showsOutcome(ch("1", "live", "net_a"), undefined)).toBe(false);
  });

  it("the request is for the set of those changes, sorted, and empty when there are none", () => {
    expect(outcomeIds([ch("b", "live", "net_a"), ch("a", "live", "net_a"), ch("c", "live", "net_b"), ch("d", "proposed", "net_a")], caps)).toEqual(["a", "b"]);
    expect(outcomeIds([ch("c", "live", "net_b")], caps)).toEqual([]);
    expect(outcomeIds(undefined, caps)).toEqual([]);
  });

  it("one answer per set of live changes, so a change that has just gone live is asked for", () => {
    expect(presenceEditKeys.outcomes("l1", ["a"])).not.toEqual(presenceEditKeys.outcomes("l1", ["a", "b"]));
    expect(presenceEditKeys.outcomes("l1", ["a"])).not.toEqual(presenceEditKeys.outcomes("l2", ["a"]));
    expect(presenceEditKeys.outcomes("l1", ["a"]).slice(0, 3)).toEqual(presenceEditKeys.outcomesAll);
  });

  it("the answer for one change is found in the list's one answer", () => {
    const r = { items: [{ id: "a", outcome: { status: "measured", reason: "compared", message: "m", lines: [] } }] };
    expect(outcomeFor(r, "a")!.id).toBe("a");
    expect(outcomeFor(r, "z")).toBeNull();
    expect(outcomeFor(undefined, "a")).toBeNull();
  });

  it("a settled answer is held a while and one that says check back, or nothing yet, only briefly", () => {
    const answer = (status: string) => ({ items: [{ id: "a", outcome: { status, reason: "x", message: "m", lines: [] } }] });
    expect(outcomesStaleTime(undefined)).toBe(0);
    expect(outcomesStaleTime(answer("measured"))).toBe(30 * 60_000);
    expect(outcomesStaleTime(answer("too_early"))).toBe(5 * 60_000);
    expect(outcomesStaleTime(answer("none"))).toBe(5 * 60_000);
    expect(outcomesStaleTime({ items: [] })).toBe(30 * 60_000);
  });
});
