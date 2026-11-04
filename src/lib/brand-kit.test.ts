import { describe, it, expect } from "vitest";
import type { BrandPrefill, KitView } from "@/lib/api/brand-kit";
import { importSuggestedLogos } from "./brand-kit-import";
import {
  addColor,
  addFont,
  addGuideline,
  addLogo,
  draftFromView,
  draftIsSaved,
  firstFreeLogoForm,
  fontHint,
  VOICE_LIMITS,
  voiceChanges,
  voiceFormFrom,
  voiceFormIsSaved,
  voicePayloadFromForm,
  inheritNote,
  initialSelection,
  kitErrorMessage,
  kitPermissions,
  logoAdWarning,
  mergePrefill,
  normalizeHex,
  payloadFromDraft,
  prefillFailureNotice,
  prefillSummary,
  scopePill,
  toggled,
  voiceIsEmpty,
  voiceSummary,
  type KitDraft,
} from "./brand-kit";

const empty = (): KitDraft => draftFromView(null);
const logo = (id: string, over: Partial<KitDraft["logos"][number]> = {}) => ({ mediaId: id, form: "primary" as const, url: `https://cdn.example/${id}.png`, mimeType: "image/png", name: id, ...over });

const view = (over: Partial<KitView> = {}): KitView => ({
  logos: [],
  colors: [],
  fonts: [],
  guidelines: [],
  from: { logos: "none", colors: "none", fonts: "none", guidelineMediaIds: "none" },
  ...over,
});

const prefill = (over: Partial<BrandPrefill> = {}): BrandPrefill => ({
  websiteUrl: "https://www.acme.example/",
  colors: [
    { hex: "#1f4d3f", role: "primary", source: "theme-color" },
    { hex: "#c8954a", source: "most-used" },
  ],
  logos: [
    { url: "https://cdn.example/brand/acme-logo.svg", source: "img-logo" },
    { url: "https://cdn.example/touch.png", source: "apple-touch-icon" },
    { url: "https://cdn.example/og.jpg", source: "og-image" },
  ],
  fontFamilies: ["Poppins", "Inter"],
  ...over,
});

describe("who may edit which scope", () => {
  it("an owner and an admin may change the organisation's kit and a business's; an editor only the business's", () => {
    expect(kitPermissions("owner")).toMatchObject({ canEditOrg: true, canEditBusiness: true, scopes: ["org", "business"], defaultScope: "org" });
    expect(kitPermissions("admin")).toMatchObject({ canEditOrg: true, scopes: ["org", "business"] });
    expect(kitPermissions("editor")).toMatchObject({ canEditOrg: false, canEditBusiness: true, scopes: ["business"], defaultScope: "business" });
  });

  it("a viewer, an unknown role and no role are read-only", () => {
    for (const r of ["viewer", "intern", "", undefined, null]) {
      expect(kitPermissions(r)).toMatchObject({ canEditOrg: false, canEditBusiness: false, scopes: [], defaultScope: null });
    }
  });

  it("the pill says who the kit is shared with", () => {
    expect(scopePill("org", "Monsoon Tea Co.")).toBe("Shared with every business");
    expect(scopePill("business", "Monsoon Tea Co.")).toBe("Monsoon Tea Co. only");
    expect(scopePill("business", "")).toBe("This business only");
  });
});

