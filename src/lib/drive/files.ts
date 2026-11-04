import { api } from "@/lib/api";

/**
 * What the Drive picker reads of a file (row D7). The shape is `GET /v1/media`'s; only the fields the picker uses are named here, so the
 * Drive page's own types can grow without touching the picker.
 *
 * `channelFit` is written by the background describer (api row D5b): per channel, the worse of the channel's hard limits (size, shape,
 * length, format; plain code) and a model's reading of the content. A file the describer has not reached has none, and the picker says so
 * rather than guessing a verdict.
 */
export type DriveKind = "image" | "video" | "document" | "font";
export type FitVerdict = "good" | "possible" | "poor";

export interface ChannelFitEntry {
  channel: string;
  fit: FitVerdict;
  reason?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  kind: DriveKind;
  mimeType: string;
  visibility: "published" | "private";
  /** Shared with every business in the organisation (no business of its own). */
  shared?: boolean;
  /** Absent on a Private file: it has no public link. */
  publicUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  source: string;
  createdAt: string;
  channelFit?: ChannelFitEntry[];
  /** Where the background describer is with this file. Only "pending" and "describing" mean a verdict may still arrive. */
  describeState?: string;
}

export interface DriveListParams {
  q?: string;
  kind?: DriveKind;
  page: number;
  limit?: number;
}

export interface DriveListPage {
  items: DriveFile[];
  hasMore: boolean;
  page: number;
}

export const PICKER_PAGE_SIZE = 60;

export async function listDriveFiles(params: DriveListParams): Promise<DriveListPage> {
  const qs: Record<string, string> = { status: "active", page: String(params.page), limit: String(params.limit ?? PICKER_PAGE_SIZE) };
  if (params.q?.trim()) qs.q = params.q.trim();
  if (params.kind) qs.kind = params.kind;
  const { data, meta } = await api.getWithMeta<DriveFile[]>("/v1/media", qs);
  return { items: data ?? [], hasMore: Boolean((meta as { hasMore?: boolean }).hasMore), page: params.page };
}

export interface SignedLink {
  url: string;
  /** null = a published file's own stable URL. */
  expiresInSeconds: number | null;
  signed: boolean;
}

/** The link to read one file now. A Private file's is signed and short-lived; a Published file's is its own public URL. */
export function getFileLink(id: string): Promise<SignedLink> {
  return api.get<SignedLink>(`/v1/media/${encodeURIComponent(id)}/url`);
}
