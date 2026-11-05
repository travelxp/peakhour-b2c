import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fetchView } from "@/lib/presence-panels";
import { fieldTitle, valueLines, cardActions, type ChangeCardData } from "@/lib/presence-edit";
import {
  batchSummary,
  canAddPhoto,
  categoryLabel,
  drawsPhotos,
  limitsSentence,
  openPhotoChanges,
  pendingFor,
  pendingNote,
  photoAccess,
  photoChanges,
  photoControls,
  photosView,
  photoValueLines,
  pickLimit,
  previewOf,
  settledSince,
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
  complete: true,
  items: [],
  held: 0,
  ...over,
});
const change = (over: Partial<ChangeCardData> = {}): ChangeCardData => ({ id: "c1", field: "media", status: "proposed", after: { op: "remove", ref: "r1" }, ...over }) as ChangeCardData;

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
  const edit = photoAccess("data", { propose: true });
  const look = photoAccess("data", { propose: false });
  const owner = { removable: true };
  const customer = { removable: false };

  it("an answer that says no is the role's; no answer yet is checking; a failed answer is not blamed on the role", () => {
    expect(photoAccess("data", { propose: true })).toEqual({ mode: "edit" });
    expect(photoAccess("data", { propose: false })).toMatchObject({ mode: "view", why: expect.stringContaining("Your role can look at your photos") });
    expect(photoAccess("loading", undefined)).toMatchObject({ mode: "view", why: expect.stringContaining("Checking") });
    expect(photoAccess("paused", undefined)).toMatchObject({ mode: "view", why: expect.stringContaining("Checking") });
    const failed = photoAccess("failed", undefined);
    expect(failed).toMatchObject({ mode: "view", why: expect.stringContaining("could not check") });
    expect((failed as { why: string }).why).not.toContain("Your role");
  });
  it("a customer photo has no delete control, for any access, and its reason is not the role's", () => {
    for (const a of [edit, look, photoAccess("failed", undefined)]) expect(photoControls(a, customer, undefined).remove).toBe(false);
    expect(photoControls(edit, customer, undefined).note).toBeNull();
  });
  it("an owner photo can be removed by an editor; not by a viewer; not while a removal of it waits", () => {
    expect(photoControls(edit, owner, undefined)).toEqual({ remove: true, note: null });
    expect(photoControls(look, owner, undefined).remove).toBe(false);
    expect(photoControls(look, owner, undefined).note).toContain("Your role");
    expect(photoControls(edit, owner, change()).remove).toBe(false);
  });
  it("what waits comes from the change list: only an OPEN removal of THIS photo", () => {
    expect(pendingFor([change()], "r1")?.id).toBe("c1");
    expect(pendingFor([change()], "r2")).toBeUndefined();
    expect(pendingFor([change({ status: "submitted" })], "r1")).toBeUndefined();
    expect(pendingFor([change({ after: { op: "add" } })], "r1")).toBeUndefined();
    expect(pendingFor([change({ field: "description" })], "r1")).toBeUndefined();
    expect(pendingFor(undefined, "r1")).toBeUndefined();
  });
  it("the waiting words follow the change's own status, so nobody is told to approve what has no button", () => {
    expect(pendingNote("validated", { approve: true })).toContain("Approve or decline it there");
    expect(pendingNote("validated", { approve: false })).toContain("for an admin or owner to approve");
    expect(pendingNote("approved", { approve: true })).not.toMatch(/Approve or decline/);
    expect(pendingNote("approved", { approve: true })).toContain("waiting to be sent");
    expect(pendingNote("applying", { approve: true })).toBe("Being removed now.");
  });
  it("several photos can be added at once: a waiting change is no lock, the cap and the role are", () => {
    const p = (held: number) => ({ declaration: data().declaration, held, items: [] as never[] });
    expect(canAddPhoto(edit, p(1), 5)).toEqual({ ok: true, why: null });
    expect(canAddPhoto(look, p(1), 0).ok).toBe(false);
    expect(canAddPhoto(edit, p(100), 0).why).toContain("at most 100");
    expect(canAddPhoto(edit, p(95), 5).ok).toBe(false);
  });
  it("how many can be picked at once: the cap less what is held and being added, never more than ten", () => {
    const p = (held: number) => ({ declaration: data().declaration, held, items: [] as never[] });
    expect(pickLimit(p(0), 0)).toBe(10);
    expect(pickLimit(p(95), 0)).toBe(5);
    expect(pickLimit(p(95), 3)).toBe(2);
    expect(pickLimit(p(100), 0)).toBe(0);
    expect(pickLimit({ declaration: { ...data().declaration, limits: { ...LIMITS, maxItems: undefined as never } }, held: 500, items: [] }, 0)).toBe(10);
  });
  it("a batch says how many were prepared and names each that was not", () => {
    expect(batchSummary(3, [])).toBe("3 photos are prepared below. Review each one, then approve it.");
    expect(batchSummary(1, [])).toContain("1 photo is prepared");
    expect(batchSummary(1, [{ name: "a.webp", message: "Not a JPG or PNG file" }])).toBe("1 photo is prepared below. 1 could not be prepared: a.webp (Not a JPG or PNG file)");
    expect(batchSummary(0, [{ name: "a", message: "x" }, { name: "b", message: "y" }])).toBe("2 could not be prepared: a (x); b (y)");
  });
  it("a video with no thumbnail draws no picture; a photo falls back to its url", () => {
    expect(previewOf({ thumbnailUrl: null, url: "https://i/v", format: "video" })).toBeNull();
    expect(previewOf({ thumbnailUrl: "https://i/t", url: "https://i/v", format: "video" })).toBe("https://i/t");
    expect(previewOf({ thumbnailUrl: null, url: "https://i/p", format: "photo" })).toBe("https://i/p");
    expect(previewOf({ thumbnailUrl: null, url: null, format: "photo" })).toBeNull();
  });
});