describe("the draft and what it saves", () => {
  it("a save carries every section, so a section the person emptied is cleared", () => {
    const saved = draftFromView(view({ colors: [{ hex: "#112233", role: "primary" }], logos: [logo("a")] }));
    const emptied = { ...saved, logos: [] };
    expect(payloadFromDraft(emptied)).toEqual({ logos: [], colors: [{ hex: "#112233", role: "primary" }], fonts: [], guidelineMediaIds: [] });
  });

  it("a save carries ids and roles only, never the urls the page drew from", () => {
    const d = draftFromView(view({ logos: [logo("a", { form: "icon" })], fonts: [{ mediaId: "f", role: "heading", family: "Fraunces", url: "https://x/f.woff2", visibility: "published", mimeType: "font/woff2" }], guidelines: [{ mediaId: "g", name: "Book.pdf", mimeType: "application/pdf", visibility: "private" }] }));
    expect(payloadFromDraft(d)).toEqual({
      logos: [{ mediaId: "a", form: "icon" }],
      colors: [],
      fonts: [{ mediaId: "f", role: "heading", family: "Fraunces" }],
      guidelineMediaIds: ["g"],
    });
  });

  it("the draft is a copy: editing it leaves the saved kit alone", () => {
    const v = view({ colors: [{ hex: "#112233" }] });
    const d = draftFromView(v);
    d.colors[0]!.hex = "#ffffff";
    expect(v.colors[0]!.hex).toBe("#112233");
  });

  it("edited and then edited back is not unsaved", () => {
    const saved = draftFromView(view({ colors: [{ hex: "#112233" }] }));
    const added = addColor(saved, "#445566");
    expect(added.ok && draftIsSaved(added.draft, saved)).toBe(false);
    expect(draftIsSaved(saved, draftFromView(view({ colors: [{ hex: "#112233" }] })))).toBe(true);
  });
});

describe("colours", () => {
  it("accepts a hex with or without the hash, in any case or short form, and stores it as #rrggbb in lower case", () => {
    expect(normalizeHex("1F4D3F")).toBe("#1f4d3f");
    expect(normalizeHex(" #ABC ")).toBe("#aabbcc");
    for (const bad of ["", "#12", "#12345", "#1234567", "red", "#ggg", "rgb(1,2,3)"]) expect(normalizeHex(bad)).toBeUndefined();
  });

  it("refuses a colour already in the kit, in another spelling, and says which", () => {
    const first = addColor(empty(), "#1F4D3F");
    expect(first.ok).toBe(true);
    const again = addColor(first.ok ? first.draft : empty(), "1f4d3f");
    expect(again).toEqual({ ok: false, reason: "#1f4d3f is already in the kit." });
  });

  it("refuses a 25th colour and a non-colour with a reason a person can act on", () => {
    let d = empty();
    for (let i = 0; i < 24; i++) {
      const r = addColor(d, `#${String(i).padStart(6, "0")}`);
      expect(r.ok).toBe(true);
      if (r.ok) d = r.draft;
    }
    expect(addColor(d, "#ffffff")).toEqual({ ok: false, reason: "A kit holds up to 24 colours." });
    expect(addColor(empty(), "teal")).toMatchObject({ ok: false, reason: expect.stringContaining("not a colour") });
  });
});

describe("logos, fonts and guidelines", () => {
  it("a second logo takes the next free form, not a second Primary", () => {
    const one = addLogo(empty(), { mediaId: "a", url: "u", mimeType: "image/png", name: "A" });
    expect(one.ok && one.draft.logos[0]!.form).toBe("primary");
    const two = addLogo(one.ok ? one.draft : empty(), { mediaId: "b", url: "u", mimeType: "image/png", name: "B" });
    expect(two.ok && two.draft.logos.map((l) => l.form)).toEqual(["primary", "icon"]);
    expect(firstFreeLogoForm({ ...empty(), logos: [logo("a"), logo("b", { form: "icon" })] })).toBe("light");
  });

  it("the same file twice is refused, by name", () => {
    const d = { ...empty(), logos: [logo("a", { name: "Monsoon" })] };
    expect(addLogo(d, { mediaId: "a", url: "u", mimeType: "image/png", name: "Monsoon" })).toEqual({ ok: false, reason: "Monsoon is already a logo in this kit." });
  });

  it("fonts take heading, then body, then accent; guidelines are not doubled", () => {
    let d = empty();
    for (const id of ["f1", "f2", "f3"]) {
      const r = addFont(d, { mediaId: id, url: "u", visibility: "published", mimeType: "font/woff2" });
      if (r.ok) d = r.draft;
    }
    expect(d.fonts.map((f) => f.role)).toEqual(["heading", "body", "accent"]);
    expect(addFont(d, { mediaId: "f1", url: "u", visibility: "published", mimeType: "font/woff2" }).ok).toBe(false);
    const g = { mediaId: "g", name: "Brand book.pdf", mimeType: "application/pdf", visibility: "private" };
    const once = addGuideline(empty(), g);
    expect(once.ok && addGuideline(once.draft, g)).toEqual({ ok: false, reason: "Brand book.pdf is already in this kit." });
  });

  it("warns, in words, when no logo is a PNG or JPEG, because Google ads take nothing else", () => {
    expect(logoAdWarning(empty())).toBeNull();
    expect(logoAdWarning({ ...empty(), logos: [logo("a", { mimeType: "image/svg+xml" })] })).toContain("PNG or JPEG");
    expect(logoAdWarning({ ...empty(), logos: [logo("a", { mimeType: "image/svg+xml" }), logo("b", { mimeType: "image/jpeg", form: "icon" })] })).toBeNull();
  });
});

