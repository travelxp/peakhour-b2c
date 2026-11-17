import { LOCALE_NAMES } from "@/i18n/config";
import { PAGES, getPage } from "./pages";
import { isPublishable } from "./publish";
import { pathFor } from "./resolve";
import { LOCALES, PUBLISHED_LOCALES, type Locale, type PageRecord } from "./types";

/** One entry of the language switcher. */
export type LanguageOption = {
  locale: Locale;
  /** The language's name in itself. */
  name: string;
  href: string;
  current: boolean;
  /** False when the page has no published equivalent and `href` is its nearest published ancestor (Bible 10, T11). */
  equivalent: boolean;
};

function findPageById(id: string): PageRecord | undefined {
  return PAGES.find((p) => p.pageId === id);
}

function nearestPublishedAncestor(page: PageRecord, locale: Locale): PageRecord | undefined {
  const seen = new Set<string>();
  let cur: PageRecord = page;
  while (cur.parentId && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    // An unknown parentId ends the walk; it must not throw (the Header would 500).
    const parent = findPageById(cur.parentId);
    if (!parent) return undefined;
    cur = parent;
    if (isPublishable(cur, locale)) return cur;
  }
  return undefined;
}

/**
 * The language switcher's options for a page. Empty (the switcher renders nothing) while fewer than two
 * locales are published, which today is always.
 *
 * For each published locale: the page's own equivalent when that variant is publishable; else the nearest
 * published ancestor (parentId chain); else that locale's home page; else the locale is left out, because
 * a link into a locale with nothing to land on would be a 404. `page` undefined (a path that is not a
 * registry page, such as the dashboard) lands on each locale's home page.
 */
export function languageOptions(page: PageRecord | undefined, current: Locale): LanguageOption[] {
  const published = LOCALES.filter((l) => PUBLISHED_LOCALES.includes(l));
  if (published.length < 2) return [];
  const options: LanguageOption[] = [];
  for (const locale of published) {
    let target: PageRecord | undefined;
    let equivalent = true;
    if (page && isPublishable(page, locale)) {
      target = page;
    } else {
      equivalent = false;
      target = page ? nearestPublishedAncestor(page, locale) : undefined;
      if (!target) {
        const home = getPage("home");
        if (isPublishable(home, locale)) target = home;
      }
    }
    if (!target) continue;
    options.push({
      locale,
      name: LOCALE_NAMES[locale],
      href: pathFor(target.pageId, locale),
      current: locale === current,
      equivalent: equivalent || locale === current,
    });
  }
  return options.length > 1 ? options : [];
}
