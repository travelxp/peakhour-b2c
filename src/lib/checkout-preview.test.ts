import { describe, expect, it } from "vitest";
import { checkoutAction } from "./checkout-preview";

// A fixed formatter: the copy is under test, not the host's locale.
const fmt = (iso: string) => `<${iso.slice(0, 10)}>`;
const AGENCY = { name: "Agency", trialApplies: false, trialDays: 0 };
const TRIAL = { name: "Peakhour Suite", trialApplies: true, trialDays: 14 };

describe("checkoutAction (D21, P4.2)", () => {
  it("a switch with a deferred first charge says what is kept, and until when", () => {
    const a = checkoutAction(AGENCY, { kind: "switch", fromTier: "suite", fromName: "Peakhour Suite", startsAt: "2026-11-01T00:00:00.000Z" }, fmt);
    expect(a).toEqual({
      label: "Switch to Agency",
      note: "You keep Peakhour Suite until <2026-11-01>; Agency is billed from then, and you have it now.",
      refused: false,
    });
  });

  it("a switch with no deferral replaces the held plan now", () => {
    const a = checkoutAction(AGENCY, { kind: "switch", fromTier: "suite", fromName: "Peakhour Suite", startsAt: null }, fmt);
    expect(a.note).toBe("Agency replaces Peakhour Suite now.");
    expect(a.label).toBe("Switch to Agency");
  });

  it("a switch takes no trial: its copy wins over the plan's trial", () => {
    const a = checkoutAction(TRIAL, { kind: "switch", fromTier: "agency", fromName: "Agency", startsAt: null }, fmt);
    expect(a.label).toBe("Switch to Peakhour Suite");
  });

  it("a cancelled plan bought again is kept, from when it would have ended", () => {
    const a = checkoutAction(TRIAL, { kind: "resume", startsAt: "2026-11-01T00:00:00.000Z" }, fmt);
    expect(a).toEqual({
      label: "Keep Peakhour Suite",
      note: "Peakhour Suite carries on after <2026-11-01>, billed from then. Nothing to pay until then.",
      refused: false,
    });
    expect(checkoutAction(AGENCY, { kind: "resume", startsAt: null }, fmt).note).toBe("Agency carries on, billed from now.");
  });

  it("a refusal shows the server's message and blocks", () => {
    const a = checkoutAction(TRIAL, { kind: "refused", code: "CHANGE_UNAVAILABLE", message: "Changing plans isn't available with this payment method yet." }, fmt);
    expect(a).toEqual({ label: "Continue to payment", note: "Changing plans isn't available with this payment method yet.", refused: true });
  });

  it("a plain purchase keeps the trial copy, or none", () => {
    expect(checkoutAction(TRIAL, { kind: "new" }, fmt)).toMatchObject({ label: "Start 14-day free trial", refused: false });
    expect(checkoutAction(TRIAL, { kind: "new" }, fmt).note).toMatch(/charge nothing for 14 days/);
    expect(checkoutAction(AGENCY, { kind: "new" }, fmt)).toEqual({ label: "Continue to payment", note: null, refused: false });
  });

  it("no answer yet (loading or failed): the plan's own copy, never blocked", () => {
    expect(checkoutAction(TRIAL, null, fmt)).toMatchObject({ label: "Start 14-day free trial", refused: false });
    expect(checkoutAction(null, null, fmt)).toEqual({ label: "Continue to payment", note: null, refused: false });
  });
});
