import type {
  BrandPrefill,
  ColorRole,
  FontRole,
  KitColor,
  KitFont,
  KitGuideline,
  KitLogo,
  KitPayload,
  KitScope,
  KitSection,
  KitView,
  LogoForm,
} from "@/lib/api/brand-kit";

/**
 * Brand Kit page logic (Peakhour Drive B2): who may edit which scope, the editable draft and what it saves, and how a website pre-fill is
 * reviewed before it touches the draft. No React and no network here, so every rule is testable on its own.
 */

// ── Words ─────────────────────────────────────────────────────────────────────

/** The order a new logo takes the first free form in: the main mark first, then the ones an ad wants next. */
export const LOGO_FORMS: readonly { form: LogoForm; label: string }[] = [
  { form: "primary", label: "Primary" },
  { form: "icon", label: "Icon" },
  { form: "light", label: "For light backgrounds" },
  { form: "dark", label: "For dark backgrounds" },
  { form: "wordmark", label: "Wordmark" },
  { form: "stacked", label: "Stacked" },
  { form: "monochrome", label: "One colour" },
];

export const COLOR_ROLES: readonly { role: ColorRole; label: string }[] = [
  { role: "primary", label: "Primary" },
  { role: "secondary", label: "Secondary" },
  { role: "accent", label: "Accent" },
  { role: "neutral", label: "Neutral" },
  { role: "background", label: "Background" },
  { role: "text", label: "Text" },
];

export const FONT_ROLES: readonly { role: FontRole; label: string }[] = [
  { role: "heading", label: "Headings" },
  { role: "body", label: "Body text" },
  { role: "accent", label: "Accent" },
];

export const MAX_COLORS = 24;
export const MAX_LOGOS = 30;
export const MAX_FONTS = 12;
export const MAX_GUIDELINES = 20;

export const logoFormLabel = (form: LogoForm): string => LOGO_FORMS.find((f) => f.form === form)?.label ?? form;
export const colorRoleLabel = (role: ColorRole): string => COLOR_ROLES.find((r) => r.role === role)?.label ?? role;
export const fontRoleLabel = (role: FontRole): string => FONT_ROLES.find((r) => r.role === role)?.label ?? role;

// ── Who may edit what ─────────────────────────────────────────────────────────

export interface KitPermissions {
  /** The organisation's kit changes every business in it: admin and owner. */
  canEditOrg: boolean;
  /** One business's own kit: editor and above. */
  canEditBusiness: boolean;
  /** The scopes this person may switch between, in the order shown. */
  scopes: KitScope[];
  /** The scope the page opens on: a person who can change the organisation's kit starts there, as the mock-up's "Shared with every business". */
  defaultScope: KitScope | null;
}

/** Mirrors the api: PUT /org is admin+, PUT /business is editor+. Anything else, including an unknown role, is read-only. */
export function kitPermissions(role: string | null | undefined): KitPermissions {
  const canEditOrg = role === "owner" || role === "admin";
  const canEditBusiness = canEditOrg || role === "editor";
  const scopes: KitScope[] = [...(canEditOrg ? (["org"] as const) : []), ...(canEditBusiness ? (["business"] as const) : [])];
  return { canEditOrg, canEditBusiness, scopes, defaultScope: scopes[0] ?? null };
}

export function scopeLabel(scope: KitScope, businessName: string): string {
  return scope === "org" ? "Every business" : businessName ? `Just ${businessName}` : "Just this business";
}

/** The pill beside the page's first line. */
export function scopePill(scope: KitScope, businessName: string): string {
  return scope === "org" ? "Shared with every business" : businessName ? `${businessName} only` : "This business only";
}

// ── The draft ─────────────────────────────────────────────────────────────────

export interface KitDraft {
  logos: KitLogo[];
  colors: KitColor[];
  fonts: KitFont[];
  guidelines: KitGuideline[];
}

