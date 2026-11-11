import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  connectedNetworks,
  drawsInsights,
  drawsListing,
  drawsReviews,
  locationSwitcher,
  networkLabel,
  networkSwitcher,
  presenceCapabilitiesQueryKey,
  presenceInsightsQueryKey,
  unreadableNetworks,
  presenceListingQueryKey,
  primaryEntry,
  setupMessage,
  DEFAULT_INSIGHT_DAYS,
  type ConnectableNetwork,
  type PresenceListingResponse,
} from "@/lib/presence-panels";
import { presenceScoreQueryKey, scoreEmptyState } from "@/lib/presence-score";
import { REVIEW_SUMMARY_QUERY_KEY } from "@/lib/review-summary";
import { REVIEW_KIT_QUERY_KEY, posterHref } from "@/lib/review-kit";
import { presenceEditKeys } from "@/lib/presence-edit";
import { networkCardState } from "@/components/presence/network-card-state";

/**
 * PE-16 (b2c): THE ADAPTER TEST, for the screens. The api answers of three networks that exist only in the api's tests (a reviews-only one,
 * a read-only listing one, and Google, which is real) go through the pure screen helpers and through a RENDER of the Presence page. The
 * answers below have the shapes `GET /v1/presence/capabilities`, `/listing`, `/insights`, `/reviews/summary`, `/reviews/kit` and `/score`
 * return in peakhour-api's `presence-adapter-test-routes.test.ts`; nothing under `src/` here is changed for a network to appear.
 *
 * It holds: a second and third connect card; the network switcher with each network's own label; panels that do not draw for a network
 * that does not declare them (no listing panel for a reviews-only network; no insights without metric keys); and no word "Google" in any
 * panel drawn for another network.
 *
 * WHAT THIS CANNOT PROVE: a browser (the page is rendered to static markup in a node run with no DOM, so no effect, click or layout runs),
 * the api (every answer is a fixture), or any real network. The render reads a pre-filled query cache, so a panel whose key differs from
 * the one filled here would show as loading, which the positive assertions catch.
 */

vi.mock("@/components/upgrade/feature-gate", () => ({ FeatureGate: ({ children }: { children: unknown }) => children }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never) }));
vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => ({ formatDate: (d: unknown) => String(d), formatDateTime: (d: unknown) => String(d), formatCurrency: (n: number) => String(n), formatNumber: (n: number) => String(n), formatRelativeTime: (d: unknown) => String(d) }),
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "b1", name: "Shop Co" } }) }));
vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));
vi.mock("@/lib/api", () => ({ api: { get: async () => { throw new Error("no network in this test"); }, put: async () => undefined, post: async () => undefined } }));

const { PresenceHome, UnreadableNote } = await import("@/components/presence/presence-home");
const { EditListingCard } = await import("@/components/presence/edit/edit-listing-card");
const { InsightsPanel } = await import("@/components/presence/insights-panel");

// ── The api answers (shapes of peakhour-api's presence routes) ─────────────────────────────

const ALL = { listing: true, reviews: true, edit: true, control: true, networkChanges: true, searchTerms: true, metricKeys: ["calls", "directionRequests", "websiteClicks", "messagingClicks", "bookings", "impressions"] } as const;
const GOOGLE_NET: ConnectableNetwork = { network: "google_business_profile", label: "Google", title: "Google Business Profile", connectHref: "/dashboard/integrations", picker: { path: "locations" }, capabilities: { ...ALL, metricKeys: [...ALL.metricKeys] } };
const REVIEWS_NET: ConnectableNetwork = { network: "pe16_reviews_only", label: "Reviewly", title: "Reviewly for Business", connectHref: "/dashboard/integrations?connect=reviewly", picker: null, capabilities: { listing: false, reviews: true, edit: false, control: false, networkChanges: false, searchTerms: false, metricKeys: [] } };
const LOCAL_NET: ConnectableNetwork = { network: "pe16_read_listing", label: "Localpages", title: "Localpages Business", connectHref: "/dashboard/integrations?connect=localpages", picker: { path: "places" }, capabilities: { listing: true, reviews: true, edit: false, control: true, networkChanges: false, searchTerms: false, metricKeys: ["calls", "websiteClicks"] } };
const NETS = [GOOGLE_NET, LOCAL_NET, REVIEWS_NET];

