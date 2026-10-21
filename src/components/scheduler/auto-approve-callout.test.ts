import { describe, it, expect } from "vitest";

import { AUTO_APPROVE_CALLOUT, showAutoApproveCallout } from "./auto-approve-callout";

const ent = (autoApprove: boolean) => ({ schedulerFeatures: { autoApprove } });

/**
 * The composer's auto-approve teaser (review R1 on b2c#600): shown only on
 * loaded data that says the feature is not included, never beside a
 * forced-visible checkbox, in words that name and presume no plan.
 */
describe("showAutoApproveCallout", () => {
  it("★shows on loaded entitlements without auto-approve", () => {
    expect(showAutoApproveCallout(ent(false), undefined)).toBe(true);
  });

  it("★not while there is no data: a failed or paused (offline) query is not a verdict", () => {
    expect(showAutoApproveCallout(undefined, undefined)).toBe(false);
  });

  it("★not beside a checkbox a staging caller forced visible, and not when the caller hides it", () => {
    expect(showAutoApproveCallout(ent(false), true)).toBe(false);
    expect(showAutoApproveCallout(ent(false), false)).toBe(false);
  });

  it("PASS: not for a business whose entitlements include auto-approve", () => {
    expect(showAutoApproveCallout(ent(true), undefined)).toBe(false);
  });
});

describe("AUTO_APPROVE_CALLOUT", () => {
  it("★names no plan and presumes none", () => {
    expect(AUTO_APPROVE_CALLOUT).toBe("Auto-approve publishing isn't included for this business yet.");
    expect(AUTO_APPROVE_CALLOUT).not.toMatch(/\bplan\b|Starter|Growth|Free/i);
  });
});

describe("the composer uses the decision", () => {
  it("★the composer renders the callout only on the decision", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(__dirname, "scheduler-composer.tsx"), "utf8");
    expect(src).toContain("{showAutoApproveCallout(entitlements, canAutoApprove) && <UpgradeCallout message={AUTO_APPROVE_CALLOUT} />}");
    expect(src.match(/<UpgradeCallout message=\{AUTO_APPROVE_CALLOUT\} \/>/g)).toHaveLength(1);
  });
});