/** The editable copy of one scope's kit. A scope with no kit yet is an empty draft. */
export function draftFromView(view: KitView | null | undefined): KitDraft {
  if (!view) return { logos: [], colors: [], fonts: [], guidelines: [] };
  return {
    logos: view.logos.map((l) => ({ ...l })),
    colors: view.colors.map((c) => ({ ...c })),
    fonts: view.fonts.map((f) => ({ ...f })),
    guidelines: view.guidelines.map((g) => ({ ...g })),
  };
}

/** What a save sends: every section, so a section the person emptied is cleared and not left behind. */
export function payloadFromDraft(d: KitDraft): KitPayload {
  return {
    logos: d.logos.map((l) => ({ mediaId: l.mediaId, form: l.form })),
    colors: d.colors.map((c) => ({ hex: c.hex, ...(c.role ? { role: c.role } : {}), ...(c.name ? { name: c.name } : {}) })),
    fonts: d.fonts.map((f) => ({ mediaId: f.mediaId, role: f.role, ...(f.family ? { family: f.family } : {}) })),
    guidelineMediaIds: d.guidelines.map((g) => g.mediaId),
  };
}

/** True when saving would change nothing: the person has not edited, or edited back. */
export function draftIsSaved(draft: KitDraft, saved: KitDraft): boolean {
  return JSON.stringify(payloadFromDraft(draft)) === JSON.stringify(payloadFromDraft(saved));
}

export function draftIsEmpty(d: KitDraft): boolean {
  return d.logos.length + d.colors.length + d.fonts.length + d.guidelines.length === 0;
}

/** "#abc", "ABC" and "#AABBCC" all become "#aabbcc"; anything else is not a colour. */
export function normalizeHex(input: string): string | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return undefined;
  const h = m[1]!.toLowerCase();
  return "#" + (h.length === 3 ? [...h].map((c) => c + c).join("") : h);
}

export type AddResult<T> = { ok: true; draft: T } | { ok: false; reason: string };

export function addColor(draft: KitDraft, input: string, role?: ColorRole): AddResult<KitDraft> {
  const hex = normalizeHex(input);
  if (!hex) return { ok: false, reason: "That is not a colour. Use six letters and numbers, like #1f4d3f." };
  if (draft.colors.some((c) => c.hex === hex)) return { ok: false, reason: `${hex} is already in the kit.` };
  if (draft.colors.length >= MAX_COLORS) return { ok: false, reason: `A kit holds up to ${MAX_COLORS} colours.` };
  return { ok: true, draft: { ...draft, colors: [...draft.colors, { hex, ...(role ? { role } : {}) }] } };
}

/** The first form no logo has yet, so a second logo does not silently become a second "Primary". Falls back to the last form. */
export function firstFreeLogoForm(draft: KitDraft): LogoForm {
  const taken = new Set(draft.logos.map((l) => l.form));
  return (LOGO_FORMS.find((f) => !taken.has(f.form)) ?? LOGO_FORMS[LOGO_FORMS.length - 1]!).form;
}

export function addLogo(draft: KitDraft, logo: Omit<KitLogo, "form"> & { form?: LogoForm }): AddResult<KitDraft> {
  if (draft.logos.length >= MAX_LOGOS) return { ok: false, reason: `A kit holds up to ${MAX_LOGOS} logos.` };
  if (draft.logos.some((l) => l.mediaId === logo.mediaId)) return { ok: false, reason: `${logo.name || "That file"} is already a logo in this kit.` };
  return { ok: true, draft: { ...draft, logos: [...draft.logos, { ...logo, form: logo.form ?? firstFreeLogoForm(draft) }] } };
}

export function addFont(draft: KitDraft, font: Omit<KitFont, "role"> & { role?: FontRole }): AddResult<KitDraft> {
  if (draft.fonts.length >= MAX_FONTS) return { ok: false, reason: `A kit holds up to ${MAX_FONTS} fonts.` };
  if (draft.fonts.some((f) => f.mediaId === font.mediaId)) return { ok: false, reason: "That font is already in this kit." };
  const taken = new Set(draft.fonts.map((f) => f.role));
  const role = font.role ?? FONT_ROLES.find((r) => !taken.has(r.role))?.role ?? "accent";
  return { ok: true, draft: { ...draft, fonts: [...draft.fonts, { ...font, role }] } };
}

