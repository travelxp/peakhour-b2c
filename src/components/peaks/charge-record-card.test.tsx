import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { chargeWhen, type ChargeLine } from "@/lib/charge-record";

// Markup only: the hooks are replaced, so nothing here reaches the api, the router or the auth provider.
const h = vi.hoisted(() => ({
  charges: {
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => {},
    data: undefined as unknown,
  },
  card: { data: undefined as unknown },
}));
vi.mock("@/hooks/use-credits", () => ({
  useCreditCharges: () => h.charges,
  useCreditsRateCard: () => h.card,
}));

const { ChargeRecordCard } = await import("./charge-record-card");

const line = (over: Partial<ChargeLine> = {}): ChargeLine => ({ id: "r1", at: "2026-11-04T10:02:00.000Z", task: "Content ideas", credits: 25, kind: "charge", status: "charged", ...over });
const refundLine = (over: Partial<ChargeLine> = {}): ChargeLine =>
  line({ id: "refund:r2", at: "2026-11-04T11:00:00.000Z", task: "Refund: Brand voice", credits: -150, kind: "refund", status: "refund", refundOf: { id: "r2", at: "2026-11-04T09:00:00.000Z" }, reason: "Charged twice.", automatic: false, ...over });
const pages = (lines: ChargeLine[]) => ({ pages: [{ charges: lines, next: null }] });
const html = () => renderToStaticMarkup(<ChargeRecordCard />);
/** The opening tag of the Download CSV button. */
const downloadButton = (out: string): string => /<button[^>]*>(?:(?!<\/button>)[\s\S])*Download CSV/.exec(out)?.[0].split(">")[0] ?? "";

beforeEach(() => {
  h.charges = { isLoading: false, isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: () => {}, data: undefined };
  h.card = { data: { useCases: [{ useCase: "commerce.assistant", creditMultiplier: 5, free: false }] } };
});

describe("the charge record", () => {
  it("lists each charge with what was done, the Peaks and the status", () => {
    h.charges.data = pages([line(), line({ id: "r2", task: "Brand voice", credits: 150, status: "refunded", refund: { at: "x", reason: "Charged twice.", automatic: false } })]);
    const out = html();
    expect(out).toContain("Charge record");
    expect(out).toContain("Content ideas");
    expect(out).toContain("Brand voice");
    expect(out).toContain("Refunded: Charged twice.");
    // a refunded charge is a badge; a plain charge is not
    expect(out).toMatch(/data-slot="badge"[^>]*>Refunded: Charged twice\./);
    expect(out.match(/data-slot="badge"/g)).toHaveLength(1);
    expect(out).toContain("2 charges shown");
    expect(out).toContain("Download CSV");
  });

  it("shows the refund as its own line with a minus sign, beside the charge it is for, which stays and is marked Refunded", () => {
    h.charges.data = pages([
      refundLine(),
      line({ id: "r2", task: "Brand voice", credits: 150, status: "refunded", at: "2026-11-04T09:00:00.000Z", refund: { at: "2026-11-04T11:00:00.000Z", reason: "Charged twice.", automatic: false } }),
    ]);
    const out = html();
    expect(out).toContain("Refund: Brand voice");
    expect(out).toContain(">-150<");
    expect(out).toContain(">150<");
    expect(out).toContain(`Given back for the charge of ${chargeWhen("2026-11-04T09:00:00.000Z")}: Charged twice.`);
    expect(out).toContain("Refunded: Charged twice.");
    expect(out).toContain('data-line-kind="refund"');
    expect(out).toContain("1 charge and 1 refund shown");
  });

  it("says what is happening when there is nothing yet, or it could not load", () => {
    h.charges.isLoading = true;
    expect(html()).toContain("Loading…");
    h.charges.isLoading = false;
    h.charges.isError = true;
    expect(html()).toContain("We could not load your charges");
    h.charges.isError = false;
    h.charges.data = pages([]);
    expect(html()).toContain("Nothing has been charged yet.");
  });

  it("offers Show more only when there is more, and a download only when there is something to download", () => {
    h.charges.data = pages([line()]);
    expect(html()).not.toContain("Show more");
    h.charges.hasNextPage = true;
    expect(html()).toContain("Show more");
    h.charges.data = pages([]);
    expect(downloadButton(html())).toContain('disabled=""');
    h.charges.data = pages([line()]);
    expect(downloadButton(html())).not.toContain('disabled=""');
  });

  it("states what a shopper's reply costs from the rate card, and says Peaks", () => {
    h.charges.data = pages([]);
    const out = html();
    expect(out).toContain("Charges from shoppers");
    expect(out).toContain("each reply it sends uses 5 Peaks");
    expect(out).not.toMatch(/AI credit/);
  });

  it("states no number for shopper replies when the rate card has no row", () => {
    h.card = { data: { useCases: [] } };
    h.charges.data = pages([]);
    const out = html();
    expect(out).toContain("each reply it sends uses Peaks.");
  });
});
