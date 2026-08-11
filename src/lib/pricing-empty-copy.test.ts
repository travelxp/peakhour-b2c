import { describe, it, expect } from "vitest";
import { emptyPlanCopy, partialPlanCopy } from "./pricing-empty-copy";
import type { PricingPlan } from "@/hooks/use-commerce-pricer";

/**
 * The Pricing panel told four different stores the same reassuring thing. These
 * pin the five causes apart, and — the part that actually ships today — the
 * legacy path used against an api that predates `emptyReason`.
 */

const base: PricingPlan = {
  windowDays: 30,
  scanned: true,
  truncated: false,
  truncatedCandidates: false,
  emptyReason: "clear",
  guardrails: {},
  proposals: [],
  totalRecoveredCapitalMinor: 0,
  currency: null,
};

const CLEAN_SHELF = "nothing is sitting with tied-up capital";

describe("emptyPlanCopy", () => {
  it("reassures only when the shelf really is clear", () => {
    expect(emptyPlanCopy(base)).toContain(CLEAN_SHELF);
  });

  it("says nothing has synced when nothing has", () => {
    expect(emptyPlanCopy({ ...base, emptyReason: "not_scanned" })).toContain("synced");
  });

  it("★names a disabled ceiling, and does not promise candidates exist", () => {
    const copy = emptyPlanCopy({ ...base, emptyReason: "markdowns_off" });
    expect(copy).toContain("switched off");
    expect(copy).toContain("whether anything qualifies");
    expect(copy).not.toContain(CLEAN_SHELF);
  });

  it("★never claims a clean shelf when slow stock was crowded out", () => {
    const copy = emptyPlanCopy({ ...base, emptyReason: "candidates_truncated" });
    expect(copy).toContain("ran out of room");
    expect(copy).not.toContain(CLEAN_SHELF);
  });

  it("★never claims a clean shelf on a partial scan", () => {
    const copy = emptyPlanCopy({ ...base, emptyReason: "scan_truncated" });
    expect(copy).toContain("isn't the whole shelf");
    expect(copy).not.toContain(CLEAN_SHELF);
  });

  it("★`none` is unreachable, so it must not map to the reassuring sentence", () => {
    // It means the plan is NOT empty. Reaching it here is a bug somewhere, and
    // the worst possible response to a bug is the most comforting sentence.
    const copy = emptyPlanCopy({ ...base, emptyReason: "none", truncated: true });
    expect(copy).toContain("isn't the whole shelf");
  });
});

describe("emptyPlanCopy — the legacy api path, which is the live one today", () => {
  /** Production trails master, so until it catches up this is what merchants
   *  actually see. The first version kept the old two-state behaviour and got
   *  three of the five causes wrong. */
  const legacy = (over: Partial<PricingPlan>): PricingPlan => ({
    ...base,
    emptyReason: undefined,
    ...over,
  });

  it("★a partial scan is not a clean shelf, even with no emptyReason", () => {
    expect(emptyPlanCopy(legacy({ truncated: true }))).toContain("isn't the whole shelf");
  });

  it("★a 0% ceiling is not a clean shelf either", () => {
    const copy = emptyPlanCopy(legacy({ guardrails: { maxDiscountPct: 0 } }));
    expect(copy).toContain("switched off");
    expect(copy).not.toContain(CLEAN_SHELF);
  });

  it("★the ceiling outranks the truncation, matching the api's own ordering", () => {
    // Leading with the truncation would promise a plan that builds once at-risk
    // stock clears — which a 0% ceiling never permits.
    const copy = emptyPlanCopy(legacy({ truncated: true, guardrails: { maxDiscountPct: 0 } }));
    expect(copy).toContain("switched off");
  });

  it("nothing synced still wins over everything", () => {
    expect(
      emptyPlanCopy(legacy({ scanned: false, truncated: true, guardrails: { maxDiscountPct: 0 } })),
    ).toContain("synced");
  });

  it("and reassures when there is genuinely nothing wrong", () => {
    expect(emptyPlanCopy(legacy({}))).toContain(CLEAN_SHELF);
  });
});

describe("partialPlanCopy", () => {
  it("says nothing about a complete plan", () => {
    expect(partialPlanCopy(base)).toBeNull();
  });

  it("★does NOT blame at-risk stock, unlike the empty case", () => {
    // With proposals present, slow items DID make the set — so the cap was hit
    // partway through them, which happens with 300 slow products and no at-risk
    // ones at all. Advice about clearing at-risk stock would be about products
    // that may not exist.
    const copy = partialPlanCopy({ ...base, truncatedCandidates: true })!;
    expect(copy).toContain("ran out of room");
    expect(copy).not.toContain("at-risk");
  });

  it("falls back to the scan cap when only that was hit", () => {
    expect(partialPlanCopy({ ...base, truncated: true })).toContain("larger than one pass");
  });
});
