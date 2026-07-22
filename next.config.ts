import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

// next-intl request pipeline (English-only today; see src/i18n/request.ts).
// Enables next-intl/server APIs (getLocale/getTranslations/getMessages) so
// marketing strings can be migrated to messages/ incrementally.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
