/**
 * The declaration state matrix.
 *
 * Every case here is a place where getting it wrong has a real consequence,
 * so they are worth pinning individually:
 *
 *   - showing a SUPERSEDED declaration as active claims protection the api
 *     is not giving (`resolvePoliticalIntent` ignores it and sends
 *     NOT_DECLARED), which is the worst outcome available here
 *   - collapsing a failed read into "undeclared" is safe-ish; collapsing it
 *     into "declared" is not — hence `unknown` exists as its own state
 *   - a false "not declared" only over-warns, so it is the correct default
 */

import { describe, it, expect } from "vitest";
import {
  declarationState,
  formatDeclaredAt,
  noticeTextFor,
  POLITICAL_DECLARATION_NOTICES,
  SPECIAL_AD_CATEGORY_LABELS,
  SPECIAL_AD_CATEGORY_ORDER,
  SPECIAL_AD_CATEGORY_NONE_NOTE,
  SPECIAL_AD_CATEGORY_CONSEQUENCE,
} from "./ads-copy";

// ★The version in force, which moved with M-03. Kept as a constant rather
// than inlined so the matrix below tests the CURRENT wording rather than a
// version we happen to still hold the text for.
const CURRENT = "ads-declaration-2026-09";

const declaration = {
  politicalIntent: "NOT_POLITICAL" as const,
  declaredAt: "2026-07-30T09:00:00.000Z",
  declaredByUserId: "69bbc24ce89bee1288944def",
  noticeVersion: CURRENT,
};

describe("declarationState", () => {
  it("undeclared when nothing is stored — the default for every business", () => {
    expect(declarationState({ currentNoticeVersion: CURRENT })).toEqual({ kind: "undeclared" });
    expect(declarationState({ declaration: null, currentNoticeVersion: CURRENT })).toEqual({
      kind: "undeclared",
    });
  });

  it("declared, carrying the provenance the record exists to hold", () => {
    expect(
      declarationState({
        declaration,
        currentNoticeVersion: CURRENT,
        declaredByName: "Vanshita Garg",
      }),
    ).toEqual({
      kind: "declared",
      declaredAt: declaration.declaredAt,
      declaredByName: "Vanshita Garg",
    });
  });

  it("declared without a name when the declarer is gone — date alone, not 'unknown user'", () => {
    const out = declarationState({ declaration, currentNoticeVersion: CURRENT });
    expect(out).toEqual({ kind: "declared", declaredAt: declaration.declaredAt });
  });

  it("SUPERSEDED — never rendered as active — when the wording has moved on", () => {
    // The api ignores this declaration and sends NOT_DECLARED. A UI showing
    // it as active would tell the user they are covered when they are not.
    const out = declarationState({
      declaration: { ...declaration, noticeVersion: "linkedin-ttpa-2024-01" },
      currentNoticeVersion: CURRENT,
      declaredByName: "Vanshita Garg",
    });
    expect(out.kind).toBe("superseded");
  });

  it("unknown — not undeclared — when the settings read failed", () => {
    // Distinct state on purpose: we cannot claim either answer.
    expect(declarationState({ failed: true })).toEqual({
      kind: "unknown",
      reason: "read_failed",
    });
    expect(declarationState({ declaration, currentNoticeVersion: CURRENT, failed: true })).toEqual({
      kind: "unknown",
      reason: "read_failed",
    });
  });

  it("unknown when the api sent no current version — we can't tell active from stale", () => {
    // Assuming "still valid" is the assumption that overstates coverage, so
    // the absent-version case must not resolve to `declared`.
    expect(declarationState({ declaration }).kind).toBe("unknown");
    expect(declarationState({ declaration, currentNoticeVersion: null }).kind).toBe("unknown");
    expect(declarationState({ declaration, currentNoticeVersion: "" }).kind).toBe("unknown");
  });

  it("gives a POLITICAL declaration its own READ-ONLY state", () => {
    // Previously this collapsed to `undeclared` — which both misreported it
    // (the api passes POLITICAL through) and put the tick-box on screen, so
    // one click would have overwritten a legal statement.
    const out = declarationState({
      declaration: { ...declaration, politicalIntent: "POLITICAL" },
      currentNoticeVersion: CURRENT,
      declaredByName: "Vanshita Garg",
    });
    expect(out).toEqual({
      kind: "political",
      declaredAt: declaration.declaredAt,
      declaredByName: "Vanshita Garg",
      superseded: false,
    });
  });

  it("a POLITICAL record under STALE wording reports superseded", () => {
    // The api ignores any superseded declaration regardless of intent, so
    // autonomous creates are sending NOT_DECLARED. Rendering this as an
    // in-force political record would overstate it — the same mistake
    // `superseded` exists to prevent, and the POLITICAL branch had it because
    // the intent check ran before the version comparison.
    const out = declarationState({
      declaration: { ...declaration, politicalIntent: "POLITICAL", noticeVersion: "old" },
      currentNoticeVersion: CURRENT,
    });
    expect(out).toEqual({
      kind: "political",
      declaredAt: declaration.declaredAt,
      superseded: true,
    });
  });

  it("treats a stored NOT_DECLARED as undeclared", () => {
    expect(
      declarationState({
        declaration: { ...declaration, politicalIntent: "NOT_DECLARED" },
        currentNoticeVersion: CURRENT,
      }),
    ).toEqual({ kind: "undeclared" });
  });

  it("is `unknown`, not `undeclared`, when we don't hold the api's notice text", () => {
    // The drift hazard: if the api bumps the version and deploys before this
    // app ships the new wording, collecting consent would stamp the NEW version
    // against the OLD text the user actually read. Refusing to ask is the only
    // safe answer, and it must win even with nothing declared — otherwise an
    // undeclared business gets a Save button that records unseen wording.
    // And it is a DEPLOY problem, not a network one — the read succeeded, so
    // "try again" would be a dead end and "campaigns are unaffected" is false.
    expect(declarationState({ currentNoticeVersion: "linkedin-ttpa-2099-01" })).toEqual({
      kind: "unknown",
      reason: "unsupported_notice",
    });
    expect(
      declarationState({
        declaration,
        currentNoticeVersion: "linkedin-ttpa-2099-01",
      }),
    ).toEqual({ kind: "unknown", reason: "unsupported_notice" });
  });

  it("renders nothing confidently when there is no data at all", () => {
    // declarationState({}) must not resolve to `undeclared`: the card would
    // then show an amber warning and a Save button on a failed/paused fetch.
    expect(declarationState({})).toEqual({ kind: "unknown", reason: "read_failed" });
  });

  it("a failed read wins over every other input", () => {
    // Ordering guard: if this ever fell through to the version comparison, a
    // failed read on a superseded declaration would render as needs-re-confirm,
    // implying we know something we don't.
    expect(
      declarationState({
        declaration: { ...declaration, noticeVersion: "old" },
        currentNoticeVersion: CURRENT,
        failed: true,
      }).kind,
    ).toBe("unknown");
  });
});

