import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { getWithMeta: h.get, put: h.put, get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const { listKitFileCandidates, saveBrandVoice } = await import("./brand-kit");

beforeEach(() => {
  h.get.mockReset().mockResolvedValue({ data: [], meta: { hasMore: false } });
  h.put.mockReset().mockResolvedValue({ voice: null });
});

describe("listKitFileCandidates", () => {
  it("asks for Published images only: a logo needs a public link for an ad", async () => {
    await listKitFileCandidates({ kind: "image" });
    expect(h.get.mock.calls[0]![1]).toMatchObject({ kind: "image", visibility: "published" });
  });

  it("does NOT filter fonts or documents by visibility: a licensed font may be Private", async () => {
    await listKitFileCandidates({ kind: "font" });
    await listKitFileCandidates({ kind: "document" });
    expect(h.get.mock.calls[0]![1]).toMatchObject({ kind: "font" });
    expect(h.get.mock.calls[0]![1]).not.toHaveProperty("visibility");
    expect(h.get.mock.calls[1]![1]).not.toHaveProperty("visibility");
  });
});

describe("saveBrandVoice", () => {
  it("PUTs the voice to the one route that writes it", async () => {
    await saveBrandVoice({ tone: "Warm", vocabulary: [] });
    expect(h.put).toHaveBeenCalledWith("/v1/brand-kit/voice", { tone: "Warm", vocabulary: [] });
  });
});
