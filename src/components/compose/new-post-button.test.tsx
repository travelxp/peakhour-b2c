// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

const sheet = vi.hoisted(() => ({ renders: vi.fn(), mounts: vi.fn() }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function SheetStub(props: { open: boolean; channel?: string | null }) {
      sheet.renders(props);
      return <div data-sheet data-open={String(props.open)} data-channel={props.channel ?? ""} />;
    },
}));

const { NewPostButton } = await import("./new-post-button");
const { ComposeSheetProvider } = await import("./compose-sheet-provider");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  sheet.renders.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const sheets = () => host.querySelectorAll("[data-sheet]");
const buttons = () => [...host.querySelectorAll("button")];

describe("NewPostButton and the page's one sheet", () => {
  it("mounts no sheet until a button is pressed, then opens it on that button's channel", async () => {
    await act(async () =>
      root.render(
        <ComposeSheetProvider>
          <NewPostButton channel="instagram" />
        </ComposeSheetProvider>,
      ),
    );
    expect(sheets().length).toBe(0);
    await act(async () => buttons()[0].click());
    expect(sheets().length).toBe(1);
    expect(sheets()[0].getAttribute("data-open")).toBe("true");
    expect(sheets()[0].getAttribute("data-channel")).toBe("instagram");
  });

  it("two buttons on one page open ONE sheet, each on its own channel", async () => {
    await act(async () =>
      root.render(
        <ComposeSheetProvider>
          <NewPostButton channel="x" />
          <NewPostButton label="Create a post" />
        </ComposeSheetProvider>,
      ),
    );
    await act(async () => buttons()[0].click());
    await act(async () => buttons()[1].click());
    expect(sheets().length).toBe(1);
    expect(sheets()[0].getAttribute("data-channel")).toBe("");
    await act(async () => buttons()[0].click());
    expect(sheets().length).toBe(1);
    expect(sheets()[0].getAttribute("data-channel")).toBe("x");
  });

  it("a disabled button opens nothing", async () => {
    await act(async () =>
      root.render(
        <ComposeSheetProvider>
          <NewPostButton channel="facebook" disabled />
        </ComposeSheetProvider>,
      ),
    );
    await act(async () => buttons()[0].click());
    expect(sheets().length).toBe(0);
  });

  it("without a provider it fails loudly rather than mounting its own sheet", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(act(async () => root.render(<NewPostButton />))).rejects.toThrow(/ComposeSheetProvider/);
    err.mockRestore();
  });
});
