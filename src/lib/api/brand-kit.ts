import { api } from "@/lib/api";

/**
 * Brand Kit client (Peakhour Drive B2), over /v1/brand-kit.
 *
 * The api resolves a kit per section: a business's own logos, colours, fonts or guidelines replace the organisation's, one section at a time.
 * GET returns three views of it: `effective` (what every generator sees), `org` (the organisation's kit on its own, null if it has none) and
 * `business` (this business's override on its own, null if it has none). The editor reads the view for the scope it is editing.
 */

export type LogoForm = "primary" | "icon" | "wordmark" | "stacked" | "light" | "dark" | "monochrome";
export type ColorRole = "primary" | "secondary" | "accent" | "neutral" | "background" | "text";
export type FontRole = "heading" | "body" | "accent";
export type KitSection = "logos" | "colors" | "fonts" | "guidelineMediaIds";
export type KitScope = "org" | "business";

export interface KitLogo {
  mediaId: string;
  form: LogoForm;
  url: string;
  mimeType: string;
  name: string;
}
export interface KitColor {
  hex: string;
  role?: ColorRole;
  name?: string;
}
export interface KitFont {
  mediaId: string;
  role: FontRole;
  family?: string;
  url: string;
  mimeType: string;
}
export interface KitGuideline {
  mediaId: string;
  name: string;
  mimeType: string;
  visibility: string;
  /** Present only for a Published file; a Private guideline opens through a signed link. */
  url?: string;
}

export interface KitView {
  logos: KitLogo[];
  colors: KitColor[];
  fonts: KitFont[];
  guidelines: KitGuideline[];
  from: Record<KitSection, "business" | "org" | "none">;
}

export interface KitVoice {
  tone?: string;
  vocabulary?: string[];
  avoidTerms?: string[];
  sampleHeadlines?: string[];
}

export interface BrandKitResponse {
  effective: KitView;
  org: KitView | null;
  business: KitView | null;
  voice: KitVoice | null;
  websiteUrl: string | null;
}

/** What a PUT carries: every section, an empty list clearing its section. */
export interface KitPayload {
  logos: { mediaId: string; form: LogoForm }[];
  colors: { hex: string; role?: ColorRole; name?: string }[];
  fonts: { mediaId: string; role: FontRole; family?: string }[];
  guidelineMediaIds: string[];
}

export interface PrefillColor {
  hex: string;
  role?: ColorRole;
  source: "theme-color" | "css-variable" | "most-used";
}
export interface PrefillLogo {
  url: string;
  source: "img-logo" | "apple-touch-icon" | "icon" | "og-image";
}
export interface BrandPrefill {
  websiteUrl: string;
  colors: PrefillColor[];
  logos: PrefillLogo[];
  /** Google Fonts families the page loads: a name only, no file. */
  fontFamilies: string[];
}

export const BRAND_KIT_QUERY_KEY = ["brand-kit"] as const;

export function getBrandKit(): Promise<BrandKitResponse> {
  return api.get<BrandKitResponse>("/v1/brand-kit");
}

export function saveBrandKit(scope: KitScope, payload: KitPayload): Promise<{ effective: KitView }> {
  return api.put<{ effective: KitView }>(scope === "org" ? "/v1/brand-kit/org" : "/v1/brand-kit/business", payload);
}

/** Drop this business's own kit: it follows the organisation's again. */
export function removeBusinessKit(): Promise<{ removed: boolean }> {
  return api.delete<{ removed: boolean }>("/v1/brand-kit/business");
}

/** Read the business's website for colours, logos and fonts. Writes nothing. */
export function prefillBrandKit(): Promise<BrandPrefill> {
  return api.post<BrandPrefill>("/v1/brand-kit/prefill", {});
}

/** A suggested logo once it is a Drive file. `mimeType` is the sniffed type of the bytes (png, jpeg or webp). */
export interface ImportedLogo {
  mediaId: string;
  publicUrl: string;
  mimeType: string;
  deduped: boolean;
}

/** Take one suggested logo into Drive as a Published image. */
export function importPrefillLogo(url: string): Promise<ImportedLogo> {
  return api.post<ImportedLogo>("/v1/brand-kit/prefill/logo", { url });
}

/** A Drive file a kit may hold, as the Files list returns it. */
export interface KitFileCandidate {
  id: string;
  name: string;
  kind: "image" | "video" | "document" | "font";
  visibility: "published" | "private";
  /** No business owns it: every business in the organisation can use it. */
  shared: boolean;
  mimeType: string;
  publicUrl?: string;
  sizeBytes: number;
}

export async function listKitFileCandidates(params: { kind: "image" | "font" | "document"; q?: string; page?: number }): Promise<{ items: KitFileCandidate[]; hasMore: boolean }> {
  const qs: Record<string, string> = { kind: params.kind, limit: "60", sort: "newest", page: String(params.page ?? 1) };
  if (params.q?.trim()) qs.q = params.q.trim();
  // A kit logo must be Published (an ad needs a public link) and a font must be too, or the resolver drops it. Guidelines may be either.
  if (params.kind !== "document") qs.visibility = "published";
  const { data, meta } = await api.getWithMeta<KitFileCandidate[]>("/v1/media", qs);
  return { items: data ?? [], hasMore: meta.hasMore === true };
}

/** Share a file with every business in the organisation (admin only): the organisation's kit may hold only shared files. */
export function shareFileWithOrganisation(mediaId: string): Promise<unknown> {
  return api.patch(`/v1/media/${mediaId}`, { shared: true });
}

/** A link that opens a file: its public URL, or a short-lived signed one for a Private file. */
export function getFileLink(mediaId: string): Promise<{ url: string; signed: boolean }> {
  return api.get<{ url: string; signed: boolean }>(`/v1/media/${mediaId}/url`);
}