export function addGuideline(draft: KitDraft, g: KitGuideline): AddResult<KitDraft> {
  if (draft.guidelines.length >= MAX_GUIDELINES) return { ok: false, reason: `A kit holds up to ${MAX_GUIDELINES} guideline files.` };
  if (draft.guidelines.some((x) => x.mediaId === g.mediaId)) return { ok: false, reason: `${g.name} is already in this kit.` };
  return { ok: true, draft: { ...draft, guidelines: [...draft.guidelines, g] } };
}

export function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

/** Google Performance Max takes PNG and JPEG logos only. Said before the person finds it out from a refused campaign. */
export function logoAdWarning(draft: KitDraft): string | null {
  if (draft.logos.length === 0) return null;
  const raster = draft.logos.some((l) => l.mimeType === "image/png" || l.mimeType === "image/jpeg");
  return raster ? null : "Google ads take a PNG or JPEG logo, and every logo here is another format. Add a PNG version to run Google ads.";
}

// ── What a scope shows when it is empty ───────────────────────────────────────

export type SectionKey = "logos" | "colors" | "fonts" | "guidelines";
const SECTION_OF: Record<SectionKey, KitSection> = { logos: "logos", colors: "colors", fonts: "fonts", guidelines: "guidelineMediaIds" };

/**
 * Where a section's content comes from, in words, for the scope being edited. A business section left empty follows the organisation's kit
 * (the api resolves per section); the editor says so, instead of showing an empty box that reads as "nothing".
 */
export function inheritNote(scope: KitScope, section: SectionKey, draft: KitDraft, effective: KitView | null): string | null {
  if (scope !== "business" || draft[section].length > 0 || !effective) return null;
  return effective.from[SECTION_OF[section]] === "org" ? "Following the organisation's kit. Add your own to replace it." : null;
}

// ── Website pre-fill, reviewed before it touches anything ─────────────────────

export interface PrefillSelection {
  colors: string[];
  logos: string[];
}

/** Colours start ticked and the first two logos too: the person unticks what is wrong, and nothing is added until they confirm. */
export function initialSelection(p: BrandPrefill): PrefillSelection {
  return { colors: p.colors.map((c) => c.hex), logos: p.logos.slice(0, 2).map((l) => l.url) };
}

