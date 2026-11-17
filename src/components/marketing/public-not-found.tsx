import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Translate } from "@/i18n/types";

/**
 * The 404 for every public URL: an unknown path, an explicit `notFound()` in a
 * server component, and (through the coming-soon gate) a path that matches no
 * route. The dashboard keeps its own `dashboard/not-found.tsx`, so nothing here
 * mentions the dashboard: a public visitor has no account to go to.
 *
 * Daylight, like /shopify, with the shared Header and Footer. The brand mark
 * comes from those two; this page draws no logo of its own. The page names three
 * real places to go and carries no search box, because the site has no search.
 *
 * `robots: noindex` is belt and braces: a 404 status already keeps it out of
 * the index, but the tag also covers a crawler that reads a soft error.
 */
export async function generateNotFoundMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

const link =
  "group inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-[15px] font-bold text-brand-contrast shadow-[0_8px_20px_-8px_var(--brand)] transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const quiet =
  "inline-flex items-center rounded-full px-6 py-3.5 text-[15px] font-bold shadow-[inset_0_0_0_2px_var(--foreground)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * The 404's content. It must NOT import the shared Header or Footer: the root `not-found`
 * sits above EVERY route, the dashboard included, and Header carries a client component,
 * so any module on the root's import path puts that code in every route's first load (the
 * bundle budget caught +22KB per dashboard route and +104KB on /dashboard/commerce/knowledge).
 * The version with the header and footer is public-not-found-with-chrome.tsx, used only by
 * [...slug] and the gate's /gate-404.
 */
export async function PublicNotFoundMain() {
  return <PublicNotFoundBody t={await getTranslations("NotFound")} />;
}

/** Sync and prop-driven so the English-text test renders it without a request. */
export function PublicNotFoundBody({ t }: { t: Translate }) {
  return (
    <main className="flex flex-1 bg-[linear-gradient(180deg,var(--daylight-hero)_0%,var(--background)_88%)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col justify-center px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-[-0.04em] text-balance sm:text-6xl">
          {t("heading")}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          {t("body")}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/" className={link}>
            {t("home")}
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/shopify" className={quiet}>
            {t("shopify")}
          </Link>
          <Link href="/pricing" className={quiet}>
            {t("pricing")}
          </Link>
        </div>
      </div>
    </main>
  );
}

export async function PublicNotFound() {
  return (
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <PublicNotFoundMain />
    </div>
  );
}
