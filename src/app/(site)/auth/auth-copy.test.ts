import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PANEL_BETA, PANEL_LIVE } from "./auth-copy";

// SEO-7 took "Five modules" off every public surface because Support is not live (plan Q3). DL-2 redrew the sign-in panel on
// Daylight and with it dropped the made-up console ("3 leads in inbox", "Support: Inbox clear") and the module count.
describe("/auth sign-in panel", () => {
  const files = ["auth-flow.tsx"].map((f) => readFileSync(path.join(__dirname, f), "utf8"));
  const panel = [...PANEL_LIVE, ...PANEL_BETA].map((i) => `${i.name} ${i.line}`).join("\n");

  it("does not promise five modules, a lead inbox, a live Support, or free modules", () => {
    for (const src of [...files, panel]) {
      expect(src).not.toMatch(/Five modules|5 modules|modules?, one login/i);
      expect(src).not.toMatch(/leads in inbox|Inbox clear|conversations resolved/i);
      expect(src).not.toMatch(/Free trial of every module|every module free/i);
    }
  });

  it("names only what is live as live, and says beta where it is beta", () => {
    expect(PANEL_LIVE.every((i) => !i.beta)).toBe(true);
    expect(PANEL_BETA.map((i) => i.name)).toEqual(["Get found on Google", "Grow with Peakhour Summit"]);
    expect(PANEL_BETA.every((i) => i.beta)).toBe(true);
    expect(panel).not.toMatch(/Support|Google Ads|LinkedIn Ads|™/);
  });

  // Owner, 2026-11-16: the sign-in door spoke as a Shopify app ("Shopify assistant" as the first card). It is generic now:
  // one card per area of the business, each an outcome; a channel is named only inside a line that is about it.
  it("is generic: no card is named after a channel, and the panel does not open on Shopify", () => {
    const names = [...PANEL_LIVE, ...PANEL_BETA].map((i) => i.name);
    expect(names).toEqual(["Sell", "Publish", "Get found on Google", "Grow with Peakhour Summit"]);
    for (const n of names) expect(n).not.toMatch(/Shopify|WooCommerce|WordPress|WhatsApp/);
    expect(PANEL_LIVE[0].line).not.toMatch(/^.{0,20}Shopify/);
    expect(files[0]).toMatch(/Your AI team behind <span className="daylight-mark">every channel<\/span> you sell on\./);
    expect(files[0]).not.toMatch(/Your shoppers, answered/);
  });

  it("states no number and no price", () => {
    expect(panel).not.toMatch(/\d/);
    expect(panel).not.toMatch(/[₹£$€]/);
  });

  it("is not the old gold-and-serif look", () => {
    for (const src of files) {
      expect(src).not.toMatch(/font-serif|italic|text-brand-gradient|bg-ink|text-on-ink/);
    }
  });
});

describe("/auth ticks follow the signup door", () => {
  it("a gated door says the trial starts on approval; an open door says it starts now; no trial, no trial tick", async () => {
    const { signupTicks } = await import("./auth-copy");
    expect(signupTicks(14, true, "waitlist_only")).toEqual(["14-day free trial once approved · No credit card", "We’ll email your link"]);
    expect(signupTicks(14, false, "open")).toEqual(["14-day free trial · No credit card", "Live the same day"]);
    expect(signupTicks(null, true, "waitlist_only")).toEqual(["We’ll email your link"]);
  });
});

describe("/auth ticks fail closed", () => {
  it("an unreadable signup mode shows no trial tick", async () => {
    const { signupTicks } = await import("./auth-copy");
    expect(signupTicks(14, true, undefined)).toEqual(["We’ll email your link"]);
    expect(signupTicks(14, true, null)).toEqual(["We’ll email your link"]);
  });
});
