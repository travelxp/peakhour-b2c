// @vitest-environment jsdom
/**
 * Enter in the code box while the code is already being confirmed does not send it again: the code is single-use, and the
 * second answer ("used") would replace the first.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { MandateConfirmView, type MandateConfirmViewProps } from "./mandate-confirm";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function mount(over: Partial<MandateConfirmViewProps>) {
  const onConfirm = vi.fn<() => void>();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <MandateConfirmView
        link={{ plan: "Plan", sentTo: "ending 01", otpSent: true, change: false }}
        codeAsked
        code="123456"
        onCode={vi.fn()}
        onSend={vi.fn()}
        onConfirm={onConfirm}
        {...over}
      />,
    ),
  );
  return onConfirm;
}
const submit = () => act(() => void document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

describe("the code form", () => {
  it("★submits a complete code once, and not again while it is being confirmed", () => {
    const idle = mount({});
    submit();
    expect(idle).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    host.remove();
    const busy = mount({ confirming: true });
    submit();
    expect(busy).not.toHaveBeenCalled();
  });
});
