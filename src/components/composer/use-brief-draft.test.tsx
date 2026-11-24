// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act, StrictMode } from "react";

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { useBriefDraft } = await import("./use-brief-draft");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Run = (c: { op: string; text: string; platform: string }) => Promise<string>;

function Probe({ brief, run }: { brief?: string; run: Run }) {
  useBriefDraft(brief, "x", run as never);
  return null;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  toast.error.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("writing the first draft from a brief", () => {
  it("runs the composer Compose action once, with the brief as the text, even under StrictMode and re-renders", async () => {
    const run = vi.fn<Run>(async () => "draft");
    await act(async () =>
      root.render(
        <StrictMode>
          <Probe brief="Write an X post." run={run} />
        </StrictMode>,
      ),
    );
    await act(async () =>
      root.render(
        <StrictMode>
          <Probe brief="Write an X post." run={vi.fn<Run>(async () => "other")} />
        </StrictMode>,
      ),
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ op: "compose", text: "Write an X post.", platform: "x" });
  });

  it("makes no call without a brief", async () => {
    const run = vi.fn<Run>(async () => "draft");
    await act(async () => root.render(<Probe run={run} />));
    expect(run).not.toHaveBeenCalled();
  });

  it("a new brief is a new run", async () => {
    const run = vi.fn<Run>(async () => "draft");
    await act(async () => root.render(<Probe brief="one-a" run={run} />));
    await act(async () => root.render(<Probe brief="two" run={run} />));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("a failed write is said, not swallowed", async () => {
    const run = vi.fn<Run>(async () => {
      throw new Error("Not enough Peaks");
    });
    await act(async () => root.render(<Probe brief="fails-1" run={run} />));
    expect(toast.error).toHaveBeenCalledWith("We could not write the draft", { description: "Not enough Peaks" });
  });

  it("a remount of the composer with the same brief is not a second charge", async () => {
    const run = vi.fn<Run>(async () => "draft");
    await act(async () => root.render(<Probe brief="remount-1" run={run} />));
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(<Probe brief="remount-1" run={run} />));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("a brief whose write failed can be tried again", async () => {
    const run = vi.fn<Run>(async () => {
      throw new Error("down");
    });
    await act(async () => root.render(<Probe brief="retry-1" run={run} />));
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(<Probe brief="retry-1" run={run} />));
    expect(run).toHaveBeenCalledTimes(2);
  });
});
