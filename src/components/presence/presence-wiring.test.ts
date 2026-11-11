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
    expect(home).toMatch(/setChosen\(undefined\); setReviewsPicked\(undefined\); \/\/ a form opened for one network's listing is not a request for another's setEditRequest\(null\);/);
    expect(home).toContain("unreadableNetworks(networks, statusQs)");
    expect(home).toContain("<UnreadableNote networks={unreadable} />");
  });
  it("offers connected networks only: cards come from every connectable network, the switcher from the connected", () => {
    expect(home).toContain("networks.map((n) => ( <NetworkConnectCard");
    expect(home).toContain("connectedNetworks(networks, statusOf)");
  });
  it("draws the review cards only for a network that declares reviews, and passes the network to the kit", () => {
    expect(home).toContain("{reviewsOn && !listAnswer.isPending ? (");
    // the reviews wait for the listing read that says whether there are several places
    expect(home).toContain("{reviewsOn && listAnswer.isPending ? <Skeleton");
    expect(home).toContain("<ReviewSummaryCard location={reviewsPlace ?? location} network={panelNetwork}");
    // PE-R: the kit is drawn for any network with reviews; a network with no listing draws it only when its link exists
    expect(home).toContain("{reviewsOn && !listAnswer.isPending ? <ReviewKitCard location={location} network={panelNetwork} hideUnlessReady={!listingOn} /> : null}");
  });
  it("PE-R: a business with several places starts from every place side by side, and picking one narrows the whole page to it", () => {
    expect(home).toContain("wantsPlacesView({ hasSwitcher: !!switcher, narrowed: reviewsPlace !== undefined })");
    expect(home).toContain("<ReviewPlacesCard");
    // the places card's pick, and the listing switcher's choice, both narrow
    // ★THE LISTING SELECT AND THE REVIEWS' SCOPE ARE TWO CONTROLS: picking a place for the reviews never changes the listing, and the
    // listing select never offers "All locations" (an edit must not appear to apply to all of them)
    expect(home).toContain("onPick={(place) => setReviewsPicked(place)}");
    expect(home).toContain("onChange={(e) => setChosen(e.target.value)}");
    expect(home).not.toMatch(/id="presence-location"[\s\S]{0,400}All locations/);
    // the select itself offers "All locations", so narrowing is always reversible, and it says which place the other panels show
    expect(home).toContain('<option value={ALL_LOCATIONS}>All locations</option>');
    expect(home).toContain("value={reviewsPlace ?? ALL_LOCATIONS}");
    expect(home).toContain('id="presence-reviews-scope"');
    expect(home).toContain("show this one listing");
    // and a way back to all of them from the narrowed card
    expect(home).toContain("onShowAll={switcher ? () => setReviewsPicked(undefined) : undefined}");
    // and the places card is keyed by network, so one network's rows are never another's while it loads
    expect(home).toContain('key={panelNetwork ?? "default"}');
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

describe("the one publishing status (GBP Issue 1)", () => {
  const home = flat("components/presence/presence-home.tsx");
  it("is drawn once, where changes can be made, above every panel it speaks for", () => {
    expect(home.match(/<PublishingStatus /g)).toHaveLength(1);
    // photos are drawn on their own declaration, so a network with photos and no edit forms still gets the status
    expect(home).toContain("{editOn || photosOn ? <PublishingStatus location={panelLocation} network={panelNetwork} onRedo={openForm} /> : null}");
    for (const panel of ["<ListingScoreCard", "<EditListingCard", "<PhotosCard", "<PostsCard", "<ServicesCard", "<DetailsCard", "<LinksCard"]) {
      expect(home.indexOf("<PublishingStatus "), panel).toBeLessThan(home.indexOf(panel));
    }
  });
  it("no panel says it again: the per-panel switch-off notice is not rendered anywhere", () => {
    for (const f of ["components/presence/edit/edit-listing-card.tsx", "components/presence/edit/extra-panel.tsx", "components/presence/edit/photos-card.tsx"]) {
      const s = flat(f);
      expect(s, f).not.toContain("writes.notice}");
      expect(s, f).not.toContain("writesNote(");
      expect(s, f).not.toContain("switchNote");
    }
  });
  it("reads the listing and capabilities the edit card reads, and every word comes from publishingBanner", () => {
    const s = flat("components/presence/publishing-status.tsx");
    expect(s).toContain("useListingQuery(location, network)");
    expect(s).toContain("publishingBanner(entry, caps.data.can)");
    // the requests list reads the same changes the edit card reads (one query key), and says every stage through requestStatus
    expect(s).toContain("useListingChanges(listing?.id)");
    expect(flat("components/presence/requests-list.tsx")).toContain("requestStatus(change, label, can, publishing)");
    expect(s).not.toContain('role="status"');
  });
  it("the prepared notice reads held from the same publishing answer as the status", () => {
    expect(flat("components/presence/edit/edit-listing-card.tsx")).toContain("preparedWords(r.notChecked.length, cap!, primaryEntry(listingQ.data)?.publishing)");
  });
});
