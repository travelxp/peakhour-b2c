import { describe, expect, it } from "vitest";

import {
  addLanguageProblem,
  groupByName,
  heldLanguages,
  mostRecentVariant,
  normaliseLanguage,
  unanimousStatus,
  updatedAtMs,
  type StudioTemplate,
} from "./template-groups";

/**
 * §3.5's variant flow — the Studio's language grouping.
 *
 * ★THE CASES THAT MATTER ARE THE ONES ABOUT NOT COLLAPSING A PER-LANGUAGE FACT
 * INTO A PER-TEMPLATE ONE, which is the same mistake ✅3.4a's CMS matrix exists
 * to prevent on the platform plane.
 */

function tpl(over: Partial<StudioTemplate> = {}): StudioTemplate {
  return {
    _id: Math.random().toString(16).slice(2),
    name: "order_update",
    language: "en",
    category: "UTILITY",
    status: "approved",
    ...over,
  };
}

describe("normaliseLanguage — the comparison folds, the stored value does not", () => {
  it("★★`en-US` and `en_US` are ONE locale, because the api says so", () => {
    // ⚠️★TRANSCRIBED FROM `template-studio.ts`, which normalises before checking
    //  for a duplicate: "en_US and en-US are ONE template to Meta". A surface
    //  comparing raw strings would offer a language the api answers 409 to.
    expect(normaliseLanguage("en-US")).toBe(normaliseLanguage("en_US"));
    expect(normaliseLanguage("EN")).toBe("en");
  });

  it("⚠️★★★an absent language folds to `en`, BECAUSE THAT IS WHAT THE API DOES", () => {
    // ⚠️🚫★★A ROUND FOUND THIS DIVERGING. The api's fold is
    //  `String(language || "en")…`, so a row with no language is **English to
    //  the SAVE**. 🚫A first version folded it to `""` and argued that defaulting
    //  "would invent a locale" — the wrong argument for a function whose whole
    //  job is to predict the api's duplicate answer. It let the UI offer
    //  "add en" on a group the api then refused with **409 DUPLICATE**, after
    //  the merchant had written a body.
    expect(normaliseLanguage(undefined)).toBe("en");
    expect(normaliseLanguage("")).toBe("en");
  });

  it("⚠★AND IT DOES NOT TRIM, because the api does not either", () => {
    // ★The trim belongs to the CALLER — it is what the SEND does, so it happens
    //  before the fold rather than inside it.
    expect(normaliseLanguage(" en")).toBe(" en");
  });
});

