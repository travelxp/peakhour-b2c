import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Translate } from "@/i18n/types";
import { languageOptions, type LanguageOption } from "@/lib/seo/language-options";
import type { Locale, PageRecord } from "@/lib/seo/types";

const chip = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold";

/**
 * The language switcher (Daylight chips). Renders NOTHING while fewer than two locales are published, which
 * is today: English is the only finished language, so the header keeps its static English chip.
 *
 * Plain links, no client code. A language whose page has no published equivalent links to the nearest
 * published ancestor and says so in visible text (Bible 10, T11); it never links to a 404 and never to the
 * English page under another language's name. `hrefLang` and `lang` mark each link for assistive tech.
 */
export async function LanguageSwitcher({ page, locale }: { page: PageRecord | undefined; locale: Locale }) {
  const options = languageOptions(page, locale);
  if (options.length === 0) return null;
  return <LanguageSwitcherView options={options} t={await getTranslations("LanguageSwitcher")} />;
}

/** Sync and prop-driven, so tests render it with a fixture. */
export function LanguageSwitcherView({ options, t }: { options: LanguageOption[]; t: Translate }) {
  if (options.length === 0) return null;
  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-wrap items-center gap-2">
        {options.map((o) => (
          <li key={o.locale}>
            {o.current ? (
              <span lang={o.locale} aria-current="true" className={`${chip} bg-muted text-foreground`}>
                {o.name}
              </span>
            ) : (
              <Link
                href={o.href}
                hrefLang={o.locale}
                lang={o.locale}
                prefetch={false}
                className={`${chip} text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              >
                {o.name}
                {!o.equivalent && <span className="font-normal">({t("sectionOnly")})</span>}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
