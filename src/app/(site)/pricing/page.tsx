import { headers } from "next/headers";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { getPricing } from "@/lib/pricing";

/**
 * /pricing — public marketing pricing page. Server-rendered with the
 * visitor's country resolved from the Vercel edge geo header
 * (`x-vercel-ip-country`). The peakhour-api `/v1/platform/pricing`
 * endpoint resolves the country-specific entry per plan (INR for IN,
 * USD via DEFAULT for everyone else in MVP) so the page renders with
 * the right currency without any client-side flicker.
 *
 * Falls back to "DEFAULT" (USD) when the header is missing — local dev
 * and non-Vercel deploys both hit that path; the page still renders.
 *
 * Pricing is cached server-side for 5 minutes via the
 * `platform-pricing` tag (see `getPricing` in lib/pricing.ts). A CMS
 * supersede can trigger a future revalidate by calling
 * `revalidateTag("platform-pricing")` once that hook is wired.
 */
export default async function PricingPage() {
  const h = await headers();
  const vercelCountry = h.get("x-vercel-ip-country");
  const country =
    vercelCountry && /^[A-Za-z]{2}$/.test(vercelCountry)
      ? vercelCountry.toUpperCase()
      : "DEFAULT";

  const pricing = await getPricing(country);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {pricing && pricing.plans.length > 0 ? (
              <PricingGrid plans={pricing.plans} />
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-700 dark:text-amber-400">
                Pricing is temporarily unavailable. Please refresh in a
                moment, or contact{" "}
                <a
                  href="mailto:sales@peakhour.ai"
                  className="font-medium underline underline-offset-2"
                >
                  sales@peakhour.ai
                </a>{" "}
                if the problem persists.
              </div>
            )}

            {pricing && pricing.country !== "DEFAULT" && (
              <p className="mt-8 text-center text-[11px] text-muted-foreground">
                Prices shown for{" "}
                <code className="font-mono">{pricing.country}</code>. Detected
                from your IP — contact sales for a custom-currency invoice.
              </p>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