const entryOf = (n: ConnectableNetwork) => ({
  network: n.network, label: n.label, externalId: `${n.network}-place`, status: "synced", syncMode: "auto", lastSyncedAt: "2026-11-04T00:00:00.000Z", driftFields: [],
  control: { state: n.capabilities.control ? "controlled" : "unknown", reason: null, hasPendingVerification: null, ownsBusiness: null, pendingEdits: null, duplicateOf: null, checkedAt: null, lastReadFailedAt: null },
  changes: { items: null, pendingFields: null, checkedAt: null, lastReadFailedAt: null, customerMediaAt: null },
  capabilities: n.capabilities,
  searchTerms: { month: null, terms: null, truncated: false, checkedAt: null, lastReadFailedAt: null },
});
const listingAnswer = (n: ConnectableNetwork): PresenceListingResponse => ({
  setup: "ready",
  connection: { network: n.network, label: n.label, status: "active", locationName: `${n.network}-place`, locations: [{ locationName: `${n.network}-place`, title: null }], lastSyncAt: null, lastError: null },
  listing: n.capabilities.listing
    ? { id: "l1", name: `${n.label} Shop`, status: "active", description: null, primaryCategory: null, additionalCategories: [], contact: { phone: "+91 22222 22222" }, address: null, geo: null, regularHours: [], specialHours: [], updatedAt: null }
    : null,
  networks: n.capabilities.listing ? [entryOf(n) as never] : [],
});
const insightsAnswer = (calls: number | null) => ({ days: 28, locationName: "x", totals: { calls, directions: null, websiteClicks: calls === null ? null : 1, messagingClicks: null, bookings: null, views: null }, series: [{ date: "2026-11-01", calls, directions: null, websiteClicks: calls === null ? null : 1, messagingClicks: null, bookings: null, views: null }] });
const summaryEntry = (net: ConnectableNetwork, rating: number, n: number) => ({ network: net.network, label: net.label, state: "ready", totalEver: n, volume: n, unanswered: n, unansweredInWindow: n, sampled: n, rating, ratedCount: n, respondedCount: 0, timedCount: 0, medianResponseMs: null, worstRecent: [] });
/** `GET /v1/presence/reviews/summary` (PE-R): the window, and one entry per network. */
const summaryAnswer = (net: ConnectableNetwork, rating: number, n: number) => ({ days: 90, windowStart: "2026-08-07T00:00:00.000Z", locationName: null, networks: [summaryEntry(net, rating, n)] });
const kitAnswer = (n: ConnectableNetwork) => ({ state: "ready", listingId: "l1", businessName: `${n.label} Shop`, link: `https://${n.network}.example/review`, network: n.network, networkLabel: n.label, qrSvg: "<svg xmlns='http://www.w3.org/2000/svg'></svg>" });
const scoreAnswer = (n: ConnectableNetwork) => n.capabilities.listing
  ? { state: "ready", listingId: "l1", network: { key: n.network, label: n.label }, score: { score: 70, seen: { scored: 5, unknown: 0, notApplicable: 0, total: 5, sentence: "We checked 5 things." }, market: { code: "IN", name: "India" }, business: { group: "shop", noun: "shop" }, checks: [], fixes: [], ordering: { by: "kind_of_business", reason: "figures_not_read", callShare: 0.5, group: "shop" } }, health: [] }
  : { state: "no_listing" };

