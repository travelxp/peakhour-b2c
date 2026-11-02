import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { DraftOffer, GuardrailsPatch, MandateView, RulesPatchBody, RulesPatchResponse, RulesResponse } from "@/lib/api/growth-v2";
import { FIXTURE_RULES } from "@/lib/growth-v2-fixtures";

/**
 * H5: Rules. A switch sends the one key it changes, a mandate edit sends only what changed, and the screen follows what the
 * api answered.
 *
 * ★WHAT ONLY THESE TESTS CAN GET WRONG: that a switch round trip leaves every rule it did not touch alone; that the last channel
 * cannot be switched off from here (that is the halt switch's job); that a mandate edit names only changed fields and never an
 * autonomy level; and that a rejected edit says the api's own words for the codes written for the merchant.
 */

const h = vi.hoisted(() => ({ patch: vi.fn<(path: string, body?: unknown) => Promise<unknown>>() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, patch: h.patch } };
});

const { growthV2Api } = await import("@/lib/api/growth-v2");
const { DEFAULT_QUIET_HOURS, channelAllowed, editAfterOutcome, editFrom, guardrailPatchFor, mandatePatchFor, patchErrorMessage } = await import("./growth-v2-rules");

const g0 = FIXTURE_RULES.guardrails;
const m0: MandateView = FIXTURE_RULES.mandate!; // bookings from orders, count, INR 20,000, cost per outcome 450

/** The api's own merge, restated: a key left out keeps what is stored; null, [] or false clears it. */
function serverMerge(g: RulesResponse["guardrails"], p: GuardrailsPatch): RulesResponse["guardrails"] {
  return {
    ...g,
    ...(p.deniedChannels !== undefined ? { deniedChannels: p.deniedChannels, ...(p.deniedChannels.length > 0 ? { allowedChannels: null } : {}) } : {}),
    ...(p.allowedChannels !== undefined ? { allowedChannels: p.allowedChannels, ...(p.allowedChannels ? { deniedChannels: [] } : {}) } : {}),
    ...(p.approvedAssetsOnly !== undefined ? { approvedAssetsOnly: p.approvedAssetsOnly } : {}),
    ...(p.blockedTerms !== undefined ? { blockedTerms: p.blockedTerms } : {}),
    ...(p.quietHours !== undefined ? { quietHours: p.quietHours } : {}),
  };
}

beforeEach(() => {
  h.patch.mockReset();
});

