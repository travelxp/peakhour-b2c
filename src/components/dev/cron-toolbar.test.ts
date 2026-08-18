/**
 * Who sees the dev cron toolbar.
 *
 * ★The default is load-bearing, not cosmetic. Vercel Cron fires only on
 * production, so on every other environment this toolbar is the only way
 * to make a cron-fed page produce data at all. Defaulting it to hidden
 * made those pages look broken rather than untriggered — which is how it
 * was reported.
 */

import { describe, it, expect } from "vitest";
import { devToolsVisible, dangerSentence } from "./cron-toolbar";

describe("the dev-tools gate", () => {
  it("★is shown by default", () => {
    // Nothing asked for, nothing stored. The page's crons are reachable.
    expect(devToolsVisible(null, null)).toBe(true);
  });

  it("stays hidden once someone hid it", () => {
    // For a demo, where a row of `discovery-runner` buttons above the
    // content is the loudest "unfinished software" signal on screen.
    expect(devToolsVisible(null, "0")).toBe(false);
  });

  it("★`?dev=1` undoes a hide from three weeks ago", () => {
    // Otherwise hiding it once is permanent for anyone who forgot they
    // did it, and the only cure is clearing site data.
    expect(devToolsVisible("1", "0")).toBe(true);
  });

  it("`?dev=0` hides it even with nothing stored yet", () => {
    expect(devToolsVisible("0", null)).toBe(false);
  });

  it("ignores a value that means neither", () => {
    // `?dev=yes` is not a hide instruction; falling through to the
    // default is safer than guessing at intent.
    expect(devToolsVisible("yes", null)).toBe(true);
  });
});

describe("what the ⚠️ warns about", () => {
  it("★says INSIDE Peakhour for the cron that erases tenants", () => {
    // One fixed sentence used to claim every guarded cron reaches
    // outside Peakhour, which is precisely backwards for
    // org-deletion-executor — the only one that destroys our own data.
    expect(dangerSentence(true)).toMatch(/INSIDE Peakhour/);
    expect(dangerSentence(true)).toMatch(/cannot be undone/);
  });

  it("says outside Peakhour for the billing and e-invoice ones", () => {
    expect(dangerSentence(false)).toMatch(/outside Peakhour/);
  });
});
