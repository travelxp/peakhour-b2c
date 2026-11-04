import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FEES_REFUND_SENTENCE, PEAKS_REFUND_SENTENCE, REFUND_LAW_SENTENCE } from "@/lib/peaks-refund-terms";

/**
 * What the site promises about refunding Peaks (owner, 2026-11-04). The product gives credits back when a task
 * failed or a charge was made in error, so the Terms and the Peaks page say exactly that, from one sentence.
 */
const page = (rel: string) => readFileSync(resolve(import.meta.dirname, "..", "app", "(site)", rel), "utf8").replace(/\r\n/g, "\n");
const flat = (s: string) => s.replace(/\s+/g, " ");

describe("the refund sentence", () => {
  it("is the owner's, word for word", () => {
    expect(PEAKS_REFUND_SENTENCE).toBe("Purchased Peaks are non-refundable, except where a task failed or a charge was made in error.");
  });

  it("the plan-fee sentence keeps the 'required by applicable law' clause and no longer covers Peaks", () => {
    expect(FEES_REFUND_SENTENCE).toBe("All fees other than purchased Peaks are non-refundable except as required by applicable law or as explicitly stated in these Terms.");
    expect(REFUND_LAW_SENTENCE).toContain("applicable law requires");
  });

  it("the Terms say it, using the shared sentences, and no longer say all fees are flatly non-refundable", () => {
    const t = flat(page("terms/page.tsx"));
    expect(t).toContain("{FEES_REFUND_SENTENCE} {PEAKS_REFUND_SENTENCE} {REFUND_LAW_SENTENCE}");
    expect(t).not.toContain("All fees are non-refundable");
  });

  it("the Peaks page says it in its description, its top-up card and its policy, and nowhere calls Peaks flatly non-refundable", () => {
    const p = flat(page("peaks/page.tsx"));
    expect(p.match(/\$\{PEAKS_REFUND_SENTENCE\}/g)).toHaveLength(2);
    expect(p).toContain("{PEAKS_REFUND_SENTENCE}{\" \"}");
    expect(p).not.toMatch(/are non-refundable,/);
    expect(p).not.toMatch(/>non-refundable</);
  });
});
