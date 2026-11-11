import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fetchView } from "@/lib/presence-panels";
import { fieldTitle, valueLines, cardActions, mergeChanges, type ChangeCardData } from "@/lib/presence-edit";
import {
  batchSummary,
  canAddPhoto,
  categoryLabel,
  drawsPhotos,
  inFlightPhotoChanges,
  limitsSentence,
  openPhotoChanges,
  outcomeOf,
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
  withChangesKnown,
  type Batch,
  type PhotoLimits,
  type PhotosResponse,
} from "@/lib/presence-photos";

/**
 * The listing photos panel's rules (PE-11), pure. The limits below are a network's DECLARATION as the api sends it; the numbers are written
 * out here, not read from the code under test.
 */

const NET = "net_a";
const LIMITS: PhotoLimits = { formats: ["image/jpeg", "image/png"], formatsLabel: "JPG or PNG", minBytes: 10 * 1024, maxBytes: 5 * 1024 * 1024, minPixels: 250, recommendedPixels: 720, maxItems: 100, source: "x" };
const file = (over: Record<string, unknown> = {}) => ({ mimeType: "image/jpeg", sizeBytes: 800_000, width: 1000, height: 1000, ...over }) as Parameters<typeof unusableReason>[0];
const data = (over: Partial<PhotosResponse> = {}): PhotosResponse => ({
  network: NET,
  label: "Testnet",
  declaration: { categories: ["EXTERIOR"], limits: LIMITS, removal: { restorable: false } },
  writes: { released: true, notice: null },
  complete: true,
  customersComplete: true,
  items: [],
  held: 0,
  ...over,
});
const change = (over: Partial<ChangeCardData> = {}): ChangeCardData =>
  ({ id: "c1", field: "media", network: NET, status: "proposed", createdAt: "2026-11-05T10:00:00.000Z", after: { op: "remove", ref: "r1" }, ...over }) as ChangeCardData;

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
  it("until the change list has answered, adding and removing are withheld and the reason is said; a role that says no keeps its own reason", () => {
    expect(withChangesKnown(edit, "data")).toEqual({ mode: "edit" });
    expect(withChangesKnown(edit, "data_stale")).toEqual({ mode: "edit" });
    expect(withChangesKnown(edit, "loading")).toMatchObject({ mode: "view", why: "Checking your waiting photo changes..." });
    expect(withChangesKnown(edit, "paused")).toMatchObject({ mode: "view", why: "Checking your waiting photo changes..." });
    expect(withChangesKnown(edit, "failed")).toMatchObject({ mode: "view", why: expect.stringContaining("could not load your photo changes") });
    expect(withChangesKnown(look, "loading")).toBe(look);
    // and what is withheld is what the card draws from: no Remove, no adding
    const held = withChangesKnown(edit, "loading");
    expect(photoControls(held, owner, undefined).remove).toBe(false);
    expect(canAddPhoto(held, data(), 0).ok).toBe(false);
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
  it("what waits comes from the change list: a removal of THIS photo on THIS network that has not settled, sent ones included", () => {
    expect(pendingFor([change()], NET, "r1")?.id).toBe("c1");
    expect(pendingFor([change({ status: "submitted" })], NET, "r1")?.id).toBe("c1");
    expect(pendingFor([change()], NET, "r2")).toBeUndefined();
    expect(pendingFor([change({ status: "live" })], NET, "r1")).toBeUndefined();
    expect(pendingFor([change({ status: "failed" })], NET, "r1")).toBeUndefined();
    expect(pendingFor([change({ after: { op: "add" } })], NET, "r1")).toBeUndefined();
    expect(pendingFor([change({ field: "description" })], NET, "r1")).toBeUndefined();
    expect(pendingFor([change({ network: "net_b" })], NET, "r1")).toBeUndefined();
    expect(pendingFor(undefined, NET, "r1")).toBeUndefined();
  });
  it("the waiting words follow the change's own status, so nobody is told to approve what has no button", () => {
    expect(pendingNote("validated", { approve: true })).toContain("Approve or decline it in Your requests");
    expect(pendingNote("validated", { approve: false })).toContain("for an admin or owner to approve");
    expect(pendingNote("approved", { approve: true })).not.toMatch(/Approve or decline/);
    expect(pendingNote("approved", { approve: true })).toContain("waiting to be sent");
    expect(pendingNote("applying", { approve: true })).toBe("Being removed now.");
    expect(pendingNote("submitted", { approve: true })).toBe("Removal sent. Waiting for it to show.");
  });
  it("several photos can be added at once: a waiting change is no lock; the role, the cap and the waiting adds are the reasons", () => {
    const p = (held: number) => ({ declaration: data().declaration, held, items: [] as never[] });
    expect(canAddPhoto(edit, p(1), 5)).toEqual({ ok: true, why: null });
    expect(canAddPhoto(look, p(1), 0).ok).toBe(false);
    expect(canAddPhoto(edit, p(100), 0).why).toBe("A listing can hold at most 100 photos. Remove one first.");
  });
  it("when the photos already WAITING are what reaches the cap, it says so, not 'remove one'", () => {
    const p = (held: number) => ({ declaration: data().declaration, held, items: [] as never[] });
    const r = canAddPhoto(edit, p(95), 5);
    expect(r.ok).toBe(false);
    expect(r.why).toBe("The photos already waiting would fill the 100 this listing can hold. Approve or decline them first.");
    expect(canAddPhoto(edit, p(100), 5).why).toContain("Remove one first");
  });
  it("how many can be picked at once: the cap less what is held and what waits, never more than ten", () => {
    const p = (held: number) => ({ declaration: data().declaration, held, items: [] as never[] });
    expect(pickLimit(p(0), 0)).toBe(10);
    expect(pickLimit(p(95), 0)).toBe(5);
    expect(pickLimit(p(95), 3)).toBe(2);
    expect(pickLimit(p(100), 0)).toBe(0);
    expect(pickLimit({ declaration: { ...data().declaration, limits: { ...LIMITS, maxItems: undefined as never } }, held: 500, items: [] }, 0)).toBe(10);
  });
  it("a video with no thumbnail draws no picture; a photo falls back to its url", () => {
    expect(previewOf({ thumbnailUrl: null, url: "https://i/v", format: "video" })).toBeNull();
    expect(previewOf({ thumbnailUrl: "https://i/t", url: "https://i/v", format: "video" })).toBe("https://i/t");
    expect(previewOf({ thumbnailUrl: null, url: "https://i/p", format: "photo" })).toBe("https://i/p");
    expect(previewOf({ thumbnailUrl: null, url: null, format: "photo" })).toBeNull();
  });
});

