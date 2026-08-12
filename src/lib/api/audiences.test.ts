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

const { audiencesApi, AUDIENCE_OBJECTIVES } = await import("./audiences");

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

  it("plans a portfolio on the platform-agnostic path", async () => {
    h.post.mockResolvedValue({ planId: "p1", sets: [], refusal: null });
    await audiencesApi.plan({ objective: "lead_generation" });
    expect(h.post).toHaveBeenCalledWith("/v1/audiences/plan", {
      objective: "lead_generation",
    });
  });

  it("★does not send a `geo` key when the caller has none", async () => {
    // The api treats an ABSENT `geo` as "use what the profile says" and an
    // EMPTY array as the user saying none of these apply — the same
    // distinction `/propose` makes. A client that helpfully defaulted the key
    // to `[]` would turn "we inferred India" into "the user told us nowhere",
    // and the plan would refuse with `no_geography`.
    h.post.mockResolvedValue({ planId: null, sets: [], refusal: null });
    await audiencesApi.plan({ objective: "engagement", platform: "linkedin" });
    const body = h.post.mock.calls[0]![1] as Record<string, unknown>;
    expect("geo" in body).toBe(false);
  });

  it("★offers exactly the objectives the api's enum accepts", async () => {
    // A value the server does not recognise is a 400, which a customer reads
    // as "the button is broken" — the same accepted-then-ignored failure the
    // library's filters are built around. Mirrored from `PlanBody.objective`.
    expect([...AUDIENCE_OBJECTIVES]).toEqual([
      "lead_generation",
      "brand_awareness",
      "website_traffic",
      "engagement",
    ]);
  });
});
