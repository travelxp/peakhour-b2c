import { headers } from "next/headers";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { ShopifyPageView } from "@/components/marketing/shopify/shopify-page-view";
import { getPublicCatalog, publicMarketingIntegrations, signupCta } from "@/lib/catalog";
import { badgedComingSoonKeys, channelIsComingSoon } from "@/lib/pillar-channels";
import { getPricing, suiteTrialDays } from "@/lib/pricing";
import { pageMetadata } from "@/lib/seo";
import { SHOPIFY_SEO } from "@/lib/shopify-features";

export const metadata = pageMetadata(SHOPIFY_SEO);

function countryFrom(header: string | null): string {
  return header && /^[A-Za-z]{2}$/.test(header) ? header.toUpperCase() : "DEFAULT";
}

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
export default async function ShopifyPage() {
  const h = await headers();
  const country = countryFrom(h.get("x-vercel-ip-country"));
  const [pricing, catalog] = await Promise.all([getPricing(country), getPublicCatalog()]);

  const published = catalog ? publicMarketingIntegrations(catalog.integrations) : [];
  const badged = new Set(
    badgedComingSoonKeys({ published, all: catalog?.integrations ?? [] }),
  );
  const comingSoon = channelIsComingSoon("shopify", badged);
  const signup = signupCta(catalog?.platform?.signupMode ?? "open", suiteTrialDays(pricing));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <ShopifyPageView pricing={pricing} comingSoon={comingSoon} signup={signup} />
      <Footer />
    </div>
  );
}
