// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { ScheduleConfirmCard } from "./schedule-confirm-card";
import type { BestTimeView } from "@/lib/scheduler/best-times";
import type { PreviewTimeResponse } from "@/lib/scheduler/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const preview: PreviewTimeResponse = {
  resolvedTimes: [
    { channel: "linkedin", scheduledAtUtc: "2026-11-24T05:30:00.000Z", audit: [] },
    { channel: "x", scheduledAtUtc: "2026-11-24T06:30:00.000Z", audit: [] },
  ],
};
const bestTimes: Record<string, BestTimeView> = {
  linkedin: { channel: "linkedin", source: "own", timezone: "Asia/Kolkata", label: "Tue 7 pm", scoredPosts: 31 },
  x: { channel: "x", source: "typical", timezone: "Asia/Kolkata", label: "9 am", scoredPosts: 0 },
};

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function render(props: Partial<React.ComponentProps<typeof ScheduleConfirmCard>>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<ScheduleConfirmCard timezone="Asia/Kolkata" preview={preview} {...props} />));
  return host.textContent ?? "";
}

describe("<ScheduleConfirmCard /> best time", () => {
  it("says the business's own best time under its channel, and the typical one under a channel with no history", () => {
    const text = render({ bestTimes });
    expect(text).toContain("Your best time on LinkedIn: Tue 7 pm (from your last 31 posts)");
    expect(text).toContain("Typical best time on X: 9 am");
  });

  it("says nothing about best time until the api has answered", () => {
    const text = render({});
    expect(text).not.toContain("best time");
  });
});
