import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { request: h.request }, newActionKey: () => ({ "Idempotency-Key": "click-1" }) }));

const { repurpose, repurposeQuote } = await import("./repurpose");

beforeEach(() => h.request.mockReset().mockResolvedValue({}));

describe("the press carries what the merchant was shown", () => {
  const req = { source: { type: "facebook_post", postId: "1001_555" } as const, platforms: ["linkedin", "wordpress"], platformFitId: "f".repeat(24) };

  it("one key per click, and a receipt per kind of writing, on the headers the api reads", async () => {
    await repurpose(req, { posts: "tok-p", articles: "tok-a" });
    const [path, opts] = h.request.mock.calls[0]!;
    expect(path).toBe("/v1/content/repurpose");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(req);
    expect(opts.headers).toEqual({ "Idempotency-Key": "click-1", "x-peaks-quote": "tok-p", "x-peaks-quote-article": "tok-a" });
  });

  it("sends no receipt header it does not hold", async () => {
    await repurpose(req, { posts: "tok-p" });
    expect(h.request.mock.calls[0]![1].headers).toEqual({ "Idempotency-Key": "click-1", "x-peaks-quote": "tok-p" });
    await repurpose(req);
    expect(h.request.mock.calls[1]![1].headers).toEqual({ "Idempotency-Key": "click-1" });
  });

  it("asks for the price of the channels, before any press", async () => {
    await repurposeQuote(["linkedin", "x"]);
    expect(h.request).toHaveBeenCalledWith("/v1/content/repurpose/quote?platforms=linkedin%2Cx");
  });
});
