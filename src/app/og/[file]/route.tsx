import { PAGES } from "@/lib/seo/pages";
import { eyebrowFor, ogTitleFor } from "@/lib/seo/og-text";
import { ogCard } from "@/lib/seo/og-card";

/**
 * /og/<pageId>.png: a registry page's share image, its H1 and family eyebrow on the Daylight card. An id the
 * registry does not know is a 404, so the route cannot be used to print arbitrary text.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = file.replace(/\.png$/, "");
  const page = file.endsWith(".png") ? PAGES.find((p) => p.pageId === id) : undefined;
  if (!page) return new Response("Not found", { status: 404 });
  return ogCard({ eyebrow: eyebrowFor(page), title: ogTitleFor(page) });
}
