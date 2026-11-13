import { headers } from "next/headers";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { ShopifyPageView } from "@/components/marketing/shopify/shopify-page-view";
import { getPublicCatalog, publicMarketingIntegrations, signupCta } from "@/lib/catalog";
import { badgedComingSoonKeys, channelIsComingSoon } from "@/lib/pillar-channels";
import { getPricing, resolveCountry, suiteTrialDays } from "@/lib/pricing";
import { pageMetadata } from "@/lib/seo";
import { SHOPIFY_SEO } from "@/lib/shopify-features";

export const metadata = pageMetadata(SHOPIFY_SEO);

/**
 * /shopify: "Peakhour for Shopify". The merchant-facing page for the embedded
 * app. (/shopify/connect, the install-error page, is a separate route and
 * keeps working.)
 *
 * The price, the trial, the credit allowance and whether the install button
 * may point at the App Store all come from the live catalog, as on /pricing:
 * the connector's availability is asked of the same rule the channels strip
 * runs, so this page cannot send a visitor to a listing the catalog says is
 * not open yet. See lib/shopify-features.ts for the copy.
 */
export default async function ShopifyPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string | string[] }>;
}) {
  const h = await headers();
  // The same resolution /pricing runs: a chosen country, else the geo header.
  const country = resolveCountry((await searchParams).country, h.get("x-vercel-ip-country"));
  const [pricing, catalog] = await Promise.all([getPricing(country), getPublicCatalog()]);

  const published = catalog ? publicMarketingIntegrations(catalog.integrations) : [];
  const badged = new Set(
    badgedComingSoonKeys({ published, all: catalog?.integrations ?? [] }),
  );
  const comingSoon = channelIsComingSoon("shopify", badged);
  const signup = signupCta(catalog?.platform?.signupMode ?? "open", suiteTrialDays(pricing));

  return (
    // .theme-daylight: the new marketing palette (globals.css), scoped to this
    // page so the Header and Footer inside it follow without being forked.
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header />
      <ShopifyPageView pricing={pricing} comingSoon={comingSoon} signup={signup} country={country} />
      <Footer />
    </div>
  );
}
