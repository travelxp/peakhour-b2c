// @vitest-environment jsdom
/**
 * MR-G5: the "Billed in USD" label. Neutral, derived from the row's own figure (it never claims a conversion that did not
 * happen), absent with no plan currency, and its tooltip opens on keyboard focus.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { BilledInLabel, billedInTip } from "./billed-in-label";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Radix sizes the tooltip with a ResizeObserver, which jsdom lacks.
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

let root: Root | undefined;
let host: HTMLElement | undefined;
const show = (node: React.ReactElement) => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
};
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe("billedInTip", () => {
  it("a converted channel says it is shown in the plan currency, and that no budget moves", () => {
    expect(billedInTip({ billedIn: "USD", planCurrency: "INR", money: { value: 10, currency: "INR" }, surface: "channel" })).toBe("Shown in INR at today's rate. Peakhour does not move budget between currencies.");
  });
  it("a campaign says its budget stays in its own currency", () => {
    expect(billedInTip({ billedIn: "USD", planCurrency: "INR", money: { value: 10, currency: "INR" }, surface: "campaign" })).toBe(
      "Spend is shown in INR at today's rate; budgets are in USD. Peakhour does not move budget between currencies.",
    );
  });
  it("no rate says it cannot convert, and a partial figure says what is not counted", () => {
    expect(billedInTip({ billedIn: "USD", planCurrency: "INR", money: { absent: "no_exchange_rate" }, surface: "channel" })).toContain("no exchange rate for USD");
    expect(billedInTip({ billedIn: "USD", planCurrency: "INR", money: { value: 5, currency: "INR", leftOut: ["USD"] }, surface: "channel" })).toContain("in USD, is not counted yet");
  });
  it("Rules shows no spend, so it never says it was converted there", () => {
    const tip = billedInTip({ billedIn: "USD", planCurrency: "INR", surface: "rules" })!;
    expect(tip).toContain("on the Channels page where Peakhour has an exchange rate");
    expect(tip).not.toContain("Shown in");
  });
  it("no plan currency: nothing, never 'Shown in  at today's rate'", () => {
    expect(billedInTip({ billedIn: "USD", planCurrency: "", money: { value: 1, currency: "" }, surface: "channel" })).toBeUndefined();
  });
});

describe("BilledInLabel", () => {
  it("renders nothing with no plan currency or nothing to say", () => {
    expect(show(<BilledInLabel billedIn="USD" planCurrency="" />).innerHTML).toBe("");
    expect(show(<BilledInLabel planCurrency="INR" />).innerHTML).toBe("");
  });

  it("says 'Can't convert USD yet' when the row's spend is absent for want of a rate", () => {
    const h = show(<BilledInLabel billedIn="usd" planCurrency="INR" money={{ absent: "no_exchange_rate" }} />);
    expect(h.textContent).toContain("Can't convert USD yet");
    expect(h.textContent).not.toContain("Billed in");
  });

  it("a campaign with no recorded currency says so instead of claiming a conversion", () => {
    const h = show(<BilledInLabel planCurrency="INR" currencyNotRecorded />);
    expect(h.textContent).toContain("Currency not recorded");
  });

  it("the tooltip is a focusable button that opens on keyboard focus and reads once", async () => {
    const h = show(<BilledInLabel billedIn="USD" planCurrency="INR" money={{ value: 10, currency: "INR" }} />);
    const trigger = h.querySelector("button")!;
    expect(trigger.textContent).toBe("Billed in USD");
    expect(document.body.textContent).not.toContain("does not move budget");
    await act(async () => {
      trigger.focus();
    });
    const text = document.body.textContent ?? "";
    expect(text).toContain("Shown in INR at today's rate. Peakhour does not move budget between currencies.");
    // visible copy only: no title attribute and no second sr-only copy beside the badge
    expect(trigger.getAttribute("title")).toBeNull();
    expect(h.querySelector(".sr-only")).toBeNull();
  });
});
