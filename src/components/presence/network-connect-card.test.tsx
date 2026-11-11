import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ConnectableNetwork } from "@/lib/presence-panels";

/**
 * "Is this your business?" on the connected card and the picker. Rendered to static markup from a filled query cache (no DOM, no click):
 * it holds what is drawn for the stored facts, not the click that opens the picker.
 */

let businessName = "Travelxp";
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "b1", name: businessName } }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never) }));
vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));
vi.mock("@/lib/api", () => ({ api: { get: async () => { throw new Error("no network in this test"); }, put: async () => undefined, post: async () => undefined } }));

const { NetworkConnectCard, LocationPicker } = await import("@/components/presence/network-connect-card");

const CAPS: ConnectableNetwork["capabilities"] = { listing: true, reviews: true, edit: true, control: true, networkChanges: true, searchTerms: true, metricKeys: [] };
const NET: ConnectableNetwork = { network: "net_a", label: "Acme", title: "Acme Business", connectHref: "/dashboard/integrations", picker: { path: "locations" }, capabilities: CAPS };
const NO_LISTING_NET: ConnectableNetwork = { ...NET, network: "net_b", capabilities: { ...CAPS, listing: false } };

const CELEB = {
  locationName: "locations/1",
  title: "Celebrities Management Private Limited",
  address: "Oshiwara, Mumbai",
  mapsUri: "https://maps.example/maps?cid=7999572708683699360",
};
const OTHER = { locationName: "locations/2", title: "Travelxp Studio", address: "Andheri, Mumbai", mapsUri: "https://maps.example/maps?cid=2" };

function draw(net: ConnectableNetwork, locations: Array<Record<string, string>>, selected: string[], complete = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["integration-status", net.network], { provider: net.network, status: "active" });
  qc.setQueryData(["integration-cap", net.network], { provider: net.network, capabilities: null, locationNames: selected, account: { extra: { locations, locationsComplete: complete } } });
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(NetworkConnectCard, { network: net })));
}

describe("the connected card", () => {
  it("names the listing with its address, links it on the map, and offers another", () => {
    businessName = "Travelxp";
    const html = draw(NET, [CELEB, OTHER], ["locations/1"]);
    expect(html).toContain("Celebrities Management Private Limited");
    expect(html).toContain(", Oshiwara, Mumbai.");
    expect(html).toContain('href="https://maps.example/maps?cid=7999572708683699360"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("View on Acme Maps");
    expect(html).toContain("Not your business?");
    expect(html).toContain("Choose another listing");
  });

  it("says the name does not look like the business when no word is shared", () => {
    businessName = "Travelxp";
    const html = draw(NET, [CELEB, OTHER], ["locations/1"]);
    expect(html.replace(/[‘’]|&#x27;/g, "'")).toContain("This listing's name doesn't look like Travelxp. Check it's the right one.");
  });

  it("says nothing of the name when it matches", () => {
    businessName = "TravelXP Pvt Ltd";
    const html = draw(NET, [CELEB, OTHER], ["locations/2"]);
    expect(html).not.toContain("doesn");
    expect(html).toContain("Not your business?");
  });

  it("with only this listing on the account, sends to connect the right account", () => {
    businessName = "Travelxp";
    const html = draw(NET, [CELEB], ["locations/1"]);
    expect(html).toContain("Connect the account that manages your listing");
    expect(html).toContain('href="/dashboard/integrations"');
    expect(html).not.toContain("Choose another listing");
  });

  it("with one listing known from a list that may be short, still offers the picker", () => {
    businessName = "Travelxp";
    const html = draw(NET, [CELEB], ["locations/1"], false);
    expect(html).toContain("Choose another listing");
    expect(html).not.toContain("Connect the account");
  });

  it("draws no link or address for a connection that kept neither", () => {
    businessName = "Travelxp";
    const html = draw(NET, [{ locationName: "locations/1", title: "Travelxp" }, OTHER], ["locations/1"]);
    expect(html).not.toContain("View on");
    expect(html).toContain("Not your business?");
  });

  it("draws none of it for a network with no listing", () => {
    const html = draw(NO_LISTING_NET, [CELEB, OTHER], ["locations/1"]);
    expect(html).not.toContain("Not your business?");
    expect(html).not.toContain("View on");
  });

  it("never links an address that is not a web address", () => {
    const html = draw(NET, [{ ...CELEB, mapsUri: "javascript:alert(1)" }, OTHER], ["locations/1"]);
    expect(html).not.toContain("javascript:");
  });
});

describe("the picker rows", () => {
  it("carry the title, the address and the map link of each listing", () => {
    const query = { isLoading: false, isError: false, data: { provider: "net_a", locations: [CELEB, OTHER], complete: true, selected: ["locations/1"] }, refetch: () => undefined };
    const html = renderToStaticMarkup(
      createElement(LocationPicker, { query: query as never, label: "Acme", title: "Acme Business", selected: ["locations/1"], saving: false, onChoose: () => undefined }),
    );
    for (const l of [CELEB, OTHER]) {
      expect(html).toContain(l.title);
      expect(html).toContain(l.address);
      expect(html).toContain(`href="${l.mapsUri}"`);
    }
  });
});
