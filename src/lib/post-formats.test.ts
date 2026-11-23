import { describe, it, expect } from "vitest";
import { aloneProblem, judgeFile, ruleForDestination, takesLine, type MediaRule } from "./media-rules";
import { pdfPageCountOf } from "./drive/probe-file";
import { buildMetaChannel } from "./meta-compose";
import { buildScheduleChannels, composerGates, hasHeavyMedia, scheduleMediaType } from "./linkedin-composer";

// the rows GET /v1/media/rules answers for these channels (peakhour-api W3-E2)
const LINKEDIN: MediaRule = {
  key: "post:linkedin",
  label: "a LinkedIn post",
  maxCount: 9,
  image: { formats: ["image/jpeg", "image/png", "image/gif"] },
  video: { formats: ["video/mp4"], minBytes: 75 * 1024, maxBytes: 500 * 1024 * 1024, minSeconds: 3, maxSeconds: 1800, mustBeAlone: true },
  document: { formats: ["application/pdf"], maxBytes: 100 * 1024 * 1024, minPages: 1, maxPages: 300, mustBeAlone: true },
};
const FACEBOOK: MediaRule = {
  key: "post:facebook",
  label: "a Facebook post",
  maxCount: 10,
  image: { formats: ["image/jpeg", "image/png", "image/gif"], maxBytes: 10 * 1024 * 1024 },
  video: { formats: ["video/mp4", "video/quicktime"], mustBeAlone: true },
  reel: { formats: ["video/mp4", "video/quicktime"], minSeconds: 3, maxSeconds: 90, minWidth: 540, minHeight: 960, aspect: { min: 0.557, max: 0.568 }, mustBeAlone: true },
};
const pdf = (over: Record<string, number> = {}) => ({ mimeType: "application/pdf", sizeBytes: 2_000_000, ...over });

describe("a document is judged by its pages", () => {
  it("fits within 300 pages, is refused over, and is not fully checked when the pages are not known", () => {
    expect(judgeFile(LINKEDIN, pdf({ pageCount: 12 }))).toEqual({ state: "fits" });
    expect(judgeFile(LINKEDIN, pdf({ pageCount: 300 }))).toEqual({ state: "fits" });
    expect(judgeFile(LINKEDIN, pdf({ pageCount: 301 }))).toEqual({ state: "refused", reason: "A LinkedIn post takes documents up to 300 pages; this one has 301." });
    expect(judgeFile(LINKEDIN, pdf()).state).toBe("unchecked");
  });
  it("is refused over 100 MB, and a Word file is not a PDF", () => {
    expect(judgeFile(LINKEDIN, pdf({ sizeBytes: 101 * 1024 * 1024, pageCount: 5 })).state).toBe("refused");
    expect(judgeFile(LINKEDIN, { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 1000, pageCount: 3 }).state).toBe("refused");
  });
  it("goes alone: a document beside another file is told so", () => {
    expect(aloneProblem(LINKEDIN, [pdf({ pageCount: 3 }), { mimeType: "image/png", sizeBytes: 10 }])).toBe("A document has to be the only item in a LinkedIn post.");
    expect(aloneProblem(LINKEDIN, [pdf({ pageCount: 3 })], 1)).toBe("A document has to be the only item in a LinkedIn post.");
    expect(aloneProblem(LINKEDIN, [{ mimeType: "image/png", sizeBytes: 10 }, { mimeType: "image/png", sizeBytes: 10 }])).toBeNull();
  });
  it("the Upload tab says the page limit", () => {
    expect(takesLine(LINKEDIN)).toContain("300 pages at most");
  });
});

describe("a video is judged by LinkedIn's own video limits", () => {
  const v = (over: Record<string, number> = {}) => ({ mimeType: "video/mp4", sizeBytes: 10_000_000, durationSeconds: 60, ...over });
  it("takes an MP4 of 3 seconds to 30 minutes, refuses a MOV and a 2-second clip", () => {
    expect(judgeFile(LINKEDIN, v()).state).toBe("fits");
    expect(judgeFile(LINKEDIN, v({ durationSeconds: 1801 })).state).toBe("fixable");
    expect(judgeFile(LINKEDIN, v({ durationSeconds: 2 })).state).toBe("refused");
    expect(judgeFile(LINKEDIN, { mimeType: "video/quicktime", sizeBytes: 10_000_000, durationSeconds: 60 }).state).toBe("refused");
    expect(judgeFile(LINKEDIN, v({ sizeBytes: 501 * 1024 * 1024 })).state).toBe("refused");
  });
});

