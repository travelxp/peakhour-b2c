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
vi.mock("sonner", () => ({ toast: { info: h.toastInfo, error: h.toastError, success: h.toastSuccess } }));

const { DrivePickerPanel, assetOf, blockedReason, gridState, progressWords } = await import("./drive-picker");
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
const IG = { channel: "instagram", label: "an Instagram post" };

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
        <DrivePickerPanel onSelect={onSelect} {...props} />
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
    await mount({ kinds: ["image", "document"] });
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
    await mount({ target: IG });
    expect(names()).toEqual(["File good", "File maybe", "File none", "File poor"]);
    expect(host.querySelector('[data-testid="fit-line"]')?.textContent).toBe("Showing what fits an Instagram post first.");
    const notes = tiles().map((t) => t.querySelector(".truncate:nth-child(2)")?.textContent);
    expect(notes).toEqual(["Fits", "Check before using", "Not checked yet", "Doesn't fit"]);
    // the api's sentence is on the tile for anyone who needs the why
    expect(tiles()[3]!.title).toContain("this one is 2.4:1");
  });

  it("does not claim an order it does not have: with no verdicts yet the line says files are newest first", async () => {
    h.list.mockResolvedValue(page([file("a"), file("b", { describeState: "pending" })]));
    await mount({ target: IG });
    expect(names()).toEqual(["File a", "File b"]);
    expect(host.querySelector('[data-testid="fit-line"]')?.textContent).toContain("still being worked out");
    expect(host.querySelector('[data-testid="fit-line"]')?.textContent).not.toContain("fits an Instagram post first");
    expect(text()).toContain("Checking fit…");
  });

  it("with no place named there is no fit line and no verdicts", async () => {
    h.list.mockResolvedValue(page([file("a", { channelFit: fit("instagram", "good") })]));
    await mount();
    expect(host.querySelector('[data-testid="fit-line"]')).toBeNull();
    expect(text()).not.toContain("Fits");
  });

  it("only shows the kinds the screen can use, and asks the api for one kind when there is one", async () => {
    h.list.mockResolvedValue(page([file("a"), file("v", { kind: "video", mimeType: "video/mp4" }), file("d", { kind: "document", mimeType: "application/pdf" })]));
    await mount({ kinds: ["image", "document"] });
    expect(names()).toEqual(["File a", "File d"]);
    expect(h.list).toHaveBeenCalledWith(expect.not.objectContaining({ kind: "image" }));
    act(() => root.unmount());
    host.remove();
    await mount({ kinds: ["video"] });
    expect(h.list).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "video" }));
  });
});

