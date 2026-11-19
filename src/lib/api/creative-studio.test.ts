import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
let keyCount = 0;

vi.mock("@/lib/api", () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a) },
  newActionKey: () => ({ "Idempotency-Key": `click-${++keyCount}` }),
}));

const { studioApi, pressHeaders } = await import("./creative-studio");

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  keyCount = 0;
});

describe("every charged call is one click: a fresh Idempotency-Key and the receipts of the price that was shown", () => {
  it("previews send both receipts (the press and the cut-out) and the count", async () => {
    await studioApi.makePreviews("c1", 4, { main: "tok-main", cutout: "tok-cut" });
    expect(post).toHaveBeenCalledWith("/v1/creative/c1/previews", { count: 4 }, { "Idempotency-Key": "click-1", "x-peaks-quote": "tok-main", "x-peaks-quote-cutout": "tok-cut" });
  });

  it("'one more' sends no count (the api refuses a count under 3)", async () => {
    await studioApi.makePreviews("c1", undefined, { main: "tok" });
    expect(post).toHaveBeenCalledWith("/v1/creative/c1/previews", undefined, { "Idempotency-Key": "click-1", "x-peaks-quote": "tok" });
  });

  it("no receipt is sent when there is none (the live price applies); a key always is", () => {
    expect(pressHeaders({})).toEqual({ "Idempotency-Key": "click-1" });
  });

  it("two clicks get two keys", async () => {
    await studioApi.newBackground("c1", "p1", { main: "t" });
    await studioApi.newWording("c1", { main: "t" });
    expect(post.mock.calls[0]![2]["Idempotency-Key"]).not.toBe(post.mock.calls[1]![2]["Idempotency-Key"]);
    expect(post.mock.calls[0]![0]).toBe("/v1/creative/c1/previews/p1/new-background");
    expect(post.mock.calls[1]![0]).toBe("/v1/creative/c1/wording");
  });

  it("finals send the receipt for exactly the items chosen", async () => {
    await studioApi.makeFinals([{ creativeId: "c1", previewId: "p1" }], "tok-final");
    expect(post).toHaveBeenCalledWith("/v1/creative/finals", { items: [{ creativeId: "c1", previewId: "p1" }] }, { "Idempotency-Key": "click-1", "x-peaks-quote": "tok-final" });
  });
});

describe("the free calls", () => {
  it("the quote of a press is asked of the creative", async () => {
    await studioApi.pressQuote("c1", "previews", 4);
    await studioApi.pressQuote("c1", "wording");
    expect(get).toHaveBeenNthCalledWith(1, "/v1/creative/c1/quote?kind=previews&count=4");
    expect(get).toHaveBeenNthCalledWith(2, "/v1/creative/c1/quote?kind=wording");
  });

  it("a tweak names the version it was made against", async () => {
    await studioApi.tweak("c1", "p1", 3, { op: "position.set", position: "top" });
    expect(patch).toHaveBeenCalledWith("/v1/creative/c1/previews/p1/tweak", { baseVersion: 3, op: { op: "position.set", position: "top" } });
  });

  it("the heart, skip and the plan", async () => {
    await studioApi.heart("c1", "p1", true);
    await studioApi.skip("c1", "p1", ["Too busy"]);
    await studioApi.patchBrief("c1", { line: "x" });
    expect(post).toHaveBeenNthCalledWith(1, "/v1/creative/c1/previews/p1/shortlist", { on: true });
    expect(post).toHaveBeenNthCalledWith(2, "/v1/creative/c1/previews/p1/skip", { reasons: ["Too busy"] });
    expect(patch).toHaveBeenCalledWith("/v1/creative/c1/brief", { line: "x" });
  });

  it("product photos page by `next` and can name a product", async () => {
    await studioApi.productImages();
    await studioApi.productImages({ productId: "p9", after: "abc", limit: 20 });
    expect(get).toHaveBeenNthCalledWith(1, "/v1/media/product-images?limit=100");
    expect(get).toHaveBeenNthCalledWith(2, "/v1/media/product-images?productId=p9&after=abc&limit=20");
  });
});