describe("a guardrail switch round trip", () => {
  it("sends the one key the switch changes to PATCH /rules, and the answer is the rules as they stand", async () => {
    let stored = g0;
    h.patch.mockImplementation(async (_path, body) => ({ ...FIXTURE_RULES, guardrails: (stored = serverMerge(stored, (body as { guardrails: GuardrailsPatch }).guardrails)) }) satisfies RulesPatchResponse);

    // approved assets: on -> off -> on, each answer drives the next request
    const off = guardrailPatchFor(stored, { kind: "approved_assets", on: !stored.approvedAssetsOnly });
    expect("patch" in off && off.patch).toEqual({ approvedAssetsOnly: false });
    const afterOff = await growthV2Api.patchRules({ guardrails: (off as { patch: GuardrailsPatch }).patch });
    expect(h.patch).toHaveBeenCalledWith("/v1/growth/v2/rules", { guardrails: { approvedAssetsOnly: false } });
    expect(afterOff.guardrails.approvedAssetsOnly).toBe(false);
    // the rules it did not name are as they were
    expect(afterOff.guardrails.blockedTerms).toEqual(g0.blockedTerms);
    expect(afterOff.guardrails.quietHours).toEqual(g0.quietHours);
    expect(afterOff.guardrails.allowedChannels).toEqual(g0.allowedChannels);

    const on = guardrailPatchFor(afterOff.guardrails, { kind: "approved_assets", on: true });
    const afterOn = await growthV2Api.patchRules({ guardrails: (on as { patch: GuardrailsPatch }).patch });
    expect(afterOn.guardrails.approvedAssetsOnly).toBe(true);
    expect(h.patch).toHaveBeenCalledTimes(2);
  });

  it("quiet hours: off sends null; on sends the stored window, or the default when there is none", () => {
    expect(guardrailPatchFor(g0, { kind: "quiet_hours", value: null })).toEqual({ patch: { quietHours: null } });
    expect(guardrailPatchFor(g0, { kind: "quiet_hours", value: { start: "23:00", end: "06:30" } })).toEqual({ patch: { quietHours: { start: "23:00", end: "06:30" } } });
    expect(DEFAULT_QUIET_HOURS).toEqual({ start: "22:00", end: "07:00" });
  });

  it("refuses an unreadable or empty quiet window before it is sent", () => {
    expect(guardrailPatchFor(g0, { kind: "quiet_hours", value: { start: "25:00", end: "06:00" } })).toHaveProperty("error");
    expect(guardrailPatchFor(g0, { kind: "quiet_hours", value: { start: "09:00", end: "09:00" } })).toHaveProperty("error");
  });

  it("blocked words are sent whole, because the api stores the list whole", () => {
    expect(guardrailPatchFor(g0, { kind: "blocked_terms", terms: [...g0.blockedTerms, "free"] })).toEqual({ patch: { blockedTerms: ["cheapest", "guaranteed", "TrekIndia", "free"] } });
    expect(guardrailPatchFor(g0, { kind: "blocked_terms", terms: [] })).toEqual({ patch: { blockedTerms: [] } });
  });
});

describe("channel switches", () => {
  const withAllow = { ...g0, allowedChannels: ["meta", "google_ads"] as RulesResponse["guardrails"]["allowedChannels"], deniedChannels: [] };
  const withDeny = { ...g0, allowedChannels: null, deniedChannels: ["x"] };

  it("read the allow list when there is one, else the deny list", () => {
    expect(channelAllowed(withAllow, "meta")).toBe(true);
    expect(channelAllowed(withAllow, "x")).toBe(false);
    expect(channelAllowed(withDeny, "x")).toBe(false);
    expect(channelAllowed(withDeny, "meta")).toBe(true);
  });

  it("with an allow list, a switch edits that list", () => {
    expect(guardrailPatchFor(withAllow, { kind: "channel", platform: "google_ads", allowed: false })).toEqual({ patch: { allowedChannels: ["meta"] } });
    expect(guardrailPatchFor(withAllow, { kind: "channel", platform: "x", allowed: true })).toEqual({ patch: { allowedChannels: ["meta", "google_ads", "x"] } });
  });

  it("with a deny list, a switch edits that list", () => {
    expect(guardrailPatchFor(withDeny, { kind: "channel", platform: "linkedin", allowed: false })).toEqual({ patch: { deniedChannels: ["x", "linkedin"] } });
    expect(guardrailPatchFor(withDeny, { kind: "channel", platform: "x", allowed: true })).toEqual({ patch: { deniedChannels: [] } });
  });

  it("the last allowed channel cannot be switched off here: stopping everything is the halt switch", () => {
    const only = { ...withAllow, allowedChannels: ["meta"] as RulesResponse["guardrails"]["allowedChannels"] };
    const r = guardrailPatchFor(only, { kind: "channel", platform: "meta", allowed: false });
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).toMatch(/halt/);
  });
});