describe("a Private file", () => {
  const priv = file("p", { name: "Contract", visibility: "private", publicUrl: undefined, kind: "document", mimeType: "application/pdf" });

  it("where a public link is needed is greyed out with the reason, and cannot be added", async () => {
    h.list.mockResolvedValue(page([file("a"), priv]));
    const { onSelect } = await mount({ kinds: ["image", "document"] });
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
    const { onSelect } = await mount({ kinds: ["document"], requirePublicUrl: false });
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
    const { onSelect } = await mount({ kinds: ["document"], requirePublicUrl: false });
    click(tiles()[0]!);
    click(buttonByText("Add"));
    await flush();
    expect(onSelect).not.toHaveBeenCalled();
    expect(h.toastError).toHaveBeenCalledWith(expect.stringContaining("Contract"), expect.anything());
  });

  it("a screen that sends the file by id (an Inbox reply) fetches NO link, so a slow or failing link route cannot block it", async () => {
    h.list.mockResolvedValue(page([priv]));
    h.link.mockRejectedValue(new Error("503"));
    const { onSelect } = await mount({ kinds: ["document"], requirePublicUrl: false, needUrl: false });
    click(tiles()[0]!);
    click(buttonByText("Add"));
    await flush();
    expect(h.link).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: "p", url: "", visibility: "private" })]);
  });

  it("assetOf never hands back a Private file as if it had a public link", async () => {
    expect(await assetOf(priv, true)).toBeNull();
    expect(h.link).not.toHaveBeenCalled();
    expect(blockedReason(priv, true)).toBe("Private. No public link.");
    expect(blockedReason(priv, false)).toBeNull();
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

  it("stops at the number the screen can take and says so", async () => {
    h.list.mockResolvedValue(page([file("a"), file("b")]));
    await mount({ maxSelection: 1 });
    click(tiles()[0]!);
    click(tiles()[1]!);
    expect(text()).toContain("1 selected");
    expect(h.toastInfo).toHaveBeenCalledWith("You can add up to 1 file here.");
  });

  it("the limit message is said once per press, not from inside a state updater that React may replay", async () => {
    h.list.mockResolvedValue(page([file("a"), file("b")]));
    await mount({ maxSelection: 1 });
    click(tiles()[0]!);
    click(tiles()[1]!);
    expect(h.toastInfo).toHaveBeenCalledTimes(1);
    // deselecting frees the slot
    click(tiles()[0]!);
    click(tiles()[1]!);
    expect(h.toastInfo).toHaveBeenCalledTimes(1);
    expect(text()).toContain("1 selected");
  });

  it("a file the screen cannot use is greyed out with ITS reason, and a Private file's reason comes first", async () => {
    h.list.mockResolvedValue(page([file("big", { sizeBytes: 9_000_000 })]));
    await mount({ unusable: (f) => (f.sizeBytes > 4_000_000 ? "Over 4 MB." : null) });
    expect(tiles()[0]!.disabled).toBe(true);
    expect(tiles()[0]!.textContent).toContain("Over 4 MB.");
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
    expect(h.toastSuccess).toHaveBeenCalledWith("Added 1 file to Drive.");
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
    expect(text()).toContain("Not added");
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
    expect(h.toastSuccess).not.toHaveBeenCalled();
  });

  it("a Private upload is asked for where the screen says so (an Inbox reply), never the type's public default", async () => {
    h.list.mockResolvedValue(page([]));
    const deps = goodDeps();
    await mount({ kinds: ["image", "document"], requirePublicUrl: false, uploadAs: "private", uploadOptions: { deps } });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Upload")!);
    choose([new File(["hello"], "invoice.jpg", { type: "image/jpeg" })]);
    await flush();
    expect(deps.initiate).toHaveBeenCalledWith(expect.objectContaining({ visibility: "private" }));
  });

  it("a dropped file of a kind the screen cannot use is turned away with a line saying so, and never starts uploading or gets selected", async () => {
    h.list.mockResolvedValue(page([]));
    const deps = goodDeps();
    await mount({ kinds: ["image"], uploadOptions: { deps } });
    click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Upload")!);
    const zone = host.querySelector("input[type=file]")!.parentElement!;
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: { files: [new File(["x"], "clip.mp4", { type: "video/mp4" })] } });
    act(() => void zone.dispatchEvent(drop));
    await flush();
    expect(text()).toContain("This screen can't use this kind of file.");
    expect(deps.initiate).not.toHaveBeenCalled();
    expect(text()).toContain("Nothing selected");
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
    expect(h.toastSuccess).not.toHaveBeenCalled();
  });

  it("reads progress in whole megabytes, and says only 'Sending' for a small file", () => {
    expect(progressWords(12 * 1048576, 48 * 1048576)).toBe("Sending 12 of 48 MB");
    expect(progressWords(10, 500_000)).toBe("Sending…");
  });
});

describe("Generate", () => {
  const openGenerate = () => click([...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((t) => t.textContent === "Generate")!);

  it("says plainly when the screen takes nothing the picker can make (no image), instead of a dead form", async () => {
    h.list.mockResolvedValue(page([]));
    await mount({ kinds: ["document"] });
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
    await mount({ kinds: ["image", "video"] });
    openGenerate();
    expect(host.querySelector('[aria-label="What to make"]')).toBeNull(); // no Image / Video switch
    expect(buttonByText("Make an image")).toBeDefined();
    expect(text()).not.toContain("Make a video");
  });

  it("with only video asked for and no generator of its own, the picker offers nothing to make", async () => {
    h.list.mockResolvedValue(page([]));
    await mount({ kinds: ["video"] });
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
    expect(opts.description).toContain("look in Drive");
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
    expect(h.toastError).toHaveBeenCalledWith("You don't have enough AI credits for this.", expect.objectContaining({ description: "You need 40 credits and have 10." }));
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
