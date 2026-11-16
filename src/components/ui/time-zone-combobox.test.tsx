// @vitest-environment jsdom
/**
 * The one time-zone picker (FR2): search finds a zone by city, country and offset; the stored value is always an option and is shown as
 * stored; typed text narrows the list and is never the value; arrows and Enter choose; the first option and the trigger's name.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act, useState } from "react";
import axe from "axe-core";
import { TimeZoneCombobox } from "./time-zone-combobox";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  // cmdk and Radix read these; jsdom has neither
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = () => undefined;
});

let root: Root;
let host: HTMLElement;
const chosen = vi.fn<(zone: string) => void>();

function Harness(p: { start: string; firstOption?: { label: string }; near?: string[]; keep?: string }) {
  const [value, setValue] = useState(p.start);
  return (
    <>
      <label htmlFor="tz">Time zone</label>
      <TimeZoneCombobox
        id="tz"
        value={value}
        {...(p.firstOption ? { firstOption: p.firstOption } : {})}
        {...(p.near ? { near: p.near } : {})}
        {...(p.keep ? { keep: p.keep } : {})}
        onChange={(z) => {
          chosen(z);
          setValue(z);
        }}
      />
    </>
  );
}

async function mount(props: Parameters<typeof Harness>[0]) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<Harness {...props} />));
}
const trigger = () => host.querySelector<HTMLButtonElement>("button#tz")!;
const input = () => document.querySelector<HTMLInputElement>("[cmdk-input]")!;
const options = () => [...document.querySelectorAll<HTMLElement>("[cmdk-item]")];
const optionTexts = () => options().map((o) => o.textContent ?? "");
async function openIt() {
  await act(async () => trigger().click());
}
async function search(text: string) {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(input(), text);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function key(k: string) {
  await act(async () => {
    input().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  });
}

beforeEach(() => chosen.mockReset());
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

describe("TimeZoneCombobox", () => {
  it("is a combobox a label names, closed until pressed, and shows the stored zone with its offset", async () => {
    await mount({ start: "Asia/Kolkata" });
    const t = trigger();
    expect(t.getAttribute("role")).toBe("combobox");
    expect(t.getAttribute("aria-expanded")).toBe("false");
    expect(t.textContent).toContain("Asia/Kolkata (UTC+05:30)");
    expect(document.querySelector("[cmdk-input]")).toBeNull();
    // the label's `for` reaches the trigger
    expect(document.querySelector("label")!.htmlFor).toBe("tz");
    await openIt();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(input()).not.toBeNull();
  });

  it("★★search finds Kolkata by city, by country and by offset", async () => {
    await mount({ start: "Europe/London" });
    await openIt();
    for (const q of ["Kolkata", "India", "+05:30"]) {
      await search(q);
      expect(optionTexts().some((t) => t.includes("Asia/Kolkata (UTC+05:30)")), q).toBe(true);
      expect(optionTexts().some((t) => t.includes("Europe/London")), q).toBe(false);
    }
  });

  it("★★the stored zone is always an option and is shown as stored, even when the list holds only its modern name", async () => {
    await mount({ start: "Asia/Calcutta" });
    expect(trigger().textContent).toContain("Asia/Calcutta (UTC+05:30)");
    await openIt();
    expect(optionTexts().some((t) => t.startsWith("Asia/Calcutta"))).toBe(true);
    expect(optionTexts().some((t) => t.startsWith("Asia/Kolkata"))).toBe(true);
    expect(chosen).not.toHaveBeenCalled();
  });

  it("★★typed text narrows the list and is never the value: a search that matches nothing offers nothing to choose", async () => {
    await mount({ start: "Europe/London" });
    await openIt();
    await search("Mars/Olympus");
    expect(options()).toHaveLength(0);
    expect(document.body.textContent).toContain("No time zone matches that.");
    await key("Enter");
    expect(chosen).not.toHaveBeenCalled();
    expect(trigger().textContent).toContain("Europe/London");
  });

  it("★★a11y: axe finds nothing wrong with the closed or the open picker, a named trigger, dialog and list included", async () => {
    await mount({ start: "Asia/Kolkata" });
    const run = async () => (await axe.run(document.body, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90)).join(" | ")}`);
    expect(await run()).toEqual([]);
    await openIt();
    expect(await run()).toEqual([]);
  });

  it("arrows and Enter choose the highlighted zone, which closes the picker", async () => {
    await mount({ start: "Europe/London" });
    await openIt();
    await search("Kolkata");
    // the first match is highlighted already; Enter chooses it
    await key("Enter");
    expect(chosen).toHaveBeenCalledWith("Asia/Kolkata");
    expect(trigger().textContent).toContain("Asia/Kolkata (UTC+05:30)");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("ArrowDown moves to the next zone", async () => {
    await mount({ start: "Europe/London" });
    await openIt();
    await search("Asia/K");
    const names = optionTexts();
    expect(names.length).toBeGreaterThan(2);
    await key("ArrowDown");
    await key("Enter");
    const picked = chosen.mock.calls[0]![0];
    // the second one of the list, not the first
    expect(names[1]).toContain(picked);
  });

  it("clicking a zone chooses it", async () => {
    await mount({ start: "Europe/London" });
    await openIt();
    await search("Dubai");
    await act(async () => options()[0]!.click());
    expect(chosen).toHaveBeenCalledWith("Asia/Dubai");
  });

  it("the browser's zone is suggested first, under its own heading", async () => {
    await mount({ start: "Pacific/Auckland" });
    await openIt();
    const headings = [...document.querySelectorAll("[cmdk-group-heading]")].map((h) => h.textContent);
    expect(headings[0]).toBe("Detected on this device");
  });

  it("an extra first option comes first, is chosen as an empty value, and is the value in force when value is empty", async () => {
    await mount({ start: "", firstOption: { label: "Your business’s time zone" } });
    expect(trigger().textContent).toContain("Your business’s time zone");
    await openIt();
    expect(optionTexts()[0]).toBe("Your business’s time zone");
    await search("Dubai");
    expect(optionTexts().some((t) => t.includes("Your business"))).toBe(false);
    await key("Enter");
    expect(chosen).toHaveBeenLastCalledWith("Asia/Dubai");
    await openIt();
    await act(async () => options()[0]!.click());
    expect(chosen).toHaveBeenLastCalledWith("");
  });

  it("with no zone chosen and no first option, the trigger says what to do", async () => {
    await mount({ start: "" });
    expect(trigger().textContent).toContain("Choose a time zone");
  });

  it("the zones near the caller come first under their own heading", async () => {
    await mount({ start: "", near: ["Asia/Dubai"] });
    await openIt();
    const headings = [...document.querySelectorAll("[cmdk-group-heading]")].map((h) => h.textContent);
    expect(headings).toContain("Where your business is");
    expect(headings.indexOf("Where your business is")).toBeLessThan(headings.indexOf("All time zones"));
  });

  it("a long list is cut and says so, and a search still reaches the zones that were cut", async () => {
    await mount({ start: "Europe/London" });
    await openIt();
    expect(options().length).toBeLessThan(100);
    expect(document.body.textContent).toMatch(/\d+ more\. Type a city, country or offset/);
    await search("Perth");
    expect(optionTexts().some((t) => t.includes("Australia/Perth"))).toBe(true);
    expect(document.body.textContent).not.toMatch(/more\. Type a city/);
  });

  it("a zone the caller keeps stays an option after the value has moved on", async () => {
    await mount({ start: "Europe/London", keep: "Asia/Calcutta" });
    await openIt();
    expect(optionTexts().some((t) => t.startsWith("Asia/Calcutta"))).toBe(true);
  });
});
