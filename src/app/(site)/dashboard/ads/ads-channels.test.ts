import { describe, it, expect } from "vitest";
import {
  ADS_CHANNELS,
  isAdsChannelKey,
  getAdsChannel,
  nextAdsHubSearch,
  resolveAdsChannel,
} from "./ads-channels";

const NONE = new Set<string>();

describe("resolveAdsChannel", () => {
  it("an explicit valid ?channel= wins, even when that channel isn't connected", () => {
    // The Content hub's Manage deep-link must land where it points; the panel
    // then renders its own connect CTA.
    expect(resolveAdsChannel("x", NONE)).toBe("x");
    expect(resolveAdsChannel("linkedin", new Set(["x_ads"]))).toBe("linkedin");
  });

  it("falls back to the first CONNECTED channel when no param is given", () => {
    expect(resolveAdsChannel(null, new Set(["x_ads"]))).toBe("x");
    expect(resolveAdsChannel(undefined, new Set(["linkedin_ads"]))).toBe("linkedin");
  });

  it("prefers registry order when several channels are connected", () => {
    expect(resolveAdsChannel(null, new Set(["x_ads", "linkedin_ads"]))).toBe("linkedin");
  });

  it("falls back to the first registered channel when nothing is connected", () => {
    expect(resolveAdsChannel(null, NONE)).toBe(ADS_CHANNELS[0].key);
  });

  it("ignores an unknown or empty param instead of rendering a blank hub", () => {
    expect(resolveAdsChannel("meta", new Set(["x_ads"]))).toBe("x");
    expect(resolveAdsChannel("", new Set(["x_ads"]))).toBe("x");
    // Keys are matched exactly — no case folding.
    expect(resolveAdsChannel("LinkedIn", new Set(["x_ads"]))).toBe("x");
  });
});

describe("isAdsChannelKey", () => {
  it("accepts registered keys only", () => {
    expect(isAdsChannelKey("linkedin")).toBe(true);
    expect(isAdsChannelKey("x")).toBe(true);
    expect(isAdsChannelKey("google")).toBe(false);
    expect(isAdsChannelKey(null)).toBe(false);
    expect(isAdsChannelKey(undefined)).toBe(false);
  });
});

describe("ADS_CHANNELS registry", () => {
  it("has unique keys and provider keys", () => {
    expect(new Set(ADS_CHANNELS.map((c) => c.key)).size).toBe(ADS_CHANNELS.length);
    expect(new Set(ADS_CHANNELS.map((c) => c.providerKey)).size).toBe(ADS_CHANNELS.length);
  });

  it("getAdsChannel round-trips every registered key", () => {
    for (const c of ADS_CHANNELS) {
      expect(getAdsChannel(c.key)).toBe(c);
    }
  });

  it("carries the provider keys the Content hub catalog routes from", () => {
    // Regression guard: these must match cfg_integrations.key /
    // int_connections.provider, or the hub can't tell connected from not.
    expect(ADS_CHANNELS.map((c) => c.providerKey)).toEqual(["linkedin_ads", "x_ads"]);
  });
});

describe("nextAdsHubSearch", () => {
  const search = (q: string) => new URLSearchParams(q);

  it("sets the channel and drops params owned by the channel being left", () => {
    // X owns `account`; carrying it into LinkedIn would leak one channel's
    // state into another.
    expect(nextAdsHubSearch(search("channel=x&account=18ce54"), "linkedin")).toBe(
      "channel=linkedin",
    );
  });

  it("keeps the channel's own params when re-selecting it", () => {
    const out = search(nextAdsHubSearch(search("channel=x&account=18ce54"), "x"));
    expect(out.get("channel")).toBe("x");
    expect(out.get("account")).toBe("18ce54");
  });

  it("preserves unrelated params", () => {
    const out = search(nextAdsHubSearch(search("ref=email&account=abc"), "linkedin"));
    expect(out.get("ref")).toBe("email");
    expect(out.get("account")).toBeNull();
  });

  it("overwrites an invalid or absent channel", () => {
    expect(nextAdsHubSearch(search("channel=meta"), "x")).toBe("channel=x");
    expect(nextAdsHubSearch(search(""), "x")).toBe("channel=x");
  });

  it("accepts Next's ReadonlyURLSearchParams shape (toString only)", () => {
    expect(nextAdsHubSearch({ toString: () => "channel=x&account=a1" }, "linkedin")).toBe(
      "channel=linkedin",
    );
  });
});
