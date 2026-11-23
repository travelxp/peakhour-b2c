import { describe, expect, it } from "vitest";
import {
  commercialLabel,
  isVideoPayload,
  postProblems,
  privacyDisabled,
  tiktokAccountState,
  tiktokAvailable,
  tiktokStatusView,
} from "./tiktok-content-view";

const none = { privacy: null, commercial: false, yourBrand: false, brandedContent: false };

describe("tiktokAvailable", () => {
  it("is true only when the api marks the tiktok row available", () => {
    expect(tiktokAvailable([{ provider: "tiktok", availability: "available" }])).toBe(true);
    expect(tiktokAvailable([{ provider: "tiktok", availability: "coming_soon" }])).toBe(false);
    expect(tiktokAvailable([{ provider: "tiktok_ads", availability: "available" }])).toBe(false);
    expect(tiktokAvailable([])).toBe(false);
    expect(tiktokAvailable(undefined)).toBe(false);
  });
});

describe("tiktokAccountState", () => {
  it("maps the creator-info errors", () => {
    expect(tiktokAccountState(null)).toBe("ready");
    expect(tiktokAccountState({ status: 409, code: "NOT_CONNECTED" })).toBe("not_connected");
    expect(tiktokAccountState({ status: 409, code: "NEEDS_REAUTH" })).toBe("needs_reauth");
    expect(tiktokAccountState({ status: 502, code: "TIKTOK_UNAVAILABLE" })).toBe("unavailable");
    expect(tiktokAccountState({ status: 503 })).toBe("unavailable");
    expect(tiktokAccountState({ status: 500, code: "BOOM" })).toBe("error");
  });
});

describe("postProblems", () => {
  it("blocks Post until a privacy level is chosen", () => {
    expect(postProblems(none, { kind: "photos" }).map((p) => p.key)).toEqual(["privacy"]);
    expect(postProblems({ ...none, privacy: "PUBLIC_TO_EVERYONE" }, { kind: "photos" })).toEqual([]);
  });

  it("needs a kind of commercial content once the switch is on", () => {
    const on = { ...none, privacy: "PUBLIC_TO_EVERYONE", commercial: true };
    expect(postProblems(on, { kind: "photos" }).map((p) => p.key)).toEqual(["commercial_kind"]);
    expect(postProblems({ ...on, yourBrand: true }, { kind: "photos" })).toEqual([]);
  });

  it("refuses branded content that is private", () => {
    const c = { privacy: "SELF_ONLY", commercial: true, yourBrand: false, brandedContent: true };
    expect(privacyDisabled("SELF_ONLY", c)).toBe(true);
    expect(privacyDisabled("PUBLIC_TO_EVERYONE", c)).toBe(false);
    expect(postProblems(c, { kind: "photos" }).map((p) => p.key)).toContain("privacy");
    // Your brand alone may be private.
    expect(postProblems({ ...c, brandedContent: false, yourBrand: true }, { kind: "photos" })).toEqual([]);
  });

  it("refuses a video longer than the account allows, and only a video", () => {
    const c = { ...none, privacy: "PUBLIC_TO_EVERYONE" };
    expect(postProblems(c, { kind: "video", durationSec: 301 }, 300).map((p) => p.key)).toEqual(["duration"]);
    expect(postProblems(c, { kind: "video", durationSec: 300 }, 300)).toEqual([]);
    expect(postProblems(c, { kind: "video", durationSec: null }, 300)).toEqual([]);
    expect(postProblems(c, { kind: "photos" }, 300)).toEqual([]);
  });
});

describe("commercialLabel", () => {
  it("names the label TikTok shows", () => {
    expect(commercialLabel(none)).toBeNull();
    expect(commercialLabel({ commercial: true, yourBrand: true, brandedContent: false })).toBe("Promotional content");
    expect(commercialLabel({ commercial: true, yourBrand: false, brandedContent: true })).toBe("Paid partnership");
    expect(commercialLabel({ commercial: true, yourBrand: true, brandedContent: true })).toBe("Paid partnership");
    expect(commercialLabel({ commercial: false, yourBrand: true, brandedContent: true })).toBeNull();
  });
});

describe("tiktokStatusView", () => {
  it("an approved item reads Approved", () => {
    expect(tiktokStatusView({ status: "queued" }).label).toBe("Approved");
  });

  it("an item whose Post was pressed reads Waiting for TikTok approval, never Published", () => {
    const v = tiktokStatusView({ status: "queued" }, true);
    expect(v.label).toBe("Waiting for TikTok approval");
    expect(v.label).not.toMatch(/published/i);
  });

  it("a parked item (needs_action, tiktok_coming_soon) reads Waiting for TikTok approval", () => {
    expect(tiktokStatusView({ status: "needs_action" }).label).toBe("Waiting for TikTok approval");
  });

  it("calls an item published only when there is a link to it", () => {
    expect(tiktokStatusView({ status: "published" }).label).toBe("Waiting for TikTok approval");
    expect(tiktokStatusView({ status: "published", externalUrl: "https://www.tiktok.com/@a/video/1" }).label).toBe("Published");
  });
});

describe("isVideoPayload", () => {
  it("reads a video by its file type", () => {
    expect(isVideoPayload(["https://cdn/x.mp4"])).toBe(true);
    expect(isVideoPayload(["https://cdn/x.MOV?sig=1"])).toBe(true);
    expect(isVideoPayload(["https://cdn/x.jpg", "https://cdn/y.jpg"])).toBe(false);
    expect(isVideoPayload(undefined)).toBe(false);
  });
});