describe("a business section left empty", () => {
  const effective = view({ from: { logos: "org", colors: "business", fonts: "none", guidelineMediaIds: "none" } });

  it("says it follows the organisation's kit, only where it does", () => {
    expect(inheritNote("business", "logos", empty(), effective)).toBe("Following the organisation's kit. Add your own to replace it.");
    expect(inheritNote("business", "fonts", empty(), effective)).toBeNull();
  });

  it("says nothing once the business has its own, or when editing the organisation's kit", () => {
    expect(inheritNote("business", "logos", { ...empty(), logos: [logo("a")] }, effective)).toBeNull();
    expect(inheritNote("org", "logos", empty(), effective)).toBeNull();
  });
});

describe("website pre-fill, reviewed before it touches anything", () => {
  it("starts with every colour and the first two logos ticked, so the person unticks rather than hunts", () => {
    expect(initialSelection(prefill())).toEqual({ colors: ["#1f4d3f", "#c8954a"], logos: ["https://cdn.example/brand/acme-logo.svg", "https://cdn.example/touch.png"] });
    expect(toggled(["a", "b"], "a")).toEqual(["b"]);
    expect(toggled(["a"], "c")).toEqual(["a", "c"]);
  });

  it("adds only what was ticked, and a colour comes with the role the site gave it", () => {
    const p = prefill();
    const sel = { colors: ["#c8954a"], logos: [] };
    const out = mergePrefill(empty(), p, sel, new Map());
    expect(out.colors).toEqual([{ hex: "#c8954a" }]);
    expect(mergePrefill(empty(), p, { colors: ["#1f4d3f"], logos: [] }, new Map()).colors).toEqual([{ hex: "#1f4d3f", role: "primary" }]);
  });

  it("never doubles a colour the kit already has", () => {
    const had = { ...empty(), colors: [{ hex: "#1f4d3f", role: "accent" as const }] };
    const out = mergePrefill(had, prefill(), { colors: ["#1f4d3f", "#c8954a"], logos: [] }, new Map());
    expect(out.colors).toEqual([{ hex: "#1f4d3f", role: "accent" }, { hex: "#c8954a" }]);
  });

  it("a ticked logo goes in only if it was imported into Drive; one that failed is left out, not half added", () => {
    const p = prefill();
    const sel = { colors: [], logos: [p.logos[0]!.url, p.logos[1]!.url] };
    const imported = new Map([[p.logos[1]!.url, { mediaId: "m2", publicUrl: "https://media.example/m2.png", mimeType: "image/png" }]]);
    const out = mergePrefill(empty(), p, sel, imported);
    expect(out.logos).toEqual([{ mediaId: "m2", url: "https://media.example/m2.png", mimeType: "image/png", name: "touch", form: "primary" }]);
  });

  it("takes the logo's type from the api, which sniffed the bytes, never from the address; names it from the file, not the host", () => {
    const p = prefill();
    const sel = { colors: [], logos: p.logos.map((l) => l.url) };
    // The addresses say svg, png and jpg; the bytes were webp, jpeg and png. The api's answer is the one that counts.
    const types = ["image/webp", "image/jpeg", "image/png"];
    const imported = new Map(p.logos.map((l, i) => [l.url, { mediaId: `m${i}`, publicUrl: `https://media.example/m${i}`, mimeType: types[i]! }]));
    const out = mergePrefill(empty(), p, sel, imported);
    expect(out.logos.map((l) => [l.mimeType, l.name, l.form])).toEqual([
      ["image/webp", "acme logo", "primary"],
      ["image/jpeg", "touch", "icon"],
      ["image/png", "og", "light"],
    ]);
  });

  it("a kit whose only logo is WebP is warned about for Google ads, even though its address ends in .png", () => {
    const p = prefill({ logos: [{ url: "https://cdn.example/logo.png", source: "img-logo" }] });
    const imported = new Map([[p.logos[0]!.url, { mediaId: "m", publicUrl: "https://media.example/m", mimeType: "image/webp" }]]);
    const out = mergePrefill(empty(), p, { colors: [], logos: [p.logos[0]!.url] }, imported);
    expect(logoAdWarning(out)).toContain("PNG or JPEG");
  });

  it("says what it found, and says so plainly when it found nothing", () => {
    expect(prefillSummary(prefill())).toBe("We found 2 colours, 3 logos and 2 fonts on acme.example. Keep what looks right.");
    expect(prefillSummary(prefill({ colors: [{ hex: "#112233", source: "most-used" }], logos: [], fontFamilies: [] }))).toBe("We found 1 colour on acme.example. Keep what looks right.");
    expect(prefillSummary(prefill({ colors: [], logos: [], fontFamilies: [] }))).toBe("We could not find a logo, colour or font on acme.example. You can add them yourself.");
  });

  it("turns the site's font names into a hint that asks for the files, since the kit holds files", () => {
    expect(fontHint(prefill())).toBe("Your website uses Poppins and Inter. Add the font files you are licensed to use and ads will match.");
    expect(fontHint(prefill({ fontFamilies: ["Fraunces"] }))).toContain("uses Fraunces.");
    expect(fontHint(prefill({ fontFamilies: [] }))).toBeNull();
    expect(fontHint(null)).toBeNull();
  });

  it("a logo that could not be imported is reported once, with the reason", () => {
    expect(prefillFailureNotice([])).toBeUndefined();
    expect(prefillFailureNotice([{ message: "That image is not one of the logos found on the website." }])).toBe("One logo could not be added: That image is not one of the logos found on the website.");
    expect(prefillFailureNotice([{ message: "Too big." }, { message: "Other" }])).toBe("2 logos could not be added. The first said: Too big.");
  });
});

