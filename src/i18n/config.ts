import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/seo/types";

/**
 * Locale configuration. The locale list itself lives in lib/seo/types.ts (LOCALES, PUBLISHED_LOCALES,
 * DEFAULT_LOCALE), the one place the SEO registry, the publish gate, the sitemap and this module read.
 * Declared is not published: a locale renders only while PUBLISHED_LOCALES lists it AND a page's variant
 * is published (lib/seo/publish.ts). Adding a language end to end: docs/seo/LOCALIZATION.md.
 *
 * Kept free of next-intl and of getRequestConfig so the middleware can import it.
 */
export const locales = LOCALES;
export const defaultLocale = DEFAULT_LOCALE;
export type AppLocale = Locale;

/**
 * Request headers the middleware stamps (and strips from every inbound request first, so a caller
 * cannot send them). i18n/request.ts reads the locale one; the localized route checks it matches the
 * URL it was rewritten from.
 */
export const LOCALE_HEADER = "x-ph-locale";
/** The URL path the visitor asked for, before any rewrite: the language switcher finds the page from it. */
export const PATH_HEADER = "x-ph-path";

/**
 * The internal route every non-English page is rewritten to (src/app/(site)/ph-locale/[locale]/[[...path]]).
 * It is never a public URL: the page 404s unless the middleware put the matching locale header on the request.
 */
export const LOCALE_ROUTE_BASE = "/ph-locale";

/** Each language's name in itself. Endonyms are the same in every UI language, so they are not messages. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "fr-CA": "Français (Canada)",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  "es-ES": "Español (España)",
  "pt-BR": "Português (Brasil)",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The URL prefix of a non-English locale: lowercase ("fr-ca"). English has none. */
export function prefixOf(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "" : `/${locale.toLowerCase()}`;
}

/** The non-English locale a first path segment names, exactly as written in lowercase; else null. */
export function localeFromPrefix(segment: string): Locale | null {
  return LOCALES.find((l) => l !== DEFAULT_LOCALE && l.toLowerCase() === segment) ?? null;
}
