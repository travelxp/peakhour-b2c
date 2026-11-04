// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FileVersion, MediaItem, ReplaceResult } from "@/lib/api/media";

const api = vi.hoisted(() => ({
  previewReplace: vi.fn(),
  replaceMedia: vi.fn(),
  listVersions: vi.fn(),
  restoreVersion: vi.fn(),
  saveToDrive: vi.fn(),
}));
const upload = vi.hoisted(() => ({ uploadToDrive: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() }, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/api/media", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api/media")>()), ...api }));
vi.mock("@/lib/drive/upload-engine", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/drive/upload-engine")>()), uploadToDrive: upload.uploadToDrive }));

const { ReplaceFileDialog } = await import("./replace-file");
const { VersionHistory } = await import("./version-history");
const { SaveToDriveButton } = await import("./save-to-drive");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Replace everywhere, version history and Save to Drive, driven as a person drives them: the dialog shows what will change BEFORE
 * anything is uploaded, a partial result is never presented as success and its Try again names the file being replaced, and Restore and
 * Save say what happened.
 */

const NOW = new Date("2026-11-04T12:00:00.000Z");
const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: "old1", publicUrl: "https://m.test/a.png", mimeType: "image/png", name: "Logo", kind: "image", visibility: "published", shared: false, sizeBytes: 1000, source: "uploaded",
  describeState: "described", usedInCount: 0, usedIn: [], createdAt: NOW.toISOString(), ...over,
});
const result = (over: Partial<ReplaceResult> = {}): ReplaceResult => ({ fileId: "new1", replacedFileId: "old1", retry: false, changed: [], staysAsSent: [], notChanged: [], ...over });

let root: Root | null = null;
let host: HTMLElement;
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });
async function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root!.render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
  });
  await tick();
}
const text = () => document.body.textContent?.replace(/\s+/g, " ") ?? "";
const button = (label: RegExp) => [...document.body.querySelectorAll("button")].find((b) => label.test(b.textContent ?? "")) as HTMLButtonElement | undefined;
async function click(el: Element | undefined) {
  expect(el, "button not found").toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await tick();
}
async function choose(file: File) {
  const input = document.body.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await tick();
}

beforeEach(() => {
  vi.clearAllMocks();
  api.previewReplace.mockResolvedValue({
    willChange: [{ kind: "draft", refId: "d1", label: "Diwali email" }, { kind: "scheduled_item", refId: "s1" }],
    staysAsSent: [{ kind: "page", refId: "p1", label: "Spring sale", reason: "Live page" }],
  });
  upload.uploadToDrive.mockResolvedValue({ mediaId: "new1", name: "logo-v2", visibility: "published", sizeBytes: 5, deduped: false });
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  host?.remove();
  document.body.innerHTML = "";
});

