import { describe, it, expect, vi } from "vitest";
import type { StoragePackView, StorageUsage } from "@/lib/api/media";

vi.mock("@/lib/api", async () => {
  class ApiError extends Error {
    constructor(public code: string, message: string, public status: number, public requestId?: string, public details?: unknown) {
      super(message);
    }
  }
  return { ApiError, api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() }, API_BASE_URL: "https://api.example" };
});

const { ApiError } = await import("@/lib/api");
const copy = await import("@/lib/storage-copy");

const CATALOG = [
  { gb: 5, peaksPerMonth: 750 },
  { gb: 100, peaksPerMonth: 15000 },
];

const usage = (over: Partial<StorageUsage> = {}): StorageUsage => ({
  totalBytes: 0,
  softDeletedBytes: 0,
  fileCount: 0,
  limitBytes: 25 * 1024 ** 3,
  limitGb: 25,
  gbUsed: 0,
  percentUsed: 0,
  source: "plan",
  pool: { planGb: 25, packGb: 0, overrideGb: null, holdings: [{ planKey: "suite", planName: "Suite", trial: false, gb: 25 }] },
  perBusiness: [],
  paused: false,
  packs: [],
  canBuyPacks: true,
  catalog: CATALOG,
  ...over,
});

const pack = (over: Partial<StoragePackView> = {}): StoragePackView => ({
  id: "p1",
  gb: 25,
  peaksPerMonth: 3750,
  boughtAt: "2026-11-04T10:00:00.000Z",
  nextChargeAt: "2026-12-04T10:00:00.000Z",
  cancelAtPeriodEnd: false,
  paused: false,
  ...over,
});

describe("the meter's states", () => {
  it("is normal under 80% and says how the pool is made", () => {
    const s = copy.meterState(usage({ percentUsed: 40 }));
    expect(s.kind).toBe("normal");
    expect(s.message).toBe("25 GB from your plan.");
  });

  it("two plans and a pack read as a pool", () => {
    const s = copy.meterState(
      usage({
        limitGb: 60,
        percentUsed: 10,
        pool: {
          planGb: 50,
          packGb: 10,
          overrideGb: null,
          holdings: [
            { planKey: "suite", planName: "Suite", trial: false, gb: 25 },
            { planKey: "suite", planName: "Suite", trial: false, gb: 25 },
          ],
        },
      }),
    );
    expect(s.message).toBe("50 GB from 2 plans and 10 GB from packs.");
  });

  it("warns from 80% and is full at 100%, offering to add space when packs can be bought", () => {
    expect(copy.meterState(usage({ percentUsed: 79.9 })).kind).toBe("normal");
    expect(copy.meterState(usage({ percentUsed: 80 })).kind).toBe("warn");
    expect(copy.meterState(usage({ percentUsed: 99.9 })).kind).toBe("warn");
    const full = copy.meterState(usage({ percentUsed: 100 }));
    expect(full.kind).toBe("full");
    expect(full.message).toContain("add space");
    expect(full.canAddSpace).toBe(true);
  });

  it("a trial is told to choose a plan, never to add space", () => {
    const s = copy.meterState(
      usage({ source: "trial", limitGb: 5, percentUsed: 100, canBuyPacks: false, catalog: [], pool: { planGb: 5, packGb: 0, overrideGb: null, holdings: [] } }),
    );
    expect(s.kind).toBe("full");
    expect(s.message).toBe("Your trial storage is full. Choose a plan to add more.");
    expect(s.canAddSpace).toBe(false);
  });

  it("a paused pack is its own state: uploads paused, files and space safe, top up Peaks", () => {
    const s = copy.meterState(usage({ percentUsed: 10, paused: true, packs: [pack({ paused: true })] }));
    expect(s.kind).toBe("paused");
    expect(s.message).toContain("New uploads are paused");
    expect(s.message).toContain("files and your space are safe");
    expect(s.message).toContain("Top up your Peaks");
  });

  it("unbounded has no bar and no call to action", () => {
    const s = copy.meterState(usage({ limitBytes: null, limitGb: null, percentUsed: null, source: "unbounded", canBuyPacks: false, catalog: [] }));
    expect(s).toMatchObject({ kind: "unbounded", canAddSpace: false });
  });

  it("used GB rounds down, so the number never says full before the state does", () => {
    expect(copy.gbUsedText(4.96)).toBe("4.9");
    expect(copy.gbUsedText(5)).toBe("5");
    expect(copy.gbUsedText(0.999)).toBe("0.99");
    expect(copy.gbUsedText(0.29)).toBe("0.29"); // 0.29 * 100 is 28.999999999999996
    expect(copy.gbUsedText(4.6)).toBe("4.6");
    expect(copy.gbUsedText(0)).toBe("0.00");
  });

  it("a paused pack offers top-up only, not Add space", () => {
    expect(copy.meterState(usage({ paused: true, packs: [pack({ paused: true })] })).canAddSpace).toBe(false);
  });

  it("a 0 GB quota is full, not unlimited", () => {
    expect(copy.meterState(usage({ limitBytes: 0, limitGb: 0, percentUsed: null })).kind).toBe("full");
  });

  it("when packs cannot be bought the full message does not offer them", () => {
    const s = copy.meterState(usage({ percentUsed: 100, canBuyPacks: false, catalog: [], source: "override" }));
    expect(s.message).not.toMatch(/add space|pack/i);
  });
});

