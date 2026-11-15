import { PAGES } from "@/lib/seo/pages";
import { isPreviewable, isPublishable } from "@/lib/seo/publish";
import { eyebrowFor, ogTitleFor } from "@/lib/seo/og-text";
import { ogCard } from "@/lib/seo/og-card";

/**
 * /og/<pageId>.png: a registry page's share image, its H1 and family eyebrow on the Daylight card. An id the
 * registry does not know, or that is neither published nor a dev draft, is a 404, so the route cannot be used to print arbitrary text.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = file.replace(/\.png$/, "");
  const page = file.endsWith(".png") ? PAGES.find((p) => p.pageId === id) : undefined;
  // Only a page that exists in public (publishable) or that dev shows as a draft: an unreleased page's title is not leaked.
  if (!page || !(isPublishable(page) || isPreviewable(page))) return new Response("Not found", { status: 404 });
  return ogCard({ eyebrow: eyebrowFor(page), title: ogTitleFor(page) });
}
