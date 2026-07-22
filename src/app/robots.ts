import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils";

/**
 * robots.txt — allow the public marketing site, disallow the gated app and
 * auth surfaces (they must never be indexed), and point crawlers at the
 * sitemap. Absolute sitemap URL from SITE.url.
 */
export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/onboarding/", "/auth", "/cms/", "/api/", "/claim/", "/reconnect/"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