describe("the Replace everywhere dialog", () => {
  it("shows what will change and what stays BEFORE anything is uploaded", async () => {
    await mount(<ReplaceFileDialog item={item()} onReplaced={vi.fn()} />);
    await click(button(/Replace everywhere/));
    const t = text();
    expect(t).toContain("1 draft, 1 scheduled post will use the new file.");
    expect(t).toContain("1 page already went out, or are being sent, and stay exactly as they were. The old file is kept, so they keep showing it.");
    expect(t).toContain("Draft: Diwali email");
    expect(t).toContain("Page: Spring sale. Live page.");
    expect(api.previewReplace).toHaveBeenCalledWith("old1");
    expect(upload.uploadToDrive).not.toHaveBeenCalled();
    expect(api.replaceMedia).not.toHaveBeenCalled();
    // nothing to replace with yet
    expect(button(/^Replace everywhere$/ as RegExp)).toBeTruthy();
    const go = [...document.body.querySelectorAll("button")].filter((b) => /Replace everywhere/.test(b.textContent ?? "")).pop() as HTMLButtonElement;
    expect(go.disabled).toBe(true);
  });

  it("uploads with the SAME visibility, then swaps, then moves the screen only when the dialog closes", async () => {
    api.replaceMedia.mockResolvedValue(result({ changed: [{ kind: "draft", refId: "d1" }], staysAsSent: [{ kind: "page", refId: "p1", reason: "Live page" }] }));
    const onReplaced = vi.fn();
    await mount(<ReplaceFileDialog item={item({ visibility: "private" })} onReplaced={onReplaced} />);
    await click(button(/Replace everywhere/));
    await choose(new File(["x"], "logo-v2.png", { type: "image/png" }));
    const go = [...document.body.querySelectorAll("button")].filter((b) => /Replace everywhere/.test(b.textContent ?? "")).pop();
    await click(go);
    expect(upload.uploadToDrive.mock.calls[0]![1]).toMatchObject({ visibility: "private" });
    expect(api.replaceMedia).toHaveBeenCalledWith("old1", "new1");
    expect(text()).toContain("1 draft now use the new file. The old file is kept, because things that went out still show it.");
    expect(onReplaced).not.toHaveBeenCalled();
    await click(button(/^Done$/));
    expect(onReplaced).toHaveBeenCalledWith("new1");
  });

  it("a partial result is NOT shown as success; Try again repeats the swap for the file being replaced, with the same upload", async () => {
    api.replaceMedia.mockResolvedValueOnce(result({ changed: [{ kind: "draft", refId: "d1" }], notChanged: [{ kind: "scheduled_item", refId: "s1", reason: "It changed while this ran. Try again." }] }));
    await mount(<ReplaceFileDialog item={item()} onReplaced={vi.fn()} />);
    await click(button(/Replace everywhere/));
    await choose(new File(["x"], "logo-v2.png", { type: "image/png" }));
    await click([...document.body.querySelectorAll("button")].filter((b) => /Replace everywhere/.test(b.textContent ?? "")).pop());
    expect(text()).toContain("1 scheduled post could not be changed");
    expect(text()).not.toContain("now use the new file");
    expect(document.body.querySelector('[role="alert"]')).toBeTruthy();
    api.replaceMedia.mockResolvedValueOnce(result({ retry: true, changed: [{ kind: "scheduled_item", refId: "s1" }] }));
    await click(button(/^Try again$/));
    expect(api.replaceMedia).toHaveBeenLastCalledWith("old1", "new1");
    expect(upload.uploadToDrive).toHaveBeenCalledTimes(1);
    expect(text()).toContain("1 scheduled post now use the new file.");
  });

  it("when the swap fails after the upload, Try again swaps without uploading the file a second time", async () => {
    api.replaceMedia.mockRejectedValueOnce({ status: 503, message: "x" });
    await mount(<ReplaceFileDialog item={item()} onReplaced={vi.fn()} />);
    await click(button(/Replace everywhere/));
    await choose(new File(["x"], "logo-v2.png", { type: "image/png" }));
    await click([...document.body.querySelectorAll("button")].filter((b) => /Replace everywhere/.test(b.textContent ?? "")).pop());
    expect(text()).toContain("Nothing that was already published changed");
    api.replaceMedia.mockResolvedValueOnce(result());
    await click(button(/^Try again$/));
    expect(api.replaceMedia).toHaveBeenCalledTimes(2);
    expect(upload.uploadToDrive).toHaveBeenCalledTimes(1);
  });

  it("a file of the wrong kind is refused before anything is uploaded", async () => {
    await mount(<ReplaceFileDialog item={item()} onReplaced={vi.fn()} />);
    await click(button(/Replace everywhere/));
    await choose(new File(["x"], "menu.pdf", { type: "application/pdf" }));
    await click([...document.body.querySelectorAll("button")].filter((b) => /Replace everywhere/.test(b.textContent ?? "")).pop());
    expect(text()).toContain("This file is an image, so it can only be replaced by an image. You chose a document.");
    expect(upload.uploadToDrive).not.toHaveBeenCalled();
    expect(api.replaceMedia).not.toHaveBeenCalled();
  });

  it("closing after a swap that never answered refreshes without moving the screen (the swap may have been applied)", async () => {
    api.replaceMedia.mockRejectedValueOnce({ status: 503, message: "x" });
    const onReplaced = vi.fn();
    await mount(<ReplaceFileDialog item={item()} onReplaced={onReplaced} />);
    await click(button(/Replace everywhere/));
    await choose(new File(["x"], "logo-v2.png", { type: "image/png" }));
    await click([...document.body.querySelectorAll("button")].filter((b) => /Replace everywhere/.test(b.textContent ?? "")).pop());
    await click(button(/^Cancel$/));
    expect(onReplaced).toHaveBeenCalledWith(null);
  });

  it("closing before anything was swapped changes nothing", async () => {
    const onReplaced = vi.fn();
    await mount(<ReplaceFileDialog item={item()} onReplaced={onReplaced} />);
    await click(button(/Replace everywhere/));
    await click(button(/^Cancel$/));
    expect(onReplaced).not.toHaveBeenCalled();
  });

  it("when the preview cannot be read nothing can be replaced", async () => {
    api.previewReplace.mockRejectedValue(new Error("down"));
    await mount(<ReplaceFileDialog item={item()} onReplaced={vi.fn()} />);
    await click(button(/Replace everywhere/));
    expect(text()).toContain("nothing can be replaced right now");
    expect(document.body.querySelector('input[type="file"]')).toBeNull();
  });
});