describe("groupByName — the flow the row says is missing", () => {
  it("★★two languages of one template are ONE group, not two rows", () => {
    const groups = groupByName([
      tpl({ language: "en" }),
      tpl({ language: "hi" }),
      tpl({ name: "cart_reminder", language: "en" }),
    ]);
    expect(groups.map((g) => g.name).sort()).toEqual(["cart_reminder", "order_update"]);
    expect(groups.find((g) => g.name === "order_update")?.variants).toHaveLength(2);
  });

  it("★★names are matched EXACTLY, because Meta keys by them", () => {
    // 🚫Folding the NAME the way the language is folded would merge two
    //  templates a merchant deliberately made distinct.
    const groups = groupByName([tpl({ name: "order_update" }), tpl({ name: "Order_Update" })]);
    expect(groups).toHaveLength(2);
  });

  it("★the group with the most recent change comes first", () => {
    const groups = groupByName([
      tpl({ name: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
      tpl({ name: "new", updatedAt: "2026-09-01T00:00:00.000Z" }),
    ]);
    expect(groups[0]?.name).toBe("new");
  });

  it("⚠️★a group with NO date sorts last — an absent date is not a recent one", () => {
    const groups = groupByName([
      tpl({ name: "undated" }),
      tpl({ name: "dated", updatedAt: "2026-01-01T00:00:00.000Z" }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["dated", "undated"]);
  });

  it("⚠️★★two undated groups keep a STABLE order rather than an engine-defined one", () => {
    // ⚠️★`-Infinity - -Infinity` is `NaN`, and a comparator returning NaN leaves
    //  the order up to the engine — a list that reshuffles under a merchant's
    //  cursor between two identical renders.
    const first = groupByName([tpl({ name: "b" }), tpl({ name: "a" })]).map((g) => g.name);
    const second = groupByName([tpl({ name: "a" }), tpl({ name: "b" })]).map((g) => g.name);
    expect(first).toEqual(["a", "b"]);
    expect(second).toEqual(["a", "b"]);
  });

  it("★variants inside a group are ordered by language, so refetches do not reshuffle", () => {
    const groups = groupByName([tpl({ language: "ta" }), tpl({ language: "en" }), tpl({ language: "hi" })]);
    expect(groups[0]?.variants.map((v) => v.language)).toEqual(["en", "hi", "ta"]);
  });

  it("⚠️★★a group whose languages differ in CATEGORY reports BOTH", () => {
    // ⚠️★NOTHING TIES A SECOND LANGUAGE'S CATEGORY TO THE FIRST'S, so this is a
    //  real state. 🚫Showing the first as "the" category hides the more
    //  expensive half — Meta bills marketing differently.
    const groups = groupByName([
      tpl({ language: "en", category: "UTILITY" }),
      tpl({ language: "hi", category: "MARKETING" }),
    ]);
    expect(groups[0]?.categories).toEqual(["MARKETING", "UTILITY"]);
  });

  it("★a row with no usable name is skipped rather than crashing the list", () => {
    const groups = groupByName([
      tpl(),
      { ...tpl(), name: undefined as unknown as string },
    ]);
    expect(groups).toHaveLength(1);
  });
});


describe("mostRecentVariant — what a merchant is translating FROM", () => {
  it("⚠️★★★it is the LAST EDITED one, not the alphabetically first", () => {
    // ⚠️🚫★★THE LIST IS SORTED BY LANGUAGE on purpose — so it does not reshuffle
    //  on a refetch — which makes index 0 useless for this question. A merchant
    //  working in `en` on an `ar`+`en` template got the ARABIC copy pre-filled.
    const g = groupByName([
      tpl({ language: "ar", updatedAt: "2026-01-01T00:00:00.000Z" }),
      tpl({ language: "en", updatedAt: "2026-09-01T00:00:00.000Z" }),
    ])[0]!;
    expect(mostRecentVariant(g)?.language).toBe("en");
  });

  it("⚠️★★★AN UNDATED VARIANT DOES NOT WEDGE THE COMPARISON", () => {
    // ⚠️🚫★★THE FIRST FIX FOR THE CASE ABOVE DID NOT WORK. It sorted on
    //  `Date.parse(x ?? "")`, which is **NaN** for an undated row — and a
    //  comparator returning NaN leaves V8's sort UNTOUCHED, so the seed fell
    //  straight back to `variants[0]`: the same regression, under a comment
    //  saying it was fixed. ★`updatedAtMs` stamps `-Infinity` instead.
    const g = groupByName([
      tpl({ language: "ar" }),
      tpl({ language: "en", updatedAt: "2026-09-01T00:00:00.000Z" }),
    ])[0]!;
    expect(mostRecentVariant(g)?.language).toBe("en");
  });

  it("★and an all-undated group still answers with one of them", () => {
    const g = groupByName([tpl({ language: "en" }), tpl({ language: "hi" })])[0]!;
    expect(mostRecentVariant(g)).toBeDefined();
  });

  it("★`updatedAtMs` never returns NaN", () => {
    expect(updatedAtMs({})).toBe(-Infinity);
    expect(updatedAtMs({ updatedAt: "not a date" })).toBe(-Infinity);
    expect(updatedAtMs({ updatedAt: "2026-09-01T00:00:00.000Z" })).toBeGreaterThan(0);
  });
});

describe("addLanguageProblem — refuse before the body is written, and say which", () => {
  const group = groupByName([tpl({ language: "en" }), tpl({ language: "pt-BR" })])[0]!;

  it("★★a language the group already holds is refused, folded", () => {
    // ★`pt_BR` and `pt-BR` are one locale to the api, so offering the second is
    //  offering a 409 — after the merchant has written a paragraph.
    expect(addLanguageProblem(group, "pt_BR")?.code).toBe("DUPLICATE");
    expect(addLanguageProblem(group, "EN")?.code).toBe("DUPLICATE");
  });

  it("⚠★★a group holding a LANGUAGE-LESS row already holds `en`", () => {
    // ★Because the api folds an absent language to `en`, that row IS the
    //  English one as far as a save is concerned. Offering "add en" would be
    //  offering a 409.
    const orphan = groupByName([tpl({ language: "" })])[0]!;
    expect(addLanguageProblem(orphan, "en")?.code).toBe("DUPLICATE");
  });

  it("★an empty language is a DIFFERENT refusal from a duplicate", () => {
    // ★Two ways to fail need two sentences: an empty box is something to fill
    //  in, a duplicate is a template they already have and probably want to
    //  open.
    expect(addLanguageProblem(group, "  ")?.code).toBe("EMPTY");
  });

  it("★★and a language it does not hold is allowed", () => {
    // ★THE PAIR EVERY REFUSAL NEEDS: a rule that refuses everything satisfies
    //  both assertions above.
    expect(addLanguageProblem(group, "hi")).toBeNull();
  });


  it("⚠️★★a ONE-CHARACTER locale is refused here, not by a 400 after translating", () => {
    // ⚠️★THE API’S OWN BOUNDS: `z.string().min(2).max(16)` on the draft body.
    //  🚫Without them a single letter sailed past this guard and 400ed **after**
    //  the merchant had written the body — the failure this function exists to
    //  move earlier.
    expect(addLanguageProblem(group, "e")?.code).toBe("LENGTH");
    expect(addLanguageProblem(group, "x".repeat(17))?.code).toBe("LENGTH");
  });

  it("★and a two-character one is fine", () => {
    expect(addLanguageProblem(group, "hi")).toBeNull();
  });

  it("★`heldLanguages` reports the folded set", () => {
    expect([...heldLanguages(group)].sort()).toEqual(["en", "pt_br"]);
  });
});

describe("unanimousStatus — a group has no single status when its languages disagree", () => {
  it("⚠️★★★APPROVED in English and REJECTED in Hindi summarises to NOTHING", () => {
    // ⚠️🚫★★THE LIE ✅3.4a's MATRIX EXISTS TO PREVENT, one plane over. Meta
    //  approves `(name, language)`, so a header badge reading "Approved" over
    //  this group tells a merchant their Hindi copy is live when it is not.
    const group = groupByName([
      tpl({ language: "en", status: "approved" }),
      tpl({ language: "hi", status: "rejected" }),
    ])[0]!;
    expect(unanimousStatus(group)).toBeNull();
  });

  it("★but a group whose languages agree may say so", () => {
    // ★THE PAIR: returning `null` always would make the summary useless for the
    //  single-language case, which is most of them.
    const group = groupByName([
      tpl({ language: "en", status: "approved" }),
      tpl({ language: "hi", status: "approved" }),
    ])[0]!;
    expect(unanimousStatus(group)).toBe("approved");
  });

  it("★and a one-language group is unanimous with itself", () => {
    expect(unanimousStatus(groupByName([tpl({ status: "draft" })])[0]!)).toBe("draft");
  });
});
