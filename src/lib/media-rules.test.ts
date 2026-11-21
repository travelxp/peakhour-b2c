import { describe, expect, it } from "vitest";
import { acceptOf, destinationKey, fitChannelOf, aloneProblem, judgeFile, kindsOfRule, roomLeft, takesLine, verdictText, type MediaRule } from "./media-rules";

/**
 * The browser's half of the media rules: reading a row of the api's table and judging a file against it. The numbers below are test data
 * written out here; what the real table holds, and that it follows the adapters, is the api's test (tests/unit/media-rules.test.ts).
 */
const IG: MediaRule = {
  key: "post:instagram",
  label: "an Instagram post",
  maxCount: 10,
  image: { formats: ["image/jpeg"], maxBytes: 8 * 1024 * 1024, minWidth: 320, aspect: { min: 0.8, max: 1.91 } },
  video: { formats: ["video/mp4", "video/quicktime"], minSeconds: 3, maxSeconds: 900 },
};
const X: MediaRule = { key: "post:x", label: "an X post", maxCount: 4, image: { formats: ["image/jpeg", "image/gif"], maxBytes: 5 * 1024 * 1024, gifMaxBytes: 15 * 1024 * 1024 } };
const WA: MediaRule = { key: "message:whatsapp", label: "a WhatsApp reply", maxCount: 1, image: { formats: ["image/jpeg", "image/png"], minBytes: 1, maxBytes: 4 * 1024 * 1024 }, document: { formats: ["application/pdf"], minBytes: 1, maxBytes: 4 * 1024 * 1024 } };
const jpeg = (over: Record<string, unknown> = {}) => ({ mimeType: "image/jpeg", sizeBytes: 500_000, width: 1080, height: 1350, ...over });

describe("which row a destination reads", () => {
  it("names each kind of destination, and reads a scheduler's channel name through the adapter alias (beehiiv is the newsletter)", () => {
    expect(destinationKey({ kind: "post", channel: "instagram" })).toBe("post:instagram");
    expect(destinationKey({ kind: "post", channel: "beehiiv" })).toBe("post:newsletter");
    expect(destinationKey({ kind: "post", channel: "google_business" })).toBe("post:googlebusiness");
    expect(destinationKey({ kind: "presence", channel: "google_business" })).toBe("presence:googlebusiness");
    expect(destinationKey({ kind: "message", channel: "whatsapp" })).toBe("message:whatsapp");
    expect(destinationKey({ kind: "ad", placement: "meta_ad_image" })).toBe("ad:meta_ad_image");
    expect(destinationKey({ kind: "page", use: "document" })).toBe("page:document");
  });

  it("only a post or a listing has a channel whose content verdicts order the Drive tab", () => {
    expect(fitChannelOf({ kind: "post", channel: "beehiiv" })).toBe("newsletter");
    expect(fitChannelOf({ kind: "presence", channel: "google_business" })).toBe("googlebusiness");
    expect(fitChannelOf({ kind: "ad", placement: "meta_ad_image" })).toBeUndefined();
    expect(fitChannelOf({ kind: "page", use: "photo" })).toBeUndefined();
  });
});

