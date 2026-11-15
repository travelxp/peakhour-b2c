import { DEFAULT_LOCALE, LOCALES, type Locale } from "./types";
import { getPage } from "./pages";

/**
 * The only builder of marketing URLs (plan section 3). English is unprefixed; every other
 * locale gets a lowercase prefix ("/fr-ca/shopify"). A non-English variant that states its
 * own path wins, so a translated slug can differ from the English one.
 *
 * Throws on an unknown pageId or locale: a link to a page that does not exist is a bug to
 * find at build time, not a 404 to find in production.
 */
export function pathFor(pageId: string, locale: Locale = DEFAULT_LOCALE): string {
  const page = getPage(pageId);
  if (!LOCALES.includes(locale)) throw new Error(`Unknown locale "${locale}"`);
  if (locale === DEFAULT_LOCALE) return page.path;
  const variant = page.locales?.[locale as Exclude<Locale, "en">];
  if (variant) return variant.path;
  const prefix = `/${locale.toLowerCase()}`;
  return page.path === "/" ? prefix : `${prefix}${page.path}`;
}