export function toggled(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function selectionCount(s: PrefillSelection): number {
  return s.colors.length + s.logos.length;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function prefillSummary(p: BrandPrefill): string {
  const host = hostOf(p.websiteUrl);
  const parts = [
    p.colors.length ? `${p.colors.length} ${p.colors.length === 1 ? "colour" : "colours"}` : "",
    p.logos.length ? `${p.logos.length} ${p.logos.length === 1 ? "logo" : "logos"}` : "",
    p.fontFamilies.length ? `${p.fontFamilies.length} ${p.fontFamilies.length === 1 ? "font" : "fonts"}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return `We could not find a logo, colour or font on ${host}. You can add them yourself.`;
  return `We found ${parts.join(", ").replace(/, ([^,]*)$/, " and $1")} on ${host}. Keep what looks right.`;
}

/** The words shown for a suggested colour, from where it was found. */
export function colorSourceLabel(source: BrandPrefill["colors"][number]["source"]): string {
  return source === "theme-color" ? "Your site's theme colour" : source === "css-variable" ? "A named brand colour" : "Used a lot on your site";
}

export function logoSourceLabel(source: BrandPrefill["logos"][number]["source"]): string {
  return source === "img-logo" ? "Your site's logo" : source === "apple-touch-icon" ? "Home-screen icon" : source === "icon" ? "Browser tab icon" : "Share image";
}

function nameFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(last).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_]+/g, " ").trim() || hostOf(url);
  } catch {
    return hostOf(url);
  }
}

/**
 * Fold the ticked suggestions into a draft. A colour already in the kit is skipped, never doubled. A logo goes in only if it was imported
 * (`imported` maps a suggested URL to the Drive file the api made of it), so a logo whose import failed is left out, not half added.
 */
export function mergePrefill(
  draft: KitDraft,
  p: BrandPrefill,
  selection: PrefillSelection,
  imported: ReadonlyMap<string, { mediaId: string; publicUrl: string; mimeType: string }>,
): KitDraft {
  let next = draft;
  for (const c of p.colors) {
    if (!selection.colors.includes(c.hex)) continue;
    const r = addColor(next, c.hex, c.role);
    if (r.ok) next = r.draft;
  }
  for (const l of p.logos) {
    if (!selection.logos.includes(l.url)) continue;
    const file = imported.get(l.url);
    if (!file) continue;
    // The type is the api's own (it sniffed the bytes), never a guess from the address: a guess of "png" would hide the Google-ads warning.
    const r = addLogo(next, { mediaId: file.mediaId, url: file.publicUrl, mimeType: file.mimeType, name: nameFromUrl(l.url) });
    if (r.ok) next = r.draft;
  }
  return next;
}

/** Fonts the site loads, as a plain hint: the kit holds font files, not family names. */
export function fontHint(p: BrandPrefill | null | undefined): string | null {
  if (!p || p.fontFamilies.length === 0) return null;
  const f = p.fontFamilies;
  const names = f.length === 1 ? f[0]! : `${f.slice(0, -1).join(", ")} and ${f[f.length - 1]}`;
  return `Your website uses ${names}. Add the font files you are licensed to use and ads will match.`;
}

// ── Voice ─────────────────────────────────────────────────────────────────────

export interface VoiceLines {
  tone: string | null;
  uses: string[];
  avoids: string[];
  headline: string | null;
}

/** The Voice card shows what the Brand Voice already holds; the kit keeps no copy of it. */
export function voiceSummary(v: { tone?: string; vocabulary?: string[]; avoidTerms?: string[]; sampleHeadlines?: string[] } | null | undefined): VoiceLines {
  return {
    tone: v?.tone?.trim() || null,
    uses: (v?.vocabulary ?? []).slice(0, 8),
    avoids: (v?.avoidTerms ?? []).slice(0, 8),
    headline: v?.sampleHeadlines?.[0]?.trim() || null,
  };
}

export function voiceIsEmpty(v: VoiceLines): boolean {
  return !v.tone && v.uses.length === 0 && v.avoids.length === 0 && !v.headline;
}

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * The api's messages are plain English and safe to show; a rate limit gets a line of ours so it reads the same wherever it appears. Only an
 * error that came from the api (it has a string `code` and a numeric `status`, as `ApiError` does) is quoted: "Failed to fetch" and
 * "Unexpected token <" are the browser's words, not ours, and get the fallback.
 */
export function kitErrorMessage(err: unknown, fallback = "That did not work. Try again."): string {
  const e = err as { status?: unknown; code?: unknown; message?: unknown } | null;
  const fromApi = typeof e?.code === "string" && typeof e?.status === "number";
  if (fromApi && e?.status === 429) return "That is a lot of website reads in a short time. Wait a few seconds and try again.";
  if (fromApi && e?.code === "NO_WEBSITE") return "This business has no website address on file, so there is nothing to read.";
  if (fromApi && typeof e?.message === "string" && e.message.trim()) return e.message;
  return fallback;
}

/** A file size for a list row. Kept here, not borrowed from the Drive page's helpers, so the kit does not move when that page does. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`;
}

/** One line for logos that could not be brought in, so a half-finished pre-fill says what is missing and why. */
export function prefillFailureNotice(failures: readonly { message: string }[]): string | undefined {
  if (failures.length === 0) return undefined;
  const first = failures[0]!.message.replace(/[.\s]+$/, "");
  return failures.length === 1 ? `One logo could not be added: ${first}.` : `${failures.length} logos could not be added. The first said: ${first}.`;
}
