import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ConnectableNetwork } from "@/lib/presence-panels";

/**
 * GBP L14: "Is this your business?" at the top of the page, asked once. Rendered to static markup from a filled query cache (no DOM, no
 * click): what is drawn for the stored facts. What a click writes is read from the cache the same way the card and the panel read it.
 */

let businessName = "Travelxp";
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "b1", name: businessName } }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never) }));
vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));
vi.mock("@/lib/api", () => ({ api: { get: async () => { throw new Error("no network in this test"); }, put: async () => undefined, post: async () => undefined } }));

const { NameAskPanel } = await import("@/components/presence/name-ask-panel");
const { NetworkConnectCard } = await import("@/components/presence/network-connect-card");

const CAPS: ConnectableNetwork["capabilities"] = { listing: true, reviews: true, edit: true, control: true, networkChanges: true, searchTerms: true, metricKeys: [] };
const NET: ConnectableNetwork = { network: "net_a", label: "Acme", title: "Acme Business", connectHref: "/dashboard/integrations", picker: { path: "locations" }, capabilities: CAPS };

const CELEB = { locationName: "locations/1", title: "Celebrities Management Private Limited", address: "Oshiwara, Mumbai" };
const OTHER = { locationName: "locations/2", title: "Travelxp Studio", address: "Andheri, Mumbai" };
const ADMIN = { propose: true, approve: true };
const VIEWER = { propose: false, approve: false };

function client(
  locations: Array<Record<string, string>>,
  selected: string[],
  can = ADMIN,
  complete = true,
  pickerList?: { locations: Array<Record<string, string>>; selected: string[] },
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(["presence", "edit", "capabilities"], { items: [], can });
  qc.setQueryData(["integration-status", NET.network], { provider: NET.network, status: "active" });
  qc.setQueryData(["integration-cap", NET.network], { provider: NET.network, capabilities: null, locationNames: selected, account: { extra: { locations, locationsComplete: complete } } });
  if (pickerList) qc.setQueryData(["network-locations", NET.network], { provider: NET.network, complete, ...pickerList });
  return qc;
}
const panel = (qc: QueryClient) => renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(NameAskPanel, { network: NET })));
const card = (qc: QueryClient) => renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(NetworkConnectCard, { network: NET })));
const flatText = (html: string) => html.replace(/[‘’]|&#x27;/g, "'").replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the question at the top of the page", () => {
  it("shows for an unanswered mismatched listing, in the page's words, with the network's label and three answers", () => {
    businessName = "Travelxp";
    const html = panel(client([CELEB, OTHER], ["locations/1"]));
    expect(flatText(html)).toContain(
      "Celebrities Management Private Limited is linked as your business on Acme. Its name is different from Travelxp. That's fine if you trade under another name. Is this your business?",
    );
    expect(html).toContain("Yes, this is my business");
    expect(html).toContain("No, choose another listing");
    expect(html).toContain("Not now");
    expect(html).toContain('id="name-ask-net_a"');
  });

  it("Yes hides it, and the card then says confirmed", () => {
    businessName = "Travelxp";
    const qc = client([{ ...CELEB, confirmedAt: "2026-11-12T10:00:00.000Z" }, OTHER], ["locations/1"]);
    expect(panel(qc)).toBe("");
    expect(card(qc)).toContain("You confirmed this is your business.");
  });

  it("Not now hides it, and the card still asks", () => {
    businessName = "Travelxp";
    const qc = client([{ ...CELEB, nameAskDismissedAt: "2026-11-12T10:00:00.000Z" }, OTHER], ["locations/1"]);
    expect(panel(qc)).toBe("");
    const html = card(qc);
    expect(html).toContain("Yes, this is my business");
    expect(flatText(html)).toContain("Is this your business?");
  });

  it("a rename brings it back: after one the api sends a row with neither date", () => {
    businessName = "Travelxp";
    expect(panel(client([{ ...CELEB, title: "Celebrities Management Pvt Ltd Mumbai" }, OTHER], ["locations/1"]))).toContain("Yes, this is my business");
  });

  it("a viewer sees no panel, and the card keeps its line", () => {
    businessName = "Travelxp";
    const qc = client([CELEB, OTHER], ["locations/1"], VIEWER);
    expect(panel(qc)).toBe("");
    expect(card(qc)).toContain("An admin or owner can confirm this.");
  });

  it("an editor sees no panel either: they cannot approve", () => {
    businessName = "Travelxp";
    expect(panel(client([CELEB, OTHER], ["locations/1"], { propose: true, approve: false }))).toBe("");
  });

  it("after the picker saves a mismatched listing it shows, read from the picker's own list", () => {
    businessName = "Travelxp";
    // the capabilities read still says listing 2 is selected; the picker's save wrote listing 1 into its list, which wins
    const html = panel(client([OTHER], ["locations/2"], ADMIN, true, { locations: [CELEB, OTHER], selected: ["locations/1"] }));
    expect(html).toContain("Celebrities Management Private Limited");
    expect(html).toContain("Yes, this is my business");
  });

  it("is not asked when the name matches, or the network has no listing", () => {
    businessName = "TravelXP Pvt Ltd";
    expect(panel(client([CELEB, OTHER], ["locations/2"]))).toBe("");
    businessName = "Travelxp";
    const noListing = { ...NET, capabilities: { ...CAPS, listing: false } };
    const qc = client([CELEB], ["locations/1"]);
    expect(renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(NameAskPanel, { network: noListing })))).toBe("");
  });

  it("with only this listing on the account, the second answer sends to connect the right account", () => {
    businessName = "Travelxp";
    const html = panel(client([CELEB], ["locations/1"]));
    expect(html).toContain('href="/dashboard/integrations"');
    expect(html).toContain("Connect the account that manages your listing");
    expect(html).not.toContain("No, choose another listing");
  });
});
