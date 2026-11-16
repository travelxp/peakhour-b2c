import { describe, expect, it } from "vitest";
import { canChangeCategory, categoryChangeWords, categoryLabel } from "./business-category";

const OPTIONS = [
  { value: "hospitality_travel", label: "Hospitality & Travel" },
  { value: "other", label: "Other" },
];

describe("canChangeCategory mirrors the api: owner or admin", () => {
  it.each([["owner"], ["admin"]])("PASS: %s", (role) => expect(canChangeCategory(role)).toBe(true));
  it.each([["editor"], ["viewer"], ["support"], [""], [undefined], [null]])("FAIL: %s", (role) => expect(canChangeCategory(role as string | undefined)).toBe(false));
});

describe("categoryLabel", () => {
  it("uses the api's label", () => expect(categoryLabel("hospitality_travel", OPTIONS)).toBe("Hospitality & Travel"));
  it("reads an unlisted value as words, never the raw key", () => expect(categoryLabel("pet_grooming", OPTIONS)).toBe("pet grooming"));
  it("is null for none", () => {
    expect(categoryLabel(undefined, OPTIONS)).toBeNull();
    expect(categoryLabel("", OPTIONS)).toBeNull();
  });
});

describe("categoryChangeWords says what happened to the plan", () => {
  it("a plan move that was proposed says a link and code were sent and nothing changes until confirmed", () => {
    const w = categoryChangeWords({ changed: true, plan: { status: "proposed", decisionId: "d1" } });
    expect(w.tone).toBe("ok");
    expect(w.text).toMatch(/link and code/);
    expect(w.text).toMatch(/nothing changes until you confirm/);
  });
  it("a move that could not be proposed is a warning that keeps the api's own reason, after the save", () => {
    const w = categoryChangeWords({ changed: true, plan: { status: "not_proposed", code: "NO_VERIFIED_CONTACT", message: "Verify your WhatsApp number in Settings first." } });
    expect(w.tone).toBe("warn");
    expect(w.text).toBe("Saved. Verify your WhatsApp number in Settings first.");
  });
  it("no plan: the next first run reads it", () => {
    expect(categoryChangeWords({ changed: true, plan: { status: "none", why: "no_plan" } }).text).toMatch(/drafts your plan/);
  });
  it("the same playbook: the plan stays", () => {
    expect(categoryChangeWords({ changed: true, plan: { status: "none", why: "same_playbook" } }).text).toMatch(/stays as it is/);
  });
  it("nothing changed", () => {
    expect(categoryChangeWords({ changed: false, plan: { status: "none", why: "unchanged" } }).text).toBe("That is already your category.");
  });
  it("★no retired word reaches the merchant", () => {
    for (const plan of [{ status: "proposed", decisionId: "d" }, { status: "none", why: "no_plan" }, { status: "none", why: "same_playbook" }] as const) {
      expect(categoryChangeWords({ changed: true, plan }).text).not.toMatch(/mandate|intent|council|strategist|critic|chair/i);
    }
  });
});
