import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

const { peaksApi, STUDIO_ACTIONS } = await import("./peaks");

beforeEach(() => get.mockReset());

describe("a per-unit Peaks quote carries the number of units (spec 4.1)", () => {
  it("asks with units when the price is per unit", async () => {
    await peaksApi.quote(STUDIO_ACTIONS.makeFinal, { units: 3 });
    expect(get).toHaveBeenCalledWith("/v1/peaks/quote?action=creative.make_final&units=3");
  });
  it("asks without units for every other action, exactly as before", async () => {
    await peaksApi.quote("growth.propose_audiences");
    expect(get).toHaveBeenCalledWith("/v1/peaks/quote?action=growth.propose_audiences");
  });
});