describe("importing the suggested logos into Drive", () => {
  const ok = (id: string) => async () => ({ mediaId: id, publicUrl: `https://media.example/${id}`, mimeType: "image/png" });

  it("in the organisation's scope each file is shared with every business, because that kit takes shared files only", async () => {
    const shared: string[] = [];
    const r = await importSuggestedLogos(["u1", "u2"], "org", { importLogo: async (u) => ({ mediaId: `m-${u}`, publicUrl: `p-${u}`, mimeType: "image/png" }), share: async (id) => void shared.push(id) });
    expect(shared).toEqual(["m-u1", "m-u2"]);
    expect([...r.imported.keys()]).toEqual(["u1", "u2"]);
    expect(r.failures).toEqual([]);
  });

  it("in one business's scope nothing is shared: the file stays that business's own", async () => {
    const shared: string[] = [];
    await importSuggestedLogos(["u1"], "business", { importLogo: ok("m1"), share: async (id) => void shared.push(id) });
    expect(shared).toEqual([]);
  });

  it("goes one at a time, in order", async () => {
    const order: string[] = [];
    let running = 0;
    let peak = 0;
    await importSuggestedLogos(["a", "b", "c"], "business", {
      importLogo: async (u) => {
        running++;
        peak = Math.max(peak, running);
        order.push(u);
        await Promise.resolve();
        running--;
        return { mediaId: u, publicUrl: u, mimeType: "image/png" };
      },
      share: async () => undefined,
    });
    expect(order).toEqual(["a", "b", "c"]);
    expect(peak).toBe(1);
  });

  it("one that fails is reported with the api's own words and the others are kept", async () => {
    const r = await importSuggestedLogos(["a", "b", "c"], "business", {
      importLogo: async (u) => {
        if (u === "b") throw Object.assign(new Error("This image is already in Drive as a Private file. Publish it there, then pick it as the logo."), { status: 422, code: "LOGO_IS_PRIVATE" });
        return { mediaId: u, publicUrl: u, mimeType: "image/png" };
      },
      share: async () => undefined,
    });
    expect([...r.imported.keys()]).toEqual(["a", "c"]);
    expect(r.failures).toEqual([{ url: "b", message: "This image is already in Drive as a Private file. Publish it there, then pick it as the logo." }]);
  });

  it("a rate limit stops the run: the rest would be refused the same way, what was imported stays, and the logos it never reached count as not added", async () => {
    const calls: string[] = [];
    const r = await importSuggestedLogos(["a", "b", "c"], "business", {
      importLogo: async (u) => {
        calls.push(u);
        if (u === "b") throw Object.assign(new Error("slow down"), { status: 429, code: "RATE_LIMITED" });
        return { mediaId: u, publicUrl: u, mimeType: "image/png" };
      },
      share: async () => undefined,
    });
    expect(calls).toEqual(["a", "b"]);
    expect([...r.imported.keys()]).toEqual(["a"]);
    expect(r.failures.map((f) => f.url)).toEqual(["b", "c"]);
    expect(r.failures[0]!.message).toContain("Wait a few seconds");
    expect(prefillFailureNotice(r.failures)).toMatch(/^2 logos could not be added/);
  });

  it("a file that was imported but could not be shared is not offered to the organisation's kit, which would refuse it", async () => {
    const r = await importSuggestedLogos(["a"], "org", {
      importLogo: ok("m1"),
      share: async () => {
        throw Object.assign(new Error("Only an admin can change who a file is shared with."), { status: 403, code: "FORBIDDEN" });
      },
    });
    expect(r.imported.size).toBe(0);
    expect(r.failures[0]!.message).toBe("Only an admin can change who a file is shared with.");
  });
});