describe("judging a file", () => {
  it("passes a file inside every limit, on the edges too", () => {
    expect(judgeFile(IG, jpeg())).toEqual({ state: "fits" });
    expect(judgeFile(IG, jpeg({ sizeBytes: 8 * 1024 * 1024 }))).toEqual({ state: "fits" });
    expect(judgeFile(IG, jpeg({ width: 320, height: 400 }))).toEqual({ state: "fits" });
    expect(judgeFile(IG, jpeg({ width: 800, height: 1000 }))).toEqual({ state: "fits" });
    expect(judgeFile(IG, jpeg({ width: 1910, height: 1000 }))).toEqual({ state: "fits" });
  });

  it("refuses a type the place does not take, naming what it does take", () => {
    const v = judgeFile(IG, jpeg({ mimeType: "image/png" }));
    expect(v).toEqual({ state: "refused", reason: "An Instagram post takes JPG files, not PNG." });
    expect(judgeFile(IG, { mimeType: "application/pdf", sizeBytes: 10 })).toEqual({ state: "refused", reason: "An Instagram post takes pictures or videos, not this kind of file." });
    expect(judgeFile(WA, { mimeType: "video/mp4", sizeBytes: 10 }).state).toBe("refused");
    expect(judgeFile(IG, { mimeType: "font/woff2", sizeBytes: 10 }).state).toBe("refused");
  });

  it("a picture that is too big could be saved smaller; a document or video that is too big cannot be fixed here", () => {
    const big = judgeFile(WA, { mimeType: "image/png", sizeBytes: 4 * 1024 * 1024 + 1 });
    expect(big).toMatchObject({ state: "fixable", what: "size", fix: "Save it at a smaller size, then add it again." });
    expect(verdictText(big)).toBe("A WhatsApp reply takes files up to 4 MB; this one is 4 MB. Save it at a smaller size, then add it again.");
    expect(judgeFile(WA, { mimeType: "application/pdf", sizeBytes: 5 * 1024 * 1024 })).toEqual({ state: "refused", reason: "A WhatsApp reply takes files up to 4 MB; this one is 5 MB." });
  });

  it("a GIF has its own size limit where the place states one", () => {
    expect(judgeFile(X, { mimeType: "image/gif", sizeBytes: 10 * 1024 * 1024 })).toEqual({ state: "fits" });
    expect(judgeFile(X, { mimeType: "image/jpeg", sizeBytes: 10 * 1024 * 1024 }).state).toBe("fixable");
  });

  it("an empty file is refused, and a file under the place's minimum size is too", () => {
    expect(judgeFile(WA, { mimeType: "image/png", sizeBytes: 0 })).toEqual({ state: "refused", reason: "That file is empty." });
    const small: MediaRule = { ...X, image: { formats: ["image/jpeg"], minBytes: 10 * 1024 } };
    expect(judgeFile(small, jpeg({ sizeBytes: 10 * 1024 - 1 })).state).toBe("refused");
    expect(judgeFile(small, jpeg({ sizeBytes: 10 * 1024 })).state).toBe("fits");
  });

  it("a picture too small in pixels is refused with the number; the wrong shape is fixable, with what to crop to", () => {
    expect(judgeFile(IG, jpeg({ width: 319, height: 400 }))).toEqual({ state: "refused", reason: "An Instagram post needs a picture at least 320 px wide; this one is 319 px." });
    const wide = judgeFile(IG, jpeg({ width: 2400, height: 1000 }));
    expect(wide).toMatchObject({ state: "fixable", what: "shape", reason: "An Instagram post takes shapes from 0.8:1 to 1.91:1; this one is 2.4:1.", fix: "Crop it to a shape between 0.8:1 and 1.91:1, then add it again." });
    expect(judgeFile(IG, jpeg({ width: 1000, height: 1250 })).state).toBe("fits");
    expect(judgeFile(IG, jpeg({ width: 1000, height: 1251 })).state).toBe("fixable");
    // a place that takes one exact shape says to crop to it
    const square: MediaRule = { key: "k", label: "a logo", maxCount: 1, image: { formats: ["image/png"], aspect: { min: 1, max: 1 } } };
    expect(judgeFile(square, { mimeType: "image/png", sizeBytes: 10, width: 200, height: 100 })).toMatchObject({ fix: "Crop it to 1:1, then add it again." });
  });

  it("a long video can be trimmed; a short one cannot be fixed", () => {
    const vid = (durationSeconds: number) => ({ mimeType: "video/mp4", sizeBytes: 1_000_000, durationSeconds });
    expect(judgeFile(IG, vid(901))).toMatchObject({ state: "fixable", what: "length", fix: "Trim it, then add it again." });
    expect(judgeFile(IG, vid(2))).toMatchObject({ state: "refused" });
    expect(judgeFile(IG, vid(900))).toEqual({ state: "fits" });
    expect(judgeFile(IG, vid(3))).toEqual({ state: "fits" });
  });

  it("a limit that cannot be checked for want of a measurement is 'unchecked', never a refusal and never a claim it fits", () => {
    expect(judgeFile(IG, { mimeType: "image/jpeg", sizeBytes: 100 }).state).toBe("unchecked");
    expect(judgeFile(IG, { mimeType: "video/mp4", sizeBytes: 100 }).state).toBe("unchecked");
    // but a limit that IS broken is still found without the measurement
    expect(judgeFile(IG, { mimeType: "image/png", sizeBytes: 100 }).state).toBe("refused");
    // and a place with nothing to measure never says unchecked
    expect(judgeFile(WA, { mimeType: "image/png", sizeBytes: 100 })).toEqual({ state: "fits" });
  });

  it("only a refusal or a fixable file has words to show", () => {
    expect(verdictText({ state: "fits" })).toBeNull();
    expect(verdictText({ state: "unchecked", reason: "x" })).toBeNull();
    expect(verdictText({ state: "refused", reason: "No." })).toBe("No.");
    expect(verdictText({ state: "fixable", what: "shape", reason: "Too wide.", fix: "Crop it." })).toBe("Too wide. Crop it.");
  });
});