describe("undo is offered only when the api says it can be put back", () => {
  const sent = { status: "submitted", undone: false } as const;
  it("a change the api marks not undoable has no Undo; one marked undoable, or from an older api, has", () => {
    expect(cardActions({ ...sent, undoable: false }, { propose: true, approve: true }).undo).toBe(false);
    expect(cardActions({ ...sent, undoable: true }, { propose: true, approve: true }).undo).toBe(true);
    expect(cardActions({ ...sent }, { propose: true, approve: true }).undo).toBe(true);
    expect(cardActions({ status: "live", undone: true, undoable: true }, { propose: true, approve: true }).undo).toBe(false);
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

describe("photos are read again when a change leaves the open statuses", () => {
  const c = (id: string, status: string) => ({ id, field: "media", status, after: { op: "add" } }) as ChangeCardData;
  it("an open change that is no longer open means the list is stale; a new open change or no change does not", () => {
    expect(settledSince(new Set(["a"]), [c("a", "submitted")])).toBe(true);
    expect(settledSince(new Set(["a"]), [c("a", "failed")])).toBe(true);
    expect(settledSince(new Set(["a"]), [c("a", "approved")])).toBe(false);
    expect(settledSince(new Set(["a"]), [])).toBe(true);
    expect(settledSince(new Set(), [c("b", "proposed")])).toBe(false);
    expect(settledSince(new Set(["a"]), undefined)).toBe(true);
  });
  it("photoChanges and openPhotoChanges pick the photo changes, and the open ones", () => {
    const list = [c("a", "proposed"), c("b", "live"), { ...c("d", "proposed"), field: "description" } as ChangeCardData];
    expect(photoChanges(list).map((x) => x.id)).toEqual(["a", "b"]);
    expect(openPhotoChanges(list).map((x) => x.id)).toEqual(["a"]);
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
  it("the Presence page draws the card only for a network that declares photos, with the id on a wrapper, and a photos fix opens it", () => {
    const home = flat("components/presence/presence-home.tsx");
    expect(home).toContain("const photosOn = listingOn && drawsPhotos(aboutNetwork);");
    expect(home).toContain('{photosOn ? ( <div id="photos-card"> <PhotosCard location={panelLocation} network={panelNetwork} /> </div> ) : null}');
    expect(flat("components/presence/edit/photos-card.tsx")).not.toContain('id="photos-card"');
    expect(home).toContain("photoChangesElsewhere={photosOn}");
    expect(home).toContain('if (field === "media") {');
  });
  it("the edit card lists photo changes itself when the photos card is not drawn", () => {
    const edit = flat("components/presence/edit/edit-listing-card.tsx");
    expect(edit).toContain("!photoChangesElsewhere || c.field !== \"media\"");
  });
  it("the picker is offered no Generate tab: a business's photos are not made by AI and nothing is charged", () => {
    expect(flat("components/presence/edit/photos-card.tsx")).toContain('tabs={["drive", "upload"]}');
  });
  it("a private file can be picked, several at once, and a file that will be refused is greyed out", () => {
    const card = flat("components/presence/edit/photos-card.tsx");
    expect(card).toContain("requirePublicUrl={false}");
    expect(card).toContain("needUrl={false}");
    expect(card).toContain("unusable={(f) => unusableReason(f, data.declaration.limits)}");
    expect(card).toContain("maxSelection={pickLimit(data, openAdds)}");
    expect(card).toContain("onSelect={(assets) => void addMany(assets)}");
  });
  it("a customer photo is drawn with no Remove button and a report link; every non-removable item says why", () => {
    const card = flat("components/presence/edit/photos-card.tsx");
    const notRemovable = card.indexOf("{!p.removable && (");
    const remove = card.indexOf("{ctl.remove && (");
    expect(notRemovable).toBeGreaterThan(-1);
    expect(remove).toBeGreaterThan(notRemovable);
    expect(card.slice(notRemovable, remove)).not.toContain("Remove");
    expect(card.slice(notRemovable, remove)).toContain("{p.notRemovableBecause &&");
    expect(card.slice(notRemovable, remove)).toContain("Report this photo");
  });
  it("the photo changes are listed whatever the photo read did (outside the ready branch)", () => {
    const card = flat("components/presence/edit/photos-card.tsx");
    expect(card.indexOf("const changeList =")).toBeGreaterThan(card.indexOf("const body ="));
    expect(card.slice(card.indexOf("return ( <Card className"))).toContain("Photo changes");
  });
  it("the photo refresh follows the change list, and a failed proposal refreshes too", () => {
    expect(flat("components/presence/edit/photos-card.tsx")).toContain("useRefreshPhotosWhenSettled(changes.data?.items);");
    const hook = flat("hooks/use-presence-photos.ts");
    expect(hook).toContain("onSettled: refresh");
    expect(hook).not.toContain("onSuccess: refresh");
  });
});