/** Render the page with the cache filled as the api would fill it, the api's default connection being `defaultNet`. */
function render(defaultNet: ConnectableNetwork, nets: ConnectableNetwork[] = NETS, statusOf: (n: ConnectableNetwork) => string = () => "active", primeDefault = true, kitFor?: (n: ConnectableNetwork) => unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(presenceCapabilitiesQueryKey, { items: nets });
  for (const n of nets) {
    qc.setQueryData(["integration-status", n.network], { provider: n.network, status: statusOf(n), account: { name: `${n.label} account` } });
    qc.setQueryData(["integration-cap", n.network], { provider: n.network, capabilities: null, locationNames: [`${n.network}-place`] });
  }
  // the api's default answer names the connection the panels are about; each network's own answer is keyed by it
  if (primeDefault) qc.setQueryData(presenceListingQueryKey(undefined, undefined), listingAnswer(defaultNet));
  for (const n of nets) {
    qc.setQueryData(presenceListingQueryKey(undefined, n.network), listingAnswer(n));
    qc.setQueryData(presenceInsightsQueryKey(DEFAULT_INSIGHT_DAYS, undefined, n.network), insightsAnswer(n === GOOGLE_NET ? 9 : n === LOCAL_NET ? 4 : null));
    qc.setQueryData([...REVIEW_SUMMARY_QUERY_KEY, "all", n.network], summaryAnswer(n, n === GOOGLE_NET ? 5 : n === LOCAL_NET ? 3 : 1.5, n === GOOGLE_NET ? 2 : n === LOCAL_NET ? 1 : 2));
    qc.setQueryData([...REVIEW_KIT_QUERY_KEY, null, n.network], (kitFor ? kitFor(n) : n.capabilities.listing ? kitAnswer(n) : { state: "no_listing" }));
    qc.setQueryData(presenceScoreQueryKey(undefined, n.network), scoreAnswer(n));
  }
  primeEdit(qc);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(PresenceHome)));
}

/** What the edit card reads: Google is writable, the others are not in the list at all (the api lists only networks that declare writes). */
function primeEdit(qc: QueryClient) {
  qc.setQueryData(presenceEditKeys.capabilities, {
    items: [{ network: GOOGLE_NET.network, label: "Google", writableFields: ["name", "phone"], riskyFields: ["name"], limits: {}, options: {}, writes: { released: false, reason: "held" } }],
    can: { propose: true, approve: true },
  });
  qc.setQueryData(presenceEditKeys.changes("l1"), { items: [] });
}

/** The words a merchant reads under another network's label: the page minus the connect cards and the switcher, which name every network on purpose. */
function panelsOf(html: string): string {
  const afterCards = html.slice(html.indexOf('id="presence-network"'));
  const select = afterCards.slice(0, afterCards.indexOf("</select>"));
  return afterCards.slice(select.length);
}