describe("the sentences", () => {
  it("a pack line gives GB, Peaks a month and an 'about' dollar figure at the list price", () => {
    expect(copy.packCostLine(CATALOG[0]!)).toBe("5 GB for 750 Peaks a month (about $0.75)");
    expect(copy.packCostLine(CATALOG[1]!)).toBe("100 GB for 15,000 Peaks a month (about $15)");
  });

  it("never calls $0.001 the sale price", () => {
    const all = [copy.USD_NOTE, copy.CONFIRM_BUY(CATALOG[0]!), copy.packCostLine(CATALOG[1]!)].join(" ");
    expect(all).not.toMatch(/sale price|\$0\.001/);
    expect(copy.USD_NOTE).toContain("list price");
    expect(copy.USD_NOTE).toContain("about");
  });

  it("the confirm step says what is charged now, when it repeats, and that cancelling keeps the space", () => {
    const c = copy.CONFIRM_BUY(CATALOG[0]!);
    expect(c).toContain("750 Peaks now");
    expect(c).toContain("every 30 days");
    expect(c).toContain("cancel any time");
    expect(c).toContain("space stays until the date it would have renewed");
  });

  it("dates are fixed to UTC and en-US, whatever the host", () => {
    expect(copy.longDate("2026-12-04T23:30:00.000Z")).toBe("December 4, 2026");
    expect(copy.longDate("not a date")).toBe("the renewal date");
  });

  it("an owned pack says when it renews, that a cancelled one keeps its space to a date, and what a paused one is doing", () => {
    expect(copy.renewalLine(pack())).toBe("3,750 Peaks a month. Renews on December 4, 2026.");
    expect(copy.renewalLine(pack({ cancelAtPeriodEnd: true }))).toBe("Cancelled. You keep the space until December 4, 2026.");
    expect(copy.renewalLine(pack({ paused: true }))).toContain("Paused: not enough Peaks to renew. You keep the space");
  });

  it("says how many more Peaks a pack needs, and nothing when the balance is unknown or enough", () => {
    expect(copy.shortBy(CATALOG[0]!, 700)).toBe(50);
    expect(copy.shortBy(CATALOG[0]!, 750)).toBe(0);
    expect(copy.shortBy(CATALOG[1]!, null)).toBe(0);
  });
});

describe("errors", () => {
  it("recognises the api's quota 402 only", () => {
    expect(copy.isQuotaError(new ApiError("STORAGE_QUOTA_EXCEEDED", "full", 402))).toBe(true);
    expect(copy.isQuotaError(new ApiError("OTHER", "x", 402))).toBe(false);
    expect(copy.isQuotaError(new Error("STORAGE_QUOTA_EXCEEDED"))).toBe(false);
  });
  it("shows the api's own message for a refused purchase", () => {
    expect(copy.packErrorMessage(new ApiError("STORAGE_PACK_SHORT_WALLET", "A 25 GB pack costs 3,750 Peaks and you have 100. Nothing was charged.", 402))).toContain("Nothing was charged");
    expect(copy.packErrorMessage(new ApiError("STORAGE_PACK_BUSY", "x", 409))).toContain("Another purchase is in progress");
  });

  it("never says 'nothing was charged' when it cannot know: a dropped connection or an error with no pack code says to check", () => {
    for (const err of [new Error("network"), new ApiError("INTERNAL", "boom", 500), new ApiError("STORAGE_PACK_CHARGE_FAILED", "", 503)]) {
      expect(copy.packErrorMessage(err)).toBe(copy.UNSURE_MESSAGE);
    }
    expect(copy.UNSURE_MESSAGE).toContain("Check your packs and your Peaks balance");
    expect(copy.UNSURE_MESSAGE).not.toMatch(/nothing was charged/i);
  });
});
