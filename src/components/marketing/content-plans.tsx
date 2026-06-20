import { TierCard } from "@/components/marketing/tier-card";
import { type ResolvedProduct } from "@/lib/pricing";

/**
 * Content plans (the Content pillar — the `content_studio` product, tiers
 * "Scout" free → "Peakhour Content" paid). Unlike Commerce there is no platform
 * split: WordPress is the only content surface today, so the tiers render as a
 * single section. Billing is peakhour.ai-native (Stripe/Razorpay), so the CTA
 * leads to sign-up rather than an app store.
 *
 * The product is env-gated server-side by its catalog status — it only reaches
 * this component when the pricing API returns it (dev, or once promoted in
 * prod), so the page can render this unconditionally when `content` is present.
 */
export function ContentPlans({ product }: { product: ResolvedProduct }) {
  const tiers = product.tiers;
  if (tiers.length === 0) return null;

  const cta = { href: "/auth", external: false, label: "Get started" } as const;

  return (
    <section className="space-y-8">
      <div className="text-center">
        <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Content
        </span>
        <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">Content plans</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {product.tagline ??
            "AI content for WordPress — start free with Scout, upgrade to Peakhour Content for autonomous publishing."}
        </p>
      </div>

      <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
        {tiers.map((tier) => (
          <TierCard key={tier.key} tier={tier} cta={cta} />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Billed securely online — no in-WordPress checkout.
      </p>
    </section>
  );
}
