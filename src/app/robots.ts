import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils";
import { isIndexableDeployment } from "@/lib/seo/indexable";

// Read per request, not at build: whether this deployment is indexable is a
// property of the deployment's environment, and a static file would freeze
// whatever the build saw.
export const dynamic = "force-dynamic";

/**
 * robots.txt. On a deployment that is not Production (dev, previews, a local
 * build) it is "Disallow: /" for every agent, with no sitemap line: nothing
 * there is meant to be found. On Production it allows the public marketing site,
 * disallows the gated app and auth surfaces (they must never be indexed), and
 * points crawlers at the sitemap. Absolute URLs from SITE.url, the one origin.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexableDeployment()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
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
