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
    expect(PANEL_BETA.map((i) => i.name)).toEqual(["Google Business Profile", "Peakhour Summit"]);
    expect(PANEL_BETA.every((i) => i.beta)).toBe(true);
    expect(panel).not.toMatch(/Support|Google Ads|LinkedIn Ads|™/);
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
