import { describe, it, expect } from "vitest";
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
  offerState,
  phoneValue,
  proposeBody,
  riskWarning,
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
  const resp = (over = {}) => ({ offers: [offer()], needsRegularHours: false, openChange: false, noTimeZone: false, ...over });

  it("shows nothing when there is no day to offer", () => {
    expect(offerState(resp({ offers: [] })).show).toBe(false);
  });
  it("says why when there is no calendar to place the days on", () => {
    const s = offerState(resp({ offers: [], noTimeZone: true }));
    expect(s).toMatchObject({ show: true, canAccept: false });
    expect(s.message).toContain("time zone");
  });
  it("can be accepted when nothing stands in the way", () => {
    expect(offerState(resp())).toEqual({ show: true, message: null, canAccept: true });
  });
  it("cannot be accepted without regular hours, or while a holiday change waits, and says why", () => {
    expect(offerState(resp({ needsRegularHours: true }))).toMatchObject({ show: true, canAccept: false });
    expect(offerState(resp({ needsRegularHours: true })).message).toContain("opening hours");
    expect(offerState(resp({ openChange: true }))).toMatchObject({ show: true, canAccept: false });
  });
});
