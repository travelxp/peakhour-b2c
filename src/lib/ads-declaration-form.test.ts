import { describe, it, expect } from "vitest";
import {
  buildDeclarationPatch,
  effectiveAnswer,
  formHeading,
  formMode,
  formSubmitLabel,
  saveErrorMessage,
} from "./ads-declaration-form";
import type { DeclarationState } from "./ads-copy";

const base = {
  declare: true,
  answerInForce: "NOT_POLITICAL" as const,
  categoryOptionCount: 5,
  selectedCategories: [] as string[],
  countries: [] as string[],
};

describe("buildDeclarationPatch", () => {
  it("withdraws with a bare null", () => {
    expect(buildDeclarationPatch({ ...base, declare: false })).toEqual({ politicalIntent: null });
  });

  it("sends an empty category list when the question was shown ([] is an answer)", () => {
    expect(buildDeclarationPatch(base)).toEqual({
      politicalIntent: "NOT_POLITICAL",
      specialAdCategories: [],
    });
  });

  it("omits categories when the api served no options", () => {
    const patch = buildDeclarationPatch({ ...base, categoryOptionCount: 0 });
    expect(patch).toEqual({ politicalIntent: "NOT_POLITICAL" });
    expect("specialAdCategories" in patch).toBe(false);
  });

  it("sends countries only for POLITICAL", () => {
    expect(
      buildDeclarationPatch({ ...base, answerInForce: "POLITICAL", countries: ["GB", "IE"] }),
    ).toEqual({
      politicalIntent: "POLITICAL",
      specialAdCategories: [],
      specialAdCategoryCountries: ["GB", "IE"],
    });
  });

  it("never sends a country list from a hidden field on NOT_POLITICAL", () => {
    const patch = buildDeclarationPatch({ ...base, countries: ["FR"] });
    expect("specialAdCategoryCountries" in patch).toBe(false);
  });

  it("never sends an empty country list, even for POLITICAL", () => {
    const patch = buildDeclarationPatch({ ...base, answerInForce: "POLITICAL", countries: [] });
    expect("specialAdCategoryCountries" in patch).toBe(false);
  });

  it("treats no answer as NOT_POLITICAL, as the card always has", () => {
    expect(buildDeclarationPatch({ ...base, answerInForce: null }).politicalIntent).toBe(
      "NOT_POLITICAL",
    );
  });

  it("passes the selected categories through", () => {
    expect(
      buildDeclarationPatch({ ...base, selectedCategories: ["HOUSING", "CREDIT"] })
        .specialAdCategories,
    ).toEqual(["HOUSING", "CREDIT"]);
  });
});

describe("effectiveAnswer", () => {
  it("defaults an unchosen answer to NOT_POLITICAL and keeps a chosen one", () => {
    expect(effectiveAnswer(null)).toBe("NOT_POLITICAL");
    expect(effectiveAnswer("POLITICAL")).toBe("POLITICAL");
    expect(effectiveAnswer("NOT_POLITICAL")).toBe("NOT_POLITICAL");
  });
});

describe("saveErrorMessage", () => {
  it("names the standing political declaration", () => {
    expect(saveErrorMessage("DECLARATION_STANDING")).toContain("withdraw it first");
  });
  it("says nothing was erased for an incomplete declaration, with no remedy to retry", () => {
    const m = saveErrorMessage("DECLARATION_INCOMPLETE");
    expect(m).toContain("Nothing was changed");
    expect(m).not.toMatch(/try again|reload/i);
  });
  it("falls back to the generic message", () => {
    expect(saveErrorMessage(undefined)).toMatch(/^Couldn't save your declaration\./);
    expect(saveErrorMessage("SOMETHING_ELSE")).toBe(saveErrorMessage(undefined));
  });
});

const political = (superseded: boolean): DeclarationState => ({
  kind: "political",
  declaredAt: "2026-01-01T00:00:00Z",
  superseded,
});
const undeclared: DeclarationState = { kind: "undeclared" };
const superseded: DeclarationState = { kind: "superseded", declaredAt: "2026-01-01T00:00:00Z" };
const unknownRead: DeclarationState = { kind: "unknown", reason: "read_failed" };
const unknownNotice: DeclarationState = { kind: "unknown", reason: "unsupported_notice" };
const declared: DeclarationState = { kind: "declared", declaredAt: "2026-01-01T00:00:00Z" };

describe("formMode / formHeading / formSubmitLabel", () => {
  const cases: Array<[string, DeclarationState, boolean, boolean, string, string, string]> = [
    ["undeclared", undeclared, false, false, "first_declaration", "Advertising declaration", "Save declaration"],
    ["superseded", superseded, false, false, "superseded", "Please confirm the current wording", "Confirm"],
    ["unknown read_failed", unknownRead, false, false, "read_failed", "We couldn't check your advertising declaration", "Save declaration"],
    ["unknown unsupported_notice", unknownNotice, false, false, "unsupported_notice", "This notice has changed", "Save declaration"],
    ["amending", declared, false, true, "answer_categories", "Answer the Meta category question", "Save"],
    ["reconfirm superseded political", political(true), true, false, "reconfirm_wording", "Please confirm the current wording", "Confirm"],
    ["reconfirm standing political", political(false), true, false, "answer_categories", "Answer the Meta category question", "Save"],
  ];
  it.each(cases)("%s", (_n, state, reconfirmingPolitical, amending, mode, heading, label) => {
    const m = formMode({ state, reconfirmingPolitical, amending });
    expect(m).toBe(mode);
    expect(formHeading(m)).toBe(heading);
    expect(formSubmitLabel(m)).toBe(label);
  });

  it("a re-confirm outranks amending", () => {
    expect(formMode({ state: political(true), reconfirmingPolitical: true, amending: true })).toBe(
      "reconfirm_wording",
    );
  });
});