describe("the pure helpers, over the three networks' answers", () => {
  it("connectedNetworks lists every connected network; the switcher offers each by its own label and defaults to the api's", () => {
    const connected = connectedNetworks(NETS, () => "active");
    expect(connected.map((n) => n.label)).toEqual(["Google", "Localpages", "Reviewly"]);
    expect(networkSwitcher(connected, undefined, REVIEWS_NET.network)).toEqual({
      value: REVIEWS_NET.network,
      options: [{ value: GOOGLE_NET.network, label: "Google" }, { value: LOCAL_NET.network, label: "Localpages" }, { value: REVIEWS_NET.network, label: "Reviewly" }],
    });
    // a choice that is not connected falls back, never to a typed name
    expect(networkSwitcher(connected, "not_a_network", LOCAL_NET.network)!.value).toBe(LOCAL_NET.network);
    // one connected network has nothing to switch
    expect(networkSwitcher(connectedNetworks(NETS, (n) => (n === LOCAL_NET.network ? "active" : "disconnected")), undefined, undefined)).toBeNull();
  });

  it("an unconnected network stays a connect card and is not in the switcher", () => {
    const connected = connectedNetworks(NETS, (n) => (n === REVIEWS_NET.network ? "disconnected" : "active"));
    expect(connected.map((n) => n.network)).not.toContain(REVIEWS_NET.network);
  });

  it("drawsListing and drawsInsights follow each network's declaration; no declaration draws them", () => {
    expect(drawsListing(REVIEWS_NET)).toBe(false);
    expect(drawsListing(LOCAL_NET)).toBe(true);
    expect(drawsReviews(REVIEWS_NET)).toBe(true);
    expect(drawsReviews({ capabilities: { reviews: false } })).toBe(false);
    expect(drawsReviews(undefined)).toBe(true);
    expect(drawsListing({ capabilities: {} })).toBe(true);
    expect(drawsListing({})).toBe(true);
    expect(drawsListing(undefined)).toBe(true);
    expect(drawsInsights(REVIEWS_NET)).toBe(false);
    expect(drawsInsights(LOCAL_NET)).toBe(true);
  });

  it("primaryEntry is the connection's own network's entry, and a reviews-only network has none (never another's)", () => {
    const l = listingAnswer(LOCAL_NET);
    expect(primaryEntry(l)?.label).toBe("Localpages");
    const r = listingAnswer(REVIEWS_NET);
    expect(primaryEntry(r)).toBeNull();
    // a connection whose entry is another network's gets none
    expect(primaryEntry({ connection: { ...listingAnswer(LOCAL_NET).connection!, network: "pe16_reviews_only" }, networks: l.networks })).toBeNull();
    expect(networkLabel(r, null)).toBe("Reviewly");
  });

  it("the setup words name the network by its label, and a ready reviews-only network says nothing is being imported", () => {
    expect(setupMessage("ready", false, "listing", "Reviewly")).toBeNull();
    expect(setupMessage("not_connected", false, "listing", "Localpages")!.headline).toBe("Localpages isn't connected yet");
    expect(JSON.stringify(setupMessage("needs_reconnect", false, "listing", "Reviewly"))).not.toMatch(/google/i);
    expect(networkCardState("active", ["x"], false).kind).toBe("ready");
  });

  it("the score's empty state for a network with no listing does not promise one", () => {
    const e = scoreEmptyState({ state: "no_listing" });
    expect(e!.headline).toBe("This network gives no listing to score");
    expect(JSON.stringify(e)).not.toMatch(/bringing in/);
  });

  it("locationSwitcher shows only when the connection manages several places", () => {
    expect(locationSwitcher(listingAnswer(LOCAL_NET).connection!.locations, undefined)).toBeNull();
  });
});

describe("the page, rendered, with Google as the default network", () => {
  const html = render(GOOGLE_NET);
  it("draws one connect card per network from the api's declarations: a second and a third card with their own titles", () => {
    for (const n of NETS) expect(html).toContain(n.title);
  });
  it("draws the network switcher with each network's own label", () => {
    expect(html).toContain('id="presence-network"');
    for (const label of ["Google", "Localpages", "Reviewly"]) expect(html).toMatch(new RegExp(`<option[^>]*>${label}</option>`));
  });
  it("draws Google's panels", () => {
    expect(html).toContain("Your listing");
    expect(html).toContain("How customers found you");
    expect(html).toContain("Reviews");
    expect(html).toContain("Get more reviews");
    expect(html).toContain("Change your listing");
    expect(html).toContain("70 out of 100");
  });
});

