import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { StoragePackView, StorageUsage } from "@/lib/api/media";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() }, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));
vi.mock("@/hooks/use-credits", () => ({ useCreditsBalance: vi.fn() }));

const { AddSpacePanel } = await import("./add-space-dialog");
const { StorageMeter } = await import("@/app/(site)/dashboard/media/storage-meter");
const { StoragePeaksView } = await import("./storage-peaks-card");

const CATALOG = [
  { gb: 5, peaksPerMonth: 750 },
  { gb: 25, peaksPerMonth: 3750 },
  { gb: 100, peaksPerMonth: 15000 },
];
const owned = (over: Partial<StoragePackView> = {}): StoragePackView => ({
  id: "p1",
  gb: 25,
  peaksPerMonth: 3750,
  boughtAt: "2026-11-04T10:00:00.000Z",
  nextChargeAt: "2026-12-04T10:00:00.000Z",
  cancelAtPeriodEnd: false,
  paused: false,
  ...over,
});
const usage = (over: Partial<StorageUsage> = {}): StorageUsage => ({
  totalBytes: 0,
  softDeletedBytes: 0,
  fileCount: 0,
  limitBytes: 25 * 1024 ** 3,
  limitGb: 25,
  gbUsed: 20,
  percentUsed: 80,
  source: "plan",
  pool: { planGb: 25, packGb: 0, overrideGb: null, holdings: [{ planKey: "suite", planName: "Suite", trial: false, gb: 25 }] },
  perBusiness: [],
  paused: false,
  packs: [],
  canBuyPacks: true,
  catalog: CATALOG,
  ...over,
});

const noop = () => {};
const panel = (u: StorageUsage, over: Partial<Parameters<typeof AddSpacePanel>[0]> = {}) =>
  renderToStaticMarkup(
    <AddSpacePanel
      usage={u}
      balance={5000}
      step="choose"
      selectedGb={null}
      cancelId={null}
      busy={false}
      error={null}
      onSelect={noop}
      onContinue={noop}
      onBack={noop}
      onBuy={noop}
      onAskCancel={noop}
      onCancelPack={noop}
      {...over}
    />,
  );

describe("Add space: choose", () => {
  it("lists every pack with its monthly Peaks and shows the Peaks balance", () => {
    const out = panel(usage());
    for (const c of CATALOG) expect(out).toContain(`${c.gb} GB for ${c.peaksPerMonth.toLocaleString("en-US")} Peaks a month`);
    expect(out).toContain("Your Peaks:");
    expect(out).toContain("5,000");
  });

  it("a pack the balance cannot cover is disabled and says how many more Peaks it needs, with a way to top up", () => {
    const out = panel(usage(), { balance: 2000 });
    expect(out).toContain("Needs 1,750 more Peaks");
    expect(out).toContain("Needs 13,000 more Peaks");
    expect(out).not.toContain("Needs 0");
    expect(out).toContain("Top up your Peaks");
    // two packs the balance cannot cover, plus Continue (nothing is picked yet)
    expect(out.match(/disabled=""/g)?.length).toBe(3);
  });

  it("Continue stays disabled until a pack is picked", () => {
    expect(panel(usage())).toMatch(/<button[^>]*disabled=""[^>]*>Continue</);
    expect(panel(usage(), { selectedGb: 5 })).not.toMatch(/<button[^>]*disabled=""[^>]*>Continue</);
  });

  it("owned packs show the renewal date and a Cancel; a cancelled one shows its end date and no Cancel", () => {
    const out = panel(usage({ packs: [owned(), owned({ id: "p2", gb: 10, peaksPerMonth: 1500, cancelAtPeriodEnd: true })] }));
    expect(out).toContain("Renews on December 4, 2026");
    expect(out).toContain("Cancelled. You keep the space until December 4, 2026.");
    expect(out.match(/>Cancel</g)?.length).toBe(1);
  });

  it("a trial is sent to choose a plan, and offers no pack", () => {
    const out = panel(usage({ source: "trial", limitGb: 5, canBuyPacks: false, catalog: [] }));
    expect(out).toContain("Choose a plan");
    expect(out).not.toContain("Peaks a month");
  });

  it("always carries the note that dollar amounts are about, at the list price, and that usage is never charged", () => {
    const out = panel(usage());
    expect(out).toContain("about, at the list price of $1 per 1,000 Peaks");
    expect(out).toContain("Nothing is charged for the space you use");
  });
});

