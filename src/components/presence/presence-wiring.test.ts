import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * How the Presence screens are wired (PE-EC), pinned as text because b2c vitest renders nothing. Source is read and flattened (JSX wraps).
 * Each case fails on the earlier shape: a hard-coded connect path, the empty-figures check placed after the setup messages, a default read
 * from the head of a list, panels read before the capabilities settle, review cards drawn for a network without reviews.
 */
const SRC = resolve(__dirname, "..", "..");
const flat = (rel: string) => readFileSync(join(SRC, rel), "utf8").replace(/\s+/g, " ");
const raw = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("the connect card", () => {
  const card = flat("components/presence/network-connect-card.tsx");
  it("sends the merchant to the page the network's own declaration names, never a typed path", () => {
    expect(card).toContain("<Link href={network.connectHref}>");
    expect(card).not.toContain("/dashboard/integrations");
  });
});

describe("the insights panel", () => {
  const src = raw("components/presence/insights-panel.tsx");
  it("checks that the network draws insights right after the listing read, before any setup message", () => {
    const gate = src.indexOf("if (!drawsInsights(entry ?? { capabilities: capsFallback })) return null;");
    const message = src.indexOf("const message = setupMessage(");
    const failed = src.indexOf("<Failed what=\"your figures\" onRetry={() => listingQ.refetch()}");
    expect(gate).toBeGreaterThan(-1);
    expect(failed).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(failed);
    expect(gate).toBeLessThan(message);
    // and before the insights read is waited on or charted
    expect(gate).toBeLessThan(src.indexOf("const view = fetchView({\n    hasData: !!insightsQ.data"));
  });
  it("reads the entry once", () => {
    expect(src.match(/primaryEntry\(listingQ\.data\)/g)).toHaveLength(1);
  });
  it("keeps the old figures only across a change of days", () => {
    expect(flat("components/presence/insights-panel.tsx")).toContain("keepInsightsWhileLoading(prevQuery?.queryKey");
    expect(src).not.toContain("keepPreviousData");
  });
});

describe("the Presence home", () => {
  const home = flat("components/presence/presence-home.tsx");
  it("reads no panel before the capabilities and the connection statuses have settled", () => {
    expect(home).toContain("const baseReady = !capsQ.isPending && statusQs.every((q) => !q.isPending);");
    expect(home).toContain("const panelsReady = baseReady &&");
    expect(home).toContain("useListingQuery(undefined, panelNetwork, panelsReady)");
    // the panels sit in the branch that is drawn only once ready
    expect(home.indexOf("{!panelsReady ? (")).toBeLessThan(home.indexOf("<ListingPanel"));
  });
  it("takes the default network from the connections, never the head of a sorted list", () => {
    expect(home).not.toContain("networks[0]");
    expect(home).toContain("networkSwitcher(connected, chosenNetwork, defaultQ.data?.connection?.network)");
    expect(home).not.toContain("isDefault ? undefined");
  });
  it("draws the listing, score, edit, insights and review cards only for the network the panels read, called with the network itself (PE-16)", () => {
    expect(home).toContain("const reviewsOn = drawsReviews(aboutNetwork);");
    expect(home).toContain("const listingOn = drawsListing(aboutNetwork);");
    expect(home).toContain("const editOn = listingOn && aboutNetwork?.capabilities.edit !== false;");
    // the network judged is the network read
    expect(home).toContain("const panelNetwork = aboutNetwork?.network;");
    expect(home.indexOf("{listingOn ? (")).toBeLessThan(home.indexOf("<ListingScoreCard"));
    expect(home.indexOf("{editOn ? (")).toBeLessThan(home.indexOf("<EditListingCard"));
    expect(home.indexOf("<EditListingCard")).toBeLessThan(home.indexOf("<InsightsPanel"));
    expect(home).toContain("capabilities={aboutNetwork?.capabilities}");
  });
  it("clears a pending form request when the network changes, and says a status read that failed", () => {
    expect(home).toMatch(/setChosen\(undefined\); setNarrowed\(false\); \/\/ a form opened for one network's listing is not a request for another's setEditRequest\(null\);/);
    expect(home).toContain("unreadableNetworks(networks, statusQs)");
    expect(home).toContain("<UnreadableNote networks={unreadable} />");
  });
  it("offers connected networks only: cards come from every connectable network, the switcher from the connected", () => {
    expect(home).toContain("networks.map((n) => ( <NetworkConnectCard");
    expect(home).toContain("connectedNetworks(networks, statusOf)");
  });
  it("draws the review cards only for a network that declares reviews, and passes the network to the kit", () => {
    expect(home).toContain("{reviewsOn ? (");
    expect(home).toContain("<ReviewSummaryCard location={location} network={panelNetwork}");
    // PE-R: the kit is drawn for any network with reviews; a network with no listing draws it only when its link exists
    expect(home).toContain("{reviewsOn ? <ReviewKitCard location={location} network={panelNetwork} hideUnlessReady={!listingOn} /> : null}");
  });
  it("PE-R: a business with several places starts from every place side by side, and picking one narrows the whole page to it", () => {
    expect(home).toContain("wantsPlacesView({ hasSwitcher: !!switcher, narrowed })");
    expect(home).toContain("<ReviewPlacesCard");
    // the places card's pick, and the listing switcher's choice, both narrow
    expect(home).toMatch(/onPick=\{\(place\) => \{ setChosen\(place\); setNarrowed\(true\); \}\}/);
    expect(home).toMatch(/setChosen\(e\.target\.value\); \/\/ choosing a listing narrows the reviews to it too setNarrowed\(true\);/);
    // and a way back to all of them from the narrowed card
    expect(home).toContain("onShowAll={switcher ? () => setNarrowed(false) : undefined}");
  });
  it("falls back to the chosen network's label so nothing says 'nothing is connected' beside a connected card", () => {
    expect(home).toContain("label={fallbackLabel}");
  });
});

describe("the review kit and the edit queries carry the network", () => {
  it("the hook, the api call and the cache key", () => {
    const hook = flat("hooks/use-review-kit.ts");
    expect(hook).toContain("[...REVIEW_KIT_QUERY_KEY, location ?? null, network ?? null]");
    expect(hook).toContain("presenceApi.reviewKit(location, network)");
    expect(flat("lib/api/presence.ts")).toContain("presenceQuery({ location, network })");
  });
  it("offers and categories are keyed by the network too", () => {
    const hooks = flat("hooks/use-presence-edit.ts");
    expect(hooks).toContain('presenceEditKeys.offers(listingId ?? "", network ?? "")');
    expect(hooks).toContain('presenceEditKeys.categories(listingId ?? "", network ?? "", q)');
  });
});