describe("the page, rendered, with the read-only listing network as the default", () => {
  const html = render(LOCAL_NET);
  const panels = panelsOf(html);
  it("draws its listing, figures, reviews and kit under its own name", () => {
    expect(panels).toContain("Your listing");
    expect(panels).toContain("70 out of 100");
    expect(panels).toContain("Localpages Shop");
    expect(panels).toContain("How customers found you");
    expect(panels).toContain("Reviews");
    expect(panels).toContain("https://pe16_read_listing.example/review");
  });
  it("★draws no word Google anywhere under the other network's label", () => {
    expect(panels).not.toMatch(/google/i);
  });
  it("draws a tile for each figure it declares and none for the ones it does not (no directions, no profile views)", () => {
    expect(panels).toContain("Calls");
    expect(panels).toContain("Website clicks");
    expect(panels).not.toContain("Directions");
    expect(panels).not.toContain("Profile views");
    expect(panels).not.toContain("Bookings");
  });
  it("draws no edit card: the network cannot be written, so no card promises a form", () => {
    expect(panels).not.toContain("Change your listing");
    expect(panels).not.toContain("cannot be made from Peakhour");
  });
  it("the poster link carries the network the kit was drawn for", () => {
    const href = /href="(\/dashboard\/presence\/review-poster[^"]*)"/.exec(panels)![1]!.replaceAll("&amp;", "&");
    expect(new URL(href, "https://x.example").searchParams.get("network")).toBe(LOCAL_NET.network);
  });
});

describe("the page, rendered, with the reviews-only network as the default", () => {
  const html = render(REVIEWS_NET);
  const panels = panelsOf(html);
  it("★draws no listing, score or edit panel and no insights, because the network declares none", () => {
    expect(panels).not.toContain("Your listing");
    expect(panels).not.toContain("Your listing score");
    expect(panels).not.toContain("Change your listing");
    expect(panels).not.toContain("How customers found you");
    // and no review kit: a link is kept on a listing, and this network has none
    expect(panels).not.toContain("Get more reviews");
    expect(panels).not.toContain("Connect your listing");
    expect(panels).not.toMatch(/bringing in your listing/);
  });
  it("★PE-R: a network with no listing draws the kit when its link exists on the connection, under its own label, and a single card per network", () => {
    const withLink = panelsOf(
      render(REVIEWS_NET, NETS, () => "active", true, (n) =>
        n.capabilities.listing ? kitAnswer(n) : { state: "ready", listingId: null, businessName: "Shop Co", link: "https://reviewly.example/r/shop", network: n.network, networkLabel: n.label, qrSvg: "<svg xmlns='http://www.w3.org/2000/svg'></svg>" },
      ),
    );
    expect(withLink).toContain("Get more reviews");
    expect(withLink).toContain("Review us on Reviewly");
    expect(withLink).toContain("https://reviewly.example/r/shop");
    expect(withLink).not.toMatch(/google/i);
    // and still no listing panel, score or edit card
    expect(withLink).not.toContain("Your listing");
  });
  it("★PE-R: with no link on the connection the kit stays hidden, and does not offer to 'connect your listing' to a network with none", () => {
    for (const state of ["no_listing", "no_link"]) {
      const hidden = panelsOf(render(REVIEWS_NET, NETS, () => "active", true, (n) => (n.capabilities.listing ? kitAnswer(n) : { state })));
      expect(hidden).not.toContain("Get more reviews");
      expect(hidden).not.toContain("Connect your listing");
    }
  });
  it("draws its reviews, and Reviewly's own figure (1.5), not Google's", () => {
    expect(panels).toContain("Reviews");
    expect(panels).toContain("1.5");
    expect(panels).not.toMatch(/google/i);
  });
  it("still draws every network's connect card and the switcher", () => {
    for (const n of NETS) expect(html).toContain(n.title);
    expect(html).toContain('id="presence-network"');
  });
});

describe("a business with only one network connected has no switcher", () => {
  it("draws the connect cards and that network's panels, and no switcher", () => {
    // only the network-keyed answers are filled: the panels must read THE network the page judged, not the api's default
    const html = render(LOCAL_NET, NETS, (n) => (n.network === LOCAL_NET.network ? "active" : "disconnected"), false);
    expect(html).not.toContain('id="presence-network"');
    expect(html).toContain("Localpages Shop");
  });
});

