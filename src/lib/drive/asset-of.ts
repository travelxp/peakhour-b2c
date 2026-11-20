import type { MediaAsset } from "@/components/composer/types";
import { getFileLink, type DriveFile } from "@/lib/drive/files";

/**
 * What the screen receives for a chosen file. A Published file's `url` is its public one. A Private file's is a SIGNED link that expires
 * (`linkExpiresInSeconds` says when), fetched now; null when the link could not be made, so the caller never gets a file with no way to read it.
 */
export async function assetOf(f: DriveFile, requirePublicUrl: boolean, needUrl = true): Promise<MediaAsset | null> {
  let url = f.publicUrl;
  let expires: number | undefined;
  if (f.visibility === "private") {
    if (requirePublicUrl) return null;
    if (!needUrl) {
      // The screen sends the file by id: no link is fetched, so a slow or failing link route cannot block it.
      url = "";
    } else {
      try {
        const link = await getFileLink(f.id);
        url = link.url;
        expires = link.expiresInSeconds ?? undefined;
      } catch {
        return null;
      }
    }
  }
  if (url === undefined || (url === "" && needUrl)) return null;
  return {
    id: f.id,
    url,
    mime: f.mimeType,
    width: f.width,
    height: f.height,
    bytes: f.sizeBytes,
    alt: f.altText,
    name: f.name,
    visibility: f.visibility,
    ...(expires !== undefined ? { linkExpiresInSeconds: expires } : {}),
    source: f.source === "ai_generated" ? (f.kind === "video" ? "ai_video" : "ai_image") : "upload",
    createdAt: f.createdAt,
  };
}
