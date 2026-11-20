// @vitest-environment jsdom
/**
 * Drop and paste into a composer, the Link tab, and the machine under both (PK-1): a file is measured, judged against the place's rule, and
 * only then sent. The rules table, the upload client and the save call are replaced, so nothing reaches the network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UploadDeps } from "@/lib/drive/upload-engine";
import type { MediaRule } from "@/lib/media-rules";
import type { MediaAsset } from "@/components/composer/types";

const RULES: MediaRule[] = vi.hoisted(() => [
  { key: "post:facebook", label: "a Facebook post", maxCount: 2, image: { formats: ["image/jpeg", "image/png"], maxBytes: 4_000_000, aspect: { min: 0.8, max: 1.91 } } },
  { key: "page:photo", label: "this page", maxCount: 1, image: { formats: ["image/jpeg"] } },
  { key: "post:gifalone", label: "an X post", maxCount: 4, image: { formats: ["image/jpeg", "image/gif"], gifMustBeAlone: true } },
]);
vi.mock("@/lib/api", async (orig) => {
  const m = await orig<typeof import("@/lib/api")>();
  return { ...m, api: { ...m.api, get: vi.fn(async (path: string) => (path === "/v1/media/rules" ? { rules: RULES } : Promise.reject(new Error(`unexpected GET ${path}`)))) } };
});

const { useDropPaste, processFiles, LinkTab, linkOf, measureFile } = await import("./drive-picker-upload");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
beforeEach(() => vi.clearAllMocks());

const flush = async () => {
  for (let i = 0; i < 5; i++) await act(async () => void (await new Promise((r) => setTimeout(r, 5))));
};
function render(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
}

const goodDeps = (over: Partial<UploadDeps> = {}): Partial<UploadDeps> => ({
  hash: async () => "a".repeat(64),
  probe: async () => ({ width: 1000, height: 1000 }),
  initiate: vi.fn(async () => ({ deduped: false as const, uploadId: "u1", visibility: "published" as const, kind: "image", partSize: 100, partCount: 1, parts: [{ partNumber: 1, url: "https://r2.test/1" }], expiresAt: "x" })),
  putPart: vi.fn(async () => undefined),
  complete: vi.fn(async () => ({ mediaId: "m1", name: "Tin", publicUrl: "https://media.test/m1.jpg", visibility: "published" as const, sizeBytes: 5, deduped: false })),
  abort: vi.fn(async () => ({ aborted: true })),
  ...over,
});
const jpg = (name = "tin.jpg", size = 5) => new File([new Uint8Array(size)], name, { type: "image/jpeg" });

function Composer({ onAdd, onRefuse, deps, attached = 0, dest = "facebook" }: { onAdd: (a: MediaAsset[]) => void; onRefuse?: (r: { name: string; reason: string }[]) => void; deps: Partial<UploadDeps>; attached?: number; dest?: string }) {
  const { ref, busy } = useDropPaste<HTMLDivElement>({
    destination: dest === "photo" ? { kind: "page", use: "photo" } : { kind: "post", channel: dest },
    attached,
    onAdd,
    ...(onRefuse ? { onRefuse } : {}),
    seam: { deps },
  });
  return (
    <div ref={ref} data-testid="composer" data-busy={busy ? "1" : "0"}>
      <textarea />
    </div>
  );
}
const dropOn = (el: Element, files: File[]) => {
  const e = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(e, "dataTransfer", { value: { files, types: ["Files"] } });
  act(() => void el.dispatchEvent(e));
  return e;
};
const pasteOn = (el: Element, files: File[]) => {
  const e = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clipboardData", { value: { files } });
  act(() => void el.dispatchEvent(e));
  return e;
};

describe("drop and paste into a composer", () => {
  it("a dropped picture goes through the same upload engine and comes back as an asset, with the drop taken (not opened by the browser)", async () => {
    const onAdd = vi.fn();
    const deps = goodDeps();
    render(<Composer onAdd={onAdd} deps={deps} />);
    await flush();
    const e = dropOn(host.querySelector('[data-testid="composer"]')!, [jpg()]);
    expect(e.defaultPrevented).toBe(true);
    await flush();
    await flush();
    expect(deps.initiate).toHaveBeenCalledWith(expect.objectContaining({ filename: "tin.jpg", visibility: "published" }));
    expect(onAdd).toHaveBeenCalledWith([expect.objectContaining({ id: "m1", url: "https://media.test/m1.jpg", mime: "image/jpeg" })]);
  });

  it("a pasted picture does the same; pasted text is left to the browser", async () => {
    const onAdd = vi.fn();
    const deps = goodDeps();
    render(<Composer onAdd={onAdd} deps={deps} />);
    await flush();
    const text = pasteOn(host.querySelector("textarea")!, []);
    expect(text.defaultPrevented).toBe(false);
    expect(deps.initiate).not.toHaveBeenCalled();
    const e = pasteOn(host.querySelector("textarea")!, [jpg("shot.png")]);
    expect(e.defaultPrevented).toBe(true);
    await flush();
    await flush();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("a drop with no files in it (text, a link being dragged) is not touched", async () => {
    render(<Composer onAdd={vi.fn()} deps={goodDeps()} />);
    await flush();
    const e = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(e, "dataTransfer", { value: { files: [], types: ["text/plain"] } });
    act(() => void host.querySelector('[data-testid="composer"]')!.dispatchEvent(e));
    expect(e.defaultPrevented).toBe(false);
  });

  it("a file the channel refuses is never sent, and is reported with its reason", async () => {
    const onAdd = vi.fn();
    const onRefuse = vi.fn();
    const deps = goodDeps({ probe: async () => ({ width: 3000, height: 1000 }) });
    render(<Composer onAdd={onAdd} onRefuse={onRefuse} deps={deps} />);
    await flush();
    dropOn(host.querySelector('[data-testid="composer"]')!, [jpg("wide.jpg"), new File(["x"], "clip.mp4", { type: "video/mp4" })]);
    await flush();
    await flush();
    await flush();
    expect(deps.initiate).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
    const refused = onRefuse.mock.calls[0]![0] as { name: string; reason: string }[];
    expect(refused.map((r) => r.name)).toEqual(["wide.jpg", "clip.mp4"]);
    expect(refused[0]!.reason).toContain("takes shapes from 0.8:1 to 1.91:1; this one is 3:1");
    expect(refused[0]!.reason).toContain("Crop it");
    expect(refused[1]!.reason).toContain("takes pictures, not this kind of file");
  });

  it("only the room left is sent: what the place already holds counts, and the rest are turned away with the count", async () => {
    const onAdd = vi.fn();
    const onRefuse = vi.fn();
    const deps = goodDeps();
    render(<Composer onAdd={onAdd} onRefuse={onRefuse} deps={deps} attached={1} />);
    await flush();
    dropOn(host.querySelector('[data-testid="composer"]')!, [jpg("a.jpg"), jpg("b.jpg")]);
    for (let i = 0; i < 6; i++) await flush();
    expect(deps.initiate).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onRefuse.mock.calls[0]![0]).toEqual([{ name: "b.jpg", reason: "Up to 2 files can go to a Facebook post." }]);
  });

  it("until the place's rules are known a drop is still taken (never left to the browser to open in this tab) and refused with a line", async () => {
    const onAdd = vi.fn();
    const onRefuse = vi.fn();
    const deps = goodDeps();
    render(<Composer onAdd={onAdd} onRefuse={onRefuse} deps={deps} dest="nowhere" />);
    await flush();
    const e = dropOn(host.querySelector('[data-testid="composer"]')!, [jpg()]);
    expect(e.defaultPrevented).toBe(true);
    await flush();
    expect(deps.initiate).not.toHaveBeenCalled();
    expect(onRefuse).toHaveBeenCalledWith([{ name: "tin.jpg", reason: "This place can't take files yet." }]);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("a composer that is locked still TAKES a dropped file (the browser would open it in this tab and lose the draft), shows no drop ring, and says why it was not added", async () => {
    const onRefuse = vi.fn();
    const deps = goodDeps();
    function Locked() {
      const { ref, dragging } = useDropPaste<HTMLDivElement>({ destination: { kind: "post", channel: "facebook" }, disabled: true, onAdd: vi.fn(), onRefuse, seam: { deps } });
      return <div ref={ref} data-testid="composer" data-dragging={dragging ? "1" : "0"} />;
    }
    render(<Locked />);
    await flush();
    const el = host.querySelector('[data-testid="composer"]')!;
    const over = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(over, "dataTransfer", { value: { files: [], types: ["Files"] } });
    act(() => void el.dispatchEvent(over));
    expect(over.defaultPrevented).toBe(true);
    expect(el.getAttribute("data-dragging")).toBe("0");
    expect(dropOn(el, [jpg()]).defaultPrevented).toBe(true);
    await flush();
    expect(deps.initiate).not.toHaveBeenCalled();
    expect(onRefuse).toHaveBeenCalledWith([{ name: "tin.jpg", reason: "This can't take files right now." }]);
  });

  it("text copied from another app (which comes with a picture of itself) is pasted as text, not turned into an upload", async () => {
    const deps = goodDeps();
    render(<Composer onAdd={vi.fn()} deps={deps} />);
    await flush();
    const e = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(e, "clipboardData", { value: { files: [jpg("selection.png")], types: ["text/plain", "text/html", "Files"] } });
    act(() => void host.querySelector("textarea")!.dispatchEvent(e));
    expect(e.defaultPrevented).toBe(false);
    await flush();
    expect(deps.initiate).not.toHaveBeenCalled();
  });

  it("onRefuse is called once per drop with everything turned away in it, an empty list when nothing was, so the host can replace what it shows", async () => {
    const onRefuse = vi.fn();
    const onAdd = vi.fn();
    render(<Composer onAdd={onAdd} onRefuse={onRefuse} deps={goodDeps()} />);
    await flush();
    dropOn(host.querySelector('[data-testid="composer"]')!, [jpg("ok.jpg")]);
    for (let i = 0; i < 5; i++) await flush();
    expect(onRefuse).toHaveBeenCalledTimes(1);
    expect(onRefuse).toHaveBeenCalledWith([]);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("two drops in quick succession share the room: the second sees the first's files as taken", async () => {
    const onAdd = vi.fn();
    const onRefuse = vi.fn();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const deps = goodDeps({ putPart: vi.fn(async () => gate) });
    render(<Composer onAdd={onAdd} onRefuse={onRefuse} deps={deps} attached={1} />);
    await flush();
    const el = host.querySelector('[data-testid="composer"]')!;
    dropOn(el, [jpg("a.jpg")]);
    await flush();
    dropOn(el, [jpg("b.jpg")]);
    await flush();
    expect(onRefuse).toHaveBeenCalledWith([{ name: "b.jpg", reason: "Up to 2 files can go to a Facebook post." }]);
    release();
    for (let i = 0; i < 6; i++) await flush();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe("processFiles", () => {
  const ctx = (over = {}) => ({ rule: RULES[0]!, room: 2, visibility: "published" as const, requirePublicUrl: true, seam: { deps: goodDeps() }, ...over });

  it("a file Drive already holds as Private is not handed back where a public link is needed", async () => {
    const deps = goodDeps({ initiate: vi.fn(async () => ({ deduped: true as const, mediaId: "old", name: "Logo", visibility: "private" as const, sizeBytes: 5 })) });
    const { done, refused } = await processFiles([jpg()], ctx({ seam: { deps } }));
    expect(done).toEqual([]);
    expect(refused[0]!.reason).toContain("already in Drive as a Private file");
  });

  it("reports each file to the hooks as it goes: checking, then done or why not", async () => {
    const seen: string[] = [];
    await processFiles([jpg()], ctx(), { begin: () => 7, patch: (k, p) => void seen.push(`${k}:${p.status ?? "sent"}`) });
    expect(seen).toContain("7:done");
    const bad: string[] = [];
    await processFiles([new File(["x"], "a.gif", { type: "image/gif" })], ctx(), { begin: () => 1, patch: (_k, p) => void (p.status && bad.push(p.status)) });
    expect(bad).toEqual(["refused"]);
  });

  it("a GIF is not sent beside other pictures where the place wants it alone", async () => {
    const rule = RULES[2]!;
    const deps = goodDeps();
    const gif = new File([new Uint8Array(5)], "a.gif", { type: "image/gif" });
    const { done, refused } = await processFiles([jpg("b.jpg"), gif], { rule, room: 4, visibility: "published", requirePublicUrl: true, seam: { deps } });
    expect(done).toHaveLength(1);
    expect(refused).toEqual([{ name: "a.gif", reason: "A GIF has to be the only picture in an X post." }]);
  });

  it("Cancel on one file ends that file and nothing else", async () => {
    const own = new AbortController();
    const { UploadAborted } = await import("@/lib/drive/upload-engine");
    const putPart = vi.fn((_u: string, _b: Blob, _o: unknown, signal: AbortSignal) =>
      signal.aborted ? Promise.reject(new UploadAborted()) : new Promise<void>((res, rej) => {
        signal.addEventListener("abort", () => rej(new UploadAborted()), { once: true });
        setTimeout(res, 30);
      }),
    );
    const deps = goodDeps({ putPart: putPart as never });
    const seen: string[] = [];
    let n = 0;
    const p = processFiles([jpg("a.jpg"), jpg("b.jpg")], ctx({ room: 5, seam: { deps } }), {
      begin: () => n++,
      signalFor: (k) => (k === 0 ? own.signal : undefined),
      patch: (k, x) => void (x.status && seen.push(`${k}:${x.status}`)),
    });
    setTimeout(() => own.abort(), 5);
    const { done } = await p;
    expect(seen).toContain("0:cancelled");
    expect(seen).toContain("1:done");
    expect(done.map((d) => d.mediaId)).toEqual(["m1"]);
  });

  it("a full Drive stops the files behind it: one attempt, every file told why", async () => {
    const { ApiError } = await import("@/lib/api");
    const initiate = vi.fn(async () => Promise.reject(new ApiError("STORAGE_QUOTA_EXCEEDED", "Your Drive is full. Add space to upload more.", 402)));
    const deps = goodDeps({ initiate: initiate as never });
    const rows: string[] = [];
    let n = 0;
    const { done, refused } = await processFiles([jpg("a.jpg"), jpg("b.jpg"), jpg("c.jpg")], ctx({ room: 5, seam: { deps } }), { begin: () => n++, patch: (k, x) => void (x.status && rows.push(`${k}:${x.status}`)) });
    expect(done).toEqual([]);
    expect(initiate).toHaveBeenCalledTimes(1);
    expect(refused.map((r) => r.name)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(refused.every((r) => r.reason.includes("Your Drive is full"))).toBe(true);
    expect(rows).toEqual(expect.arrayContaining(["0:error", "1:error", "2:error"]));
  });

  it("measures a picture's shape with the probe it is given, and a video's length is left out when the browser cannot read it", async () => {
    const facts = await measureFile(jpg(), { deps: goodDeps({ probe: async () => ({ width: 640, height: 480 }) }) });
    expect(facts).toEqual({ mimeType: "image/jpeg", sizeBytes: 5, width: 640, height: 480 });
    const v = await measureFile(new File(["x"], "v.mp4", { type: "video/mp4" }), { deps: goodDeps({ probe: async () => ({}) }), duration: async () => undefined });
    expect(v).toEqual({ mimeType: "video/mp4", sizeBytes: 1 });
    const w = await measureFile(new File(["x"], "v.mp4", { type: "video/mp4" }), { deps: goodDeps({ probe: async () => ({ width: 1920, height: 1080 }) }), duration: async () => 12.5 });
    expect(w).toEqual({ mimeType: "video/mp4", sizeBytes: 1, width: 1920, height: 1080, durationSeconds: 12.5 });
  });
});

describe("the Link tab", () => {
  const rule = RULES[1]!;
  const saved = { mediaId: "s1", name: "Tin", visibility: "published" as const, publicUrl: "https://media.test/s1.jpg", deduped: false, alreadyInDrive: false };
  const media = (over = {}) => ({ mimeType: "image/jpeg", sizeBytes: 1000, width: 800, height: 800, ...over }) as never;
  const press = () => act(() => void host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  const type = (value: string) =>
    act(() => {
      const input = host.querySelector<HTMLInputElement>("input")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

  it("takes only an https link", () => {
    expect(linkOf("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
    expect(linkOf("  https://example.com/a b.jpg  ")).toBeNull();
    expect(linkOf("http://example.com/a.jpg")).toBeNull();
    expect(linkOf("javascript:alert(1)")).toBeNull();
    expect(linkOf("data:image/png;base64,AAAA")).toBeNull();
    expect(linkOf("example.com/a.jpg")).toBeNull();
  });

  it("asks the api to fetch it (the one safe fetcher), judges the saved file, and hands it back", async () => {
    const save = vi.fn(async () => saved);
    const readFile = vi.fn(async () => media());
    const onDone = vi.fn();
    render(<LinkTab rule={rule} room={1} requirePublicUrl onDone={onDone} save={save as never} readFile={readFile as never} />);
    expect(host.querySelector("button[type=submit]")!.hasAttribute("disabled")).toBe(true);
    type("https://example.com/tin.jpg");
    press();
    await flush();
    expect(save).toHaveBeenCalledWith({ from: "draft_asset", url: "https://example.com/tin.jpg" });
    expect(readFile).toHaveBeenCalledWith("s1");
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: "s1", kind: "image", publicUrl: "https://media.test/s1.jpg", width: 800 }));
  });

  it("a link to something the place would refuse is in Drive, and says why it was not added", async () => {
    const onDone = vi.fn();
    render(<LinkTab rule={rule} room={1} requirePublicUrl onDone={onDone} save={(async () => saved) as never} readFile={(async () => media({ mimeType: "image/png" })) as never} />);
    type("https://example.com/tin.png");
    press();
    await flush();
    expect(onDone).not.toHaveBeenCalled();
    expect(host.textContent).toContain("It is saved in Drive, but it was not added. This page takes JPG files, not PNG.");
  });

  it("an address the api cannot fetch says so in the api's words; a full place does not fetch at all", async () => {
    const { ApiError } = await import("@/lib/api");
    render(<LinkTab rule={rule} room={1} requirePublicUrl onDone={vi.fn()} save={(async () => Promise.reject(new ApiError("UNFETCHABLE", "That address could not be reached.", 422))) as never} readFile={vi.fn() as never} />);
    type("https://example.com/gone.jpg");
    press();
    await flush();
    expect(host.textContent).toContain("That address could not be reached.");
    act(() => root.unmount());
    host.remove();
    const save = vi.fn();
    render(<LinkTab rule={rule} room={0} requirePublicUrl onDone={vi.fn()} save={save as never} readFile={vi.fn() as never} />);
    type("https://example.com/a.jpg");
    press();
    await flush();
    expect(save).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Only one file can go to this page.");
  });
});
