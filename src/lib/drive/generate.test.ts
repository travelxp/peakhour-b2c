import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { post: h.post }, newActionKey: () => ({ "Idempotency-Key": "click-test" }) }));

const { generateImageToDrive, GeneratedPrivateError } = await import("./generate");

beforeEach(() => {
  h.post.mockReset();
});

describe("generateImageToDrive", () => {
  it("posts the sentence once, with this click's key and the quote that was shown", async () => {
    h.post.mockResolvedValue({ mediaId: "m1", name: "A blue tin", mimeType: "image/png", publicUrl: "https://media.test/m1.png", width: 1024, height: 1024, deduped: false });
    const asset = await generateImageToDrive({ prompt: "A blue tin", quoteToken: "tok" });
    expect(h.post).toHaveBeenCalledTimes(1);
    expect(h.post).toHaveBeenCalledWith("/v1/media/generate", { prompt: "A blue tin", aspect: "1:1" }, { "Idempotency-Key": "click-test", "x-peaks-quote": "tok" });
    expect(asset).toMatchObject({ id: "m1", url: "https://media.test/m1.png", name: "A blue tin", mime: "image/png", width: 1024, height: 1024, visibility: "published", source: "ai_image" });
  });

  it("sends no quote header when no price was held, and the aspect when one is asked for", async () => {
    h.post.mockResolvedValue({ mediaId: "m1", name: "x", mimeType: "image/png", publicUrl: "https://media.test/m1.png", deduped: false });
    await generateImageToDrive({ prompt: "A tin", aspect: "9:16" });
    expect(h.post).toHaveBeenCalledWith("/v1/media/generate", { prompt: "A tin", aspect: "9:16" }, { "Idempotency-Key": "click-test" });
  });

  it("an image that is already in Drive as a Private file has no public link to hand back: a typed result naming the file, never an empty address", async () => {
    h.post.mockResolvedValue({ mediaId: "m1", name: "x", mimeType: "image/png", deduped: true });
    const caught = await generateImageToDrive({ prompt: "A tin" }).catch((e: unknown) => e);
    expect(caught).toBeInstanceOf(GeneratedPrivateError);
    expect((caught as InstanceType<typeof GeneratedPrivateError>).mediaId).toBe("m1");
    expect((caught as Error).message).toMatch(/already in Drive as a Private file/);
  });

  it("lets the api's refusal through untouched, so the tab can say what to do", async () => {
    const refusal = Object.assign(new Error("You need 40 credits"), { code: "CREDITS_EXHAUSTED", status: 429 });
    h.post.mockRejectedValue(refusal);
    const caught = await generateImageToDrive({ prompt: "A tin" }).catch((e: unknown) => e);
    expect(caught).toBe(refusal);
  });
});
