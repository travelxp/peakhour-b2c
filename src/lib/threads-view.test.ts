import { describe, expect, it } from "vitest";
import { threadsHubState, threadsThumbnail, threadsTypeLabel, threadsViewHref } from "./threads-view";
import { CHANNELS } from "@/app/(site)/dashboard/content/channels.config";

describe("threadsTypeLabel", () => {
  it("names the types Threads sends and leaves a plain text post unlabelled", () => {
    expect(threadsTypeLabel("IMAGE")).toBe("Photo");
    expect(threadsTypeLabel("VIDEO")).toBe("Video");
    expect(threadsTypeLabel("CAROUSEL_ALBUM")).toBe("Carousel");
    expect(threadsTypeLabel("REPOST_FACADE")).toBe("Repost");
    expect(threadsTypeLabel("TEXT_POST")).toBeUndefined();
    expect(threadsTypeLabel(undefined)).toBeUndefined();
  });
});

describe("threadsThumbnail", () => {
  it("shows the image of an image post and never a video file", () => {
    expect(threadsThumbnail({ mediaType: "IMAGE", mediaUrl: "https://cdn/x.jpg" })).toBe("https://cdn/x.jpg");
    expect(threadsThumbnail({ mediaType: "VIDEO", mediaUrl: "https://cdn/x.mp4" })).toBeUndefined();
    expect(threadsThumbnail({ mediaType: "TEXT_POST" })).toBeUndefined();
  });
});

describe("threadsViewHref", () => {
  it("passes a Threads permalink and drops anything else", () => {
    expect(threadsViewHref({ permalink: "https://www.threads.com/@acme/post/ABC" })).toBe("https://www.threads.com/@acme/post/ABC");
    expect(threadsViewHref({ permalink: "https://www.threads.net/@acme/post/ABC" })).toBe("https://www.threads.net/@acme/post/ABC");
    expect(threadsViewHref({ permalink: "javascript:alert(1)" })).toBeUndefined();
    expect(threadsViewHref({ permalink: "https://evil.example/threads.com/" })).toBeUndefined();
    expect(threadsViewHref({})).toBeUndefined();
  });
});

describe("threadsHubState", () => {
  it("decides every state the api can answer", () => {
    expect(threadsHubState({ loading: true })).toBe("loading");
    expect(threadsHubState({ loading: false })).toBe("ready");
    expect(threadsHubState({ loading: false, error: { status: 404, code: "THREADS_NOT_CONNECTED" } })).toBe("not_connected");
    expect(threadsHubState({ loading: false, error: { status: 409, code: "NEEDS_REAUTH" } })).toBe("needs_reauth");
    expect(threadsHubState({ loading: false, error: { status: 403 } })).toBe("needs_permission");
    expect(threadsHubState({ loading: false, error: { status: 404 } })).toBe("error");
    expect(threadsHubState({ loading: false, error: { status: 502, code: "THREADS_UNAVAILABLE" } })).toBe("error");
    expect(threadsHubState({ loading: false, error: {} })).toBe("error");
  });
});

describe("the Content hub row", () => {
  it("links the Threads provider to its hub", () => {
    const row = CHANNELS.find((c) => c.providerKey === "threads");
    expect(row?.dashboardPath).toBe("/dashboard/content/threads");
    expect(row?.status).toBe("available");
  });
});
