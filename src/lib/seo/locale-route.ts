import { LOCALE_ROUTE_BASE, isPublishedLocale, localeFromPrefix } from "@/i18n/config";
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

/** The registry page whose URL in `locale` is exactly `pathname` (percent-decoded), or undefined. */
export function pageAtPath(pathname: string, locale: Locale): PageRecord | undefined {
  const decoded = safeDecode(pathname);
  return decoded === null ? undefined : BY_LOCALE_PATH.get(`${locale}|${decoded}`);
}

/** The percent-decoded path, or null for malformed input (treated as no match, never a throw). A translated slug may be non-ASCII. */
function safeDecode(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
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
 * What the localized route may render, from the request alone: the route param, the locale header the
 * middleware stamped, and the path header it stamped. The route does not trust the rewrite: it re-runs the
 * resolution from the path header and requires the very same locale and a publishable page. English is never
 * served here (its URLs are the ordinary routes), and a forged header on a path that skips the middleware
 * (a dotted path) cannot make a page render, because the path must resolve to a rewrite for this locale.
 */
export function resolveLocalizedRequest(
  localeParam: string,
  localeHeader: string | null,
  pathHeader: string | null,
): { page: PageRecord; locale: Locale } | null {
  if (!isPublishedLocale(localeParam) || localeParam === DEFAULT_LOCALE || localeHeader !== localeParam) return null;
  const route = resolveLocaleRoute(pathHeader ?? "");
  if (route?.kind !== "rewrite" || route.locale !== localeParam) return null;
  return { page: route.page, locale: localeParam };
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
