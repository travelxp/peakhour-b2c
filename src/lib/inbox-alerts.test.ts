import { describe, it, expect } from "vitest";
import { INBOX_ALERTS, alertIsOn, alertSwitches, alertsPatch, canSeeInboxAlerts } from "@/lib/inbox-alerts";

describe("the inbox alert switches", () => {
  it("absent means ON: a person nobody migrated has all three", () => {
    expect(alertSwitches(null)).toEqual({ needsHuman: true, newLead: true, badReview: true });
    expect(alertSwitches(undefined)).toEqual({ needsHuman: true, newLead: true, badReview: true });
    expect(alertSwitches({})).toEqual({ needsHuman: true, newLead: true, badReview: true });
  });
  it("only an explicit false is off", () => {
    expect(alertIsOn({ newLead: false }, "newLead")).toBe(false);
    expect(alertIsOn({ newLead: false }, "badReview")).toBe(true);
    expect(alertIsOn({ newLead: true }, "newLead")).toBe(true);
  });
  it("saving one switch sends ALL THREE, so the others keep their state (the api replaces the object)", () => {
    expect(alertsPatch({ needsHuman: false }, "newLead", false)).toEqual({ needsHuman: false, newLead: false, badReview: true });
    expect(alertsPatch(null, "badReview", false)).toEqual({ needsHuman: true, newLead: true, badReview: false });
  });
  it("PASS: turning one back on", () => {
    expect(alertsPatch({ needsHuman: false, newLead: false }, "needsHuman", true)).toEqual({ needsHuman: true, newLead: false, badReview: true });
  });
  it("only owners and admins see them: they are the only recipients", () => {
    expect(canSeeInboxAlerts("owner")).toBe(true);
    expect(canSeeInboxAlerts("admin")).toBe(true);
    for (const r of ["editor", "viewer", null, undefined, ""]) expect(canSeeInboxAlerts(r), String(r)).toBe(false);
  });
  it("the three rows are the three keys the api and the collection hold", () => {
    expect(INBOX_ALERTS.map((a) => a.key).sort()).toEqual(["badReview", "needsHuman", "newLead"]);
  });
  it("the copy names no retired product and promises nothing it cannot keep", () => {
    const text = JSON.stringify(INBOX_ALERTS);
    expect(text).not.toMatch(/Peaks|Lens|Growth Council|always|never/i);
  });
});
