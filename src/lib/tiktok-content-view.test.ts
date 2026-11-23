import { describe, expect, it } from "vitest";
import {
  commercialLabel,
  isVideoItem,
  mediaKind,
  mediaRefusal,
  mediaTypeOf,
  postAnswer,
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

it("mediaKind: video/* is a video, image/* is photos, anything else is refused", () => {
  expect(mediaKind(["video/mp4"])).toBe("video");
  expect(mediaKind(["image/png"])).toBe("photos");
  expect(mediaKind(["application/pdf"])).toBe("unsupported");
  expect(mediaKind(["image/png", "audio/mpeg"])).toBe("unsupported");
  expect(mediaRefusal(["application/pdf"])).toContain("video or photos only");
});

const known = (seconds: number) => ({ kind: "video" as const, length: { state: "known" as const, seconds } });

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

  it("Only me is disabled for branded content, and not for your brand alone", () => {
    const c = { commercial: true, brandedContent: true };
    expect(privacyDisabled("SELF_ONLY", c)).toBe(true);
    expect(privacyDisabled("PUBLIC_TO_EVERYONE", c)).toBe(false);
    expect(privacyDisabled("SELF_ONLY", { commercial: true, brandedContent: false })).toBe(false);
  });

  it("refuses a video longer than the account allows", () => {
    const c = { ...none, privacy: "PUBLIC_TO_EVERYONE" };
    expect(postProblems(c, known(301), 300).map((p) => p.key)).toEqual(["duration"]);
    expect(postProblems(c, known(300), 300)).toEqual([]);
    expect(postProblems(c, { kind: "photos" }, 300)).toEqual([]);
  });

  it("does not pass a video whose length is not known yet, or cannot be read", () => {
    const c = { ...none, privacy: "PUBLIC_TO_EVERYONE" };
    expect(postProblems(c, { kind: "video", length: { state: "checking" } }, 300).map((p) => p.key)).toEqual(["duration_unknown"]);
    const unreadable = postProblems(c, { kind: "video", length: { state: "unreadable" } }, 300);
    expect(unreadable.map((p) => p.key)).toEqual(["duration_unknown"]);
    expect(unreadable[0].message).toContain("could not read this video");
    // no limit from the account: a known length passes
    expect(postProblems(c, known(9999), null)).toEqual([]);
  });
});

describe("media", () => {
  it("judges by mime type: one video, or photos, never both", () => {
    expect(mediaKind([])).toBe("none");
    expect(mediaKind(["video/mp4"])).toBe("video");
    expect(mediaKind(["image/jpeg", "image/webp"])).toBe("photos");
    expect(mediaKind(["video/mp4", "image/jpeg"])).toBe("mixed");
    expect(mediaKind(["video/mp4", "video/quicktime"])).toBe("many_videos");
    expect(mediaRefusal(["video/mp4", "image/jpeg"])).toContain("one video or photos, not both");
    expect(mediaRefusal(["video/mp4", "video/mp4"])).toContain("one video");
    expect(mediaRefusal(["video/mp4"])).toBeNull();
    expect(mediaRefusal(["image/png"])).toBeNull();
  });

  it("sets mediaType from the type, and reads an item by it, not by its link", () => {
    expect(mediaTypeOf(["video/quicktime"])).toBe("video");
    expect(mediaTypeOf(["image/jpeg"])).toBe("photo");
    expect(isVideoItem({ payload: { channelOptions: { mediaType: "video" }, mediaUrls: ["https://cdn/x.jpg"] } } as never)).toBe(true);
    expect(isVideoItem({ payload: { channelOptions: { mediaType: "photo" }, mediaUrls: ["https://cdn/x.mp4"] } } as never)).toBe(false);
    expect(isVideoItem({ payload: { mediaUrls: ["https://cdn/x.mp4"] } } as never)).toBe(false);
  });
});

describe("postAnswer", () => {
  it("says only what the api said", () => {
    expect(postAnswer({ outcome: "published", published: true }).kind).toBe("posted");
    expect(postAnswer({ outcome: "needs_action", code: "tiktok_coming_soon" }).text).toContain("coming soon");
    expect(postAnswer({ outcome: "needs_action", code: "tiktok_privacy_required" }).kind).toBe("choose_privacy");
    expect(postAnswer({ outcome: "needs_action", code: "other" }).kind).toBe("needs_attention");
    expect(postAnswer({ outcome: "permanent_error" }).kind).toBe("failed");
    for (const a of [null, { outcome: "transient_error" }, { outcome: "rate_limited" }, { outcome: "unknown" }]) {
      const r = postAnswer(a);
      expect(r.text).toBe("Your choices are saved. It will go out shortly.");
    }
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

const parked = (code: string) => ({ status: "needs_action" as const, attempts: [{ errorCode: code }] }) as never;

describe("tiktokStatusView", () => {
  it("an item with no choices reads Approved, choose how it posts, and offers Post", () => {
    const v = tiktokStatusView({ status: "queued", payload: { channelOptions: { mediaType: "video" } } } as never);
    expect([v.label, v.action]).toEqual(["Approved. Choose how it posts.", "post"]);
  });

  it("a queued or ready item whose privacy is saved reads Saved, sending soon, with Edit and no Post", () => {
    for (const status of ["queued", "ready"] as const) {
      const v = tiktokStatusView({ status, payload: { channelOptions: { privacyLevel: "SELF_ONLY" } } } as never);
      expect([v.label, v.action]).toEqual(["Saved. Sending soon.", "edit"]);
    }
  });

  it("needs_action tiktok_coming_soon reads Waiting for TikTok approval, with no button", () => {
    const v = tiktokStatusView(parked("tiktok_coming_soon"));
    expect([v.label, v.action]).toEqual(["Waiting for TikTok approval", null]);
  });

  it("needs_action tiktok_privacy_required reads Choose who can watch it, with Open", () => {
    const v = tiktokStatusView(parked("tiktok_privacy_required"));
    expect([v.label, v.action]).toEqual(["Choose who can watch it", "open"]);
  });

  it("any other parked reason is not called waiting for approval", () => {
    expect(tiktokStatusView(parked("something_else")).label).toBe("Needs attention");
    expect(tiktokStatusView({ status: "needs_action" } as never).label).toBe("Needs attention");
  });

  it("published without a link reads Published, link coming; with one, Published", () => {
    expect(tiktokStatusView({ status: "published" }).label).toBe("Published, link coming");
    expect(tiktokStatusView({ status: "published", externalUrl: "https://www.tiktok.com/@a/video/1" }).label).toBe("Published");
  });

  it("in_flight reads Sending and awaiting_retry reads Retrying, neither with Post", () => {
    const sending = tiktokStatusView({ status: "in_flight" });
    const retrying = tiktokStatusView({ status: "awaiting_retry" });
    expect([sending.label, sending.action]).toEqual(["Sending…", null]);
    expect([retrying.label, retrying.action]).toEqual(["Retrying", null]);
  });
});
