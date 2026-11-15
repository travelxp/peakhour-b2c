import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { LOCALE_HEADER, defaultLocale, isLocale, type AppLocale } from "./config";

/**
 * i18n request config. English is the default and every English URL is unprefixed. A non-English page
 * reaches here only through the middleware's rewrite (middleware.ts + lib/seo/locale-route.ts), which
 * stamps LOCALE_HEADER after the page's variant passed the publish gate. There is NO detection: no
 * Accept-Language, no cookie (Bible 10). A request without the header is English.
 *
 * messages/<locale>.json must exist for a locale that is published; a missing file throws rather than
 * falling back to English (a non-English URL never shows English by accident).
 */
export default getRequestConfig(async () => {
  const raw = (await headers()).get(LOCALE_HEADER);
  const locale: AppLocale = isLocale(raw) ? raw : defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
