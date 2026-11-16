import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SITE } from "@/lib/utils";
import type { Translate } from "@/i18n/types";
import { PeakhourLogo } from "@/components/shared/peakhour-logo";

// Grouped footer nav. Every href below is a route that exists today. Labels are message keys (messages/<locale>.json, namespace Footer).
const FOOTER_GROUPS = [
  {
    heading: "platform",
    links: [
      { href: "/commerce", label: "commerce" },
      { href: "/content", label: "content" },
      { href: "/growth", label: "growth" },
      { href: "/support", label: "support" },
      { href: "/presence", label: "presence" },
    ],
  },
  {
    heading: "worksWith",
    links: [
      { href: "/shopify", label: "shopify" },
      { href: "/content", label: "wordpress" },
    ],
  },
  {
    heading: "product",
    links: [
      { href: "/pricing", label: "pricing" },
      { href: "/peaks", label: "peaks" },
      { href: "/how-it-works", label: "howItWorks" },
      { href: "/contact", label: "contact" },
    ],
  },
  {
    heading: "legal",
    links: [
      { href: "/privacy-policy", label: "privacy" },
      { href: "/terms", label: "terms" },
      { href: "/cookie-policy", label: "cookies" },
      { href: "/data-deletion", label: "dataDeletion" },
    ],
  },
] as const;

/** The footer with its strings resolved for the request's locale. */
export async function Footer() {
  return <FooterView t={await getTranslations("Footer")} commonT={await getTranslations("Common")} />;
}

/** Sync and prop-driven so it renders without a request (the English-text test renders it). */
export function FooterView({ t, commonT }: { t: Translate; commonT: Translate }) {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <Link
              href="/"
              className="flex items-center"
              aria-label={commonT("homeAria", { name: SITE.name })}
            >
              <PeakhourLogo className="h-7 w-auto" decorative />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("tagline", { tagline: SITE.tagline })}
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
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 lg:gap-x-14">
            {FOOTER_GROUPS.map((group) => (
              <nav key={group.heading} aria-label={t(group.heading)}>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {t(group.heading)}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-brand"
                      >
                        {t(link.label)}
                      </Link>
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
