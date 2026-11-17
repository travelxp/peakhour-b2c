import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublicCatalog, signupCta } from "@/lib/catalog";
import { marketingTrialDays } from "@/lib/pricing";
import { HeaderNav, type HeaderCta, type HeaderLabels } from "@/components/shared/header-nav";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { PATH_HEADER } from "@/i18n/config";
import type { Translate } from "@/i18n/types";
import { SITE } from "@/lib/utils";
import { languageOptions } from "@/lib/seo/language-options";
import { pageForPublicPath } from "@/lib/seo/locale-route";
import type { Locale, PageRecord } from "@/lib/seo/types";

/** The header's strings from the message catalog (namespaces Nav and Common). Pure, so a test builds them without a request. */
export function headerLabels(nav: Translate, common: Translate): HeaderLabels {
  return {
    homeAria: common("homeAria", { name: SITE.name }),
    primaryAria: nav("primaryAria"),
    navLinks: {
      commerce: nav("commerce"),
      content: nav("content"),
      growth: nav("growth"),
      support: nav("support"),
      presence: nav("presence"),
      peaks: nav("peaks"),
      pricing: nav("pricing"),
    },
    signIn: nav("signIn"),
    signOut: nav("signOut"),
    dashboard: nav("dashboard"),
    settings: nav("settings"),
    userMenu: nav("userMenu"),
    openMenu: nav("openMenu"),
    closeMenu: nav("closeMenu"),
    languageChip: common("languageChip"),
    languageChipShort: common("languageChipShort"),
    languageMore: common("languageMore"),
    languageTooltip: common("languageTooltip"),
  };
}

/**
 * On a Shopify page whose hero says "Install on Shopify", the header says it too: a visitor who reads one action in the
 * hero and a different one in the header does not know which is the door. Every other page keeps the platform's own
 * signup CTA (open, waitlist, invite). Pure, so a test needs no request.
 */
export function headerCtaForPage(page: Pick<PageRecord, "scope" | "primaryCta"> | undefined, platformCta: HeaderCta): HeaderCta {
  if (page?.scope === "shopify" && page.primaryCta.kind === "install") {
    return { label: page.primaryCta.label, href: page.primaryCta.href };
  }
  return platformCta;
}

/**
 * Site header (server wrapper). Resolves the signup CTA from the live platform
 * stage so the header's primary button tracks the launch state — "Start free trial"
 * when signups are open and the catalog gives a trial ("Get started" when it
 * gives none, `trialCtaLabel`), "Join the waitlist" / "Request an invite" pre-launch,
 * and hidden when closed — instead of always inviting signups. The interactive
 * shell (nav, mobile menu, user menu) lives in the client `HeaderNav`.
 *
 * Its strings come from messages/<locale>.json here, on the server, and are passed to the client shell as
 * plain props. The LanguageSwitcher renders in place of the static English chip once a second locale is
 * published (it returns null until then, so the chip stays).
 *
 * @param minimal Renders only the brand lockup (no nav, no CTA) — used on the
 *   legal pages. Skips the catalog fetch since nothing reads the CTA there.
 */
export async function Header({ minimal = false }: { minimal?: boolean } = {}) {
  const [nav, common] = await Promise.all([getTranslations("Nav"), getTranslations("Common")]);
  const labels = headerLabels(nav, common);
  // Legal pages show no CTA — don't pay for the catalog fetch.
  if (minimal) return <HeaderNav minimal cta={{ label: nav("getStarted"), href: "/auth" }} labels={labels} />;
  const [catalog, trialDays] = await Promise.all([getPublicCatalog(), marketingTrialDays()]);
  const platformCta = signupCta(catalog?.platform?.signupMode ?? "open", trialDays);

  const locale = (await getLocale()) as Locale;
  const found = pageForPublicPath((await headers()).get(PATH_HEADER) ?? "");
  const cta = headerCtaForPage(found?.page, platformCta);
  // Null (so the static English chip stays) until a second locale is published.
  const options = languageOptions(found?.page, locale);
  const languageSwitcher = options.length > 0 ? <LanguageSwitcher options={options} /> : null;
  return <HeaderNav minimal={false} cta={cta} labels={labels} languageSwitcher={languageSwitcher} />;
}
