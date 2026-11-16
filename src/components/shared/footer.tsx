import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SITE } from "@/lib/utils";
import { findPageByPath } from "@/lib/seo/pages";
import { isPublishable } from "@/lib/seo/publish";
import { cardLabel } from "@/lib/seo/labels";
import type { Translate } from "@/i18n/types";
import { PeakhourLogo } from "@/components/shared/peakhour-logo";

// Grouped footer nav. A link is either a registry page (shown only while isPublishable, so a draft never appears, and
// labelled with the registry's short name) or a fixed public route with a message key (messages/<locale>.json, namespace Footer).
type Item = { path: string; key: string } | { path: string; page: true } | { text: string };
const FOOTER_GROUPS: readonly { heading: string; items: readonly Item[] }[] = [
  {
    heading: "platform",
    items: [
      { path: "/commerce", key: "commerce" },
      { path: "/content", key: "content" },
      { path: "/growth", key: "growth" },
      { path: "/support", key: "support" },
      { path: "/presence", key: "presence" },
      { path: "/features", key: "features" },
      { path: "/features/peakhour-summit", key: "summit" },
    ],
  },
  {
    heading: "shopify",
    items: [
      { path: "/shopify", key: "shopify" },
      { path: "/shopify/features", key: "allFeatures" },
      { path: "/shopify/features/ai-shopping-assistant", page: true },
      { path: "/shopify/features/whatsapp-cod-confirmation", page: true },
      { path: "/shopify/features/product-recommendations", page: true },
      { path: "/shopify/features/ai-seo", page: true },
      // Only while the directory is publishable: footerGroups drops a registry page that is not.
      { path: "/shopify/compare", page: true },
    ],
  },
  {
    heading: "integrations",
    items: [
      { path: "/integrations", key: "allIntegrations" },
      { path: "/integrations/whatsapp", page: true },
      { path: "/integrations/meta-ads", page: true },
      { path: "/integrations/instagram", page: true },
      { path: "/integrations/linkedin", page: true },
      { path: "/integrations/google-business-profile", page: true },
      { text: "wordpress" },
    ],
  },
  {
    heading: "product",
    items: [
      { path: "/pricing", key: "pricing" },
      { path: "/peaks", key: "peaks" },
      { path: "/how-it-works", key: "howItWorks" },
      { path: "/about", key: "about" },
      { path: "/contact", key: "contact" },
    ],
  },
  {
    heading: "legal",
    items: [
      { path: "/privacy-policy", key: "privacy" },
      { path: "/terms", key: "terms" },
      { path: "/cookie-policy", key: "cookies" },
      { path: "/data-deletion", key: "dataDeletion" },
    ],
  },
];

/** The footer's groups with labels resolved. A registry page that is not publishable is left out; a group's text-only items have no href. */
export function footerGroups(t: Translate): { heading: string; links: { href?: string; label: string }[] }[] {
  return FOOTER_GROUPS.map((g) => ({
    heading: t(g.heading),
    links: g.items.flatMap((i): { href?: string; label: string }[] => {
      if ("text" in i) return [{ label: t(i.text) }];
      const page = findPageByPath(i.path);
      // A route the registry knows is shown only while it is publishable; one it does not know (pricing, legal) is a fixed route.
      if (page && !isPublishable(page)) return [];
      if ("page" in i) return page ? [{ href: i.path, label: cardLabel(page) }] : []; // a registry link with no record is dropped
      return [{ href: i.path, label: t(i.key) }];
    }),
  }));
}

/** The footer with its strings resolved for the request's locale. */
export async function Footer() {
  const [t, commonT] = await Promise.all([getTranslations("Footer"), getTranslations("Common")]);
  return <FooterView t={t} commonT={commonT} />;
}

/** Sync and prop-driven so it renders without a request (the English-text test renders it). */
export function FooterView({ t, commonT }: { t: Translate; commonT: Translate }) {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 xl:flex-row xl:justify-between">
          {/* Brand */}
          <div className="max-w-xs shrink-0">
            <Link
              href="/"
              className="flex items-center"
              aria-label={commonT("homeAria", { name: SITE.name })}
            >
              <PeakhourLogo className="h-7 w-auto" decorative />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("tagline")}
            </p>
            <span
              className="mt-4 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground"
              title={commonT("languageTooltip")}
            >
              <span aria-hidden="true">🌐</span> {commonT("languageChip")}
              <span className="font-normal">{commonT("languageMore")}</span>
            </span>
          </div>

          {/* Link groups */}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-8">
            {footerGroups(t).map((group) => (
              <nav key={group.heading} aria-label={group.heading}>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{group.heading}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.href ?? link.label}>
                      {link.href ? (
                        <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-brand">
                          {link.label}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">{link.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          {t("copyright", { name: SITE.name, year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  );
}
