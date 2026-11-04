// @vitest-environment jsdom
/**
 * The X messages container (Inbox lane I3g): what it shows when the status cannot be read, and when the api starts answering
 * "not released" after the panel is already on screen.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { XDmStatus } from "@/lib/x-dm";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { get: h.get, post: h.post, put: h.put }, API_BASE_URL: "https://api.example" }));

const { XDmConnect } = await import("./x-dm-connect");
const { LOAD_FAILED, REFRESH_FAILED } = await import("@/lib/x-dm");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const status = (over: Partial<XDmStatus> = {}): XDmStatus => ({
  connected: true, connectionId: "c1", state: "off", pricePerMessage: 5, monthlyCap: 500, usedThisMonth: 0, resumesAt: null, ...over,
});
const notFound = () => Object.assign(new Error("not found"), { status: 404 });
const serverError = () => Object.assign(new Error("boom"), { status: 500 });

let root: Root;
let host: HTMLElement;
let client: QueryClient;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  h.get.mockReset();
  h.post.mockReset();
  h.put.mockReset();
});

async function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <XDmConnect />
      </QueryClientProvider>,
    );
  });
  // let the query settle (one retry for a non-404 failure)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

describe("reading the status", () => {
  it("a 404 (not released) renders NOTHING", async () => {
    h.get.mockRejectedValue(notFound());
    await mount();
    expect(host.innerHTML).toBe("");
    expect(h.get).toHaveBeenCalledTimes(1);
  });
  it("a failure that is not a 404 is said, with Try again, and is not mistaken for 'off'", async () => {
    h.get.mockRejectedValue(serverError());
    await mount();
    expect(host.textContent).toContain(LOAD_FAILED);
    expect(host.textContent).toContain("Try again");
    expect(h.get.mock.calls.length).toBe(2);
  });
  it("a status shows the panel", async () => {
    h.get.mockResolvedValue(status());
    await mount();
    expect(host.querySelector('[data-testid="x-dm-connect"]')).not.toBeNull();
  });
  it("the api's own 'unavailable' state renders nothing", async () => {
    h.get.mockResolvedValue(status({ state: "unavailable" }));
    await mount();
    expect(host.innerHTML).toBe("");
  });
});

describe("after the panel is on screen", () => {
  it("a 404 on the next read (the platform switch was turned off) hides the panel instead of leaving a stale On", async () => {
    h.get.mockResolvedValueOnce(status({ state: "on" }));
    await mount();
    expect(host.querySelector('[data-testid="x-dm-connect"]')).not.toBeNull();
    h.get.mockRejectedValue(notFound());
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["x-dm-status"] });
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(host.innerHTML).toBe("");
  });
  it("an action whose re-read fails says the change was saved and the page could not refresh", async () => {
    h.get.mockResolvedValueOnce(status());
    h.post.mockResolvedValue({});
    await mount();
    h.get.mockRejectedValue(serverError());
    const turnOn = [...host.querySelectorAll("button")].find((b) => b.textContent === "Turn on X messages")!;
    await act(async () => {
      turnOn.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(h.post).toHaveBeenCalledWith("/v1/x/dm/enable", {});
    expect(host.textContent).toContain(REFRESH_FAILED);
  });
  it("an action that works and re-reads shows the new state and no error", async () => {
    h.get.mockResolvedValueOnce(status());
    h.post.mockResolvedValue({});
    await mount();
    h.get.mockResolvedValue(status({ state: "on" }));
    const turnOn = [...host.querySelectorAll("button")].find((b) => b.textContent === "Turn on X messages")!;
    await act(async () => {
      turnOn.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(host.textContent).toContain("Turn off");
    expect(host.querySelector('[data-testid="x-dm-error"]')).toBeNull();
  });
  it("an action the api refuses shows the api's sentence", async () => {
    h.get.mockResolvedValue(status());
    h.post.mockRejectedValue(new Error("Grant message access to your X account first, then turn X messages on."));
    await mount();
    const turnOn = [...host.querySelectorAll("button")].find((b) => b.textContent === "Turn on X messages")!;
    await act(async () => {
      turnOn.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(host.querySelector('[data-testid="x-dm-error"]')!.textContent).toContain("Grant message access to your X account first");
  });
});
