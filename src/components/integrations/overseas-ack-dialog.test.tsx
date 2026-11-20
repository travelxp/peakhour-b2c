// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { OverseasAckDialog } from "./overseas-ack-dialog";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(open: boolean, onCancel = vi.fn(), onConfirm = vi.fn()) {
  act(() => {
    root.render(
      <OverseasAckDialog version="tiktok_india_v1" open={open} onCancel={onCancel} onConfirm={onConfirm} />,
    );
  });
  return { onCancel, onConfirm };
}
const confirmBtn = () =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === "Connect TikTok") as HTMLButtonElement;

describe("OverseasAckDialog", () => {
  it("renders nothing while closed", () => {
    mount(false);
    expect(document.body.textContent).not.toContain("TikTok is banned in India");
  });

  it("keeps Connect disabled until the box is ticked, then confirms with the version", () => {
    const { onConfirm } = mount(true);
    expect(document.body.textContent).toContain("TikTok is banned in India");
    expect(confirmBtn().disabled).toBe(true);
    const box = document.querySelector('[role="checkbox"]') as HTMLButtonElement;
    expect(box.getAttribute("aria-labelledby") ?? document.querySelector(`label[for="${box.id}"]`)).toBeTruthy();
    act(() => box.click());
    expect(confirmBtn().disabled).toBe(false);
    act(() => confirmBtn().click());
    expect(onConfirm).toHaveBeenCalledWith("tiktok_india_v1");
  });

  it("Cancel only cancels", () => {
    const { onCancel, onConfirm } = mount(true);
    const cancel = [...document.querySelectorAll("button")].find((b) => b.textContent === "Cancel")!;
    act(() => cancel.click());
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape closes", () => {
    const { onCancel } = mount(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalled();
  });
});
