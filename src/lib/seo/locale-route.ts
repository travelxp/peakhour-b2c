import { LOCALE_ROUTE_BASE, localeFromPrefix } from "@/i18n/config";
import { PAGES } from "./pages";
import { isPublishable } from "./publish";
import { DEFAULT_LOCALE, type Locale, type PageRecord } from "./types";

/*
 * Locale routing for the public marketing pages (SEO-4).
 *
 * English is unprefixed and is not routed here at all: every current URL is served by the route it always
 * was. A path whose first segment is a non-English locale prefix in lowercase ("/fr-ca/shopify") is answered
 * by the middleware, after the coming-soon gate, with one of two things:
 *
 *   - a rewrite to the internal localized route (LOCALE_ROUTE_BASE), only when the page's variant in that
 *     locale is publishable (lib/seo/publish.ts: locale published, variant published, page published, claims
 *     satisfied);
 *   - otherwise a real 404 (the middleware rewrites to /gate-404, which calls notFound()).
 *
 * There is no detection: no Accept-Language, no cookie, no redirect between languages (Bible 10). A prefix
 * is reserved even when nothing is published, so "/fr/x" is never read as a CMS page slug.
 *
 * Imported by the middleware, so it must stay free of Node-only modules.
 */

export type LocaleRoute =
  | { kind: "rewrite"; locale: Locale; page: PageRecord; target: string }
  | { kind: "not-found"; locale: Locale };

/** The registry page whose URL in `locale` is exactly `pathname`, or undefined. */
/**
 * Keyed by `${locale}|${path}`, built once. A non-English URL is matched ONLY against a page that declares
 * an explicit variant for that locale, so a page with no variant can never shadow a translated slug.
 */
const BY_LOCALE_PATH = new Map<string, PageRecord>();
for (const p of PAGES) {
  if (!BY_LOCALE_PATH.has(`${DEFAULT_LOCALE}|${p.path}`)) BY_LOCALE_PATH.set(`${DEFAULT_LOCALE}|${p.path}`, p);
  for (const [locale, variant] of Object.entries(p.locales ?? {})) {
    if (variant && !BY_LOCALE_PATH.has(`${locale}|${variant.path}`)) BY_LOCALE_PATH.set(`${locale}|${variant.path}`, p);
  }
}

export function pageAtPath(pathname: string, locale: Locale): PageRecord | undefined {
  return BY_LOCALE_PATH.get(`${locale}|${pathname}`);
}

/**
 * What the middleware does with `pathname`, or null when it is not a locale path (English, the app, anything
 * whose first segment is not a non-English locale prefix, in any letter case).
 */
export function resolveLocaleRoute(pathname: string): LocaleRoute | null {
  const [, first = "", ...rest] = pathname.split("/");
  const locale = localeFromPrefix(first);
  if (!locale) return null;
  const page = pageAtPath(pathname, locale);
  if (!page || !isPublishable(page, locale)) return { kind: "not-found", locale };
  const tail = rest.length ? `/${rest.join("/")}` : "";
  return { kind: "rewrite", locale, page, target: `${LOCALE_ROUTE_BASE}/${locale}${tail}` };
}

/**
 * The registry page (and its locale) behind a public URL as the visitor typed it, published or not:
 * the language switcher's starting point. Undefined for a path that is not a registry page.
 */
export function pageForPublicPath(pathname: string): { page: PageRecord; locale: Locale } | undefined {
  const [, first = ""] = pathname.split("/");
  const locale = localeFromPrefix(first) ?? DEFAULT_LOCALE;
  const page = pageAtPath(pathname, locale);
  return page ? { page, locale } : undefined;
}
