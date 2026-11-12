import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { presenceListingQueryKey } from "@/lib/presence-panels";
import { presenceEditKeys } from "@/lib/presence-edit";

/**
 * GBP L13. The listing card's always-there time zone row: the zone and its source, "not set [Choose]" when none is known, no button for a role
 * that cannot change it, and a save that asks both the listing and the holiday offers again.
 * WHAT THIS CANNOT PROVE: a click or the picker opening (static markup; no effect runs), or the api (every answer is a fixture).
 */

vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));
vi.mock("@/hooks/use-locale", () => ({ useLocale: () => ({ formatDate: (d: unknown) => String(d), formatDateTime: (d: unknown) => String(d) }) }));
const post = vi.hoisted(() => vi.fn<(path: string, body: unknown) => Promise<{ timeZone: string }>>(async () => ({ timeZone: "Asia/Kolkata" })));
vi.mock("@/lib/api", () => ({
  api: {
    get: async () => {
      throw new Error("no network in this test");
    },
    post,
  },
}));

const { ListingPanel } = await import("@/components/presence/listing-panel");
const { usePresenceEditMutations } = await import("@/hooks/use-presence-edit");

const listing = (timeZone: unknown) => ({
  id: "l1",
  name: "Shop",
  status: "active",
  description: null,
  primaryCategory: null,
  additionalCategories: [],
  contact: {},
  address: { city: "Mumbai", country: "IN" },
  geo: null,
  regularHours: [],
  specialHours: [],
  updatedAt: null,
  ...(timeZone === undefined ? {} : { timeZone }),
});

type Can = { propose: boolean; approve: boolean };

function client(tz: unknown, can: Can | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(presenceListingQueryKey(undefined, undefined), {
    setup: "ready",
    connection: { network: "net_a", label: "NetA", status: "active", locationName: "p", locations: [], lastSyncAt: null, lastError: null },
    listing: listing(tz),
    networks: [{ network: "net_a", label: "NetA", capabilities: {} }],
  });
  if (can) qc.setQueryData(presenceEditKeys.capabilities, { items: [], can });
  return qc;
}
const render = (tz: unknown, can: Can | null) => renderToStaticMarkup(createElement(QueryClientProvider, { client: client(tz, can) }, createElement(ListingPanel as never)));

const ADMIN = { propose: true, approve: true };

describe("the listing card's time zone row", () => {
  it("shows the zone and where it came from, with Change for an admin", () => {
    const html = render({ zone: "Asia/Kolkata", source: "address" }, ADMIN);
    expect(html).toContain("Time zone: India Standard Time (Asia/Kolkata)");
    expect(html).toContain("from your address in Mumbai");
    expect(html).toContain(">Change<");
  });
  it("says the business settings gave it", () => {
    expect(render({ zone: "Europe/London", source: "business" }, ADMIN)).toContain("from your business settings");
  });
  it("a confirmed zone shows no source", () => {
    const html = render({ zone: "Asia/Kolkata", source: "confirmed" }, ADMIN);
    expect(html).toContain("Time zone: India Standard Time (Asia/Kolkata)");
    expect(html).not.toContain("from your");
  });
  it("none known says so and offers Choose, not a dead end", () => {
    const html = render(null, ADMIN);
    expect(html).toContain("Time zone: not set");
    expect(html).toContain(">Choose<");
  });
  it("an api that sends no zone field draws no row, so nobody is nudged to overwrite one", () => {
    const html = render(undefined, ADMIN);
    expect(html).not.toContain("Time zone");
    expect(html).not.toContain(">Choose<");
  });
  it("a viewer or editor sees the line and no button", () => {
    for (const can of [{ propose: false, approve: false }, { propose: true, approve: false }, null]) {
      const html = render({ zone: "Asia/Kolkata", source: "address" }, can);
      expect(html).toContain("Time zone: India Standard Time");
      expect(html).not.toContain(">Change<");
      expect(html).not.toContain(">Choose<");
    }
    expect(render(null, { propose: true, approve: false })).not.toContain(">Choose<");
  });
});

describe("a saved time zone refreshes the row and the holiday card", () => {
  it("asks the listing read and the holiday offers again", async () => {
    const qc = client({ zone: "Asia/Kolkata", source: "address" }, ADMIN);
    qc.setQueryData(presenceEditKeys.offers("l1", "net_a"), { offers: [] });
    let mutate: (() => void) | undefined;
    const Probe = ({ onReady }: { onReady: (go: () => void) => void }) => {
      const m = usePresenceEditMutations("l1");
      onReady(() => m.setTimeZone.mutate({ listingId: "l1", timeZone: "Asia/Dubai" }));
      return null;
    };
    renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(Probe, { onReady: (go) => (mutate = go) })));
    mutate?.();
    await vi.waitFor(() => expect(qc.getQueryState(presenceEditKeys.offers("l1", "net_a"))?.isInvalidated).toBe(true));
    expect(post).toHaveBeenCalledWith("/v1/presence/edit/time-zone", { listingId: "l1", timeZone: "Asia/Dubai" });
    expect(qc.getQueryState(presenceListingQueryKey(undefined, undefined))?.isInvalidated).toBe(true);
  });
});
