import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fetchView } from "@/lib/presence-panels";
import { fieldTitle, valueLines } from "@/lib/presence-edit";
import {
  canAddPhoto,
  categoryLabel,
  drawsPhotos,
  limitsSentence,
  photoControls,
  photosView,
  photoValueLines,
  unusableReason,
  type PhotoLimits,
  type PhotosResponse,
} from "@/lib/presence-photos";

/**
 * The listing photos panel's rules (PE-11), pure. The limits below are a network's DECLARATION as the api sends it; the numbers are written
 * out here, not read from the code under test.
 */

const LIMITS: PhotoLimits = { formats: ["image/jpeg", "image/png"], formatsLabel: "JPG or PNG", minBytes: 10 * 1024, maxBytes: 5 * 1024 * 1024, minPixels: 250, recommendedPixels: 720, maxItems: 100, source: "x" };
const file = (over: Record<string, unknown> = {}) => ({ mimeType: "image/jpeg", sizeBytes: 800_000, width: 1000, height: 1000, ...over }) as Parameters<typeof unusableReason>[0];
const data = (over: Partial<PhotosResponse> = {}): PhotosResponse => ({
  network: "n",
  label: "Testnet",
  declaration: { categories: ["EXTERIOR"], limits: LIMITS, removal: { restorable: false } },
  writes: { released: true, notice: null },
  items: [],
  waiting: [],
  held: 0,
  ...over,
});

describe("which networks draw the panel", () => {
  it("only one that declares photos; an api that predates the field, and a network that does not, draw none", () => {
    expect(drawsPhotos({ capabilities: { media: true } as never })).toBe(true);
    expect(drawsPhotos({ capabilities: { media: false } as never })).toBe(false);
    expect(drawsPhotos({ capabilities: {} as never })).toBe(false);
    expect(drawsPhotos(undefined)).toBe(false);
    expect(drawsPhotos(null)).toBe(false);
  });
});

describe("words from the declaration", () => {
  it("a category reads as words, whatever the network calls it", () => {
    expect(categoryLabel("FOOD_AND_DRINK")).toBe("Food and drink");
    expect(categoryLabel("EXTERIOR")).toBe("Exterior");
    expect(categoryLabel("")).toBe("");
  });
  it("the limits sentence says what the network states and nothing it does not", () => {
    expect(limitsSentence(LIMITS, "Testnet")).toBe("Testnet takes photos that are JPG or PNG, 10 KB to 5 MB, at least 250 x 250 pixels (720 x 720 is better), up to 100 photos.");
    expect(limitsSentence({ formats: ["image/png"], formatsLabel: "PNG", source: "x" }, "Testnet")).toBe("Testnet takes photos that are PNG.");
  });
});

describe("a file that will be refused is greyed out, with the reason", () => {
  it("passes a photo inside every limit, on the edges too", () => {
    expect(unusableReason(file(), LIMITS)).toBeNull();
    expect(unusableReason(file({ mimeType: "image/png" }), LIMITS)).toBeNull();
    expect(unusableReason(file({ sizeBytes: 10 * 1024 }), LIMITS)).toBeNull();
    expect(unusableReason(file({ sizeBytes: 5 * 1024 * 1024 }), LIMITS)).toBeNull();
    expect(unusableReason(file({ width: 250, height: 250 }), LIMITS)).toBeNull();
  });
  it("names the limit that is broken", () => {
    expect(unusableReason(file({ mimeType: "image/webp" }), LIMITS)).toBe("Not a JPG or PNG file");
    expect(unusableReason(file({ sizeBytes: 10 * 1024 - 1 }), LIMITS)).toBe("Under 10 KB");
    expect(unusableReason(file({ sizeBytes: 5 * 1024 * 1024 + 1 }), LIMITS)).toBe("Over 5 MB");
    expect(unusableReason(file({ width: 249 }), LIMITS)).toBe("Under 250 x 250 pixels");
    expect(unusableReason(file({ height: 249 }), LIMITS)).toBe("Under 250 x 250 pixels");
  });
  it("does not refuse a file whose pixel size is unknown", () => {
    expect(unusableReason(file({ width: undefined, height: undefined }), LIMITS)).toBeNull();
  });
});

