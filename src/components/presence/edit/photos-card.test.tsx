import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { presenceListingQueryKey } from "@/lib/presence-panels";
import { presenceEditKeys } from "@/lib/presence-edit";
import { presencePhotosKey } from "@/hooks/use-presence-photos";
import type { PhotosResponse } from "@/lib/presence-photos";

/**
 * The photos card rendered with the api's answers in the cache (PE-11): the states a merchant sees, that a customer's photo carries no
 * delete control, that what waits comes from the change list, and that photo changes are shown whatever the photo read did.
 * WHAT THIS CANNOT PROVE: a browser (static markup, no effect or click runs) or the api (every answer is a fixture).
 */

vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));
vi.mock("@/lib/api", () => ({ api: { get: async () => { throw new Error("no network in this test"); }, put: async () => undefined, post: async () => undefined } }));

const { PhotosCard } = await import("@/components/presence/edit/photos-card");

const NET = "net_a";
const LIMITS = { formats: ["image/jpeg", "image/png"], formatsLabel: "JPG or PNG", minBytes: 10240, maxBytes: 5242880, minPixels: 250, recommendedPixels: 720, maxItems: 100, source: "x" };
const NOTICE = "Nothing is sent to NetA yet. You can prepare photos and approve them, but a change expires 72 hours after you prepare it, and one that has not been sent by then is dropped and has to be prepared again. Held.";
const item = (over: Record<string, unknown>) => ({ ref: "m/x", category: null, format: "photo", source: "owner", url: null, thumbnailUrl: null, createdAt: null, attribution: null, removable: true, notRemovableBecause: null, driveMediaId: null, ...over });
const photos = (over: Partial<PhotosResponse> = {}): PhotosResponse => ({
  network: NET,
  label: "NetA",
  declaration: { categories: ["EXTERIOR", "FOOD_AND_DRINK"], limits: LIMITS, removal: { restorable: false } },
  writes: { released: false, notice: NOTICE },
  complete: true,
  customersComplete: true,
  items: [
    item({ ref: "m/1", category: "EXTERIOR", url: "https://img.example/1.jpg" }) as never,
    item({ ref: "m/2", source: "customer", url: "https://img.example/2.jpg", attribution: { name: "Sam Rao", reportUrl: "https://report.example/x" }, removable: false, notRemovableBecause: "This photo was added by a customer. NetA does not let a business delete a customer's photo." }) as never,
  ],
  held: 1,
  ...over,
});
const change = (over: Record<string, unknown> = {}) => ({
  id: "c1", listingId: "l1", network: NET, field: "media", status: "validated", riskTier: "ordinary", notes: ["A note."], source: "form",
  before: { op: "keep", ref: "m/1" }, after: { op: "remove", ref: "m/1" }, reason: null, held: null, validation: null, createdAt: "2026-11-05T10:00:00.000Z", expiresAt: "2026-11-08T10:00:00.000Z",
  submittedAt: null, liveAt: null, liveCheck: null, undone: false, undoable: true, ...over,
});

function render(opts: { data?: PhotosResponse | null; can?: { propose: boolean; approve: boolean } | null; changes?: unknown[] | null } = {}) {
  const { data = photos(), can = { propose: true, approve: true }, changes = [] } = opts;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(presenceListingQueryKey(undefined, undefined), {
    setup: "ready",
    connection: { network: NET, label: "NetA", status: "active", locationName: "p", locations: [], lastSyncAt: null, lastError: null },
    listing: { id: "l1", name: "Shop", status: "active", description: null, primaryCategory: null, additionalCategories: [], contact: {}, address: null, geo: null, regularHours: [], specialHours: [], updatedAt: null },
    networks: [{ network: NET, label: "NetA", capabilities: { media: true } }],
  });
  if (can) qc.setQueryData(presenceEditKeys.capabilities, { items: [], can });
  if (changes) qc.setQueryData(presenceEditKeys.changes("l1"), { items: changes });
  if (data) qc.setQueryData(presencePhotosKey("l1", NET), data);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(PhotosCard)));
}

