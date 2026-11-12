// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { ChangeLine, PresenceListing, PresenceNetworkEntry } from "@/lib/presence-panels";

/**
 * GBP3-L9: a change we cannot name is never offered for approval. Driven as a person drives it: there is no "Keep" and no "Put mine back",
 * "I've checked it" calls the keep route, and a named change with something to look at keeps its "Keep".
 */

const keepMutateAsync = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/hooks/use-presence-edit", () => ({
  useEditCapabilities: () => ({ data: { can: { propose: true, approve: true }, items: [{ network: "net_a", writableFields: ["description", "phone"] }] } }),
  useKeepNetworkChange: () => ({ mutateAsync: keepMutateAsync, reset: vi.fn(), isPending: false, isError: false, error: null }),
  usePresenceEditMutations: () => ({ propose: { mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null } }),
}));

const { ChangeChoices } = await import("./change-choices");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry = { network: "net_a", label: "Acme", externalId: "locations/1" } as unknown as PresenceNetworkEntry;
const listing = { id: "l1", contact: { additionalPhones: [] } } as unknown as PresenceListing;
const line = (over: Partial<ChangeLine>): ChangeLine => ({ key: "k", field: "other", path: "relationship.x", text: "", unnamed: true, canPutBack: false, before: undefined, suggested: undefined, ...over });

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  keepMutateAsync.mockClear();
});

function draw(l: ChangeLine, mapHref: string | null, onDone = vi.fn()) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<ChangeChoices line={l} entry={entry} listing={listing} mapHref={mapHref} onDone={onDone} />));
  return { host, onDone };
}
const buttons = (h: HTMLElement) => [...h.querySelectorAll("button")].map((b) => b.textContent);

describe("an unnamed change", () => {
  it("offers no Keep and no Put mine back, only the link and I've checked it", () => {
    const { host: h } = draw(line({ before: "old", canPutBack: true }), "https://maps.example/a");
    expect(buttons(h)).toEqual(["I've checked it"]);
    expect(h.textContent).not.toMatch(/Keep|Put mine back/);
    const a = h.querySelector("a")!;
    expect(a.textContent).toBe("Check it on Acme");
    expect(a.getAttribute("href")).toBe("https://maps.example/a");
  });

  it("I've checked it calls keep with the change and no value", async () => {
    const { host: h, onDone } = draw(line({}), null);
    expect(h.querySelector("a")).toBeNull();
    await act(async () => {
      h.querySelector("button")!.click();
    });
    expect(keepMutateAsync).toHaveBeenCalledTimes(1);
    expect(keepMutateAsync).toHaveBeenCalledWith({ listingId: "l1", network: "net_a", field: "other", label: "relationship.x", externalId: "locations/1", suggested: undefined });
    expect(onDone).toHaveBeenLastCalledWith("Done. We will stop reminding you about this.");
  });
});

describe("a named change", () => {
  it("offers Keep when there is a value, or a link to look at", () => {
    expect(buttons(draw(line({ field: "website", unnamed: false, suggested: "https://b.example" }), null).host)).toEqual(["Keep Acme's version"]);
    act(() => root?.unmount());
    host?.remove();
    expect(buttons(draw(line({ field: "regularHours", unnamed: false }), "https://maps.example/a").host)).toEqual(["Keep Acme's version"]);
  });

  it("with no value and no link, is still dismissable: I've checked it, never Keep", () => {
    expect(buttons(draw(line({ field: "regularHours", unnamed: false }), null).host)).toEqual(["I've checked it"]);
  });
});