describe("what a person may press", () => {
  const owner = { removable: true };
  const customer = { removable: false };
  it("a customer photo has no delete control, for any role, and no 'why not' that blames the role", () => {
    for (const can of [{ propose: true }, { propose: false }] as const) {
      expect(photoControls(can, customer, false).remove).toBe(false);
    }
    expect(photoControls({ propose: true }, customer, false).whyNot).toBeNull();
  });
  it("an owner photo can be removed by an editor, not by a viewer, and not while another photo change waits", () => {
    expect(photoControls({ propose: true }, owner, false)).toEqual({ remove: true, whyNot: null });
    expect(photoControls({ propose: false }, owner, false).remove).toBe(false);
    expect(photoControls(undefined, owner, false).remove).toBe(false);
    expect(photoControls({ propose: true }, owner, true)).toMatchObject({ remove: false, whyNot: expect.stringContaining("already waiting") });
  });
  it("adding waits for a role, for the one waiting change and for the item cap", () => {
    expect(canAddPhoto({ propose: true }, data())).toEqual({ ok: true, why: null });
    expect(canAddPhoto({ propose: false }, data()).ok).toBe(false);
    expect(canAddPhoto({ propose: true }, data({ waiting: [{ id: "c", status: "proposed", op: "add" }] })).why).toContain("already waiting");
    expect(canAddPhoto({ propose: true }, data({ held: 99 })).ok).toBe(true);
    expect(canAddPhoto({ propose: true }, data({ held: 100 })).why).toContain("at most 100");
  });
});

describe("loading, paused, failed, empty (isLoading misses a paused query)", () => {
  it("a paused first fetch is its own state, not a spinner for ever", () => {
    expect(photosView(fetchView({ hasData: false, isPending: true, isError: false, fetchStatus: "paused" }), 0)).toEqual({ kind: "paused" });
    expect(photosView(fetchView({ hasData: false, isPending: true, isError: false, fetchStatus: "fetching" }), 0)).toEqual({ kind: "loading" });
    expect(photosView(fetchView({ hasData: false, isPending: false, isError: true, fetchStatus: "idle" }), 0)).toEqual({ kind: "failed" });
  });
  it("data is ready; empty is only data with no items; a failed refresh keeps the data and says it is stale", () => {
    expect(photosView("data", 2)).toEqual({ kind: "ready", stale: false, empty: false });
    expect(photosView("data", 0)).toEqual({ kind: "ready", stale: false, empty: true });
    expect(photosView("data_stale", 2)).toEqual({ kind: "ready", stale: true, empty: false });
  });
});

describe("a photo change as a before-and-after card", () => {
  it("says what is added, removed or kept, and titles the card Photo", () => {
    expect(photoValueLines({ op: "add", category: "FOOD_AND_DRINK", file: { name: "front.jpg" } })).toEqual(['Add "front.jpg"', "Category: Food and drink"]);
    expect(photoValueLines({ op: "remove", ref: "r", category: "EXTERIOR" })).toEqual(["Remove this photo", "Category: Exterior"]);
    expect(photoValueLines({ op: "keep", ref: "r" })).toEqual(["On your listing"]);
    expect(photoValueLines(null)).toEqual([]);
    expect(valueLines("media", { op: "remove", ref: "r" })).toEqual(["Remove this photo"]);
    expect(fieldTitle("media")).toBe("Photo");
    expect(fieldTitle("description")).toBe("Description");
  });
});

describe("how the panel is wired (pinned as text: b2c vitest renders no DOM)", () => {
  const SRC = resolve(__dirname, "..");
  const flat = (rel: string) => readFileSync(join(SRC, rel), "utf8").replace(/\s+/g, " ");
  it("the Presence page draws the card only for a network that declares photos, and a photos fix opens it", () => {
    const home = flat("components/presence/presence-home.tsx");
    expect(home).toContain("const photosOn = listingOn && drawsPhotos(aboutNetwork);");
    expect(home).toContain("{photosOn ? <PhotosCard location={panelLocation} network={panelNetwork} /> : null}");
    expect(home).toContain('if (field === "media") {');
  });
  it("the picker is offered no Generate tab: a business's photos are not made by AI and nothing is charged", () => {
    expect(flat("components/presence/edit/photos-card.tsx")).toContain('tabs={["drive", "upload"]}');
  });
  it("a private file can be picked (no public link is needed in the browser), but a file that will be refused is greyed out", () => {
    const card = flat("components/presence/edit/photos-card.tsx");
    expect(card).toContain("requirePublicUrl={false}");
    expect(card).toContain("needUrl={false}");
    expect(card).toContain("unusable={(f) => unusableReason(f, data.declaration.limits)}");
  });
  it("a customer photo is drawn with no Remove button and a report link", () => {
    const card = flat("components/presence/edit/photos-card.tsx");
    const customer = card.indexOf('p.source === "customer" ?');
    const remove = card.indexOf("ctl.remove ?");
    expect(customer).toBeGreaterThan(-1);
    expect(remove).toBeGreaterThan(customer);
    expect(card.slice(customer, remove)).not.toContain("Remove");
    expect(card.slice(customer, remove)).toContain("Report this photo");
  });
});