describe("Add space: confirm and cancel", () => {
  it("confirm repeats the cost, the balance and the cancel promise before any charge", () => {
    const out = panel(usage(), { step: "confirm", selectedGb: 25 });
    expect(out).toContain("25 GB storage pack");
    expect(out).toContain("3,750 Peaks now");
    expect(out).toContain("every 30 days");
    expect(out).toContain("Pay 3,750 Peaks");
    expect(out).toContain("5,000");
  });

  it("the pay button is disabled while busy and when the balance is short", () => {
    expect(panel(usage(), { step: "confirm", selectedGb: 25, busy: true })).toMatch(/<button[^>]*disabled=""[^>]*aria-busy="true"[^>]*>Buying/);
    expect(panel(usage(), { step: "confirm", selectedGb: 25, balance: 100 })).toMatch(/<button[^>]*disabled=""[^>]*>Pay 3,750 Peaks/);
    expect(panel(usage(), { step: "confirm", selectedGb: 25 })).not.toMatch(/<button[^>]*disabled=""[^>]*>Pay 3,750 Peaks/);
  });

  it("an error is announced and the cancel step says the space stays to the date", () => {
    expect(panel(usage(), { step: "confirm", selectedGb: 25, error: "Nothing was charged." })).toContain('role="alert"');
    const out = panel(usage({ packs: [owned()] }), { step: "cancel", cancelId: "p1" });
    expect(out).toContain("Stop renewing the 25 GB pack?");
    expect(out).toContain("keep the space until December 4, 2026");
  });
});

describe("the meter and the Peaks page line", () => {
  it("the page meter shows GB of the pool, an Add space button when packs can be bought, and no overage wording", () => {
    const out = renderToStaticMarkup(<StorageMeter usage={usage({ gbUsed: 20.1, limitGb: 50, limitBytes: 50 * 1024 ** 3, percentUsed: 40.2 })} />);
    expect(out).toContain("20.1 / 50 GB");
    expect(out).toContain("Add space");
    expect(out).not.toMatch(/overage|upgrade/i);
  });

  it("a paused pack shows the paused words and a Top up Peaks link", () => {
    const out = renderToStaticMarkup(<StorageMeter usage={usage({ paused: true, packs: [owned({ paused: true })] })} />);
    expect(out).toContain("New uploads are paused");
    expect(out).toContain("Top up Peaks");
    // one piece of guidance, not two: a new purchase would be gated on the same short wallet
    expect(out).not.toContain("Add space");
  });

  it("the used figure never reads as full before the bar does: 4.96 of 5 GB shows 4.9", () => {
    const out = renderToStaticMarkup(<StorageMeter usage={usage({ gbUsed: 4.96, limitGb: 5, limitBytes: 5 * 1024 ** 3, percentUsed: 99.2 })} compact />);
    expect(out).toContain("4.9 / 5 GB");
  });

  it("the compact sidebar meter is the bar and the numbers only", () => {
    const out = renderToStaticMarkup(<StorageMeter usage={usage()} compact />);
    expect(out).toContain("20 / 25 GB");
    expect(out).not.toContain("Add space");
  });

  it("the Peaks page line is its own card, sums the live packs' monthly Peaks and says usage is never charged", () => {
    const out = renderToStaticMarkup(
      <StoragePeaksView usage={usage({ packs: [owned(), owned({ id: "p2", gb: 10, peaksPerMonth: 1500 }), owned({ id: "p3", gb: 5, peaksPerMonth: 750, cancelAtPeriodEnd: true })] })} />,
    );
    expect(out).toContain("Storage");
    expect(out).toContain("5,250 Peaks a month");
    expect(out).toContain("never for the space you use");
    expect(renderToStaticMarkup(<StoragePeaksView usage={usage()} />)).toContain("No storage packs");
  });

  it("a paused pack is not counted in the monthly total (nothing is being charged for it) and offers no purchase", () => {
    const out = renderToStaticMarkup(<StoragePeaksView usage={usage({ paused: true, packs: [owned({ paused: true }), owned({ id: "p2", gb: 10, peaksPerMonth: 1500 })] })} />);
    expect(out).toContain("1,500 Peaks a month");
    expect(out).not.toContain("5,250");
    expect(out).not.toContain("Add space");
  });
});