describe("formatDeclaredAt", () => {
  it("renders a readable date via Intl, not a hardcoded month list", () => {
    expect(formatDeclaredAt("2026-07-30T09:00:00.000Z", "en-GB")).toBe("30 Jul 2026");
  });

  it("is pinned to UTC, so the day can't shift by the viewer's timezone", () => {
    // Without timeZone: "UTC" this renders "29 Jul" west of UTC-9 — a
    // compliance record showing a different day than it holds.
    expect(formatDeclaredAt("2026-07-30T01:00:00.000Z", "en-GB")).toBe("30 Jul 2026");
    expect(formatDeclaredAt("2026-07-30T23:30:00.000Z", "en-GB")).toBe("30 Jul 2026");
  });

  it("returns empty string on an unparseable date instead of 'Invalid Date'", () => {
    expect(formatDeclaredAt("not-a-date")).toBe("");
    expect(formatDeclaredAt("")).toBe("");
  });
});

describe("the notice text is keyed by the version it is", () => {
  it("holds wording for the version this app expects the api to stamp", () => {
    // NOTE: this cannot detect the api bumping its own constant — CURRENT here
    // is a local literal and nothing compares the two repos. The real guard is
    // runtime: an unheld version resolves to `unknown` and the card refuses to
    // collect consent. This only asserts we shipped text for the version we
    // believe is current.
    expect(noticeTextFor(CURRENT)).toBeTypeOf("string");
  });

  it("returns undefined for a version we don't hold, rather than a fallback", () => {
    // A fallback here would defeat the whole guard: the card would show
    // wording that is not what the api is about to record.
    expect(noticeTextFor("linkedin-ttpa-2099-01")).toBeUndefined();
    expect(noticeTextFor(undefined)).toBeUndefined();
    expect(noticeTextFor(null)).toBeUndefined();
    expect(noticeTextFor("")).toBeUndefined();
  });

  it("is LinkedIn's wording, not a paraphrase", () => {
    // Guards against a well-meaning edit for tone. The contract requires their
    // text; softening it would collect consent to something else.
    const text = POLITICAL_DECLARATION_NOTICES[CURRENT];
    expect(text).toContain("not political advertising");
    expect(text).toContain("EU law for ads targeted to the EU");
    expect(text).toContain("LinkedIn's policies");
  });

});

