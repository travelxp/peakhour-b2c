import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { post: h.post, patch: h.patch, get: vi.fn() } }));

import { MetaLaunchError, metaAdsApi } from "./meta-ads";

const bodies = {
  campaign: { name: "c" },
  adSet: (campaignId: string) => ({ campaignId }),
  ad: (adsetId: string) => ({ adsetId }),
};

beforeEach(() => {
  h.post.mockReset();
  h.patch.mockReset();
});

describe("launchCampaign", () => {
  it("creates campaign, ad set, ad in that order, each with the id from the level above", async () => {
    h.post
      .mockResolvedValueOnce({ campaignId: "c1" })
      .mockResolvedValueOnce({ adSetId: "s1" })
      .mockResolvedValueOnce({ adId: "a1" });
    await expect(metaAdsApi.launchCampaign(bodies)).resolves.toEqual({ campaignId: "c1", adSetId: "s1", adId: "a1" });
    expect(h.post.mock.calls.map((c) => c[0])).toEqual([
      "/v1/meta/ads/campaigns",
      "/v1/meta/ads/ad-sets",
      "/v1/meta/ads/ads",
    ]);
    expect(h.post.mock.calls[1]![1]).toEqual({ campaignId: "c1" });
    expect(h.post.mock.calls[2]![1]).toEqual({ adsetId: "s1" });
    expect(h.patch).not.toHaveBeenCalled();
  });

  it("a refusal at level one is a MetaLaunchError with no campaign, and nothing to remove", async () => {
    const cause = new Error("over the weekly limit");
    h.post.mockRejectedValueOnce(cause);
    const err = await metaAdsApi.launchCampaign(bodies).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MetaLaunchError);
    expect((err as MetaLaunchError).cause).toBe(cause);
    expect((err as MetaLaunchError).campaignId).toBeNull();
    expect((err as MetaLaunchError).leftBehind).toBe(false);
    expect(h.patch).not.toHaveBeenCalled();
  });

  it("removes the campaign when the ad set fails, so a retry does not mint a second", async () => {
    h.post.mockResolvedValueOnce({ campaignId: "c1" }).mockRejectedValueOnce(new Error("no"));
    h.patch.mockResolvedValue({});
    const err = (await metaAdsApi.launchCampaign(bodies).catch((e: unknown) => e)) as MetaLaunchError;
    expect(h.patch).toHaveBeenCalledWith("/v1/meta/ads/campaigns/c1/status", { status: "DELETED" });
    expect(err.campaignId).toBe("c1");
    expect(err.leftBehind).toBe(false);
  });

  it("removes the campaign when the ad fails too", async () => {
    h.post.mockResolvedValueOnce({ campaignId: "c1" }).mockResolvedValueOnce({ adSetId: "s1" }).mockRejectedValueOnce(new Error("no"));
    h.patch.mockResolvedValue({});
    await metaAdsApi.launchCampaign(bodies).catch(() => undefined);
    expect(h.patch).toHaveBeenCalledTimes(1);
  });

  it("says the campaign is left behind when it cannot be removed", async () => {
    h.post.mockResolvedValueOnce({ campaignId: "c1" }).mockRejectedValueOnce(new Error("no"));
    h.patch.mockRejectedValue(new Error("also no"));
    const err = (await metaAdsApi.launchCampaign(bodies).catch((e: unknown) => e)) as MetaLaunchError;
    expect(err.leftBehind).toBe(true);
    expect(err.campaignId).toBe("c1");
  });
});