describe("a mandate edit", () => {
  const COUNT_OFFER: DraftOffer = { kind: "bookings", source: "orders", optimizeFor: "count", label: "Bookings", focusSuggestions: [{ by: "product_type", values: ["Flight"], label: "Flights", source: "playbook", revenue: 900000 }], targetSource: "merchant" };
  const VALUE_OFFER: DraftOffer = { kind: "sales", source: "orders", optimizeFor: "value", label: "Sales", focusSuggestions: [], defaultTarget: { kind: "roas", value: 2.5, low: 1, high: 5 }, targetSource: "playbook" };
  const LEADS: DraftOffer = { kind: "leads", source: "win_definition", optimizeFor: "count", label: "Leads", focusSuggestions: [], targetSource: "merchant" };
  const offers = [COUNT_OFFER, VALUE_OFFER, LEADS];
  const edit = (over: Partial<ReturnType<typeof editFrom>> = {}) => ({ ...editFrom(m0), ...over });

  it("starts from what the mandate says, and sending it unchanged is nothing to send", () => {
    expect(editFrom(m0)).toEqual({ offer: "bookings:orders", focus: "", ceiling: "20000", target: "450" });
    expect(mandatePatchFor(m0, edit(), offers)).toBeUndefined();
  });

  it("names only the fields that changed", () => {
    expect(mandatePatchFor(m0, edit({ ceiling: "35,000" }), offers)).toEqual({ monthlyCeiling: 35000 });
    expect(mandatePatchFor(m0, edit({ target: "400" }), offers)).toEqual({ target: { kind: "cost_per_outcome", value: 400 } });
    expect(mandatePatchFor(m0, edit({ ceiling: "35000", target: "400" }), offers)).toEqual({ monthlyCeiling: 35000, target: { kind: "cost_per_outcome", value: 400 } });
  });

  it("never names autonomy, approvers or confirmation", () => {
    const p = mandatePatchFor(m0, edit({ ceiling: "35000", target: "400", focus: "Flights" }), offers) as Record<string, unknown>;
    expect(Object.keys(p).every((k) => ["outcome", "monthlyCeiling", "target"].includes(k))).toBe(true);
  });

  it("a new focus is an outcome change that carries the focus the api suggested", () => {
    expect(mandatePatchFor(m0, edit({ focus: "Flights" }), offers)).toEqual({
      outcome: { kind: "bookings", source: "orders", optimizeFor: "count", focus: { by: "product_type", values: ["Flight"], label: "Flights" } },
    });
  });

  it("an outcome measured the other way takes its target's kind from the outcome; the form clears the box, so a retyped number is the merchant's own", () => {
    const cleared = editAfterOutcome(m0, edit(), "sales:orders", offers);
    expect(cleared).toMatchObject({ offer: "sales:orders", focus: "", target: "" });
    // an empty box with the kind flipped is "the playbook's default, or tell me": the api answers which
    expect(mandatePatchFor(m0, cleared, offers)).toEqual({ outcome: { kind: "sales", source: "orders", optimizeFor: "value" } });
    expect(mandatePatchFor(m0, { ...cleared, target: "3" }, offers)).toEqual({
      outcome: { kind: "sales", source: "orders", optimizeFor: "value" },
      target: { kind: "roas", value: 3 },
    });
    // ...and the old number retyped on purpose is a return of 450x, not an error: it is the merchant's call
    expect(mandatePatchFor(m0, { ...cleared, target: "450" }, offers)).toEqual({
      outcome: { kind: "sales", source: "orders", optimizeFor: "value" },
      target: { kind: "roas", value: 450 },
    });
  });

  it("an empty target with no change of measure has nothing to fall back on", () => {
    expect(mandatePatchFor(m0, edit({ target: "" }), offers)).toHaveProperty("error");
    expect(mandatePatchFor(m0, edit({ offer: "leads:win_definition", target: "" }), offers)).toHaveProperty("error");
  });

  it("choosing the saved outcome again brings back its saved focus and target", () => {
    const withFocus: MandateView = { ...m0, outcome: { ...m0.outcome, focus: { by: "product_type", values: ["Hotels"], label: "Hotels" } } };
    const away = editAfterOutcome(withFocus, editFrom(withFocus), "sales:orders", offers);
    expect(away).toMatchObject({ focus: "", target: "" });
    expect(editAfterOutcome(withFocus, away, "bookings:orders", offers)).toMatchObject({ focus: "Hotels", target: "450" });
  });

  it("an outcome of the same kind of measure keeps the target unless it is retyped", () => {
    expect(mandatePatchFor(m0, edit({ offer: "leads:win_definition" }), offers)).toEqual({ outcome: { kind: "leads", source: "win_definition", optimizeFor: "count" } });
  });

  it("★a saved focus that this week's suggestions no longer rank is not a change, so a ceiling-only edit leaves the outcome alone", () => {
    const shoes: MandateView = { ...m0, outcome: { ...m0.outcome, focus: { by: "product_type", values: ["Shoes"], label: "Shoes" } } };
    expect(mandatePatchFor(shoes, { ...editFrom(shoes), ceiling: "35000" }, offers)).toEqual({ monthlyCeiling: 35000 });
    // and the offers not having loaded at all does not stop a ceiling edit either
    expect(mandatePatchFor(shoes, { ...editFrom(shoes), ceiling: "35000" }, [])).toEqual({ monthlyCeiling: 35000 });
    // asking for Everything is a change, and says so by sending an outcome with no focus
    expect(mandatePatchFor(shoes, { ...editFrom(shoes), focus: "" }, offers)).toEqual({ outcome: { kind: "bookings", source: "orders", optimizeFor: "count" } });
    // a focus that is neither saved nor suggested cannot be sent
    expect(mandatePatchFor(shoes, { ...editFrom(shoes), focus: "Boots" }, offers)).toHaveProperty("error");
  });

  it("refuses an unreadable ceiling or target, and an outcome the business is not offered", () => {
    expect(mandatePatchFor(m0, edit({ ceiling: "" }), offers)).toHaveProperty("error");
    expect(mandatePatchFor(m0, edit({ ceiling: "0" }), offers)).toHaveProperty("error");
    expect(mandatePatchFor(m0, edit({ target: "abc" }), offers)).toHaveProperty("error");
    expect(mandatePatchFor(m0, edit({ offer: "store_visits:ads_conversions" }), offers)).toHaveProperty("error");
  });

  it("goes to PATCH /rules as a mandate edit alone", async () => {
    h.patch.mockResolvedValue({ ...FIXTURE_RULES, mandateChange: { decisionId: "d1", linkSent: true, via: "signed_link_otp" } } satisfies RulesPatchResponse);
    const body: RulesPatchBody = { mandate: { monthlyCeiling: 35000 } };
    const r = await growthV2Api.patchRules(body);
    expect(h.patch).toHaveBeenCalledWith("/v1/growth/v2/rules", { mandate: { monthlyCeiling: 35000 } });
    // the screen shows "sent for confirmation" from this, and the mandate it renders is still the old one
    expect(r.mandateChange).toEqual({ decisionId: "d1", linkSent: true, via: "signed_link_otp" });
    expect(r.mandate?.monthlyCeiling).toBe(m0.monthlyCeiling);
  });
});

describe("a refused edit", () => {
  it("shows the api's own sentence for the codes it writes for the merchant", () => {
    expect(patchErrorMessage(new ApiError("NO_CHANGE", "That is what the plan already says.", 409))).toBe("That is what the plan already says.");
    expect(patchErrorMessage(new ApiError("TARGET_NEEDED", "This outcome is measured differently.", 422))).toBe("This outcome is measured differently.");
    expect(patchErrorMessage(new ApiError("VALIDATION_ERROR", "Keep at least one channel on.", 400))).toBe("Keep at least one channel on.");
  });
  it("says something plain, never a raw message, for anything else", () => {
    expect(patchErrorMessage(new ApiError("RULES_ERROR", "mongo exploded at host 10.0.0.4", 500))).not.toMatch(/mongo/);
    expect(patchErrorMessage(new ApiError("VALIDATION_ERROR", "Invalid body", 400))).not.toBe("Invalid body");
    expect(patchErrorMessage(new TypeError("Failed to fetch"))).toMatch(/Try again/);
  });
});
