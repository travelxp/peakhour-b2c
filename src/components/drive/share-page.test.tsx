// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OpenResult, SharePageState } from "@/lib/api/drive-share";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() }, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));

const { SharePage, SharePageView, safeFileUrl } = await import("./share-page");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The page a share link lands on (owner decision 2026-11-04): the notice is on the page BEFORE the file is reachable, the number is the
 * api's, and nothing is recorded or served until the visitor presses the button.
 */
const NOTICE_90 = "Opening this link records your IP address and device. We keep these for 90 days.";
const noop = () => undefined;
const view = (v: Parameters<typeof SharePageView>[0]["view"]) =>
  renderToStaticMarkup(<SharePageView view={v} password="" busy={false} onPassword={noop} onOpen={noop} />);

describe("the view", () => {
  it("shows the notice with the button, before anything is opened", () => {
    const html = view({ step: "ready", passwordRequired: false, retentionDays: 90 });
    expect(html).toContain(NOTICE_90);
    expect(html).toContain("Open file");
    expect(html).not.toMatch(/href="https?:/); // no file link exists yet
  });

  it("shows the notice above the password box, and follows the number", () => {
    const html = view({ step: "ready", passwordRequired: true, retentionDays: 30 });
    expect(html).toContain("We keep these for 30 days.");
    expect(html).not.toContain("90 days");
    expect(html).toContain('type="password"');
    expect(html.indexOf("Opening this link records")).toBeLessThan(html.indexOf('type="password"'));
  });

  it("keeps the notice after a wrong password and when the link is locked (no box then)", () => {
    expect(view({ step: "ready", passwordRequired: true, retentionDays: 90, wrongPassword: true })).toContain(NOTICE_90);
    const locked = view({ step: "ready", passwordRequired: true, retentionDays: 90, locked: true });
    expect(locked).toContain(NOTICE_90);
    expect(locked).toContain("Too many wrong passwords");
    expect(locked).not.toContain('type="password"');
  });

  it("a dead link and an unavailable file show no button", () => {
    for (const v of [{ step: "gone" }, { step: "error" }] as const) {
      const html = view(v);
      expect(html).not.toContain("Open file");
    }
  });
});

let root: Root;
let host: HTMLElement;
afterEach(() => {
  // the static-markup cases above mount nothing
  if (!root) return;
  act(() => root.unmount());
  host.remove();
  root = undefined as never;
});

async function mount(over: { load?: () => Promise<SharePageState>; open?: (t: string, p?: string) => Promise<OpenResult> }) {
  const load = vi.fn(over.load ?? (async () => ({ kind: "ready", passwordRequired: false, retentionDays: 90 }) as SharePageState));
  const open = vi.fn(over.open ?? (async () => ({ kind: "opened", url: "https://files.example/signed?sig=1", name: "Brand guidelines", retentionDays: 90 }) as OpenResult));
  const navigate = vi.fn<(url: string) => void>();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<SharePage token={"t".repeat(43)} load={load} open={open as never} navigate={navigate} />);
  });
  return { load, open, navigate };
}
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(label)) as HTMLButtonElement | undefined;

describe("the page", () => {
  it("shows the notice first; the file is not requested and the browser does not move until the button is pressed", async () => {
    const { load, open, navigate } = await mount({});
    expect(load).toHaveBeenCalledOnce();
    expect(host.textContent).toContain(NOTICE_90);
    expect(button("Open file")).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => button("Open file")!.click());
    expect(open).toHaveBeenCalledWith("t".repeat(43), undefined);
    expect(navigate).toHaveBeenCalledWith("https://files.example/signed?sig=1");
  });

  it("with no number from the api there is no button: the file is not opened on a guess", async () => {
    const { open } = await mount({ load: async () => ({ kind: "error" }) });
    expect(host.textContent).toContain("isn't available");
    expect(button("Open file")).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });

  it("a password link asks for the password and sends it only on the press", async () => {
    const { open } = await mount({ load: async () => ({ kind: "ready", passwordRequired: true, retentionDays: 90 }) });
    expect(host.textContent).toContain(NOTICE_90);
    expect(button("Open file")!.disabled).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it("a wrong password keeps the notice and the box; a locked link keeps the notice and removes the box", async () => {
    const answers: OpenResult[] = [{ kind: "password", wrong: true, retentionDays: 90 }, { kind: "locked", retentionDays: 90 }];
    const { open, navigate } = await mount({
      load: async () => ({ kind: "ready", passwordRequired: true, retentionDays: 90 }),
      open: async () => answers.shift()!,
    });
    const input = host.querySelector("input")!;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      set.call(input, "guess");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("Open file")!.click());
    expect(open).toHaveBeenCalledWith("t".repeat(43), "guess");
    expect(host.textContent).toContain("That password is not right.");
    expect(host.textContent).toContain(NOTICE_90);
    const again = host.querySelector("input")!;
    await act(async () => {
      set.call(again, "guess two");
      again.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("Open file")!.click());
    expect(host.textContent).toContain("Too many wrong passwords");
    expect(host.textContent).toContain(NOTICE_90);
    expect(host.querySelector("input")).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("a dead link says so and offers nothing", async () => {
    await mount({ load: async () => ({ kind: "gone" }) });
    expect(host.textContent).toContain("does not exist or has expired");
    expect(button("Open file")).toBeUndefined();
  });

  it("a failed open keeps the page, the notice and the button, with an inline error", async () => {
    const { navigate } = await mount({ open: async () => ({ kind: "error" }) });
    await act(async () => button("Open file")!.click());
    expect(host.textContent).toContain("not available right now");
    expect(host.textContent).toContain(NOTICE_90);
    expect(button("Open file")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("two quick presses send one request", async () => {
    let release!: (r: OpenResult) => void;
    const { open } = await mount({ open: () => new Promise<OpenResult>((r) => (release = r)) });
    const b = button("Open file")!;
    await act(async () => {
      b.click();
      b.click();
    });
    expect(open).toHaveBeenCalledTimes(1);
    await act(async () => release({ kind: "error" }));
  });

  it("never navigates to or links a non-http address", async () => {
    expect(safeFileUrl("javascript:alert(1)")).toBeNull();
    expect(safeFileUrl("data:text/html,x")).toBeNull();
    expect(safeFileUrl("not a url")).toBeNull();
    expect(safeFileUrl("https://files.example/x?sig=1")).toBe("https://files.example/x?sig=1");
    const { navigate } = await mount({ open: async () => ({ kind: "opened", url: "javascript:alert(1)", name: "x", retentionDays: 90 }) });
    await act(async () => button("Open file")!.click());
    expect(navigate).not.toHaveBeenCalled();
    expect(host.innerHTML).not.toContain("javascript:");
  });
});