describe("the photos card", () => {
  it("shows the limits and the declared categories in the network's own label, and never repeats the switch-off notice", () => {
    const html = render();
    // GBP Issue 1: whether changes are sent is the page's one publishing status, never a paragraph per panel.
    expect(html).not.toContain("a change expires 72 hours after you prepare it");
    expect(html).toContain("NetA takes photos that are JPG or PNG, 10 KB to 5 MB");
    expect(html).toContain(">Exterior<");
    expect(html).toContain(">Food and drink<");
    expect(html).not.toContain("Google");
  });

  it("an owner photo has a Remove button; a customer photo has none, says who it is credited to, why, and offers a report link", () => {
    const html = render();
    expect(html.match(/>Remove</g)).toHaveLength(1);
    expect(html).toContain("Added by a customer");
    expect(html).toContain("Credited to Sam Rao");
    expect(html).toContain("does not let a business delete a customer");
    expect(html).toContain('href="https://report.example/x"');
    expect(html).toContain("Report this photo to NetA");
  });

  it("a video with no thumbnail draws no picture, and says why it cannot be removed", () => {
    const html = render({ data: photos({ items: [item({ ref: "v/1", format: "video", url: "https://img.example/v.jpg", removable: false, notRemovableBecause: "Only photos can be removed here." }) as never] }) });
    expect(html).not.toContain("img.example/v.jpg");
    expect(html).toContain("No preview (not a photo)");
    expect(html).toContain("Only photos can be removed here.");
    expect(html).not.toContain(">Remove<");
  });

  it("a viewer sees the photos and no control to add or remove, and is told it is their role", () => {
    const html = render({ can: { propose: false, approve: false } });
    expect(html).not.toContain(">Remove<");
    expect(html).toContain("Your role can look at your photos but not change them");
  });

  it("with no answer yet about the role it says it is checking, and does not blame the role", () => {
    const html = render({ can: null });
    expect(html).toContain("Checking what you can do here...");
    expect(html).not.toContain("Your role can look");
    expect(html).not.toContain(">Remove<");
  });

  it("a removal waiting for approval is read from the CHANGE LIST: that photo has no Remove, and its note matches the status", () => {
    const waiting = render({ changes: [change({ status: "validated" })] });
    expect(waiting.match(/>Remove</g) ?? []).toHaveLength(0);
    expect(waiting).toContain("A removal is waiting below. Approve or decline it there.");
    const approved = render({ changes: [change({ status: "approved" })] });
    expect(approved).toContain("Approved, waiting to be sent");
    expect(approved).not.toContain("Approve or decline it there");
  });

  it("until the change list has answered, Remove and adding are withheld and it says why", () => {
    const html = render({ changes: null });
    expect(html).not.toContain(">Remove<");
    expect(html).toContain("Checking your waiting photo changes...");
    expect(html).toMatch(/<select id="photo-category"[^>]*disabled/);
  });

  it("a removal already sent still counts as waiting on its tile, with words that match", () => {
    const html = render({ changes: [change({ status: "submitted" })] });
    expect(html.match(/>Remove</g) ?? []).toHaveLength(0);
    expect(html).toContain("Removal sent. Waiting for it to show.");
    expect(html).not.toContain("Approve or decline it there");
  });

  it("another network's photo change is not listed here, and does not hold this network's tile", () => {
    const html = render({ changes: [change({ network: "net_b", id: "other" })] });
    expect(html).toContain("No photo changes yet.");
    expect(html.match(/>Remove</g)).toHaveLength(1);
  });

  it("says when the customers' photos could not be read, apart from the owner's list", () => {
    expect(render({ data: photos({ customersComplete: false }) })).toContain("could not read the photos your customers added on NetA");
    expect(render({ data: photos({ customersComplete: false }) })).not.toContain("We could not read every one of your photos");
    expect(render()).not.toContain("your customers added");
  });

  it("waiting adds that would fill the cap are named as such, not blamed on a full listing", () => {
    const adds = Array.from({ length: 5 }, (_, i) => change({ id: `a${i}`, status: "validated", before: null, after: { op: "add", mediaId: `d${i}`, category: "EXTERIOR", file: { name: "a.jpg" } } }));
    const html = render({ data: photos({ held: 95 }), changes: adds });
    expect(html).toContain("The photos already waiting would fill the 100 this listing can hold. Approve or decline them first.");
  });

  it("every open change is shown even beneath a long settled history", () => {
    const history = Array.from({ length: 20 }, (_, i) => change({ id: `h${i}`, status: "live", createdAt: `2026-11-06T10:00:${String(i).padStart(2, "0")}.000Z`, after: { op: "remove", ref: `old/${i}` } }));
    const open = change({ id: "still-open", status: "validated", createdAt: "2026-11-01T10:00:00.000Z" });
    const html = render({ changes: [...history, open] });
    expect(html).toContain("Awaiting your approval");
    expect(html.match(/Live on NetA/g)).toHaveLength(8);
  });

  it("a waiting change does not lock adding: the category is still chosen and several photos can be picked", () => {
    const html = render({ changes: [change({ id: "c9", status: "validated", after: { op: "add", mediaId: "d1", category: "EXTERIOR", file: { name: "a.jpg" } }, before: null })] });
    expect(html).not.toContain("is already waiting");
    expect(html).toMatch(/<select id="photo-category"(?![^>]*disabled)/);
  });

  it("the cap, not a waiting change, stops adding", () => {
    const html = render({ data: photos({ held: 100 }) });
    expect(html).toContain("A listing can hold at most 100 photos. Remove one first.");
    expect(html).toMatch(/<select id="photo-category"[^>]*disabled/);
  });

  it("says when the list may be missing photos", () => {
    expect(render({ data: photos({ complete: false }) })).toContain("We could not read every one of your photos from NetA just now");
    expect(render()).not.toContain("We could not read every one of your photos");
  });

  it("an empty listing says so and still offers to add", () => {
    const html = render({ data: photos({ items: [], held: 0 }) });
    expect(html).toContain("There are no photos on NetA yet.");
    expect(html).toContain("Choose from Drive");
  });

  it("with no photo answer yet it shows a placeholder and no photo, never an empty-list claim", () => {
    const html = render({ data: null });
    expect(html).not.toContain("There are no photos");
    expect(html).not.toContain("Choose from Drive");
  });

  it("★photo changes are listed even when the photo read has not answered", () => {
    const html = render({ data: null, changes: [change({ status: "validated" })] });
    expect(html).toContain("Photo changes");
    expect(html).toContain("Awaiting your approval");
    expect(html).toContain("Remove this photo");
  });

  it("a removal's card shows the photo it is about, looked up by its reference; with no photo read it shows none", () => {
    const withData = render({ changes: [change()] });
    expect(withData).toContain('alt="The photo this change is about"');
    expect(withData).toContain('src="https://img.example/1.jpg"');
    expect(render({ data: null, changes: [change()] })).not.toContain("The photo this change is about");
  });

  it("Undo is shown only for a change the api says can be put back", () => {
    const sent = (undoable: boolean) => render({ changes: [change({ status: "submitted", undoable })] });
    expect(sent(true)).toContain("Undo (needs approval)");
    expect(sent(false)).not.toContain("Undo (needs approval)");
  });
});
