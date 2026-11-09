import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The claim request carries exactly the choice made (api#1482): keeping the
 * store separate sends `mode: "separate"` and nothing that would attach it.
 */

const request = vi.fn<(path: string, init: { method: string; body: string }) => Promise<unknown>>(async () => ({}));
vi.mock("@/lib/api", () => ({ api: { request } }));

const { claimShopifyStore } = await import("./shopify-claim");

const sent = () => JSON.parse(request.mock.calls[0]![1].body) as Record<string, unknown>;

beforeEach(() => request.mockClear());

describe("claimShopifyStore", () => {
  it("keeping the store separate sends mode: separate, and no account or business", async () => {
    await claimShopifyStore("s1", "tok", { mode: "separate" });
    expect(request.mock.calls[0]![0]).toBe("/v1/shopify/claim");
    expect(sent()).toEqual({ store: "s1", token: "tok", mode: "separate" });
  });

  it("attaching sends the account, the business and the confirmation", async () => {
    await claimShopifyStore("s1", "tok", { orgId: "o1", businessId: "b1", confirmed: true });
    expect(sent()).toEqual({ store: "s1", token: "tok", orgId: "o1", businessId: "b1", confirmed: true });
  });

  it("the one-click path sends only the store and token", async () => {
    await claimShopifyStore("s1", "tok");
    expect(sent()).toEqual({ store: "s1", token: "tok" });
  });
});
