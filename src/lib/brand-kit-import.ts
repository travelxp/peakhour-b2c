import type { KitScope } from "@/lib/api/brand-kit";
import { kitErrorMessage } from "@/lib/brand-kit";

/**
 * Bring the ticked logo suggestions into Drive (Peakhour Drive B2). One at a time: the api rate-limits both pre-fill routes, so parallel
 * imports would only trip it. In the ORGANISATION's scope each file is then shared with every business, because that kit can hold shared files
 * only. A rate limit stops the run (the rest would be refused the same way) and the files already imported are kept.
 */
export interface ImportDeps {
  importLogo: (url: string) => Promise<{ mediaId: string; publicUrl: string }>;
  share: (mediaId: string) => Promise<unknown>;
}

export async function importSuggestedLogos(
  urls: readonly string[],
  scope: KitScope,
  deps: ImportDeps,
): Promise<{ imported: Map<string, { mediaId: string; publicUrl: string }>; failures: { url: string; message: string }[] }> {
  const imported = new Map<string, { mediaId: string; publicUrl: string }>();
  const failures: { url: string; message: string }[] = [];
  for (const url of urls) {
    try {
      const file = await deps.importLogo(url);
      if (scope === "org") await deps.share(file.mediaId);
      imported.set(url, { mediaId: file.mediaId, publicUrl: file.publicUrl });
    } catch (err) {
      failures.push({ url, message: kitErrorMessage(err, "The image could not be read.") });
      if ((err as { status?: number } | null)?.status === 429) break;
    }
  }
  return { imported, failures };
}
