import { describe, it, expect } from "vitest";
import type { DrawnSection } from "@/lib/presence-edit";
import type { PresencePublishing } from "@/lib/presence-panels";
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
  outcomeSignature,
  outcomeSlot,
  outcomesRefetchMs,
  wantsOutcomes,
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
  preparedWords,
  publishingBanner,
  requestGroups,
  requestStatus,
  shortChange,
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
    expect(statusWords(change({ status: "submitted" }), "Elsewhere", ADMIN).headline).toBe("Sent to Elsewhere");
    expect(preparedWords(0, cap({ label: "Elsewhere" }))).toContain("Elsewhere");
    expect(publishingBanner({ label: "Elsewhere", publishing: { state: "on", heldReason: null, blocker: null, keptForHours: 72 } }, undefined)!.headline).toContain("Elsewhere");
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
    expect(words("submitted").headline).toBe("Sent to Testnet");
    expect(words("submitted").detail).toMatch(/may take time to show it/);
  });

  it("says an approved change was not sent when sending is held, and gives the reason", () => {
    const w = words("approved", { held: { reason: "Held for review." } });
    expect(w.headline).toBe("Approved, waiting to send");
    expect(w.detail).toContain("Held for review.");
    expect(w.tone).toBe("warn");
    expect(words("approved").headline).toBe("Approved, waiting to send");
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

describe("the one publishing status (GBP Issue 1)", () => {
  const ADMIN_CAN = { propose: true, approve: true };
  const EDITOR_CAN = { propose: true, approve: false };
  const pub = (over: Partial<PresencePublishing> = {}): PresencePublishing => ({ state: "held", heldReason: "Peakhour is finishing its setup with Testnet.", blocker: null, keptForHours: 72, ...over });
  const entry = (p: PresencePublishing | null | undefined) => ({ label: "Testnet", publishing: p });

  it("held says what is off, why, that the merchant need not act, and for how long a change keeps, with no button", () => {
    const b = publishingBanner(entry(pub()), ADMIN_CAN)!;
    expect(b.tone).toBe("warn");
    expect(b.headline).toBe("Publishing to Testnet hasn't started yet");
    expect(b.lines[0]).toBe("Peakhour is finishing its setup with Testnet. You don't need to do anything.");
    expect(b.lines.join(" ")).toMatch(/You can prepare and approve changes now/);
    expect(b.lines.join(" ")).toMatch(/3 days after it was prepared is dropped/);
    expect(b.action).toBeNull();
  });

  it("★never tells a merchant about a switch they cannot press", () => {
    for (const state of ["on", "held", "blocked"] as const) {
      const b = publishingBanner(entry(pub({ state, blocker: state === "blocked" ? { reason: "x", action: "reconnect", href: "/i" } : null })), ADMIN_CAN)!;
      expect([b.headline, ...b.lines].join(" "), state).not.toMatch(/switch/i);
    }
  });

  it("held with a merchant-side blocker names it and gives its fix, so it can be done while they wait", () => {
    const b = publishingBanner(entry(pub({ blocker: { reason: "Testnet has suspended this listing.", action: "fix_on_network", href: "https://t.example" } })), ADMIN_CAN)!;
    expect(b.lines).toContain("One thing needs you first: Testnet has suspended this listing.");
    // never "you don't need to do anything" beside "fix this"; the why is still said
    expect(b.lines.join(" ")).not.toMatch(/don't need to do anything/);
    expect(b.lines[0]).toBe("Peakhour is finishing its setup with Testnet.");
    expect(b.action).toEqual({ label: "Fix this on Testnet", href: "https://t.example", external: true });
  });

  it("blocked is the warning look, with the reason and a reconnect inside the app", () => {
    const b = publishingBanner(entry(pub({ state: "blocked", heldReason: null, blocker: { reason: "We could not tell.", action: "reconnect", href: "/dashboard/integrations" } })), ADMIN_CAN)!;
    expect(b.tone).toBe("bad");
    expect(b.headline).toBe("Peakhour can't publish to Testnet right now");
    expect(b.lines[0]).toBe("We could not tell.");
    expect(b.action).toEqual({ label: "Reconnect Testnet", href: "/dashboard/integrations", external: false });
  });

  it("a blocker with no place to fix it gives its reason and no button that leads nowhere", () => {
    expect(publishingBanner(entry(pub({ state: "blocked", blocker: { reason: "r", action: "fix_on_network", href: null } })), ADMIN_CAN)!.action).toBeNull();
  });

  it("on says changes are sent, and never promises they are live", () => {
    const b = publishingBanner(entry(pub({ state: "on", heldReason: null })), ADMIN_CAN)!;
    expect(b.tone).toBe("good");
    expect(b.headline).toBe("Publishing to Testnet is on");
    expect(b.lines.join(" ")).not.toMatch(/live/i);
  });

  it("an editor is told an admin approves; an admin is not", () => {
    expect(publishingBanner(entry(pub()), EDITOR_CAN)!.lines.join(" ")).toMatch(/an admin or owner approves them/i);
    expect(publishingBanner(entry(pub({ state: "on", heldReason: null })), EDITOR_CAN)!.lines.join(" ")).toMatch(/An admin or owner approves them/);
    expect(publishingBanner(entry(pub()), ADMIN_CAN)!.lines.join(" ")).not.toMatch(/admin or owner/);
  });

  it("★while held, nobody is told they can do what their role cannot", () => {
    const editor = publishingBanner(entry(pub()), EDITOR_CAN)!.lines.join(" ");
    expect(editor).toMatch(/You can prepare changes now, and an admin or owner approves them/);
    expect(editor).not.toMatch(/prepare and approve/);
    const viewer = publishingBanner(entry(pub()), { propose: false, approve: false })!.lines.join(" ");
    expect(viewer).not.toMatch(/You can prepare/);
    expect(viewer).toMatch(/Changes your team prepares and approves now are kept/);
  });

  it("draws nothing for a network that writes nothing, or an api that predates the field", () => {
    expect(publishingBanner(entry(null), ADMIN_CAN)).toBeNull();
    expect(publishingBanner(entry(undefined), ADMIN_CAN)).toBeNull();
    expect(publishingBanner(null, ADMIN_CAN)).toBeNull();
  });

  it("blocked also says how long a prepared change keeps, since it still expires", () => {
    const b = publishingBanner(entry(pub({ state: "blocked", heldReason: null, blocker: { reason: "r", action: "reconnect", href: "/i" } })), ADMIN_CAN)!;
    expect(b.lines.join(" ")).toMatch(/Changes are sent once this is fixed\. A change that has not been sent 3 days after/);
  });

  it("★a viewer is told what is wrong but offered no button they cannot use", () => {
    const viewer = { propose: false, approve: false };
    expect(publishingBanner(entry(pub({ state: "blocked", blocker: { reason: "r", action: "reconnect", href: "/i" } })), viewer)!.action).toBeNull();
    expect(publishingBanner(entry(pub({ blocker: { reason: "r", action: "fix_on_network", href: "https://t.example" } })), viewer)!.action).toBeNull();
    expect(publishingBanner(entry(pub({ state: "blocked", blocker: { reason: "r", action: "reconnect", href: "/i" } })), EDITOR_CAN)!.action).not.toBeNull();
  });

  it("a new tab follows the link, not the action: an in-app fix stays in the app, an off-site reconnect opens a tab", () => {
    expect(publishingBanner(entry(pub({ state: "blocked", blocker: { reason: "r", action: "fix_on_network", href: "/dashboard/x" } })), ADMIN_CAN)!.action!.external).toBe(false);
    expect(publishingBanner(entry(pub({ state: "blocked", blocker: { reason: "r", action: "reconnect", href: "https://auth.example" } })), ADMIN_CAN)!.action!.external).toBe(true);
  });

  it("says a day or hours when the lifetime is not whole days", () => {
    expect(publishingBanner(entry(pub({ keptForHours: 1 })), ADMIN_CAN)!.lines.join(" ")).toMatch(/1 hour after/);
    expect(publishingBanner(entry(pub({ keptForHours: 48 })), ADMIN_CAN)!.lines.join(" ")).toMatch(/2 days after/);
    expect(publishingBanner(entry(pub({ keptForHours: 24 })), ADMIN_CAN)!.lines.join(" ")).toMatch(/1 day after/);
    expect(publishingBanner(entry(pub({ keptForHours: 36 })), ADMIN_CAN)!.lines.join(" ")).toMatch(/36 hours after/);
  });
});

describe("what a person reads after preparing a change", () => {
  it("while writes are held, says who checked it: the network checks it again when it is sent", () => {
    expect(preparedWords(0, cap())).toBe("Your change is prepared and checked against Testnet's rules. Testnet checks it again when it is sent. Review it below, then approve it.");
  });
  it("while writes are on, the network checked it", () => {
    expect(preparedWords(0, cap({ writes: { released: true, reason: null } }))).toBe("Your change is prepared and checked. Review it below, then approve it.");
  });
  it("the listing's publishing answer wins over the capabilities' cache, so it never disagrees with the status", () => {
    expect(preparedWords(0, cap(), { state: "on" })).toBe("Your change is prepared and checked. Review it below, then approve it.");
    expect(preparedWords(0, cap({ writes: { released: true, reason: null } }), { state: "held" })).toMatch(/checked against Testnet's rules/);
    expect(preparedWords(0, cap({ writes: { released: true, reason: null } }), { state: "blocked" })).toMatch(/^Your change is prepared and checked\./);
  });
  it("a change the network could not check says so, whatever the switch", () => {
    expect(preparedWords(1, cap())).toMatch(/could not check it just now/);
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
    expect(head("holiday_change")).toMatch(/holiday-hours change/);
    expect(head("read_failed")).toBe("Could not read this just now");
    expect(head("other_change")).toBe("Not tied to this one change");
    for (const r of ["after_unread", "not_connected", "no_location", "no_figures"]) expect(head(r), r).toBe("Cannot compare");
    for (const r of ["no_baseline", "too_few_days", "figures_missing"]) expect(head(r), r).toBe("Not enough figures to compare");
  });

  it("every state that is not a comparison draws its sentence and no list of figures", () => {
    for (const r of ["window_not_finished", "other_change", "holiday_change", "too_few_actions", "not_connected"]) {
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
    const heads = ["compared", "window_not_finished", "too_few_actions", "calendar_unknown", "holiday_change", "other_change", "no_baseline", "not_connected"].map((r) => outcomeWords(item(r))!.headline);
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
  const answer = (...ids: string[]) => ({ items: ids.map((id) => ({ id, outcome: { status: "measured", reason: "compared", message: "m", lines: [] } })) });
  const q = (over: Record<string, unknown> = {}) => ({ data: undefined, isError: false, isPlaceholderData: false, retry: () => undefined, ...over }) as never;

  it("a live change on a network that declares figures does; nothing else does", () => {
    expect(showsOutcome(ch("1", "live", "net_a"), caps)).toBe(true);
    expect(showsOutcome(ch("1", "submitted", "net_a"), caps)).toBe(false);
    expect(showsOutcome(ch("1", "live", "net_b"), caps)).toBe(false);
    // an older api that sends no flag, a network the capabilities do not list, and no capabilities yet
    expect(showsOutcome(ch("1", "live", "net_c"), caps)).toBe(false);
    expect(showsOutcome(ch("1", "live", "net_z"), caps)).toBe(false);
    expect(showsOutcome(ch("1", "live", "net_a"), undefined)).toBe(false);
  });

  it("the request is made only when some change in the list asks", () => {
    expect(wantsOutcomes([ch("a", "proposed", "net_a"), ch("b", "live", "net_a")], caps)).toBe(true);
    expect(wantsOutcomes([ch("a", "live", "net_b"), ch("b", "submitted", "net_a")], caps)).toBe(false);
    expect(wantsOutcomes(undefined, caps)).toBe(false);
  });

  it("the key moves when a change is sent, goes live, or leaves live, by whichever path, and not for changes that do not ask", () => {
    const sig = (...c: unknown[]) => outcomeSignature(c as never, caps);
    expect(sig(ch("b", "live", "net_a"), ch("a", "live", "net_a"))).toBe("a:live,b:live");
    // sent, then live: two keys
    expect(sig(ch("a", "submitted", "net_a"))).toBe("a:submitted");
    expect(sig(ch("a", "submitted", "net_a"))).not.toBe(sig(ch("a", "live", "net_a")));
    // a proposed or declined change, and a network with no figures, are not part of it
    expect(sig(ch("a", "live", "net_a"), ch("p", "proposed", "net_a"), ch("n", "live", "net_b"), ch("r", "rejected", "net_a"))).toBe("a:live");
    expect(sig()).toBe("");
    expect(presenceEditKeys.outcomes("l1", "a:live")).not.toEqual(presenceEditKeys.outcomes("l1", "a:live,b:live"));
    expect(presenceEditKeys.outcomes("l1", "a:live")).not.toEqual(presenceEditKeys.outcomes("l2", "a:live"));
  });

  it("a card draws its answer, a note when it is past the newest ten, a retry when the read failed, and nothing while it loads", () => {
    const live = ch("a", "live", "net_a");
    expect(outcomeSlot(live, caps, q({ data: answer("a") }))).toMatchObject({ kind: "answer", item: { id: "a" } });
    // the read succeeded and does not cover it: past the newest ten, which is not "no figures"
    expect(outcomeSlot(live, caps, q({ data: answer("z") }))).toEqual({ kind: "older" });
    expect(outcomeSlot(live, caps, q({ data: answer() }))).toEqual({ kind: "older" });
    // the last answer standing while the next is read does not make a newly live change "older"
    expect(outcomeSlot(live, caps, q({ data: answer("z"), isPlaceholderData: true }))).toEqual({ kind: "none" });
    expect(outcomeSlot(live, caps, q({ data: answer("a"), isPlaceholderData: true }))).toMatchObject({ kind: "answer" });
    // nothing yet
    expect(outcomeSlot(live, caps, q())).toEqual({ kind: "none" });
    // failed with nothing to show: a retry that is the query's
    let retried = 0;
    const failed = outcomeSlot(live, caps, q({ isError: true, retry: () => void retried++ }));
    expect(failed.kind).toBe("failed");
    if (failed.kind === "failed") failed.retry();
    expect(retried).toBe(1);
    // a refresh that failed after an answer keeps the answer
    expect(outcomeSlot(live, caps, q({ data: answer("a"), isError: true })).kind).toBe("answer");
  });

  it("a change that does not ask is never given a slot", () => {
    for (const c of [ch("a", "submitted", "net_a"), ch("b", "live", "net_b"), ch("c", "live", "net_c")]) {
      expect(outcomeSlot(c, caps, q({ data: answer("a", "b", "c") })).kind).toBe("none");
      expect(outcomeSlot(c, caps, q({ isError: true })).kind).toBe("none");
    }
  });

  it("the answer for one change is found in the single answer", () => {
    expect(outcomeFor(answer("a"), "a")!.id).toBe("a");
    expect(outcomeFor(answer("a"), "z")).toBeNull();
    expect(outcomeFor(undefined, "a")).toBeNull();
  });

  it("a settled answer is held a while and polls not at all; one that says check back, or nothing yet, only briefly and polls", () => {
    const one = (status: string) => ({ items: [{ id: "a", outcome: { status, reason: "x", message: "m", lines: [] } }] });
    expect(outcomesStaleTime(undefined)).toBe(0);
    expect(outcomesStaleTime(one("measured"))).toBe(30 * 60_000);
    expect(outcomesStaleTime(one("too_early"))).toBe(5 * 60_000);
    expect(outcomesStaleTime(one("none"))).toBe(5 * 60_000);
    expect(outcomesStaleTime({ items: [] })).toBe(30 * 60_000);
    expect(outcomesRefetchMs(one("too_early"))).toBe(5 * 60_000);
    expect(outcomesRefetchMs(one("measured"))).toBe(false);
    expect(outcomesRefetchMs(undefined)).toBe(false);
  });
});

describe("where a request stands (GBP L4)", () => {
  const A = { propose: true, approve: true };
  const E = { propose: true, approve: false };
  const V = { propose: false, approve: false };
  const at = (over: Partial<ChangeCardData>, can = A, publishing = null as Parameters<typeof requestStatus>[3]) => requestStatus(change(over), "Testnet", can, publishing);
  const check = (outcome: string, note: string | null = null) => ({ checkedAt: "2026-11-11T09:00:00.000Z", outcome, note });
  const BLOCKER = { reason: "Testnet cannot see that you control this listing.", action: "fix_on_network" as const, href: "https://example.test/fix" };

  it("names every stage of the table", () => {
    expect(at({ status: "proposed" })).toMatchObject({ stage: "draft", label: "Draft" });
    expect(at({ status: "validated" })).toMatchObject({ stage: "awaiting_approval", label: "Awaiting your approval" });
    expect(at({ status: "approved" })).toMatchObject({ stage: "approved_waiting", label: "Approved, waiting to send" });
    expect(at({ status: "approved", held: { reason: "Publishing has not started." } })).toMatchObject({ stage: "approved_held", label: "Approved, waiting to send", tone: "warn" });
    expect(at({ status: "applying" })).toMatchObject({ stage: "sent", label: "Sent to Testnet" });
    expect(at({ status: "submitted" })).toMatchObject({ stage: "sent", label: "Sent to Testnet" });
    expect(at({ status: "live" })).toMatchObject({ stage: "live", label: "Live on Testnet", reason: null, next: { kind: "none" } });
    expect(at({ status: "failed", reason: { code: "network_rejected", message: "Testnet refused it." } })).toMatchObject({ stage: "rejected_by_network", label: "Rejected by Testnet", reason: "Testnet refused it." });
    expect(at({ status: "failed", reason: { code: "not_published", message: "It may have been declined." } })).toMatchObject({ stage: "not_published", label: "Didn't go live" });
    expect(at({ status: "failed", reason: { code: "outcome_unknown", message: "No answer." } })).toMatchObject({ stage: "failed", label: "Failed", reason: "No answer." });
    expect(at({ status: "blocked", reason: { code: "control_lost", message: "No control." } })).toMatchObject({ stage: "failed", label: "Failed", reason: "No control." });
    expect(at({ status: "rejected" })).toMatchObject({ stage: "declined", label: "Declined by you" });
    expect(at({ status: "expired" })).toMatchObject({ stage: "expired", label: "Expired" });
    expect(at({ status: "superseded" })).toMatchObject({ stage: "replaced", label: "Replaced" });
  });

  it("keeps the merchant's decline apart from the network's rejection", () => {
    const declined = at({ status: "rejected" });
    const refused = at({ status: "failed", reason: { code: "network_rejected", message: "No." } });
    expect(declined.label).toBe("Declined by you");
    expect(refused.label).toBe("Rejected by Testnet");
    expect(declined.label).not.toBe(refused.label);
    // a failure with no reason code is neither
    expect(at({ status: "failed" }).label).toBe("Failed");
  });

  it("says under review only for a pending check, and nothing else", () => {
    expect(at({ status: "submitted", liveCheck: check("pending", "Testnet is still reviewing this change.") })).toMatchObject({ stage: "under_review", label: "Under Testnet review", reason: "Testnet is still reviewing this change." });
    for (const outcome of ["not_shown", "unknown", "live", "rejected", ""]) {
      expect(at({ status: "submitted", liveCheck: check(outcome) }).stage).not.toBe("under_review");
    }
    // time alone never makes it a review: an old submission with no check is only "sent"
    expect(at({ status: "submitted", submittedAt: "2026-10-01T00:00:00.000Z" }).stage).toBe("sent");
    // pending on any other status is not a review either
    expect(at({ status: "approved", liveCheck: check("pending") }).stage).not.toBe("under_review");
  });

  it("says plainly when the network does not let us confirm", () => {
    const r = at({ status: "submitted", liveCheck: check("unknown", "Testnet keeps the profile photo under one name.") });
    expect(r).toMatchObject({ stage: "cannot_confirm", label: "Sent, Testnet doesn't let us confirm this", reason: "Testnet keeps the profile photo under one name.", tone: "neutral" });
    expect(at({ status: "submitted", liveCheck: check("unknown") }).reason).toContain("Testnet");
  });

  it("warns when the network is not showing a sent change", () => {
    expect(at({ status: "submitted", liveCheck: check("not_shown") })).toMatchObject({ stage: "sent", tone: "warn", reason: "Testnet is not showing it yet." });
  });

  it("offers Approve and Decline only to someone who can approve", () => {
    expect(at({ status: "validated" }, A).next).toEqual({ kind: "decide" });
    expect(at({ status: "proposed" }, A).next).toEqual({ kind: "decide" });
    expect(at({ status: "validated" }, E).next).toEqual({ kind: "none" });
    expect(at({ status: "validated" }, E).reason).toContain("admin or owner");
    expect(at({ status: "validated" }, V).next).toEqual({ kind: "none" });
  });

  it("offers to make a failed, rejected or expired change again, and a viewer gets no action", () => {
    const redo = { kind: "redo", label: "Make the change again" };
    expect(at({ status: "expired" }, E).next).toEqual(redo);
    expect(at({ status: "failed", reason: { code: "network_rejected", message: "No." } }, A).next).toEqual(redo);
    expect(at({ status: "failed", reason: { code: "not_published", message: "No." } }, E).next).toEqual(redo);
    expect(at({ status: "failed" }, E).next).toEqual(redo);
    for (const status of ["expired", "failed", "blocked", "validated", "approved"] as ChangeStatus[]) {
      expect(at({ status, held: status === "approved" ? { reason: "Held." } : null }, V, { blocker: BLOCKER, heldReason: null }).next).toEqual({ kind: "none" });
    }
    // nothing to do for what the merchant chose, or for what is live or replaced
    for (const status of ["rejected", "live", "superseded", "submitted", "applying"] as ChangeStatus[]) expect(at({ status }, A).next).toEqual({ kind: "none" });
  });

  it("points a held or blocked request at the publishing status's own fix", () => {
    const p = { blocker: BLOCKER, heldReason: null };
    expect(at({ status: "blocked", reason: { code: "control_lost", message: "No control." } }, A, p).next).toEqual({ kind: "fix", label: "Fix this on Testnet", href: "https://example.test/fix", external: true });
    expect(at({ status: "approved", held: { reason: "Held." } }, E, p)).toMatchObject({ next: { kind: "fix", href: "https://example.test/fix" }, reason: expect.stringContaining(BLOCKER.reason) });
    const reconnect = { blocker: { reason: "The connection has lapsed.", action: "reconnect" as const, href: "/app/connections" }, heldReason: null };
    expect(at({ status: "blocked" }, A, reconnect).next).toEqual({ kind: "fix", label: "Reconnect Testnet", href: "/app/connections", external: false });
    // no blocker: a blocked request is made again, and a held one has nothing to press
    expect(at({ status: "blocked" }, A).next).toEqual({ kind: "redo", label: "Make the change again" });
    expect(at({ status: "approved", held: { reason: "Held." } }, A).next).toEqual({ kind: "none" });
  });

  it("falls back to the publishing status's own sentence when a held change has no reason of its own", () => {
    expect(at({ status: "approved", held: { reason: "" } }, A, { blocker: null, heldReason: "Peakhour is finishing its setup." }).reason).toContain("Peakhour is finishing its setup.");
  });

  it("never names a network in the words but the label it is given", () => {
    const r = requestStatus(change({ status: "submitted", liveCheck: check("pending") }), "Elsewhere", A);
    expect(r.label).toBe("Under Elsewhere review");
    expect(requestStatus(change({ status: "live" }), "Elsewhere", A).label).toBe("Live on Elsewhere");
  });

  it("makes the same words for statusWords as for requestStatus", () => {
    const c = change({ status: "failed", reason: { code: "network_rejected", message: "No." } });
    expect(statusWords(c, "Testnet", A)).toEqual({ headline: "Rejected by Testnet", detail: "No.", tone: "bad" });
  });
});

describe("the requests list (GBP L4)", () => {
  const NOW = Date.parse("2026-11-11T12:00:00.000Z");
  const DAY = 24 * 3_600_000;
  const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
  const row = (id: string, status: ChangeStatus, over: Partial<ChangeCardData> = {}) => change({ id, status, createdAt: ago(1), expiresAt: ago(-2), ...over });

  it("lists open and in-flight requests first, newest first", () => {
    const g = requestGroups(
      [row("a", "submitted", { createdAt: ago(3) }), row("b", "validated", { createdAt: ago(1) }), row("c", "approved", { createdAt: ago(2) }), row("d", "proposed", { createdAt: ago(0.5) }), row("e", "applying", { createdAt: ago(4) })],
      NOW,
    );
    expect(g.open.map((c) => c.id)).toEqual(["d", "b", "c", "a", "e"]);
    expect(g.recent).toEqual([]);
  });

  it("folds finished requests from the last seven days and drops older ones", () => {
    const g = requestGroups(
      [
        row("live6", "live", { liveAt: ago(6) }),
        row("live8", "live", { liveAt: ago(8), createdAt: ago(9) }),
        row("failed2", "failed", { submittedAt: ago(2) }),
        row("declined", "rejected", { createdAt: ago(1) }),
        row("declined-old", "rejected", { createdAt: ago(10) }),
        row("expired", "expired", { createdAt: ago(10), expiresAt: ago(2) }),
        row("expired-old", "expired", { createdAt: ago(12), expiresAt: ago(9) }),
      ],
      NOW,
    );
    expect(g.recent.map((c) => c.id)).toEqual(["declined", "failed2", "expired", "live6"]);
  });

  it("hides a replaced request, open or not", () => {
    const g = requestGroups([row("x", "superseded"), row("y", "validated")], NOW);
    expect(g.open.map((c) => c.id)).toEqual(["y"]);
    expect(g.recent).toEqual([]);
  });

  it("is empty before the changes have loaded", () => {
    expect(requestGroups(undefined, NOW)).toEqual({ open: [], recent: [] });
  });

  it("says a change as a short before and after", () => {
    expect(shortChange("description", "Old.", "New.")).toBe("Old. → New.");
    expect(shortChange("description", null, "New.")).toBe("nothing set → New.");
    const long = "x".repeat(100);
    expect(shortChange("description", "Old.", long).length).toBeLessThan(80);
    expect(shortChange("description", "Old.", long)).toContain("...");
  });
});
