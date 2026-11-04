import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PEAKS_ACTIONS } from "./peaks";

/**
 * C7: the cost of a charged task is shown before the click. The content image button asks for its price, shows it beside the buttons
 * and sends the receipt back; a refusal before the task starts (too few credits, already running) is shown in the api's words.
 */
describe("the content image price is shown before the click", () => {
  const page = readFileSync(fileURLToPath(new URL("../../app/(site)/dashboard/strategist/[id]/page.tsx", import.meta.url)), "utf8");

  it("names the api's registered action", () => {
    expect(PEAKS_ACTIONS.generateImage).toBe("content.generate_image");
  });

  it("asks for the price for the image buttons, shows it, and sends the receipt on the generate call", () => {
    expect(page).toContain("usePeaksQuote(PEAKS_ACTIONS.generateImage");
    expect(page).toContain("<PriceLine price={price} />");
    expect(page).toContain("quoteTokenFor(price).quoteToken");
    expect(page).toMatch(/placeholders\/\$\{index\}\/generate`, \{\}, quoteToken \? \{ "x-peaks-quote": quoteToken \} : undefined\)/);
  });

  it("shows a refusal before the task started, and a failed generation says nothing was charged", () => {
    expect(page).toContain("chargedTaskRefusal(err.code, err.message)");
    expect(page).toContain("Image generation failed. You were not charged.");
  });
});
