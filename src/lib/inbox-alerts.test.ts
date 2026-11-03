import { describe, it, expect } from "vitest";
import { INBOX_ALERTS, alertIsOn, alertSwitches, alertsForRole, alertsPatch, canSeeAssignedAlert, canSeeInboxAlerts } from "@/lib/inbox-alerts";

describe("the inbox alert switches", () => {
  it("absent means ON: a person nobody migrated has all four", () => {
    expect(alertSwitches(null)).toEqual({ needsHuman: true, newLead: true, badReview: true, assigned: true });
    expect(alertSwitches(undefined)).toEqual({ needsHuman: true, newLead: true, badReview: true, assigned: true });
    expect(alertSwitches({})).toEqual({ needsHuman: true, newLead: true, badReview: true, assigned: true });
  });
  it("only an explicit false is off", () => {
    expect(alertIsOn({ newLead: false }, "newLead")).toBe(false);
    expect(alertIsOn({ newLead: false }, "badReview")).toBe(true);
    expect(alertIsOn({ newLead: true }, "newLead")).toBe(true);
  });
  it("saving one switch sends ALL FOUR, so the others keep their state (the api replaces the object)", () => {
    expect(alertsPatch({ needsHuman: false }, "newLead", false)).toEqual({ needsHuman: false, newLead: false, badReview: true, assigned: true });
    expect(alertsPatch(null, "badReview", false)).toEqual({ needsHuman: true, newLead: true, badReview: false, assigned: true });
    expect(alertsPatch({ newLead: false }, "assigned", false)).toEqual({ needsHuman: true, newLead: false, badReview: true, assigned: false });
  });
  it("PASS: turning one back on", () => {
    expect(alertsPatch({ needsHuman: false, newLead: false }, "needsHuman", true)).toEqual({ needsHuman: true, newLead: false, badReview: true, assigned: true });
    expect(alertsPatch({ assigned: false }, "assigned", true)).toEqual({ needsHuman: true, newLead: true, badReview: true, assigned: true });
  });
  it("only owners and admins see them: they are the only recipients", () => {
    expect(canSeeInboxAlerts("owner")).toBe(true);
    expect(canSeeInboxAlerts("admin")).toBe(true);
    for (const r of ["editor", "viewer", null, undefined, ""]) expect(canSeeInboxAlerts(r), String(r)).toBe(false);
  });
  it("the four rows are the four keys the api and the collection hold", () => {
    expect(INBOX_ALERTS.map((a) => a.key).sort()).toEqual(["assigned", "badReview", "needsHuman", "newLead"]);
  });
  it("'A conversation is assigned to me' is for every editor and above; the other three stay with owners and admins", () => {
    const keys = (role: string | null) => alertsForRole(role).map((a) => a.key).sort();
    expect(keys("owner")).toEqual(["assigned", "badReview", "needsHuman", "newLead"]);
    expect(keys("admin")).toEqual(["assigned", "badReview", "needsHuman", "newLead"]);
    expect(keys("editor")).toEqual(["assigned"]);
    expect(keys("viewer")).toEqual([]);
    expect(keys(null)).toEqual([]);
    expect(canSeeAssignedAlert("editor")).toBe(true);
    expect(canSeeAssignedAlert("viewer")).toBe(false);
    expect(INBOX_ALERTS.find((a) => a.key === "assigned")!.label).toBe("A conversation is assigned to me");
  });
  it("the copy names no retired product and promises nothing it cannot keep", () => {
    const text = JSON.stringify(INBOX_ALERTS);
    expect(text).not.toMatch(/Peaks|Lens|Growth Council|always|never/i);
  });
});