describe("what a place takes, in words", () => {
  it("lists the kinds, the accept list, the room and the line above the dropzone", () => {
    expect(kindsOfRule(IG)).toEqual(["image", "video"]);
    expect(kindsOfRule(WA)).toEqual(["image", "document"]);
    expect(acceptOf(WA)).toBe("image/jpeg,image/png,application/pdf");
    expect(roomLeft(IG, 3)).toBe(7);
    expect(roomLeft(IG, 99)).toBe(0);
    expect(roomLeft(IG)).toBe(10);
    expect(takesLine(IG)).toBe("JPG, up to 8 MB. Videos: MP4 or MOV, 15 minutes at most");
    expect(takesLine(WA)).toBe("JPG or PNG, up to 4 MB. Documents: PDF, up to 4 MB");
  });
});

describe("files judged together: a GIF beside other pictures", () => {
  const XR: MediaRule = { ...X, image: { ...X.image!, gifMustBeAlone: true } };
  const gif = { mimeType: "image/gif", sizeBytes: 100 };
  const png = { mimeType: "image/jpeg", sizeBytes: 100 };
  it("says so, in the place's words, only where the rule says a GIF must be alone", () => {
    expect(aloneProblem(XR, [gif, png])).toBe("A GIF has to be the only picture in an X post.");
    expect(aloneProblem(XR, [png, gif])).toBe("A GIF has to be the only picture in an X post.");
    expect(aloneProblem(XR, [gif], 1)).toBe("A GIF has to be the only picture in an X post.");
    expect(aloneProblem(XR, [gif])).toBeNull();
    expect(aloneProblem(XR, [png, png])).toBeNull();
    expect(aloneProblem(X, [gif, png])).toBeNull();
  });
  it("and a video, where the rule says a video goes alone (an Instagram Reel)", () => {
    const reel: MediaRule = { ...IG, video: { ...IG.video!, mustBeAlone: true } };
    const clip = { mimeType: "video/mp4", sizeBytes: 100 };
    expect(aloneProblem(reel, [clip, png])).toBe("A video has to be the only item in an Instagram post.");
    expect(aloneProblem(reel, [png, clip])).toBe("A video has to be the only item in an Instagram post.");
    expect(aloneProblem(reel, [clip])).toBeNull();
    expect(aloneProblem(reel, [png, png])).toBeNull();
    expect(aloneProblem(IG, [clip, png])).toBeNull();
  });
});
