import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ApiError } from "@/lib/api";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { studioRefusal } from "@/lib/studio-flow";

/**
 * Spec 9.4: each charged action maps a 409 CREATIVE_NOT_RELEASED to the coming-soon state with NO error toast, a 429 to the Peaks refusal,
 * and the blocked-final copy never says a charge happened. The screens call `studioRefusal` and branch on its `tone`; this checks the
 * mapping for every charged action and that every screen that spends reads the tone before it speaks.
 */
const notReleased = new ApiError("CREATIVE_NOT_RELEASED", "Making previews isn't available yet. You weren't charged.", 409, undefined, { useCase: "creative.image_draft" });
const short = new ApiError("CREDITS_EXHAUSTED", "x", 429, undefined, { needed: 680, remaining: 100 });

const ACTIONS = ["Making previews", "Another background", "New wording", "Making a final", "Making more background for a size"];

describe("every charged action", () => {
  it.each(ACTIONS)("%s: a switched-off use case is the coming-soon state, plain, and never a charge", (what) => {
    const r = studioRefusal(notReleased, what);
    expect(r.tone).toBe("not_released");
    expect(r.text).toBe(`${what} isn't available yet. You weren't charged.`);
  });

  it.each(ACTIONS)("%s: a short balance is the Peaks refusal with the way to add Peaks", (what) => {
    const r = studioRefusal(short, what);
    expect(r.tone).toBe("error");
    expect(r.action).toBe("add_peaks");
    expect(r.text).toContain("Nothing was started and nothing was charged.");
  });
});

describe("the screens that spend read the tone before they speak", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), "src/components/studio", rel), "utf8");
  it.each(["brief-screen.tsx", "one-more.tsx", "creative-workspace.tsx", "make-final.tsx"])("%s turns not_released into the coming-soon state, not a toast", (file) => {
    const src = read(file);
    expect(src).toContain("not_released");
    // a charged call's error handler must not toast the refusal text of a not-released answer
    expect(src).not.toMatch(/toast\.error\(\s*studioRefusal\([^)]*\)\.text\s*\)[^;]*(press|makeFinals|Press)/);
  });
});

describe("words that must never promise or imply a charge that did not happen", () => {
  it("a blocked final says it was not charged and the preview is safe, and never that a charge was made", () => {
    const t = STUDIO_COPY.final.blocked;
    expect(t).toContain("You weren't charged.");
    expect(t).toContain("Your preview is safe.");
    expect(t).not.toMatch(/\b(was|were|been) charged\b|\bcharged you\b/i);
  });
  it("a failed render and a failed press say they were not charged", () => {
    expect(STUDIO_COPY.final.failed).toContain("You weren't charged.");
    expect(STUDIO_COPY.refusal.wentWrong).toContain("You weren't charged.");
    expect(STUDIO_COPY.creative.allFailed.title).toContain("You weren't charged.");
    expect(STUDIO_COPY.creative.failedTile).toContain("Not charged.");
  });
});
