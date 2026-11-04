import type { ImportedLogo, KitScope } from "@/lib/api/brand-kit";
import { kitErrorMessage } from "@/lib/brand-kit";

/**
 * Bring the ticked logo suggestions into Drive (Peakhour Drive B2). One at a time: the api rate-limits both pre-fill routes, so parallel
 * imports would only trip it. In the ORGANISATION's scope each file is then shared with every business, because that kit can hold shared files
 * only. A rate limit stops the run, because the rest would be refused the same way: files already imported are kept, and every logo the run
 * did not reach is reported as a failure too, so "2 logos could not be added" never reads as "1".
 */
export interface ImportDeps {
  importLogo: (url: string) => Promise<Pick<ImportedLogo, "mediaId" | "publicUrl" | "mimeType">>;
  share: (mediaId: string) => Promise<unknown>;
}

export type ImportedFile = Pick<ImportedLogo, "mediaId" | "publicUrl" | "mimeType">;

export async function importSuggestedLogos(
  urls: readonly string[],
  scope: KitScope,
  deps: ImportDeps,
): Promise<{ imported: Map<string, ImportedFile>; failures: { url: string; message: string }[] }> {
  const imported = new Map<string, ImportedFile>();
  const failures: { url: string; message: string }[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    try {
      const file = await deps.importLogo(url);
      if (scope === "org") await deps.share(file.mediaId);
      imported.set(url, { mediaId: file.mediaId, publicUrl: file.publicUrl, mimeType: file.mimeType });
    } catch (err) {
      const message = kitErrorMessage(err, "The image could not be read.");
      failures.push({ url, message });
      if ((err as { status?: number } | null)?.status === 429) {
        for (const rest of urls.slice(i + 1)) failures.push({ url: rest, message });
        break;
      }
    }
  }
  return { imported, failures };
}