describe("the Voice card", () => {
  it("shows what the Brand Voice holds and is empty when it holds nothing", () => {
    expect(voiceIsEmpty(voiceSummary(null))).toBe(true);
    expect(voiceIsEmpty(voiceSummary({ tone: "  ", vocabulary: [], sampleHeadlines: [] }))).toBe(true);
    const v = voiceSummary({ tone: "Warm and unhurried.", vocabulary: ["estate", "single origin"], avoidTerms: ["cheap"], sampleHeadlines: ["From our hills to your cup"] });
    expect(v).toEqual({ tone: "Warm and unhurried.", uses: ["estate", "single origin"], avoids: ["cheap"], headline: "From our hills to your cup" });
    expect(voiceIsEmpty(v)).toBe(false);
  });
});

describe("errors", () => {
  it("a rate limit reads the same wherever it appears, and the api's plain message is passed through", () => {
    expect(kitErrorMessage({ status: 429, code: "RATE_LIMITED", message: "x" })).toContain("Wait a few seconds");
    expect(kitErrorMessage({ status: 422, code: "NO_WEBSITE", message: "x" })).toContain("no website address");
    expect(kitErrorMessage({ status: 422, code: "MEDIA_NOT_PUBLISHED", message: "A logo must be a Published file." })).toBe("A logo must be a Published file.");
  });

  it("an error that did not come from the api is the browser's words, not ours: the fallback is shown instead", () => {
    expect(kitErrorMessage(new TypeError("Failed to fetch"))).toBe("That did not work. Try again.");
    expect(kitErrorMessage(new Error("Unexpected token < in JSON"), "Nope.")).toBe("Nope.");
    expect(kitErrorMessage(undefined, "Nope.")).toBe("Nope.");
    expect(kitErrorMessage({ status: 500, code: "INTERNAL", message: "  " })).toBe("That did not work. Try again.");
  });
});

