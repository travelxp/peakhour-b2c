import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The audiences client's REQUEST SHAPES.
 *
 * ⚠️ THIS FILE IS THIN, AND SO IS WHAT IT CAN PROVE. `audiences.ts` is a
 * pass-through, so the body assertions below are close to `x => x` — they pin
 * the PATHS and the wrapper shape, which is what a hand-written client actually
 * gets wrong, and nothing more. The judgement worth testing lives in
 * `audience-profile-rules.test.ts`, where the panel's decisions are pure
 * functions: which evidence tier a claim rests on, whether a correction is safe
 * to send, whether it changes anything at all.
 *
 * The panel itself has no test: this repo is vitest `environment: "node"` with
 * no jsdom by design (see vitest.config.ts), and adding a DOM stack is a
 * bigger change than this PR should carry. Extracting the decisions was the
 * trade — and it is the half that would have been wrong silently.
 */

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: { get: h.get, post: h.post, patch: h.patch } }));

const { audiencesApi } = await import("./audiences");

beforeEach(() => vi.clearAllMocks());

describe("audiencesApi", () => {
  it("reads the profile from the platform-agnostic path", async () => {
    h.get.mockResolvedValue({ profile: null, correctableFields: [] });
    await audiencesApi.getProfile();
    // Platform is a PARAMETER on this surface, never a path segment — adding
    // Meta must not need a second client.
    expect(h.get).toHaveBeenCalledWith("/v1/audiences/profile");
  });

  it("refreshes with an explicit empty body", async () => {
    // Not because the route needs one — it reads nothing — but because
    // `api.post(path)` and `api.post(path, {})` differ in whether a
    // Content-Type is sent, and pinning the call keeps that stable.
    h.post.mockResolvedValue({ profile: {}, classified: true });
    await audiencesApi.refreshProfile();
    expect(h.post).toHaveBeenCalledWith("/v1/audiences/profile/refresh", {});
  });

  it("sends a scalar correction as `to`", async () => {
    h.patch.mockResolvedValue({ profile: {} });
    await audiencesApi.correctProfile([{ field: "classification.industry", to: "Travel" }]);
    expect(h.patch).toHaveBeenCalledWith("/v1/audiences/profile", {
      corrections: [{ field: "classification.industry", to: "Travel" }],
    });
  });

  it("★sends an EMPTY list as an empty array, not by omitting the key", async () => {
    // "None of these apply" is a real correction and clearing the list is the
    // only way to say it. Dropping the key would make the server read the
    // request as a shape error instead.
    h.patch.mockResolvedValue({ profile: {} });
    await audiencesApi.correctProfile([{ field: "painPoints", toList: [] }]);
    expect(h.patch).toHaveBeenCalledWith("/v1/audiences/profile", {
      corrections: [{ field: "painPoints", toList: [] }],
    });
  });

  it("sends several corrections in one request, in order", async () => {
    // The server applies them in order and the last one for a field wins, so
    // the client must not reorder or batch them into a map.
    h.patch.mockResolvedValue({ profile: {} });
    await audiencesApi.correctProfile([
      { field: "icp", toList: ["A"] },
      { field: "painPoints", toList: ["B"] },
    ]);
    const body = h.patch.mock.calls[0]![1] as { corrections: Array<{ field: string }> };
    expect(body.corrections.map((c) => c.field)).toEqual(["icp", "painPoints"]);
  });
});
