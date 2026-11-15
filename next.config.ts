import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { NOINDEX_HEADER, isIndexableDeployment } from "./src/lib/seo/indexable";

export const nextConfig: NextConfig = {
  poweredByHeader: false,
  // No images.remotePatterns, on purpose: merchant media is never sent through the Next image optimiser. See
  // src/components/shared/media-image.tsx for why (four regional Drive domains, expiring signed URLs, per-image billing).
  // A Drive share link's token is its credential and sits in the /share/<token> URL: never send it on as a Referer, from the page or
  // from anything the page loads. (The page also sets <meta name="referrer">; this is the header, which covers every response.)
  async headers() {
    return [
      { source: "/share/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      // Off Production, noindex on EVERY path. The middleware sets it too, but its matcher skips dotted
      // paths (/robots.txt, /sitemap.xml, any file), and for a file a header is the only way to say noindex.
      // Evaluated at build, where VERCEL_ENV is the deployment's own.
      ...(isIndexableDeployment()
        ? []
        : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: NOINDEX_HEADER }] }]),
    ];
  },
};

// next-intl request pipeline (English-only today; see src/i18n/request.ts).
// Enables next-intl/server APIs (getLocale/getTranslations/getMessages) so
// marketing strings can be migrated to messages/ incrementally.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
