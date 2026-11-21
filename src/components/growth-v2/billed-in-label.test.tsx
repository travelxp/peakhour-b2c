// @vitest-environment jsdom
/**
 * MR-G5: the "Billed in USD" label. Neutral, derived from the row's own figure (it never claims a conversion that did not
 * happen), absent with no plan currency, and its note opens on tap/Enter (a toggletip) and closes on Escape.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { BilledInLabel, billedInLabelOf } from "./billed-in-label";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Radix positions the note with a ResizeObserver, which jsdom lacks.
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

const tipOf = (a: Parameters<typeof billedInLabelOf>[0]) => billedInLabelOf(a)?.tip;
const NO_MOVE = "Peakhour does not move budget between currencies.";

describe("billedInLabelOf", () => {
  it("a converted channel says it is shown in the plan currency, and that no budget moves", () => {
    expect(tipOf({ billedIn: "USD", planCurrency: "INR", money: { value: 10, currency: "INR" } })).toBe(`Shown in INR at today's rate. ${NO_MOVE}`);
  });
  it("a campaign says its budget stays in its own currency", () => {
    expect(tipOf({ billedIn: "USD", planCurrency: "INR", money: { value: 10, currency: "INR" }, surface: "campaign" })).toBe(`Spend is shown in INR at today's rate; budgets are in USD. ${NO_MOVE}`);
  });
  it("no rate says it cannot convert; a partial figure says what is not counted", () => {
    expect(billedInLabelOf({ billedIn: "USD", planCurrency: "INR", money: { absent: "no_exchange_rate" } })!.text).toBe("Can't convert USD yet");
    expect(tipOf({ billedIn: "USD", planCurrency: "INR", money: { value: 5, currency: "INR", leftOut: ["USD"] } })).toContain("in USD, is not counted yet");
  });
  it("a conversion is claimed ONLY for a value: any other absence, or no figure, just says what it is billed in", () => {
    expect(tipOf({ billedIn: "USD", planCurrency: "INR", money: { absent: "spend_unreadable" } })).toBe(`Billed in USD. ${NO_MOVE}`);
    expect(tipOf({ billedIn: "USD", planCurrency: "INR" })).toBe(`Billed in USD. ${NO_MOVE}`);
  });
  it("Rules shows no spend, so it never says it was converted there", () => {
    const tip = tipOf({ billedIn: "USD", planCurrency: "INR", surface: "rules" })!;
    expect(tip).toContain("on the Channels page where Peakhour has an exchange rate");
    expect(tip).not.toContain("Shown in");
  });
  it("no plan currency: no label, never 'Shown in  at today's rate'", () => {
    expect(billedInLabelOf({ billedIn: "USD", planCurrency: "", money: { value: 1, currency: "" } })).toBeNull();
    expect(billedInLabelOf({ planCurrency: "INR" })).toBeNull();
  });
  it("one normaliser: the text and the note use the same trimmed upper-case code", () => {
    const l = billedInLabelOf({ billedIn: " usd ", planCurrency: " inr", money: { value: 1, currency: "INR" } })!;
    expect(l.text).toBe("Billed in USD");
    expect(l.tip).toContain("Shown in INR");
  });
  it("both billedIn and an unrecorded currency: the note says some of it is counted as is", () => {
    expect(tipOf({ billedIn: "USD", planCurrency: "INR", money: { value: 1, currency: "INR" }, currencyNotRecorded: true })).toContain("Some of it has no recorded currency and is counted as is.");
  });
  it("an unreadable campaign read is said, not dropped", () => {
    expect(billedInLabelOf({ planCurrency: "INR", unreadable: true })!.text).toBe("Billing currency unavailable");
  });
});

describe("BilledInLabel", () => {
  it("renders nothing with no plan currency or nothing to say", () => {
    expect(show(<BilledInLabel billedIn="USD" planCurrency="" />).innerHTML).toBe("");
    expect(show(<BilledInLabel planCurrency="INR" />).innerHTML).toBe("");
  });

  it("a campaign with no recorded currency says so instead of claiming a conversion", () => {
    expect(show(<BilledInLabel planCurrency="INR" currencyNotRecorded />).textContent).toContain("Currency not recorded");
  });

  it("the note is readable without hover: it opens on click (tap), and closes on Escape", async () => {
    const h = show(<BilledInLabel billedIn="USD" planCurrency="INR" money={{ value: 10, currency: "INR" }} />);
    const trigger = h.querySelector("button")!;
    expect(trigger.textContent).toBe("Billed in USD");
    expect(document.body.textContent).not.toContain("does not move budget");
    await act(async () => {
      trigger.click();
    });
    expect(document.body.textContent).toContain(`Shown in INR at today's rate. ${NO_MOVE}`);
    expect(trigger.getAttribute("title")).toBeNull();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.body.textContent).not.toContain("does not move budget");
  });
});
