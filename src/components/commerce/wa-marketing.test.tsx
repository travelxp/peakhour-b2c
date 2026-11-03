import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Broadcast, WaOverview } from "@/lib/wa-marketing";

// The views are pure given their data; the hook module is replaced so nothing here reaches the api or the auth provider.
const save = { mutate: vi.fn(), isPending: false, isError: false, isSuccess: false, error: null };
vi.mock("@/hooks/use-wa-marketing", () => ({
  useSaveWaSettings: () => save,
  useWaOverview: () => ({}),
  useBroadcasts: () => ({}),
  useCancelBroadcast: () => ({}),
  useCreateBroadcast: () => ({}),
  usePreviewBroadcast: () => ({}),
  useWaProducts: () => ({}),
  useWaTemplates: () => ({}),
}));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { WinBackView } = await import("./win-back");
const { BroadcastRow } = await import("./broadcasts");

const overview = (over: Partial<WaOverview> = {}, ready: WaOverview["recovery"]["ready"] = "ready"): WaOverview => ({
  supported: true,
  stopped: false,
  settings: { cartRecovery: { enabled: false, delayMinutes: 60, secondReminder: false }, broadcasts: { enabled: false }, frequencyCap: { max: 1, perDays: 3 } },
  recovery: { ready, counts: { watching: 2, reminded: 5, recovered: 1 }, recoveredRevenue: [{ currency: "INR", minor: 149900 }], windowDays: 30 },
  ratesAsOf: "2026-11-03",
  currency: "INR",
  ...over,
});

describe("Win back carts", () => {
  it("is OFF by default, says Measured, and shows the recovered revenue", () => {
    const out = renderToStaticMarkup(<WinBackView data={overview()} />);
    expect(out).toMatch(/role="switch" aria-checked="false"[^>]*id="wb-enabled"/);
    expect(out).toContain("Off until you turn them on.");
    expect(out).toContain("Measured");
    expect(out).toContain("1,499.00");
    expect(out).toContain('href="/dashboard/commerce/broadcasts"');
    expect(out).not.toContain("data-tone");
  });

  it("shows Meta's approval as a wait, with the reason nothing is sent", () => {
    const out = renderToStaticMarkup(<WinBackView data={overview({}, "template_not_approved")} />);
    expect(out).toContain("Waiting for Meta to approve the reminder message");
    expect(out).toContain('data-tone="info"');
  });

  it("shows the emergency stop above everything", () => {
    const out = renderToStaticMarkup(<WinBackView data={overview({ stopped: true })} />);
    expect(out).toContain("Your emergency stop is on");
  });

  it("None yet when nothing is recovered", () => {
    const d = overview();
    d.recovery.recoveredRevenue = [];
    expect(renderToStaticMarkup(<WinBackView data={d} />)).toContain("None yet");
  });
});

const row = (over: Partial<Broadcast> = {}): Broadcast => ({
  id: "b1",
  name: "Diwali",
  templateName: "diwali",
  message: "Hi, Acme here. 10% off",
  audience: { kind: "all_opted_in" },
  audienceSize: 120,
  estimate: { currency: "INR", totalMinor: 9480 },
  status: "scheduled",
  scheduledFor: "2026-11-05T10:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  counts: { queued: 120, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0, skipped: 0, attributedOrders: 0, attributedMinor: 0 },
  canCancel: true,
  ...over,
});

describe("a broadcast row", () => {
  it("a scheduled one can be cancelled", () => {
    const out = renderToStaticMarkup(<BroadcastRow b={row()} currency="INR" onCancel={() => undefined} />);
    expect(out).toContain("Scheduled");
    expect(out).toContain("Cancel broadcast");
    expect(out).toContain("120 shoppers");
  });

  it("one that has started cannot be undone, and says so instead of offering Cancel", () => {
    const out = renderToStaticMarkup(
      <BroadcastRow
        b={row({ status: "sending", canCancel: false, counts: { queued: 20, sent: 100, delivered: 90, read: 40, replied: 3, failed: 0, skipped: 0, attributedOrders: 2, attributedMinor: 250000 } })}
        currency="INR"
        onCancel={() => undefined}
      />,
    );
    expect(out).not.toContain("Cancel broadcast");
    expect(out).toContain("cannot be cancelled or undone");
    expect(out).toContain("90 (90%)");
    expect(out).toContain("20 still waiting");
    expect(out).toContain("2,500.00");
    expect(out).toMatch(/not proof the message caused it/);
  });

  it("shows attributed revenue in the STORE's currency, with or without a cost estimate", () => {
    const counts = { queued: 0, sent: 10, delivered: 10, read: 5, replied: 1, failed: 0, skipped: 0, attributedOrders: 1, attributedMinor: 12000 };
    const out = renderToStaticMarkup(<BroadcastRow b={row({ status: "sent", canCancel: false, estimate: null, counts })} currency="AED" onCancel={() => undefined} />);
    expect(out).toContain("120.00");
    expect(out).toMatch(/AED|\u062F\.\u0625/);
    expect(out).not.toContain("\u20B9");
  });

  it("a cancelled one shows no results", () => {
    const out = renderToStaticMarkup(<BroadcastRow b={row({ status: "cancelled", canCancel: false })} currency="INR" onCancel={() => undefined} />);
    expect(out).toContain("Cancelled");
    expect(out).not.toContain("Delivered");
  });
});