describe("what a proposal answered is read, never assumed", () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: "c1", status: "validated", reason: null, ...over }) as never;
  it("a checked row is prepared; a blocked row is blocked with its reason; a row the network could not check is not prepared", () => {
    expect(outcomeOf({ items: [row()], notChecked: [] })).toEqual({ kind: "prepared", id: "c1" });
    expect(outcomeOf({ items: [row({ status: "blocked", reason: { code: "control_lost", message: "Suspended." } })], notChecked: [] })).toEqual({ kind: "blocked", message: "Suspended." });
    expect(outcomeOf({ items: [row({ status: "blocked" })], notChecked: [] })).toEqual({ kind: "blocked", message: "It was blocked." });
    expect(outcomeOf({ items: [row({ status: "proposed" })], notChecked: [{ id: "c1", message: "Try again in a moment." }] })).toEqual({ kind: "not_checked", message: "Try again in a moment." });
    expect(outcomeOf({ items: [], notChecked: [] })).toEqual({ kind: "blocked", message: "Nothing was prepared." });
  });
  it("another row's not-checked entry does not demote this one", () => {
    expect(outcomeOf({ items: [row()], notChecked: [{ id: "other", message: "x" }] })).toEqual({ kind: "prepared", id: "c1" });
  });
});

describe("the batch summary", () => {
  const b = (over: Partial<Batch> = {}): Batch => ({ prepared: ["a", "b", "c"], failed: [], notChecked: [], ...over });
  it("tells an admin to review and approve, and anyone else that an admin has to", () => {
    expect(batchSummary(b(), new Set(["a", "b", "c"]), { approve: true })).toBe("3 photos are prepared below. Review each one, then approve it.");
    const editor = batchSummary(b(), new Set(["a", "b", "c"]), { approve: false })!;
    expect(editor).toBe("3 photos are prepared below. An admin or owner has to approve each one.");
    expect(editor).not.toContain("then approve it");
    expect(batchSummary(b({ prepared: ["a"] }), new Set(["a"]), { approve: true })).toContain("1 photo is prepared");
    expect(batchSummary(b(), new Set(["a", "b", "c"]), undefined)).toContain("An admin or owner has to approve");
  });
  it("counts only the changes still open, and goes once they settle", () => {
    expect(batchSummary(b(), new Set(["a"]), { approve: true })).toContain("1 photo is prepared");
    expect(batchSummary(b(), new Set(), { approve: true })).toBeNull();
    expect(batchSummary(null, new Set(["a"]), { approve: true })).toBeNull();
  });
  it("names each photo that was blocked or could not be checked, and does not count them as prepared", () => {
    const text = batchSummary(b({ prepared: ["a"], failed: [{ name: "a.webp", message: "Not a JPG or PNG file" }], notChecked: [{ name: "b.jpg", message: "Try again." }] }), new Set(["a"]), { approve: true })!;
    expect(text).toContain("1 photo is prepared");
    expect(text).toContain("1 could not be checked just now and is waiting unchecked: b.jpg (Try again.)");
    expect(text).toContain("1 could not be prepared: a.webp (Not a JPG or PNG file)");
    // failures stay named after the prepared ones settle
    expect(batchSummary(b({ prepared: ["a"], failed: [{ name: "x", message: "y" }] }), new Set(), { approve: true })).toBe("1 could not be prepared: x (y).");
    // nothing prepared at all
    expect(batchSummary(b({ prepared: [], failed: [{ name: "a", message: "x" }, { name: "b", message: "y" }] }), new Set(), { approve: true })).toBe("2 could not be prepared: a (x); b (y).");
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

describe("photos are read again when a change leaves the in-flight statuses", () => {
  const c = (id: string, status: string, network = NET) => ({ id, field: "media", network, status, after: { op: "add" } }) as ChangeCardData;
  it("an in-flight change that has settled means the list is stale: sent then live, sent then failed, declined, expired, gone", () => {
    expect(settledSince(new Set(["a"]), [c("a", "live")], NET)).toBe(true);
    expect(settledSince(new Set(["a"]), [c("a", "failed")], NET)).toBe(true);
    expect(settledSince(new Set(["a"]), [c("a", "rejected")], NET)).toBe(true);
    expect(settledSince(new Set(["a"]), [c("a", "expired")], NET)).toBe(true);
    expect(settledSince(new Set(["a"]), [], NET)).toBe(true);
    expect(settledSince(new Set(["a"]), undefined, NET)).toBe(true);
  });
  it("a change that is still open, or sent and waiting, or a new one, does not", () => {
    expect(settledSince(new Set(["a"]), [c("a", "approved")], NET)).toBe(false);
    expect(settledSince(new Set(["a"]), [c("a", "submitted")], NET)).toBe(false);
    expect(settledSince(new Set(["a"]), [c("a", "validated")], NET)).toBe(false);
    expect(settledSince(new Set(), [c("b", "proposed")], NET)).toBe(false);
  });
  it("opened to sent is not a settle (the list is still stale until it is shown)", () => {
    expect(settledSince(new Set(["a"]), [c("a", "submitted")], NET)).toBe(false);
  });
  it("a change of another network is not this network's", () => {
    expect(settledSince(new Set(["a"]), [c("a", "approved", "net_b")], NET)).toBe(true);
  });
  it("photoChanges, openPhotoChanges and inFlightPhotoChanges pick this network's photo changes", () => {
    const list = [c("a", "proposed"), c("b", "live"), c("s", "submitted"), c("x", "proposed", "net_b"), { ...c("d", "proposed"), field: "description" } as ChangeCardData];
    expect(photoChanges(list, NET).map((x) => x.id)).toEqual(["a", "b", "s"]);
    expect(openPhotoChanges(list, NET).map((x) => x.id)).toEqual(["a"]);
    expect(inFlightPhotoChanges(list, NET).map((x) => x.id)).toEqual(["a", "s"]);
    expect(photoChanges(list, "net_b").map((x) => x.id)).toEqual(["x"]);
  });
});

describe("the merged change list keeps every open change", () => {
  const c = (id: string, status: string) => ({ id, field: "media", network: NET, status, createdAt: `2026-11-05T10:00:${id.padStart(2, "0")}.000Z`, after: { op: "add" } }) as ChangeCardData;
  it("the merged list never loses an open change to history: the open ones are read on their own and merged by id", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ ...c(String(40 + (i % 10)), "live"), id: `h${i}`, createdAt: `2026-11-06T10:00:${String(i).padStart(2, "0")}.000Z` }));
    const open = [{ ...c("01", "proposed"), id: "old-open", createdAt: "2026-11-01T10:00:00.000Z" }];
    const merged = mergeChanges(open, history);
    expect(merged).toHaveLength(31);
    expect(merged.some((x) => x.id === "old-open")).toBe(true);
    expect(merged[0]!.createdAt >= merged[1]!.createdAt).toBe(true);
    expect(mergeChanges([history[0]!], history)).toHaveLength(30);
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
  const card = () => flat("components/presence/edit/photos-card.tsx");
  it("the Presence page draws the card only for a network that declares photos, with the id on a wrapper, KEYED by place and network", () => {
    const home = flat("components/presence/presence-home.tsx");
    expect(home).toContain("const photosOn = listingOn && drawsPhotos(aboutNetwork);");
    expect(home).toContain('<div id="photos-card">');
    expect(home).toContain('<PhotosCard key={`${panelLocation ?? ""}|${panelNetwork ?? ""}`} location={panelLocation} network={panelNetwork} />');
    expect(card()).not.toContain('id="photos-card"');
    expect(home).toContain('if (field === "media") {');
  });
  it("no card keeps a change list of its own: each section points at Your requests instead", () => {
    for (const f of ["edit-listing-card", "extra-panel", "photos-card"]) {
      const src = flat(`components/presence/edit/${f}.tsx`);
      expect(src, f).toContain("<WaitingLine");
      expect(src, f).not.toContain("<ChangeCard");
    }
  });
  it("the picker is offered no Generate tab: a business's photos are not made by AI and nothing is charged", () => {
    expect(card()).toContain('tabs={["drive", "upload"]}');
  });
  it("a private file can be picked, several at once, and a file that will be refused is greyed out", () => {
    expect(card()).toContain("requirePublicUrl={false}");
    expect(card()).toContain("needUrl={false}");
    expect(card()).toContain("unusable={(f) => unusableReason(f, data.declaration.limits)}");
    expect(card()).toContain("maxSelection={pickLimit(data, waitingAdds)}");
    expect(card()).toContain("onSelect={(assets) => void addMany(assets)}");
  });
  it("a customer photo is drawn with no Remove button and a report link; every non-removable item says why", () => {
    const c = card();
    const notRemovable = c.indexOf("{!p.removable && (");
    const remove = c.indexOf("{ctl.remove && (");
    expect(notRemovable).toBeGreaterThan(-1);
    expect(remove).toBeGreaterThan(notRemovable);
    expect(c.slice(notRemovable, remove)).not.toContain("Remove");
    expect(c.slice(notRemovable, remove)).toContain("{p.notRemovableBecause &&");
    expect(c.slice(notRemovable, remove)).toContain("Report this photo");
  });
  it("the waiting line is outside the ready branch, so a request is pointed at whatever the photo read did", () => {
    const c = card();
    expect(c.indexOf("<WaitingLine")).toBeGreaterThan(c.indexOf("const body ="));
  });
  it("the answer of every proposal is read through outcomeOf, in the batch and for a removal", () => {
    const c = card();
    expect(c.match(/outcomeOf\(await m\.propose\.mutateAsync/g)).toHaveLength(2);
    expect(c).not.toContain("prepared++");
  });
  it("the photo lists are refreshed once after the batch, not per photo, and the proposal carries its place in its variables", () => {
    const c = card();
    // exactly two refreshes in the card: one after the batch loop, one after a single removal; none inside the loop
    expect(c.match(/m\.refresh\(target!\)/g)).toHaveLength(2);
    expect(c).toContain("} await m.refresh(target!); setBusy(false); setBatch(next);");
    expect(c).toContain("m.propose.mutateAsync({ ...target!, value:");
    const hook = flat("hooks/use-presence-photos.ts");
    expect(hook).toContain("(v: PhotoTarget & { value: PhotoChange })");
    expect(hook).not.toMatch(/propose: useMutation\([^)]*onSettled/);
  });
  it("the photo refresh follows the change list, and a failed approve, decline or undo refreshes too", () => {
    expect(card()).toContain("useRefreshPhotosWhenSettled(changes.data?.items, target);");
    expect(flat("hooks/use-presence-photos.ts")).toContain("onSettled: settled");
  });
  it("adding and removing wait for the change list, and a stale list says so", () => {
    expect(card()).toContain("withChangesKnown(photoAccess(capsView, caps.data?.can), changesView)");
  });
  it("tiles load lazily", () => {
    expect(card().match(/loading="lazy"/g)).toHaveLength(1);
  });
  it("the api client reads every open change on its own, then the latest history", () => {
    const api = flat("lib/api/presence-edit.ts");
    expect(api).toContain("status=open&limit=200");
    expect(api).toContain("mergeChanges(open.items, history.items)");
  });
});
