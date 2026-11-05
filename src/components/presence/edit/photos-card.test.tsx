import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { presenceListingQueryKey } from "@/lib/presence-panels";
import { presenceEditKeys } from "@/lib/presence-edit";
import { presencePhotosKey } from "@/hooks/use-presence-photos";
import type { PhotosResponse } from "@/lib/presence-photos";

/**
 * The photos card rendered with the api's answers in the cache (PE-11): the states a merchant sees, and that a customer's photo carries no
 * delete control. WHAT THIS CANNOT PROVE: a browser (static markup, no effect or click runs) or the api (every answer is a fixture).
 */

vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));
vi.mock("@/lib/api", () => ({ api: { get: async () => { throw new Error("no network in this test"); }, put: async () => undefined, post: async () => undefined } }));

const { PhotosCard } = await import("@/components/presence/edit/photos-card");

const NET = "net_a";
const LIMITS = { formats: ["image/jpeg", "image/png"], formatsLabel: "JPG or PNG", minBytes: 10240, maxBytes: 5242880, minPixels: 250, recommendedPixels: 720, maxItems: 100, source: "x" };
const photos = (over: Partial<PhotosResponse> = {}): PhotosResponse => ({
  network: NET,
  label: "NetA",
  declaration: { categories: ["EXTERIOR", "FOOD_AND_DRINK"], limits: LIMITS, removal: { restorable: false } },
  writes: { released: false, notice: "Nothing is sent to NetA yet. You can choose photos and approve them, and they wait here until Peakhour switches sending on. Held." },
  items: [
    { ref: "m/1", category: "EXTERIOR", format: "photo", source: "owner", url: "https://img.example/1.jpg", thumbnailUrl: null, createdAt: null, attribution: null, removable: true, notRemovableBecause: null, driveMediaId: null },
    {
      ref: "m/2", category: null, format: "photo", source: "customer", url: "https://img.example/2.jpg", thumbnailUrl: null, createdAt: null,
      attribution: { name: "Sam Rao", reportUrl: "https://report.example/x" }, removable: false, notRemovableBecause: "This photo was added by a customer. NetA does not let a business delete a customer's photo.", driveMediaId: null,
    },
  ],
  waiting: [],
  held: 1,
  ...over,
});

function render(data: PhotosResponse | null, can = { propose: true, approve: true }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(presenceListingQueryKey(undefined, undefined), {
    setup: "ready",
    connection: { network: NET, label: "NetA", status: "active", locationName: "p", locations: [], lastSyncAt: null, lastError: null },
    listing: { id: "l1", name: "Shop", status: "active", description: null, primaryCategory: null, additionalCategories: [], contact: {}, address: null, geo: null, regularHours: [], specialHours: [], updatedAt: null },
    networks: [{ network: NET, label: "NetA", capabilities: { media: true } }],
  });
  qc.setQueryData(presenceEditKeys.capabilities, { items: [], can });
  qc.setQueryData(presenceEditKeys.changes("l1"), { items: [] });
  if (data) qc.setQueryData(presencePhotosKey("l1", NET), data);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(PhotosCard)));
}

describe("the photos card", () => {
  it("shows the switch-off words, the limits and the declared categories, in the network's own label", () => {
    const html = render(photos());
    expect(html).toContain("Nothing is sent to NetA yet");
    expect(html).toContain("NetA takes photos that are JPG or PNG, 10 KB to 5 MB");
    expect(html).toContain(">Exterior<");
    expect(html).toContain(">Food and drink<");
    expect(html).not.toContain("Google");
  });

  it("an owner photo has a Remove button; a customer photo has none, says who it is credited to, and offers a report link", () => {
    const html = render(photos());
    expect(html.match(/>Remove</g)).toHaveLength(1);
    expect(html).toContain("Added by a customer");
    expect(html).toContain("Credited to Sam Rao");
    expect(html).toContain("does not let a business delete a customer");
    expect(html).toContain('href="https://report.example/x"');
    expect(html).toContain("Report this photo to NetA");
  });

  it("a viewer sees the photos and no control to add or remove", () => {
    const html = render(photos(), { propose: false, approve: false });
    expect(html).not.toContain(">Remove<");
    expect(html).toContain("Your role can look at your photos but not change them");
  });

  it("with a photo change waiting there is no second Remove and the reason is given", () => {
    const html = render(photos({ waiting: [{ id: "c1", status: "proposed", op: "add" }] }));
    expect(html).not.toContain(">Remove<");
    expect(html).toContain("A photo change is already waiting");
  });

  it("an empty listing says so and still offers to add", () => {
    const html = render(photos({ items: [], held: 0 }));
    expect(html).toContain("There are no photos on NetA yet.");
    expect(html).toContain("Choose from Drive");
  });

  it("with no answer yet it shows a placeholder and no photo, never an empty-list claim", () => {
    const html = render(null);
    expect(html).not.toContain("There are no photos");
    expect(html).not.toContain("Choose from Drive");
  });
});
