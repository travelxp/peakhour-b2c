// @vitest-environment jsdom
/**
 * The Drive picker's states (row D7): what it shows while loading, offline, failed, empty and ready; what fits comes first and says so;
 * a Private file where a public link is needed; what is handed back on Add; and the Upload tab. The api client and the toast are
 * replaced, so nothing here reaches the network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DriveFile } from "@/lib/drive/files";
import { UploadAborted, type UploadDeps } from "@/lib/drive/upload-engine";
import type { MediaDestination, MediaRule } from "@/lib/media-rules";

const h = vi.hoisted(() => ({
  list: vi.fn(),
  link: vi.fn(),
  generate: vi.fn(),
  price: { quote: undefined as unknown, loading: false, unavailable: false, reason: undefined as unknown },
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@/lib/drive/files", async (orig) => ({ ...(await orig<typeof import("@/lib/drive/files")>()), listDriveFiles: h.list, getFileLink: h.link }));
vi.mock("@/lib/drive/generate", async (orig) => ({ ...(await orig<typeof import("@/lib/drive/generate")>()), generateImageToDrive: h.generate }));
// the price comes from the rate card over the network; the tab's use of it is what is under test
vi.mock("@/hooks/use-peaks-quote", async (orig) => ({ ...(await orig<typeof import("@/hooks/use-peaks-quote")>()), usePeaksQuote: vi.fn(() => h.price) }));
// The rules table is the api's; these rows are test data for the destinations the tests name. What a real row holds is the api's test.
const RULES: MediaRule[] = vi.hoisted(() => [
  { key: "page:photo", label: "this page", maxCount: 10, image: { formats: ["image/jpeg", "image/png", "image/webp", "image/gif"] } },
  { key: "page:document", label: "this page", maxCount: 1, document: { formats: ["application/pdf"] } },
  { key: "post:instagram", label: "an Instagram post", maxCount: 10, image: { formats: ["image/jpeg", "image/png"], maxBytes: 8 * 1024 * 1024, minWidth: 320, aspect: { min: 0.8, max: 1.91 } }, video: { formats: ["video/mp4"], minSeconds: 3, maxSeconds: 900 } },
  { key: "post:multi", label: "a mixed post", maxCount: 5, image: { formats: ["image/jpeg", "image/png"] }, document: { formats: ["application/pdf"] } },
  { key: "post:vid", label: "a video post", maxCount: 1, video: { formats: ["video/mp4"] } },
  { key: "post:iv", label: "a picture or video post", maxCount: 4, image: { formats: ["image/jpeg"] }, video: { formats: ["video/mp4"] } },
  { key: "post:single", label: "a one-picture post", maxCount: 1, image: { formats: ["image/jpeg"] } },
  { key: "post:gifalone", label: "an X post", maxCount: 4, image: { formats: ["image/jpeg", "image/gif"], gifMustBeAlone: true } },
  { key: "post:small", label: "a small post", maxCount: 3, image: { formats: ["image/jpeg"], maxBytes: 4_000_000 } },
  { key: "message:whatsapp", label: "a WhatsApp reply", maxCount: 1, image: { formats: ["image/jpeg", "image/png"], maxBytes: 4_194_304 }, document: { formats: ["application/pdf"], maxBytes: 4_194_304 } },
]);
vi.mock("@/lib/api", async (orig) => {
  const m = await orig<typeof import("@/lib/api")>();
  return { ...m, api: { ...m.api, get: vi.fn(async (path: string) => (path === "/v1/media/rules" ? { rules: RULES } : Promise.reject(new Error(`unexpected GET ${path}`)))) } };
});
vi.mock("sonner", () => ({ toast: { info: h.toastInfo, error: h.toastError, success: h.toastSuccess } }));

const { DrivePickerPanel, assetOf, blockedReason, gridState } = await import("./drive-picker");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  vi.resetAllMocks();
  h.price = { quote: undefined, loading: false, unavailable: false, reason: undefined };
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const file = (id: string, over: Partial<DriveFile> = {}): DriveFile => ({
  id,
  name: `File ${id}`,
  kind: "image",
  mimeType: "image/jpeg",
  visibility: "published",
  publicUrl: `https://media.test/${id}.jpg`,
  sizeBytes: 1000,
  source: "uploaded",
  createdAt: "2026-11-04T10:00:00.000Z",
  ...over,
});
const page = (items: DriveFile[], hasMore = false) => ({ items, hasMore, page: 1 });
const D = {
  photo: { kind: "page", use: "photo" },
  doc: { kind: "page", use: "document" },
  ig: { kind: "post", channel: "instagram" },
  multi: { kind: "post", channel: "multi" },
  vid: { kind: "post", channel: "vid" },
  iv: { kind: "post", channel: "iv" },
  single: { kind: "post", channel: "single" },
  small: { kind: "post", channel: "small" },
  gifalone: { kind: "post", channel: "gifalone" },
  whatsapp: { kind: "message", channel: "whatsapp" },
} as const satisfies Record<string, MediaDestination>;

// react-query hands results to React on a timer, so a few ticks pass before a resolved fetch is on screen
const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => void (await new Promise((r) => setTimeout(r, 5))));
};
async function mount(props: Partial<React.ComponentProps<typeof DrivePickerPanel>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const onSelect = vi.fn();
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <DrivePickerPanel onSelect={onSelect} {...props} destination={props.destination ?? D.photo} />
      </QueryClientProvider>,
    ),
  );
  await flush();
  return { onSelect, client };
}
const tiles = () => [...host.querySelectorAll<HTMLButtonElement>("ul button[aria-pressed]")];
const names = () => tiles().map((t) => t.querySelector(".truncate")?.textContent);
const text = () => host.textContent ?? "";
const click = (el: Element) => act(() => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const buttonByText = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLButtonElement;

describe("the grid's states", () => {
  it("shows a busy skeleton, not an empty Drive, while the first page loads", async () => {
    h.list.mockReturnValue(new Promise(() => {}));
    await mount();
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(text()).not.toContain("Nothing in Drive yet");
  });

  it("says so, with a way to try again, when the first load fails; Try again loads the files", async () => {
    h.list.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(page([file("a")]));
    await mount();
    expect(text()).toContain("We couldn't load your files");
    expect(text()).not.toContain("boom");
    click(buttonByText("Try again"));
    await flush();
    expect(names()).toEqual(["File a"]);
    expect(text()).not.toContain("We couldn't load your files");
  });

  it("an empty Drive offers an upload; an empty search says what was searched and offers none", async () => {
    h.list.mockResolvedValue(page([]));
    await mount();
    expect(text()).toContain("Nothing in Drive yet");
    click(buttonByText("Upload a file"));
    expect(host.querySelector("input[type=file]")).not.toBeNull();

    act(() => root.unmount());
    host.remove();
    await mount();
    const search = host.querySelector<HTMLInputElement>("#drive-picker-search")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "blue tin");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => void (await new Promise((r) => setTimeout(r, 320))));
    await flush();
    expect(h.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: "blue tin", page: 1 }));
    expect(text()).toContain('Nothing matches "blue tin"');
    expect(text()).not.toContain("Nothing in Drive yet");
  });

  it("★a query that cannot run because the browser is offline is 'offline', not an empty Drive (isLoading would say neither)", () => {
    expect(gridState({ isPending: true, isError: false, fetchStatus: "paused" }, 0)).toBe("offline");
    expect(gridState({ isPending: true, isError: false, fetchStatus: "fetching" }, 0)).toBe("loading");
    expect(gridState({ isPending: false, isError: false, fetchStatus: "idle" }, 0)).toBe("empty");
    expect(gridState({ isPending: false, isError: true, fetchStatus: "idle" }, 0)).toBe("error");
    // files already on screen are never replaced by a state: a failed "show more" keeps the grid
    expect(gridState({ isPending: false, isError: true, fetchStatus: "idle" }, 3)).toBe("ready");
    // more pages to read and none of them showable yet: still loading, not empty
    expect(gridState({ isPending: false, isError: false, fetchStatus: "idle" }, 0, true)).toBe("loading");
  });

  it("with several kinds, keeps reading pages while the ones read hold nothing this screen can use, instead of calling Drive empty", async () => {
    const vid = (id: string) => file(id, { kind: "video", mimeType: "video/mp4" });
    h.list
      .mockResolvedValueOnce(page([vid("v1"), vid("v2")], true))
      .mockResolvedValueOnce({ items: [vid("v3")], hasMore: true, page: 2 })
      .mockResolvedValueOnce({ items: [file("img")], hasMore: false, page: 3 });
    await mount({ destination: D.multi });
    await flush();
    await flush();
    expect(h.list).toHaveBeenCalledTimes(3);
    expect(names()).toEqual(["File img"]);
    expect(text()).not.toContain("Nothing in Drive yet");
  });

  it("asks for the next page when 'Show more' is pressed", async () => {
    h.list.mockResolvedValueOnce(page([file("a")], true)).mockResolvedValueOnce({ items: [file("b")], hasMore: false, page: 2 });
    await mount();
    click(buttonByText("Show more"));
    await flush();
    expect(h.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(names()).toEqual(["File a", "File b"]);
    expect(buttonByText("Show more")).toBeUndefined();
  });
});

describe("what fits comes first", () => {
  const fit = (channel: string, f: "good" | "possible" | "poor", reason?: string) => [{ channel, fit: f, ...(reason ? { reason } : {}) }];

  it("puts files that fit a post first, says so, and names each file's verdict in plain words", async () => {
    h.list.mockResolvedValue(
      page([
        file("poor", { channelFit: fit("instagram", "poor", "Instagram takes shapes from 0.8:1 to 1.91:1; this one is 2.4:1") }),
        file("none"),
        file("good", { channelFit: fit("instagram", "good") }),
        file("maybe", { channelFit: fit("instagram", "possible", "Size could not be measured") }),
      ]),
    );
    await mount({ destination: D.ig });
    expect(names()).toEqual(["File good", "File maybe", "File none", "File poor"]);
    expect(host.querySelector('[data-testid="fit-line"]')?.textContent).toBe("Showing what fits an Instagram post first.");
    const notes = tiles().map((t) => t.querySelector(".truncate:nth-child(2)")?.textContent);
    expect(notes).toEqual(["Fits", "Check before using", "Not checked yet", "Doesn't fit"]);
    // the api's sentence is on the tile for anyone who needs the why
    expect(tiles()[3]!.title).toContain("this one is 2.4:1");
  });

  it("does not claim an order it does not have: with no verdicts yet the line says files are newest first", async () => {
    h.list.mockResolvedValue(page([file("a"), file("b", { describeState: "pending" })]));
    await mount({ destination: D.ig });
    expect(names()).toEqual(["File a", "File b"]);
    expect(host.querySelector('[data-testid="fit-line"]')?.textContent).toContain("still being worked out");
    expect(host.querySelector('[data-testid="fit-line"]')?.textContent).not.toContain("fits an Instagram post first");
    expect(text()).toContain("Checking fit…");
  });

  it("with no place named there is no fit line and no verdicts", async () => {
    h.list.mockResolvedValue(page([file("a", { channelFit: fit("instagram", "good") })]));
    await mount();
    expect(host.querySelector('[data-testid="fit-line"]')).toBeNull();
    // the api's content verdicts (about a channel) are not shown; the place's own rules are, and this file meets them
    expect(text()).not.toContain("Check before using");
    expect(text()).not.toContain("Not checked yet");
    expect(tiles()[0]!.textContent).toContain("Fits");
  });

  it("only shows the kinds the screen can use, and asks the api for one kind when there is one", async () => {
    h.list.mockResolvedValue(page([file("a"), file("v", { kind: "video", mimeType: "video/mp4" }), file("d", { kind: "document", mimeType: "application/pdf" })]));
    await mount({ destination: D.multi });
    expect(names()).toEqual(["File a", "File d"]);
    expect(h.list).toHaveBeenCalledWith(expect.not.objectContaining({ kind: "image" }));
    act(() => root.unmount());
    host.remove();
    await mount({ destination: D.vid });
    expect(h.list).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "video" }));
  });
});

describe("a Private file", () => {
  const priv = file("p", { name: "Contract", visibility: "private", publicUrl: undefined, kind: "document", mimeType: "application/pdf" });

  it("where a public link is needed is greyed out with the reason, and cannot be added", async () => {
    h.list.mockResolvedValue(page([file("a"), priv]));
    const { onSelect } = await mount({ destination: D.multi });
    const t = tiles().find((b) => b.textContent?.includes("Contract"))!;
    expect(t.disabled).toBe(true);
    expect(t.textContent).toContain("Private. No public link.");
    expect(t.title).toContain("Publish the file in Drive");
    expect(host.querySelector('[data-testid="private-line"]')?.textContent).toContain("no public link");
    click(t);
    expect(text()).toContain("Nothing selected");
    expect(buttonByText("Add").disabled).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("where none is needed (an Inbox reply) can be added, and the picker fetches a short-lived signed link for it", async () => {
    h.list.mockResolvedValue(page([priv]));
    h.link.mockResolvedValue({ url: "https://signed.test/p?sig=1", expiresInSeconds: 300, signed: true });
    const { onSelect } = await mount({ destination: D.doc, requirePublicUrl: false });
    expect(host.querySelector('[data-testid="private-line"]')).toBeNull();
    click(tiles()[0]!);
    click(buttonByText("Add"));
    await flush();
    expect(h.link).toHaveBeenCalledWith("p");
    expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: "p", url: "https://signed.test/p?sig=1", visibility: "private", linkExpiresInSeconds: 300 })]);
  });

  it("if the signed link cannot be made nothing is added, and the person is told which file", async () => {
    h.list.mockResolvedValue(page([priv]));
    h.link.mockRejectedValue(new Error("503"));
    const { onSelect } = await mount({ destination: D.doc, requirePublicUrl: false });
    click(tiles()[0]!);
    click(buttonByText("Add"));
    await flush();
    expect(onSelect).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="picker-notice"]')?.textContent).toContain("Contract");
  });

  it("a screen that sends the file by id (an Inbox reply) fetches NO link, so a slow or failing link route cannot block it", async () => {
    h.list.mockResolvedValue(page([priv]));
    h.link.mockRejectedValue(new Error("503"));
    const { onSelect } = await mount({ destination: D.doc, requirePublicUrl: false, needUrl: false });
    click(tiles()[0]!);
    click(buttonByText("Add"));
    await flush();
    expect(h.link).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: "p", url: "", visibility: "private" })]);
  });

  it("assetOf never hands back a Private file as if it had a public link", async () => {
    expect(await assetOf(priv, true)).toBeNull();
    expect(h.link).not.toHaveBeenCalled();
    expect(blockedReason(priv, true, { state: "fits" })).toBe("Private. No public link.");
    expect(blockedReason(priv, false, { state: "fits" })).toBeNull();
    // the place's own rule comes after the Private one
    expect(blockedReason(file("x"), true, { state: "refused", reason: "Too big." })).toBe("Too big.");
  });
});

describe("choosing and adding", () => {
  it("hands back the public address, name, type and size of each chosen file, in the order chosen", async () => {
    h.list.mockResolvedValue(page([file("a", { width: 1080, height: 1350, altText: "A blue tin" }), file("b")]));
    const { onSelect } = await mount({ addLabel: "Add to post" });
    expect(buttonByText("Add to post").disabled).toBe(true);
    click(tiles()[1]!);
    click(tiles()[0]!);
    expect(text()).toContain("2 selected");
    click(buttonByText("Add to post"));
    await flush();
    expect(onSelect).toHaveBeenCalledWith([
      expect.objectContaining({ id: "b", url: "https://media.test/b.jpg", name: "File b", mime: "image/jpeg", bytes: 1000, visibility: "published", source: "upload" }),
      expect.objectContaining({ id: "a", url: "https://media.test/a.jpg", width: 1080, height: 1350, alt: "A blue tin" }),
    ]);
  });

  it("stops at the number the place takes and says so on the sheet, not in a toast", async () => {
    h.list.mockResolvedValue(page([file("a"), file("b")]));
    await mount({ destination: D.single });
    click(tiles()[0]!);
    click(tiles()[1]!);
    expect(text()).toContain("1 selected");
    expect(host.querySelector('[data-testid="picker-notice"]')?.textContent).toBe("One file is all a one-picture post takes.");
    expect(h.toastInfo).not.toHaveBeenCalled();
    // deselecting frees the slot and clears the line
    click(tiles()[0]!);
    expect(host.querySelector('[data-testid="picker-notice"]')).toBeNull();
    click(tiles()[1]!);
    expect(text()).toContain("1 selected");
  });

  it("a slot that takes one file takes one, whatever the place takes in all", async () => {
    h.list.mockResolvedValue(page([file("a"), file("b")]));
    await mount({ destination: D.photo, single: true });
    click(tiles()[0]!);
    click(tiles()[1]!);
    expect(text()).toContain("1 selected");
    expect(host.querySelector('[data-testid="picker-notice"]')?.textContent).toBe("One file is all this takes.");
  });

  it("Generate is not offered once the place is full: nothing is made, and nothing is charged, for a picture that could not be added", async () => {
    h.list.mockResolvedValue(page([file("a")]));
    await mount({ destination: D.single, attached: 1 });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Generate")!);
    expect(text()).toContain("Nothing more can be added here");
    expect(host.querySelector("textarea")).toBeNull();
  });

  it("a GIF where the place wants it alone: refused beside another picture, in either order, with the place's words", async () => {
    h.list.mockResolvedValue(page([file("g", { mimeType: "image/gif" }), file("p")]));
    await mount({ destination: D.gifalone });
    click(tiles()[0]!);
    click(tiles()[1]!);
    expect(text()).toContain("1 selected");
    expect(host.querySelector('[data-testid="picker-notice"]')?.textContent).toBe("A GIF has to be the only picture in an X post.");
  });

  it("what the place already holds counts against its room", async () => {
    h.list.mockResolvedValue(page([file("a"), file("b"), file("c")]));
    await mount({ destination: D.small, attached: 2 });
    click(tiles()[0]!);
    click(tiles()[1]!);
    expect(text()).toContain("1 selected");
    expect(host.querySelector('[data-testid="picker-notice"]')?.textContent).toContain("(2 already on it)");
  });

  it("a file the place would refuse is greyed out with WHY, and one that could be made to fit says what to do", async () => {
    h.list.mockResolvedValue(
      page([
        file("big", { sizeBytes: 9_000_000 }),
        file("png", { name: "Logo", mimeType: "image/png" }),
        file("ok", { sizeBytes: 100_000 }),
      ]),
    );
    await mount({ destination: D.small });
    const big = tiles().find((t) => t.textContent?.includes("File big"))!;
    const png = tiles().find((t) => t.textContent?.includes("Logo"))!;
    const ok = tiles().find((t) => t.textContent?.includes("File ok"))!;
    expect(big.disabled).toBe(true);
    expect(big.textContent).toContain("Needs a change");
    expect(big.textContent).toContain("takes files up to 3.8 MB");
    expect(big.textContent).toContain("Save it at a smaller size");
    expect(png.disabled).toBe(true);
    expect(png.textContent).toContain("Doesn't fit");
    expect(png.textContent).toContain("takes JPG files, not PNG");
    expect(ok.disabled).toBe(false);
    expect(ok.textContent).toContain("Fits");
    click(big);
    expect(text()).toContain("Nothing selected");
  });

  it("a shape the place does not take is flagged with what to do, once the file's size is known", async () => {
    h.list.mockResolvedValue(page([file("wide", { width: 2400, height: 1000 }), file("fine", { width: 1080, height: 1350 })]));
    await mount({ destination: D.ig });
    const wide = tiles().find((t) => t.textContent?.includes("File wide"))!;
    expect(wide.disabled).toBe(true);
    expect(wide.textContent).toContain("takes shapes from 0.8:1 to 1.91:1; this one is 2.4:1");
    expect(wide.textContent).toContain("Crop it to a shape between");
    expect(tiles().find((t) => t.textContent?.includes("File fine"))!.disabled).toBe(false);
  });

  it("while the place's rules are not there nothing can be added, and a failure says so with a way to try again", async () => {
    const { api } = await import("@/lib/api");
    h.list.mockResolvedValue(page([file("a")]));
    vi.mocked(api.get).mockRejectedValueOnce(new Error("down"));
    await mount();
    expect(text()).toContain("We couldn't check what this place takes");
    expect(tiles()).toHaveLength(0);
    expect(h.list).not.toHaveBeenCalled();
    click(buttonByText("Try again"));
    await flush();
    expect(names()).toEqual(["File a"]);
  });

  it("AI-made files are labelled by what they are, not 'upload'", async () => {
    expect(await assetOf(file("g", { source: "ai_generated" }), true)).toMatchObject({ source: "ai_image" });
    expect(await assetOf(file("v", { source: "ai_generated", kind: "video" }), true)).toMatchObject({ source: "ai_video" });
  });
});

describe("the Upload tab", () => {
  const goodDeps = (over: Partial<UploadDeps> = {}): Partial<UploadDeps> => ({
    hash: async () => "a".repeat(64),
    probe: async () => ({}),
    initiate: vi.fn(async () => ({ deduped: false as const, uploadId: "u1", visibility: "published" as const, kind: "image", partSize: 100, partCount: 1, parts: [{ partNumber: 1, url: "https://r2.test/1" }], expiresAt: "x" })),
    putPart: vi.fn(async () => undefined),
    complete: vi.fn(async () => ({ mediaId: "new1", name: "Tin", publicUrl: "https://media.test/new1.jpg", visibility: "published" as const, sizeBytes: 5, deduped: false })),
    abort: vi.fn(async () => ({ aborted: true })),
    ...over,
  });
  const choose = (files: File[]) => {
    const input = host.querySelector<HTMLInputElement>("input[type=file]")!;
    Object.defineProperty(input, "files", { value: files, configurable: true });
    act(() => void input.dispatchEvent(new Event("change", { bubbles: true })));
  };

  it("uploads a chosen file, asks for a PUBLISHED file where a public link is needed, then shows it in Drive already selected", async () => {
    h.list.mockResolvedValue(page([]));
    const deps = goodDeps();
    const { onSelect } = await mount({ uploadOptions: { deps } });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Upload")!);
    choose([new File(["hello"], "tin.jpg", { type: "image/jpeg" })]);
    await flush();
    await flush();
    expect(deps.initiate).toHaveBeenCalledWith(expect.objectContaining({ filename: "tin.jpg", visibility: "published" }));
    expect(names()).toEqual(["Tin"]);
    expect(text()).toContain("1 selected");
    click(buttonByText("Add"));
    await flush();
    expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: "new1", url: "https://media.test/new1.jpg" })]);
  });

  it("names a refused upload in the api's words and adds nothing", async () => {
    h.list.mockResolvedValue(page([]));
    const { ApiError } = await import("@/lib/api");
    const deps = goodDeps({ initiate: vi.fn(async () => Promise.reject(new ApiError("STORAGE_QUOTA_EXCEEDED", "Your Drive is full. Add space to upload more.", 402))) });
    await mount({ uploadOptions: { deps } });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Upload")!);
    choose([new File(["hello"], "tin.jpg", { type: "image/jpeg" })]);
    await flush();
    await flush();
    expect(text()).toContain("Your Drive is full. Add space to upload more.");
    expect(text()).toContain("Nothing selected");
  });

  it("a file Drive already holds as PRIVATE is not added where a public link is needed, and the person is told why", async () => {
    h.list.mockResolvedValue(page([]));
    const deps = goodDeps({ initiate: vi.fn(async () => ({ deduped: true as const, mediaId: "old1", name: "Logo", visibility: "private" as const, sizeBytes: 5 })) });
    await mount({ uploadOptions: { deps } });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Upload")!);
    choose([new File(["hello"], "logo.png", { type: "image/png" })]);
    await flush();
    await flush();
    expect(text()).toContain("already in Drive as a Private file");
    expect(text()).toContain("Nothing selected");
  });

  it("a Private upload is asked for where the screen says so (an Inbox reply), never the type's public default", async () => {
    h.list.mockResolvedValue(page([]));
    const deps = goodDeps();
    await mount({ destination: D.multi, requirePublicUrl: false, uploadAs: "private", uploadOptions: { deps } });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Upload")!);
    choose([new File(["hello"], "invoice.jpg", { type: "image/jpeg" })]);
    await flush();
    expect(deps.initiate).toHaveBeenCalledWith(expect.objectContaining({ visibility: "private" }));
  });

  it("a file the place takes only in another kind or type is turned away on its own tile, with why, and never starts uploading", async () => {
    h.list.mockResolvedValue(page([]));
    const deps = goodDeps();
    await mount({ destination: D.photo, uploadOptions: { deps } });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Upload")!);
    choose([new File(["x"], "clip.mp4", { type: "video/mp4" })]);
    await flush();
    expect(host.querySelector('[aria-label="Uploads"]')?.textContent).toContain("This page takes pictures, not this kind of file.");
    expect(deps.initiate).not.toHaveBeenCalled();
    expect(text()).toContain("Nothing selected");
  });

  it("a picture of the wrong shape is measured, refused before it is sent, and told how to fix it", async () => {
    h.list.mockResolvedValue(page([]));
    const deps = goodDeps({ probe: async () => ({ width: 2400, height: 1000 }) });
    await mount({ destination: D.ig, uploadOptions: { deps } });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Upload")!);
    choose([new File(["x"], "wide.jpg", { type: "image/jpeg" })]);
    await flush();
    await flush();
    expect(host.querySelector('[aria-label="Uploads"]')?.textContent).toContain("takes shapes from 0.8:1 to 1.91:1; this one is 2.4:1");
    expect(host.querySelector('[aria-label="Uploads"]')?.textContent).toContain("Crop it to a shape between");
    expect(deps.initiate).not.toHaveBeenCalled();
  });

  it("more files than the place has room for: the ones beyond it are not sent", async () => {
    h.list.mockResolvedValue(page([]));
    const deps = goodDeps();
    await mount({ destination: D.single, uploadOptions: { deps } });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Upload")!);
    choose([new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.jpg", { type: "image/jpeg" })]);
    await flush();
    await flush();
    await flush();
    expect(deps.initiate).toHaveBeenCalledTimes(1);
    expect(text()).toContain("1 selected");
  });

  it("closing the picker mid-upload stops the files queued behind the one in flight", async () => {
    h.list.mockResolvedValue(page([]));
    const deps = goodDeps({
      putPart: vi.fn((_url, _body, _on, signal) => new Promise<void>((_res, rej) => signal?.addEventListener("abort", () => rej(new UploadAborted())))),
    });
    await mount({ uploadOptions: { deps } });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Upload")!);
    choose([new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.jpg", { type: "image/jpeg" }), new File(["c"], "c.jpg", { type: "image/jpeg" })]);
    await flush();
    expect(deps.initiate).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    await flush();
    expect(deps.initiate).toHaveBeenCalledTimes(1);
  });
});

describe("Generate", () => {
  const openGenerate = () => click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Generate")!);

  it("says plainly when the screen takes nothing the picker can make (no image), instead of a dead form", async () => {
    h.list.mockResolvedValue(page([]));
    await mount({ destination: D.doc });
    openGenerate();
    expect(text()).toContain("Generating isn't available here");
    expect(host.querySelector("textarea")).toBeNull();
  });

  it("a screen with no generator of its own still generates images: the tab shows the price first, then makes the image, charged with the quote shown", async () => {
    h.list.mockResolvedValue(page([]));
    h.price = { quote: { action: "content.generate_image", useCase: "creative_image", label: "Image", description: null, peaks: 40, breakdown: [], free: false, source: "code", token: "quote-token-1", expiresAt: Date.now() + 600_000 }, loading: false, unavailable: false, reason: undefined };
    const made = { id: "g9", url: "https://media.test/g9.png", mime: "image/png", source: "ai_image" as const, createdAt: "2026-11-04T10:00:00.000Z" };
    h.generate.mockResolvedValue(made);
    const { onSelect } = await mount();
    openGenerate();
    expect(host.querySelector("textarea")).not.toBeNull();
    expect(text()).toContain("40"); // the cost is on screen before the button is pressed
    const box = host.querySelector<HTMLTextAreaElement>("textarea")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, "A blue tin of Assam tea");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    click(buttonByText("Make an image"));
    await flush();
    expect(h.generate).toHaveBeenCalledWith({ prompt: "A blue tin of Assam tea", quoteToken: "quote-token-1" });
    expect(onSelect).toHaveBeenCalledWith([made]);
  });

  it("a screen that takes images and videos but gives no generator is offered images only: the picker never pretends to make a video", async () => {
    h.list.mockResolvedValue(page([]));
    await mount({ destination: D.iv });
    openGenerate();
    expect(host.querySelector('[aria-label="What to make"]')).toBeNull(); // no Image / Video switch
    expect(buttonByText("Make an image")).toBeDefined();
    expect(text()).not.toContain("Make a video");
  });

  it("with only video asked for and no generator of its own, the picker offers nothing to make", async () => {
    h.list.mockResolvedValue(page([]));
    await mount({ destination: D.vid });
    openGenerate();
    expect(text()).toContain("Generating isn't available here");
  });

  it("a screen's own generator shows no price unless it says it is charged as the image act; then it shows it and passes the quote", async () => {
    h.list.mockResolvedValue(page([]));
    h.price = { quote: { action: "content.generate_image", useCase: "creative_image", label: "Image", description: null, peaks: 40, breakdown: [], free: false, source: "code", token: "q2", expiresAt: Date.now() + 600_000 }, loading: false, unavailable: false, reason: undefined };
    const onGenerate = vi.fn(async () => undefined);
    await mount({ onGenerate, generatePrompt: "A tin" });
    openGenerate();
    expect(text()).not.toContain("40");
    act(() => root.unmount());
    host.remove();
    await mount({ onGenerate, generatePrompt: "A tin", generatePriced: true });
    openGenerate();
    expect(text()).toContain("40");
    click(buttonByText("Make an image"));
    await flush();
    expect(onGenerate).toHaveBeenLastCalledWith("A tin", "image", { quoteToken: "q2" });
  });

  it("an image that was made but kept as an existing Private file is not called a failure or a free try: the person is told where it is", async () => {
    h.list.mockResolvedValue(page([]));
    const { GeneratedPrivateError } = await import("@/lib/drive/generate");
    h.generate.mockRejectedValue(new GeneratedPrivateError("m1"));
    const { onSelect } = await mount();
    openGenerate();
    const box = host.querySelector<HTMLTextAreaElement>("textarea")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, "A blue tin");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    click(buttonByText("Make an image"));
    await flush();
    expect(h.toastInfo).toHaveBeenCalledWith("Already in Drive", expect.objectContaining({ description: expect.stringContaining("Find it in the Drive tab") }));
    expect(h.toastError).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a dropped connection does not claim the image was not charged (it may have been made)", async () => {
    h.list.mockResolvedValue(page([]));
    h.generate.mockRejectedValue(new TypeError("Failed to fetch"));
    await mount();
    openGenerate();
    const box = host.querySelector<HTMLTextAreaElement>("textarea")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, "A blue tin");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    click(buttonByText("Make an image"));
    await flush();
    const [, opts] = h.toastError.mock.calls[0]!;
    expect(opts.description).not.toContain("not charged");
    expect(opts.description).toContain("Check Drive");
  });

  it("only a 4xx refusal says nothing was charged; a 5xx (a gateway timeout can come after the image was made) points to Drive instead", async () => {
    h.list.mockResolvedValue(page([]));
    const { ApiError } = await import("@/lib/api");
    const type = (text: string) => {
      const box = host.querySelector<HTMLTextAreaElement>("textarea")!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, text);
        box.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    h.generate.mockRejectedValueOnce(new ApiError("GENERATE_FAILED", "The model said no.", 400)).mockRejectedValueOnce(new ApiError("BAD_GATEWAY", "Bad gateway.", 502));
    await mount();
    openGenerate();
    type("A blue tin");
    click(buttonByText("Make an image"));
    await flush();
    expect(h.toastError.mock.calls[0]![1].description).toBe("The model said no. You were not charged.");
    click(buttonByText("Make an image"));
    await flush();
    expect(h.toastError.mock.calls[1]![1].description).not.toContain("not charged");
    expect(h.toastError.mock.calls[1]![1].description).toContain("Check Drive");
  });

  it("a refused generation (too few credits) says so and nothing is selected", async () => {
    h.list.mockResolvedValue(page([]));
    const { ApiError } = await import("@/lib/api");
    h.generate.mockRejectedValue(new ApiError("CREDITS_EXHAUSTED", "You need 40 credits and have 10.", 429));
    const { onSelect } = await mount();
    openGenerate();
    const box = host.querySelector<HTMLTextAreaElement>("textarea")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, "A blue tin");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    click(buttonByText("Make an image"));
    await flush();
    expect(h.toastError).toHaveBeenCalledWith("You don't have enough Peaks for this.", expect.objectContaining({ description: "You need 40 credits and have 10." }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("starts from the brief the screen holds; when the screen shows the result itself the picker just closes", async () => {
    h.list.mockResolvedValue(page([]));
    const onGenerate = vi.fn(async () => undefined);
    const onClose = vi.fn();
    const { onSelect } = await mount({ onGenerate, generatePrompt: "A blue tin on a table", promptEditable: false, onClose });
    openGenerate();
    const box = host.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(box.value).toBe("A blue tin on a table");
    expect(box.readOnly).toBe(true);
    click(buttonByText("Make an image"));
    await flush();
    expect(onGenerate).toHaveBeenCalledWith("A blue tin on a table", "image", undefined); // unpriced: it is not the picker's image act
    expect(h.generate).not.toHaveBeenCalled(); // the screen's own generator is used when it gives one
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("returns a made file to the screen when the screen hands one back", async () => {
    h.list.mockResolvedValue(page([]));
    const made = { id: "g1", url: "https://media.test/g1.png", mime: "image/png", source: "ai_image" as const, createdAt: "2026-11-04T10:00:00.000Z" };
    const { onSelect } = await mount({ onGenerate: vi.fn(async () => made) });
    openGenerate();
    const box = host.querySelector<HTMLTextAreaElement>("textarea")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, "A tin");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    click(buttonByText("Make an image"));
    await flush();
    expect(onSelect).toHaveBeenCalledWith([made]);
  });
});
