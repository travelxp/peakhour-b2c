import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAPABILITIES } from "@/lib/seo/capabilities";
import { PANEL_BETA, PANEL_HEADLINE, PANEL_LIVE } from "./auth-copy";

// SEO-7 took "Five modules" off every public surface because Support is not live (plan Q3). DL-2 redrew the sign-in panel on
// Daylight and with it dropped the made-up console ("3 leads in inbox", "Support: Inbox clear") and the module count.
describe("/auth sign-in panel", () => {
  const files = ["auth-flow.tsx"].map((f) => readFileSync(path.join(__dirname, f), "utf8"));
  const headline = `${PANEL_HEADLINE.lead}${PANEL_HEADLINE.mark}${PANEL_HEADLINE.tail}`;
  // Every visible word of the panel, headline included, so each guard below covers all of it.
  const panel = [headline, ...[...PANEL_LIVE, ...PANEL_BETA].map((i) => `${i.name} ${i.line}`)].join("\n");
  const card = (name: string) => {
    const found = [...PANEL_LIVE, ...PANEL_BETA].find((i) => i.name === name);
    expect(found, `no panel card named "${name}" (renamed? move its limit check with it)`).toBeDefined();
    return found!;
  };

  it("does not promise five modules, a lead inbox, a live Support, or free modules", () => {
    for (const src of [...files, panel]) {
      expect(src).not.toMatch(/Five modules|5 modules|modules?, one login/i);
      expect(src).not.toMatch(/leads in inbox|Inbox clear|conversations resolved/i);
      expect(src).not.toMatch(/Free trial of every module|every module free/i);
    }
  });

  it("names only what is live as live, and says beta where it is beta", () => {
    expect(PANEL_LIVE.every((i) => !i.beta)).toBe(true);
    expect(PANEL_BETA.map((i) => i.name)).toEqual(["Get found", "Grow"]);
    expect(PANEL_BETA.every((i) => i.beta)).toBe(true);
    expect(panel).not.toMatch(/Support|Google Ads|LinkedIn Ads|™/);
  });

  // Owner, 2026-11-16: the sign-in door spoke as a Shopify app ("Shopify assistant" as the first card). It is generic now:
  // the headline says what Peakhour does (only what is live), no card is named after a channel or network, and the panel
  // does not open on a store platform.
  it("is generic: no channel or network in the headline or any card name, and it does not open on Shopify", () => {
    const CHANNEL = /Shopify|WooCommerce|WordPress|WhatsApp|Amazon|Google|LinkedIn|Facebook|Instagram|\bX\b/;
    expect(headline).not.toMatch(CHANNEL);
    expect(headline).not.toMatch(/every channel|get found|grow/i); // "every channel" is not met; find and grow are beta
    for (const i of [...PANEL_LIVE, ...PANEL_BETA]) expect(i.name, i.name).not.toMatch(CHANNEL);
    expect(PANEL_LIVE[0].line).not.toMatch(/Shopify/);
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

  it("keeps the approved limits the review of #815 caught being widened", () => {
    expect(card("Confirm orders").line).toMatch(/Asks shoppers .* to confirm or cancel/);
    expect(card("Get found").line).toMatch(/until an admin on your team approves it/);
    expect(card("Grow").line).toMatch(/growth proposals/);
    expect(card("Grow").line).toMatch(/only recommends/);
    expect(card("Publish").line).toMatch(/posts approved content/); // not "what you approve": auto-approve exists
    // One card per claim pair it shortens: "Sell" no longer joins the store assistant to the WhatsApp checkout link.
    expect(card("Sell").claims).toEqual(["commerce.ai_shopping_assistant.answers_from_catalogue"]);
  });

  it("makes no blanket promise under the cards (none is true of every card)", () => {
    expect(files[0]).not.toMatch(/PANEL_PROMISE|You approve what goes out|You choose what waits/);
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
