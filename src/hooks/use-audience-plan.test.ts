import { describe, expect, it } from "vitest";
import { chargedTaskRefusal } from "./use-audience-plan";

/**
 * C7: a charged task that did not start says so in the api's words. Both refusals happen before the model is called, so the
 * merchant is told nothing was charged (the api's sentence does), and the title says what happened.
 */
describe("chargedTaskRefusal", () => {
  it("too few credits: the title says it, and the api's sentence (price, what is left, what to do) is the description", () => {
    const msg = "This takes 175 AI credits and you have 40 left. Nothing was started and nothing was charged. Add AI credits, or wait for your allowance to reset.";
    expect(chargedTaskRefusal("CREDITS_EXHAUSTED", msg)).toEqual({ title: "You don't have enough AI credits for this.", description: msg });
  });
  it("a double press: the title says it is already running, and that it is charged once", () => {
    expect(chargedTaskRefusal("ACT_ALREADY_RUNNING", undefined)).toEqual({ title: "This is already running.", description: "Wait for it to finish. You will be charged once." });
  });
  it("a refusal with no message still tells the merchant nothing was charged", () => {
    expect(chargedTaskRefusal("CREDITS_EXHAUSTED", "")?.description).toMatch(/nothing was charged/i);
  });
  it("any other code is not ours (the PASS case: the generic handlers still get it)", () => {
    for (const code of ["RATE_LIMITED", "NOT_CONNECTED", "QUOTE_NOT_HONOURED", undefined]) expect(chargedTaskRefusal(code, "x")).toBeUndefined();
  });
});