describe("editing the Brand Voice", () => {
  const form = (over: Partial<ReturnType<typeof voiceFormFrom>> = {}) => ({ ...voiceFormFrom(null), ...over });

  it("the form shows the whole voice, one entry per line", () => {
    const f = voiceFormFrom({ tone: "Warm", vocabulary: ["a", "b"], avoidTerms: ["c"], sampleHeadlines: ["H, one"] });
    expect(f).toEqual({ tone: "Warm", vocabulary: "a\nb", avoidTerms: "c", sampleHeadlines: "H, one" });
    expect(voiceFormFrom(null)).toEqual({ tone: "", vocabulary: "", avoidTerms: "", sampleHeadlines: "" });
  });

  it("entries split on lines only, are trimmed and de-duplicated; a comma belongs to the entry in every list", () => {
    const r = voicePayloadFromForm(form({ tone: " Plain ", vocabulary: "a\n\n c \na", avoidTerms: "free, guaranteed", sampleHeadlines: "Tea, but better\nSecond" }));
    expect(r).toEqual({ ok: true, payload: { tone: "Plain", vocabulary: ["a", "c"], avoidTerms: ["free, guaranteed"], sampleHeadlines: ["Tea, but better", "Second"] } });
  });

  it("a phrase with a comma survives an edit of something else unchanged", () => {
    const saved = voiceFormFrom({ tone: "Warm", avoidTerms: ["free, guaranteed"] });
    expect(voicePayloadFromForm(saved)).toMatchObject({ ok: true, payload: { avoidTerms: ["free, guaranteed"] } });
    expect(voiceChanges({ ...saved, tone: "Warmer" }, saved)).toEqual({ tone: "Warmer" });
  });

  it("holds the schema's bounds: a tone of 512, words of 128, headlines of 512, 30 of each", () => {
    expect(voicePayloadFromForm(form({ tone: "x".repeat(VOICE_LIMITS.tone) })).ok).toBe(true);
    expect(voicePayloadFromForm(form({ tone: "x".repeat(VOICE_LIMITS.tone + 1) }))).toMatchObject({ ok: false, reason: expect.stringContaining("513") });
    expect(voicePayloadFromForm(form({ vocabulary: "w".repeat(VOICE_LIMITS.word + 1) }))).toMatchObject({ ok: false, reason: expect.stringContaining("Words we use") });
    expect(voicePayloadFromForm(form({ avoidTerms: "w".repeat(VOICE_LIMITS.word) })).ok).toBe(true);
    expect(voicePayloadFromForm(form({ sampleHeadlines: "h".repeat(VOICE_LIMITS.headline + 1) }))).toMatchObject({ ok: false });
    const many = Array.from({ length: VOICE_LIMITS.items + 1 }, (_, i) => `w${i}`).join("\n");
    expect(voicePayloadFromForm(form({ vocabulary: many }))).toMatchObject({ ok: false, reason: expect.stringContaining("31") });
    expect(voicePayloadFromForm(form({ vocabulary: many.split("\n").slice(0, VOICE_LIMITS.items).join("\n") })).ok).toBe(true);
  });

  it("an emptied box is sent empty, so the api clears it", () => {
    expect(voicePayloadFromForm(form())).toEqual({ ok: true, payload: { tone: "", vocabulary: [], avoidTerms: [], sampleHeadlines: [] } });
  });

  it("knows when nothing changed, however the lines were spaced", () => {
    const saved = voiceFormFrom({ tone: "Warm", vocabulary: ["a", "b"] });
    expect(voiceFormIsSaved(saved, saved)).toBe(true);
    expect(voiceFormIsSaved({ ...saved, vocabulary: " a \n\nb\n" }, saved)).toBe(true);
    expect(voiceFormIsSaved({ ...saved, tone: "Warmer" }, saved)).toBe(false);
  });

  it("voiceChanges names only the fields that changed, so a save cannot overwrite what someone else edited", () => {
    const saved = voiceFormFrom({ tone: "Warm", vocabulary: ["a", "b"], avoidTerms: ["x"] });
    expect(voiceChanges(saved, saved)).toEqual({});
    expect(voiceChanges({ ...saved, vocabulary: "a\nb\nc" }, saved)).toEqual({ vocabulary: ["a", "b", "c"] });
    expect(voiceChanges({ ...saved, avoidTerms: "" }, saved)).toEqual({ avoidTerms: [] }); // emptied is a clear, and it is sent
    expect(voiceChanges({ ...saved, tone: "x".repeat(VOICE_LIMITS.tone + 1) }, saved)).toBeUndefined();
  });
});
