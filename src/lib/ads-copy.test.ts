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
  POLITICAL_DECLARATION_NOTICE,
} from "./ads-copy";

const CURRENT = "linkedin-ttpa-2025-10";

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
    expect(declarationState({ failed: true })).toEqual({ kind: "unknown" });
    expect(declarationState({ declaration, currentNoticeVersion: CURRENT, failed: true })).toEqual({
      kind: "unknown",
    });
  });

  it("unknown when the api sent no current version — we can't tell active from stale", () => {
    // Assuming "still valid" is the assumption that overstates coverage, so
    // the absent-version case must not resolve to `declared`.
    expect(declarationState({ declaration }).kind).toBe("unknown");
    expect(declarationState({ declaration, currentNoticeVersion: null }).kind).toBe("unknown");
    expect(declarationState({ declaration, currentNoticeVersion: "" }).kind).toBe("unknown");
  });

  it("treats a POLITICAL declaration as undeclared rather than offering to overwrite it", () => {
    // Political advertising carries obligations we don't support. Showing a
    // tick-box that would silently rewrite that answer is worse than showing
    // the undeclared state.
    expect(
      declarationState({
        declaration: { ...declaration, politicalIntent: "POLITICAL" },
        currentNoticeVersion: CURRENT,
      }),
    ).toEqual({ kind: "undeclared" });
    expect(
      declarationState({
        declaration: { ...declaration, politicalIntent: "NOT_DECLARED" },
        currentNoticeVersion: CURRENT,
      }),
    ).toEqual({ kind: "undeclared" });
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

  it("returns empty string on an unparseable date instead of 'Invalid Date'", () => {
    expect(formatDeclaredAt("not-a-date")).toBe("");
    expect(formatDeclaredAt("")).toBe("");
  });
});

describe("the notice text", () => {
  it("is LinkedIn's wording, not a paraphrase", () => {
    // Guards against a well-meaning edit for tone. The contract requires
    // their text; softening it would collect consent to something else.
    expect(POLITICAL_DECLARATION_NOTICE).toContain("not political advertising");
    expect(POLITICAL_DECLARATION_NOTICE).toContain("EU law for ads targeted to the EU");
    expect(POLITICAL_DECLARATION_NOTICE).toContain("LinkedIn's policies");
  });
});