describe("a status read that failed is said, not dropped", () => {
  // (a server render re-queues an errored query as pending, so the note is tested at its two parts)
  it("picks out the networks whose read failed, in order, and not the ones still loading", () => {
    expect(unreadableNetworks(NETS, [{ isError: false }, { isError: true }, { isError: true }])).toEqual([LOCAL_NET, REVIEWS_NET]);
    expect(unreadableNetworks(NETS, [undefined, { isError: false }])).toEqual([]);
  });
  it("names them in words", () => {
    const html = renderToStaticMarkup(createElement(UnreadableNote, { networks: [REVIEWS_NET] })).replaceAll("<!-- -->", "");
    expect(html).toContain("check whether Reviewly is connected");
    expect(renderToStaticMarkup(createElement(UnreadableNote, { networks: [] }))).toBe("");
  });
  it("the page says nothing when every read worked, and still draws the connect cards", () => {
    const html = render(LOCAL_NET);
    expect(html).not.toContain("check whether");
    for (const n of NETS) expect(html).toContain(n.title);
  });
});

describe("the connect card words follow the declaration", () => {
  it("a reviews-only network is not asked to connect a listing; a listing network is", () => {
    const html = render(GOOGLE_NET, NETS, () => "disconnected");
    expect(html).toContain("Connect Reviewly to get your reviews in one inbox.");
    expect(html).toContain("Connect your listing to get your Localpages reviews in one inbox and reply to them there.");
  });
});

describe("the real edit card, for a network that is not writable", () => {
  it("says changes cannot be made from Peakhour, and draws no form", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    qc.setQueryData(presenceListingQueryKey(undefined, LOCAL_NET.network), listingAnswer(LOCAL_NET));
    primeEdit(qc);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(EditListingCard, { network: LOCAL_NET.network })));
    expect(html).toContain("Changes to this listing cannot be made from Peakhour yet.");
    expect(html).not.toContain("<form");
  });
});

describe("the insights panel with no listing entry uses the network's own declaration", () => {
  const draw = (capabilities: ConnectableNetwork["capabilities"] | undefined) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    qc.setQueryData(presenceListingQueryKey(undefined, REVIEWS_NET.network), listingAnswer(REVIEWS_NET));
    qc.setQueryData(presenceInsightsQueryKey(DEFAULT_INSIGHT_DAYS, undefined, REVIEWS_NET.network), insightsAnswer(3));
    return renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(InsightsPanel, { network: REVIEWS_NET.network, capabilities })));
  };
  it("draws only the declared tiles, never all six", () => {
    const html = draw({ ...REVIEWS_NET.capabilities, metricKeys: ["calls"] });
    expect(html).toContain("Calls");
    for (const other of ["Directions", "Website clicks", "Bookings", "Profile views", "Messages"]) expect(html).not.toContain(other);
  });
  it("draws nothing for a declaration of no figures", () => {
    expect(draw(REVIEWS_NET.capabilities)).toBe("");
  });
});

describe("the poster link", () => {
  it("round-trips location and network through its query string", () => {
    const u = new URL(posterHref("a b&c", "pe16_x"), "https://x.example");
    expect(u.pathname).toBe("/dashboard/presence/review-poster");
    expect(u.searchParams.get("location")).toBe("a b&c");
    expect(u.searchParams.get("network")).toBe("pe16_x");
    expect(posterHref()).toBe("/dashboard/presence/review-poster");
  });
});

describe("the diff rule, for the screens", () => {
  const SRC = resolve(__dirname, "..", "..");
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const f = join(dir, n);
      return statSync(f).isDirectory() ? walk(f) : /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [f] : [];
    });
  }
  it("no screen file spells a test network's key: the three networks above exist only in this test file", { timeout: 60_000 }, () => {
    // Explicit timeout: this walks and reads every non-test source file in src/. The cost is file I/O, not a
    // hang, and under CPU load (several builds at once) it exceeds the 5s default. The scan is unchanged.
    const bad = walk(SRC)
      .filter((f) => /pe16_/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(bad).toEqual([]);
  });
});