/**
 * ── M-03: the notice version moved, and the wording did not ───────────────
 *
 * ★THE PAIRING RULE THIS FILE EXISTS FOR. `ads-copy.ts` says it: *"an
 * unrecognised version means we do not have the text the api is asking about,
 * so `declarationState` returns `unknown` and the card refuses to collect
 * consent rather than collecting the wrong consent. Add the new wording here
 * in the same PR that bumps the api."*
 */
describe("the M-03 notice version", () => {
  it("★we hold the text for the version the api now asks about", () => {
    // Without this entry the declaration card renders `unknown` and NOBODY can
    // declare — safe, but broken. It is the half of the pair that is easy to
    // forget because the api deploys green without it.
    expect(noticeTextFor("ads-declaration-2026-09")).toBeTruthy();
  });

  it("★the wording is unchanged from the version it supersedes, ON PURPOSE", () => {
    // `noticeVersion` identifies the declaration FORM, not this paragraph. The
    // form now also asks about Meta's special ad categories, so a business that
    // consented to the old version answered strictly fewer questions — a
    // re-prompt is correct even though LinkedIn's sentence did not move.
    //
    // Pinned because "the text is identical, so why re-prompt" is the
    // reasonable-sounding change that would silently inherit consent.
    expect(POLITICAL_DECLARATION_NOTICES["ads-declaration-2026-09"]).toBe(
      POLITICAL_DECLARATION_NOTICES["linkedin-ttpa-2025-10"],
    );
  });

  it("keeps the superseded wording, so an old record still renders honestly", () => {
    // Deleting it would turn every business still on the old version from
    // `superseded` ("please confirm the current wording") into `unknown` ("we
    // couldn't check") — a worse and less actionable message for a state we
    // understand perfectly well.
    expect(noticeTextFor("linkedin-ttpa-2025-10")).toBeTruthy();
  });
});

describe("special ad category copy", () => {
  it("★★offers no ISSUES_ELECTIONS_POLITICS checkbox — it is derived", () => {
    // It is the same fact as the political declaration shown directly above it
    // in the same form. A sixth checkbox would let one business answer one
    // question twice, two different ways, in one submission.
    expect(SPECIAL_AD_CATEGORY_ORDER).not.toContain("ISSUES_ELECTIONS_POLITICS");
    expect(SPECIAL_AD_CATEGORY_LABELS).not.toHaveProperty("ISSUES_ELECTIONS_POLITICS");
  });

  it("every key shown has a label, and every label is shown", () => {
    // ★BOTH DIRECTIONS. A key with no label renders a blank line beside a
    // checkbox; a label no order includes is copy nobody ever reads, which is
    // how a category silently stops being offered.
    for (const k of SPECIAL_AD_CATEGORY_ORDER) {
      expect(SPECIAL_AD_CATEGORY_LABELS[k], `no label for ${k}`).toBeTruthy();
    }
    expect(Object.keys(SPECIAL_AD_CATEGORY_LABELS).sort()).toEqual([...SPECIAL_AD_CATEGORY_ORDER].sort());
  });

  it("★covers the five declarable categories, including the two §2.1 gets wrong", () => {
    // CREDIT is real (§2.1's correction box calls it a bad guess) and
    // ONLINE_GAMBLING_AND_GAMING is missing from that box entirely.
    expect([...SPECIAL_AD_CATEGORY_ORDER].sort()).toEqual([
      "CREDIT",
      "EMPLOYMENT",
      "FINANCIAL_PRODUCTS_SERVICES",
      "HOUSING",
      "ONLINE_GAMBLING_AND_GAMING",
    ]);
  });

  it("★says that ticking nothing is an answer, and what declaring one costs", () => {
    // Meta has no "not answered" value, so an empty submission is a positive
    // statement — the form has to say so rather than letting it read as skipped.
    expect(SPECIAL_AD_CATEGORY_NONE_NOTE).toMatch(/that is an answer/i);
    // And the targeting a declared category removes is stated BEFORE the tick.
    expect(SPECIAL_AD_CATEGORY_CONSEQUENCE).toMatch(/lookalike/i);
  });
});
