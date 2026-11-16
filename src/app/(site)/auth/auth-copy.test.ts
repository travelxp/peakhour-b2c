import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAPABILITIES } from "@/lib/seo/capabilities";
import { PANEL_BETA, PANEL_HEADLINE, PANEL_LIVE, PANEL_PROMISE } from "./auth-copy";

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
  // the headline says what Peakhour does, and no card is named after a channel.
  it("is generic: the headline and every card name are free of channel names", () => {
    const CHANNEL = /Shopify|WooCommerce|WordPress|WhatsApp|Amazon/;
    const headline = `${PANEL_HEADLINE.lead}${PANEL_HEADLINE.mark}${PANEL_HEADLINE.tail}`;
    expect(headline).not.toMatch(CHANNEL);
    expect(headline).not.toMatch(/every channel/i); // not a claim the live product meets (WooCommerce is not live)
    for (const i of [...PANEL_LIVE, ...PANEL_BETA]) expect(i.name, i.name).not.toMatch(CHANNEL);
    expect(files[0]).not.toMatch(/Your shoppers, answered/);
  });

  // ★Every line shortens an approved claim and names it. The claim must exist, and its status must hold: a live card needs a
  // live claim, a beta card a beta-or-live one. Wording is reviewed by hand (shortened, never widened); this pins the link.
  it("ties every card to approved claims that exist and whose status holds", () => {
    const approved = new Map(CAPABILITIES.flatMap((c) => c.approvedClaims.map((a) => [a.id, a.requires] as const)));
    for (const item of PANEL_LIVE) {
      expect(item.claims.length, item.name).toBeGreaterThan(0);
      for (const id of item.claims) expect(approved.get(id), `${item.name}: ${id}`).toBe("live");
    }
    for (const item of PANEL_BETA) {
      expect(item.claims.length, item.name).toBeGreaterThan(0);
      for (const id of item.claims) expect(["live", "beta"], `${item.name}: ${id}`).toContain(approved.get(id));
    }
  });

  it("keeps the approved limits the review caught being widened", () => {
    const line = (name: string) => [...PANEL_LIVE, ...PANEL_BETA].find((i) => i.name === name)!.line;
    expect(line("Confirm orders")).toMatch(/Asks shoppers .* to confirm or cancel/);
    expect(line("Get found on Google")).toMatch(/until an admin on your team approves it/);
    expect(line("Grow with Peakhour Summit")).toMatch(/growth proposals/);
    expect(line("Grow with Peakhour Summit")).toMatch(/only recommends/);
    expect(PANEL_PROMISE).not.toMatch(/You approve what goes out/); // the assistant answers shoppers on its own
  });

  it("shows the promise line on phones as well as beside the form", () => {
    expect(files[0].match(/\{PANEL_PROMISE\}/g)?.length).toBe(2);
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
