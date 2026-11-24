// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChannelWhatChanged } from "@/lib/api/what-changed";

const h = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/api/what-changed", () => ({ whatChangedApi: { read: h.read } }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "b1" } }) }));
vi.mock("@/components/compose/draft-this-post-button", () => ({
  DraftThisPostButton: (p: { channel: string; brief: string }) => <button data-draft data-channel={p.channel} data-brief={p.brief} />,
}));

const { WhatChangedCard } = await import("./what-changed-card");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  h.read.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const render = async (channel?: "x") => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WhatChangedCard {...(channel ? { channel } : {})} />
      </QueryClientProvider>,
    ),
  );
  // let the query settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

const ch = (over: Partial<ChannelWhatChanged>): ChannelWhatChanged => ({
  channel: "x",
  name: "X",
  state: "ok",
  measuredPosts: 5,
  needed: 3,
  lines: [],
  ...over,
});

describe("What changed in your posts", () => {
  it("a draft button on every line that carries a brief, with that line's channel and brief", async () => {
    h.read.mockResolvedValue([
      ch({
        lines: [
          { id: "a", group: "improving", text: "Posts with a picture or video get about 2× the engagement of posts with only text on X.", draft: { channel: "x", brief: "Write an X post. Add a picture." } },
          { id: "b", group: "attention", text: "You have not posted on X in the last 7 days." },
        ],
      }),
    ]);
    await render("x");
    expect(host.textContent).toContain("Improving: Posts with a picture");
    const buttons = [...host.querySelectorAll("[data-draft]")];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.getAttribute("data-channel")).toBe("x");
    expect(buttons[0]!.getAttribute("data-brief")).toBe("Write an X post. Add a picture.");
  });

  it("a channel with some results but too few says 'not enough history yet', not a line from noise", async () => {
    h.read.mockResolvedValue([ch({ state: "not_enough_history", measuredPosts: 2 })]);
    await render("x");
    expect(host.textContent).toContain("Not enough history yet");
    expect(host.textContent).toContain("2 posts so far");
    expect(host.querySelector("[data-draft]")).toBeNull();
  });

  it("a channel page with no measured posts shows nothing at all", async () => {
    h.read.mockResolvedValue([ch({ state: "not_enough_history", measuredPosts: 0 })]);
    await render("x");
    expect(host.textContent).toBe("");
  });

  it("a failed read shows nothing", async () => {
    h.read.mockRejectedValue(new Error("down"));
    await render("x");
    expect(host.textContent).toBe("");
  });

  it("Results lists only channels that have something to say, each under its name, and one note when none has", async () => {
    h.read.mockResolvedValue([
      ch({ channel: "linkedin", name: "LinkedIn", lines: [{ id: "q", group: "attention", text: "You have not posted on LinkedIn in the last 7 days.", draft: { channel: "linkedin", brief: "Write a LinkedIn post." } }] }),
      ch({ channel: "x", name: "X", state: "steady" }),
    ]);
    await render();
    expect(host.textContent).toContain("LinkedIn");
    expect(host.textContent).not.toContain("Nothing has changed");
    expect(host.querySelectorAll("[data-draft]")).toHaveLength(1);

    await act(async () => root.unmount());
    root = createRoot(host);
    h.read.mockResolvedValue([ch({ state: "steady" })]);
    await render();
    expect(host.textContent).toContain("Nothing to report yet");
  });
});
