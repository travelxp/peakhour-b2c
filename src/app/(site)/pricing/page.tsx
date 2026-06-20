import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { Button } from "@/components/ui/button";
import { CommercePlans } from "@/components/marketing/commerce-plans";
import { getPricing } from "@/lib/pricing";
import { PeaksGlyph } from "@/components/peaks/peaks-glyph";

export const metadata: Metadata = {
  title: "Peakhour Commerce — Plans for Shopify & WooCommerce",
  description:
    "Peakhour.ai commerce plans for Shopify and WooCommerce. Start free, upgrade when you're ready. Every paid plan includes Peaks — the AI credits that power the platform.",
};

/**
 * /pricing — the public Plans page. Shows the COMMERCE plans only, split into a
 * Shopify section and a WooCommerce section (the catalog's `commerce_assistant`
 * tiers). The legacy all-in-one "Suite" tiers (free/starter/growth/agency/
 * enterprise) and the Content product are intentionally not surfaced here.
 *
 * Server-rendered with the visitor's country resolved from the Vercel edge geo
 * header so prices show in the right currency. Note: the commerce product is
 * env-gated by its catalog status — it only appears in production once ops sets
 * its status to coming_soon/live.
 */
export default async function PricingPage() {
  const h = await headers();
  const vercelCountry = h.get("x-vercel-ip-country");
  const country =
    vercelCountry && /^[A-Za-z]{2}$/.test(vercelCountry)
      ? vercelCountry.toUpperCase()
      : "DEFAULT";

  const pricing = await getPricing(country);
  const commerce = pricing?.products.find((p) => p.pillar === "commerce");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        <section className="border-b">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Plans &amp; pricing
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Peakhour Commerce
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              The live, catalog-grounded AI assistant for Shopify and WooCommerce.
              Start free, upgrade when
              you&rsquo;re ready — every paid plan includes{" "}
              <Link href="/peaks" className="font-medium underline underline-offset-2">
                Peaks
              </Link>
              , the AI credits that power Peakhour.ai.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {commerce && commerce.tiers.length > 0 ? (
              <>
                <CommercePlans product={commerce} />
                {pricing && pricing.country !== "DEFAULT" && (
                  <p className="mt-12 text-center text-[11px] text-muted-foreground">
                    Prices shown for{" "}
                    <code className="font-mono">{pricing.country}</code>, detected from
                    your IP — contact sales for a custom-currency invoice.
                  </p>
                )}
              </>
            ) : (
              <div className="mx-auto max-w-xl rounded-xl border bg-card p-8 text-center">
                <div className="mb-4 flex justify-center">
                  <PeaksGlyph size={40} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Plans are being finalised. Check back shortly, or reach out to{" "}
                  <a
                    href="mailto:sales@peakhour.ai"
                    className="font-medium underline underline-offset-2"
                  >
                    sales@peakhour.ai
                  </a>{" "}
                  for early access.
                </p>
                <Button asChild className="mt-6">
                  <Link href="/peaks">Learn about Peaks</Link>
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
