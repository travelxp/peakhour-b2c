// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

const h = vi.hoisted(() => ({
  card: { isPending: false, isError: false, fetchStatus: "idle", data: undefined as unknown },
  sheet: vi.fn(),
}));
vi.mock("@/hooks/use-credits", () => ({ useCreditsRateCard: () => h.card }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function SheetStub(props: { open: boolean; channel?: string | null; brief?: string | null }) {
      h.sheet(props);
      return <div data-sheet data-channel={props.channel ?? ""} data-brief={props.brief ?? ""} />;
    },
}));

const { DraftThisPostButton } = await import("./draft-this-post-button");
const { ComposeSheetProvider } = await import("./compose-sheet-provider");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  h.sheet.mockClear();
  h.card = { isPending: false, isError: false, fetchStatus: "idle", data: { useCases: [{ useCase: "content_editor", free: false, creditMultiplier: 8 }] } };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const button = () => host.querySelector("button")!;
const BRIEF = 'Write a LinkedIn post about "Tea guide". Ask the reader a question.';
const render = () =>
  act(async () =>
    root.render(
      <ComposeSheetProvider>
        <DraftThisPostButton channel="linkedin" brief={BRIEF} />
      </ComposeSheetProvider>,
    ),
  );

describe("Draft this post", () => {
  it("shows the Peaks price from the rate card on the button before it is pressed, and mounts no sheet yet", async () => {
    await render();
    expect(button().textContent).toContain("Draft this post · 8 Peaks");
    expect(button().disabled).toBe(false);
    expect(host.querySelector("[data-sheet]")).toBeNull();
  });

  it("opens the page's one sheet on the insight's channel with its brief", async () => {
    await render();
    await act(async () => button().click());
    const sheet = host.querySelector("[data-sheet]")!;
    expect(sheet.getAttribute("data-channel")).toBe("linkedin");
    expect(sheet.getAttribute("data-brief")).toBe(BRIEF);
  });

  it("is off, and opens nothing, when the rate card has no price to show", async () => {
    h.card = { isPending: false, isError: true, fetchStatus: "idle", data: undefined };
    await render();
    expect(button().disabled).toBe(true);
    await act(async () => button().click());
    expect(host.querySelector("[data-sheet]")).toBeNull();
  });
});
