import { describe, it, expect } from "vitest";
import { getChannelDisplay, CHANNEL_DISPLAY, BAND_STYLES } from "./repurpose";

/**
 * Pure display-metadata for the repurpose recommend→select surface.
 * PR 6.1b adds the blog_article destinations + plan §4.5 band copy.
 */

describe("getChannelDisplay", () => {
  it("returns the social channel labels", () => {
    expect(getChannelDisplay("linkedin").label).toBe("LinkedIn");
    expect(getChannelDisplay("x").label).toBe("X (Twitter)");
  });

  it("flags WordPress + Shopify as blog destinations", () => {
    const wp = getChannelDisplay("wordpress");
    expect(wp.label).toBe("WordPress");
    expect(wp.isBlog).toBe(true);
    const sh = getChannelDisplay("shopify");
    expect(sh.label).toBe("Shopify blog");
    expect(sh.isBlog).toBe(true);
  });

  it("social channels are not flagged isBlog", () => {
    expect(getChannelDisplay("linkedin").isBlog).toBeUndefined();
    expect(CHANNEL_DISPLAY.x?.isBlog).toBeUndefined();
  });

  it("falls back to a generic chip for unknown channels", () => {
    const u = getChannelDisplay("mastodon");
    expect(u.label).toBe("mastodon");
    expect(u.icon).toBeNull();
    expect(u.isBlog).toBeUndefined();
  });
});

describe("BAND_STYLES (plan §4.5 copy — qualitative, never a raw %)", () => {
  it("uses SME-friendly band labels", () => {
    expect(BAND_STYLES.green.label).toBe("Recommended");
    expect(BAND_STYLES.amber.label).toBe("Worth a try");
    expect(BAND_STYLES.grey.label).toBe("Not a fit");
  });
});