describe("a Facebook video is a Reel only when the merchant says so", () => {
  const dest = { kind: "post", channel: "facebook" } as const;
  const reel = (over: Record<string, number> = {}) => ({ mimeType: "video/mp4", sizeBytes: 9_000_000, durationSeconds: 30, width: 1080, height: 1920, ...over });
  it("a feed video has no shape or length limit; the Reel rule has", () => {
    const landscape = { mimeType: "video/mp4", sizeBytes: 9_000_000, durationSeconds: 200, width: 1920, height: 1080 };
    expect(judgeFile(ruleForDestination(FACEBOOK, dest), landscape).state).toBe("fits");
    expect(judgeFile(ruleForDestination(FACEBOOK, { ...dest, as: "reel" }), landscape).state).not.toBe("fits");
  });
  it("the Reel rule takes 9:16, 540 x 960 at least, 3 to 90 seconds", () => {
    const r = ruleForDestination(FACEBOOK, { ...dest, as: "reel" });
    expect(judgeFile(r, reel()).state).toBe("fits");
    expect(judgeFile(r, reel({ durationSeconds: 91 })).state).toBe("fixable");
    expect(judgeFile(r, reel({ width: 1080, height: 1350 })).state).toBe("fixable"); // 4:5
    expect(judgeFile(r, reel({ width: 400, height: 711 })).state).toBe("refused"); // vertical but under 540 x 960
  });
  it("a channel with no Reel rule reads its video rule whatever the destination says", () => {
    expect(ruleForDestination(LINKEDIN, { kind: "post", channel: "linkedin", as: "reel" })).toBe(LINKEDIN);
  });
});

describe("pdfPageCountOf reads the page tree root's /Count", () => {
  const tree = "%PDF-1.4\n1 0 obj<</Type/Pages/Kids[2 0 R 3 0 R]/Count 12>>endobj\n2 0 obj<</Type/Pages/Parent 1 0 R/Count 7/Kids[]>>endobj\n3 0 obj<</Type/Pages/Parent 1 0 R/Count 5/Kids[]>>endobj";
  it("takes the root (the /Pages dictionary with no /Parent), and says nothing when there is none in the clear", () => {
    expect(pdfPageCountOf(tree)).toBe(12);
    expect(pdfPageCountOf("%PDF-1.5\nstream\n...compressed...\nendstream")).toBeUndefined();
    expect(pdfPageCountOf("<</Type/Pages/Count 0/Kids[]>>")).toBeUndefined();
  });
  it("a bookmark tree's /Count is not the page count", () => {
    expect(pdfPageCountOf(tree + "\n9 0 obj<</Type/Outlines/First 10 0 R/Last 11 0 R/Count 150>>endobj")).toBe(12);
  });
  it("a PDF saved in increments has several roots: the last is the live one", () => {
    expect(pdfPageCountOf(tree + "\n%%EOF\n1 0 obj<</Type/Pages/Kids[2 0 R 3 0 R 4 0 R]/Count 13>>endobj")).toBe(13);
  });
});

describe("what the composers send", () => {
  const media = (mime: string) => [{ url: "https://cdn.test/abc", mime }];
  it("a Facebook video says it is a video, or a Reel when chosen; a picture says nothing", () => {
    const base = { text: "Hello", link: "" };
    expect(buildMetaChannel("facebook", { ...base, media: media("video/mp4") }).payload.channelOptions).toEqual({ mediaType: "VIDEO" });
    expect(buildMetaChannel("facebook", { ...base, media: media("video/mp4"), reel: true }).payload.channelOptions).toEqual({ mediaType: "REELS" });
    expect(buildMetaChannel("facebook", { ...base, media: media("image/jpeg"), reel: true }).payload).not.toHaveProperty("channelOptions");
    expect(buildMetaChannel("instagram", { ...base, media: media("video/mp4") }).payload.channelOptions).toEqual({ mediaType: "REELS" });
  });
  it("a LinkedIn scheduled post says video or document, so the publisher takes the right flow without a file ending", () => {
    expect(scheduleMediaType(["video/mp4"])).toBe("VIDEO");
    expect(scheduleMediaType(["application/pdf"])).toBe("DOCUMENT");
    expect(scheduleMediaType(["image/png", "image/png"])).toBeUndefined();
    const input = { authorKey: "person", personUrn: "urn:li:person:a", visibility: "PUBLIC" as const, showLink: false, linkUrl: "", linkTitle: "", text: "Deck" };
    const [entry] = buildScheduleChannels({ ...input, mediaUrls: ["https://cdn.test/abc"], mediaMimes: ["application/pdf"] });
    expect(entry!.payload.channelOptions).toMatchObject({ mediaType: "DOCUMENT" });
    const [pics] = buildScheduleChannels({ ...input, mediaUrls: ["https://cdn.test/a"], mediaMimes: ["image/png"] });
    expect(pics!.payload.channelOptions).not.toHaveProperty("mediaType");
  });
  it("the instant Publish is off while a video or a document is on a LinkedIn post (it goes through Schedule)", () => {
    const g = (heavy: boolean) => composerGates({ text: "hello", showLink: false, linkUrl: "", pollActive: false, pollValid: false, anyPending: false, linkLooksLikeUrl: false, heavyMedia: heavy });
    expect(g(false).publishDisabled).toBe(false);
    expect(g(true).publishDisabled).toBe(true);
    expect(g(true).scheduleDisabled).toBe(false);
    expect(hasHeavyMedia(["image/png", "application/pdf"])).toBe(true);
    expect(hasHeavyMedia(["image/png"])).toBe(false);
  });
});
