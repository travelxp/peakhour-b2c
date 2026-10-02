import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// The kinds endpoint, answered in turn by the test.
const answers: Array<{ kinds: string[]; complete?: boolean }> = [];
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(async () => answers.shift()) },
}));

import { cmsJobKindsQueryOptions, cmsJobsKeys } from "./use-jobs";

beforeEach(() => {
  answers.length = 0;
});

// ★The wiring, not the helpers (cms#175 parity): `structuralSharing` and
//  `refetchInterval` are what apply `./job-kinds-answer`. No DOM here: the
//  query client applies `structuralSharing` on every fetch.
describe("cmsJobKindsQueryOptions", () => {
  it("★★an incomplete refetch keeps the kinds already held", async () => {
    const client = new QueryClient();
    answers.push({ kinds: ["ad_boost_launch", "onboarding_discovery"], complete: true });
    answers.push({ kinds: ["ad_boost_launch"], complete: false });
    await client.fetchQuery({ ...cmsJobKindsQueryOptions(), staleTime: 0 });
    await client.fetchQuery({ ...cmsJobKindsQueryOptions(), staleTime: 0 });
    expect(client.getQueryData(cmsJobsKeys.kinds())).toEqual({
      kinds: ["ad_boost_launch", "onboarding_discovery"],
      complete: false,
    });
  });

  it("★an absent flag is complete, and an unchanged answer keeps its reference", async () => {
    const client = new QueryClient();
    answers.push({ kinds: ["ad_boost_launch"] });
    answers.push({ kinds: ["ad_boost_launch"] });
    const first = await client.fetchQuery({ ...cmsJobKindsQueryOptions(), staleTime: 0 });
    expect(first).toEqual({ kinds: ["ad_boost_launch"], complete: true });
    await client.fetchQuery({ ...cmsJobKindsQueryOptions(), staleTime: 0 });
    expect(client.getQueryData(cmsJobsKeys.kinds())).toBe(first);
  });

  it("★★polls only while the answer is incomplete, or failed", () => {
    const { refetchInterval } = cmsJobKindsQueryOptions();
    expect(refetchInterval({ state: { data: { kinds: [], complete: false }, status: "success" } })).toBe(60_000);
    expect(refetchInterval({ state: { data: { kinds: [], complete: true }, status: "success" } })).toBe(false);
    expect(refetchInterval({ state: { data: undefined, status: "error" } })).toBe(60_000);
  });
});
