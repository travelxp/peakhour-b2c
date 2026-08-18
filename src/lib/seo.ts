import type { Metadata } from "next";
import { SITE } from "@/lib/utils";

/**
 * Build per-page metadata with a canonical URL + OpenGraph + Twitter card from
 * a title/description/path. Paths are relative; metadataBase (set on the root
 * layout) resolves them to absolute URLs. Keeps every marketing page's SEO
 * consistent without repeating the OG/twitter/alternates block per route.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      // Next replaces (not deep-merges) openGraph per page, so siteName must be
      // repeated here or og:site_name is dropped on every page using this.
      siteName: SITE.name,
      title,
      description,
      url: path,
      locale: "en",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
