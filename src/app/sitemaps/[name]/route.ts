import { SITEMAP_NAMES, renderUrlset, sitemapEntries, type SitemapName } from "@/lib/seo/sitemap";

export const dynamic = "force-dynamic";

/** /sitemaps/<name>.xml: one named sitemap of the index. An unknown name is a 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name: file } = await params;
  const name = file.replace(/\.xml$/, "") as SitemapName;
  if (!file.endsWith(".xml") || !SITEMAP_NAMES.includes(name)) return new Response("Not found", { status: 404 });
  return new Response(renderUrlset(await sitemapEntries(name)), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