describe("version history", () => {
  const v = (over: Partial<FileVersion> = {}): FileVersion => ({ id: "v1", name: "Logo (2025)", mimeType: "image/png", sizeBytes: 2048, visibility: "published", publicUrl: "https://m.test/v.png", replacedAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(), hardDeleteAfter: new Date(NOW.getTime() + 28 * 86_400_000).toISOString(), ...over });

  it("lists the versions with how long they are kept; shows nothing at all when there are none", async () => {
    api.listVersions.mockResolvedValue([v()]);
    await mount(<VersionHistory fileId="new1" now={NOW} canEdit onRestored={vi.fn()} />);
    expect(text()).toContain("Earlier versions");
    expect(text()).toContain("Logo (2025)");
    expect(text()).toContain("Replaced 2 days ago. 28 days left");
    await act(async () => root!.unmount());
    host.remove();
    api.listVersions.mockResolvedValue([]);
    await mount(<VersionHistory fileId="new1" now={NOW} canEdit onRestored={vi.fn()} />);
    expect(text()).not.toContain("Earlier versions");
  });

  it("a viewer sees the versions but no Restore", async () => {
    api.listVersions.mockResolvedValue([v()]);
    await mount(<VersionHistory fileId="new1" now={NOW} canEdit={false} onRestored={vi.fn()} />);
    expect(text()).toContain("Logo (2025)");
    expect(button(/Restore/)).toBeUndefined();
  });

  it("restoring asks first, then says what followed, and moves the screen to the restored file", async () => {
    api.listVersions.mockResolvedValue([v()]);
    api.restoreVersion.mockResolvedValue({ fileId: "v1", changed: [{ kind: "draft", refId: "d1" }], staysAsSent: [], notChanged: [] });
    const onRestored = vi.fn();
    await mount(<VersionHistory fileId="new1" now={NOW} canEdit onRestored={onRestored} />);
    await click(button(/^Restore$/));
    expect(api.restoreVersion).not.toHaveBeenCalled();
    expect(text()).toContain("Anything already published stays as it went out.");
    await click([...document.body.querySelectorAll("button")].filter((b) => /^Restore$/.test(b.textContent ?? "")).pop());
    expect(api.restoreVersion).toHaveBeenCalledWith("new1", "v1");
    expect(toast.success).toHaveBeenCalledWith("Restored. 1 draft now use it.");
    expect(onRestored).toHaveBeenCalledWith("v1");
  });

  it("a restore that could not switch everything says so", async () => {
    api.listVersions.mockResolvedValue([v()]);
    api.restoreVersion.mockResolvedValue({ fileId: "v1", changed: [], staysAsSent: [], notChanged: [{ kind: "page", refId: "p1" }] });
    await mount(<VersionHistory fileId="new1" now={NOW} canEdit onRestored={vi.fn()} />);
    await click(button(/^Restore$/));
    await click([...document.body.querySelectorAll("button")].filter((b) => /^Restore$/.test(b.textContent ?? "")).pop());
    expect(toast.success).toHaveBeenCalledWith("Restored, but 1 page could not be switched. They still use the other file.");
  });

  it("a full Drive shows the api's reason", async () => {
    api.listVersions.mockResolvedValue([v()]);
    api.restoreVersion.mockRejectedValue({ status: 402, message: "Restoring this version would pass your storage limit." });
    await mount(<VersionHistory fileId="new1" now={NOW} canEdit onRestored={vi.fn()} />);
    await click(button(/^Restore$/));
    await click([...document.body.querySelectorAll("button")].filter((b) => /^Restore$/.test(b.textContent ?? "")).pop());
    expect(toast.error).toHaveBeenCalledWith("Restoring this version would pass your storage limit.");
  });
});

describe("Save to Drive", () => {
  it("saves an Inbox attachment and says it is Private; the button then reads Saved", async () => {
    api.saveToDrive.mockResolvedValue({ mediaId: "m9", name: "WhatsApp photo", visibility: "private", deduped: false, alreadyInDrive: false });
    const onSaved = vi.fn();
    await mount(<SaveToDriveButton source={{ from: "inbox", threadId: "wa:1:2", ref: "a".repeat(64) }} onSaved={onSaved} />);
    await click(button(/Save to Drive/));
    expect(api.saveToDrive).toHaveBeenCalledWith({ from: "inbox", threadId: "wa:1:2", ref: "a".repeat(64) });
    expect(toast.success.mock.calls[0]![0]).toContain("It is Private");
    expect(onSaved).toHaveBeenCalledWith("m9");
    expect(button(/Saved to Drive/)?.disabled).toBe(true);
  });

  it("a refusal shows the api's reason and leaves the button to try again", async () => {
    api.saveToDrive.mockRejectedValue({ status: 415, message: "Drive does not store this kind of file." });
    await mount(<SaveToDriveButton source={{ from: "draft_asset", url: "https://x.test/a.png" }} />);
    await click(button(/Save to Drive/));
    expect(toast.error).toHaveBeenCalledWith("Drive does not store this kind of file.");
    expect(button(/Save to Drive/)?.disabled).toBe(false);
  });

  it("renders as plain markup too (no provider-only state leaks into the first paint)", () => {
    const qc = new QueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <SaveToDriveButton source={{ from: "ai_image", dataUrl: "data:image/png;base64,AAAA" }} />
      </QueryClientProvider>,
    );
    expect(html).toContain("Save to Drive");
  });
});
