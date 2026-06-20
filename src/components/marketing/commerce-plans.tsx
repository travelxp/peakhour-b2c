import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatMonthly,
  formatYearly,
  FEATURE_LABELS,
  type ResolvedProduct,
  type ResolvedProductTier,
} from "@/lib/pricing";

const SHOPIFY_APP_STORE_URL =
  process.env.NEXT_PUBLIC_SHOPIFY_APP_STORE_URL ?? "https://apps.shopify.com/";

/**
 * Commerce plans, split by platform. The catalog ships one `commerce_assistant`
 * product whose tiers cover both storefronts — the shared free tier (Lens) plus
 * a paid tier per platform (Peakhour Commerce for Shopify, "… (WooCommerce)"
 * for Woo). We present them as two parallel sections so each merchant sees only
 * the plans that apply to their store.
 *
 * Platform is inferred from the tier (key/name contains "woo") since the
 * catalog doesn't expose a platform field. The free tier is shown as the entry
 * card under both platforms.
 */
function isWoo(tier: ResolvedProductTier): boolean {
  return /woo/i.test(tier.key) || /woocommerce/i.test(tier.name);
}

export function CommercePlans({ product }: { product: ResolvedProduct }) {
  const tiers = product.tiers;
  const free = tiers.filter((t) => t.pricing.monthly === 0 && !isWoo(t));
  const shopifyPaid = tiers.filter((t) => t.pricing.monthly > 0 && !isWoo(t));
  const wooPaid = tiers.filter((t) => t.pricing.monthly > 0 && isWoo(t));

  const platforms = [
    {
      key: "shopify",
      name: "Shopify",
      blurb: "For Shopify stores — installed from the Shopify App Store.",
      tiers: [...free, ...shopifyPaid],
      cta: { href: SHOPIFY_APP_STORE_URL, external: true, label: "Shopify App Store" },
      note: "Billed through your Shopify account.",
    },
    {
      key: "woocommerce",
      name: "WooCommerce",
      blurb: "For WordPress + WooCommerce stores — via the Peakhour plugin.",
      tiers: [...free, ...wooPaid],
      cta: { href: "/auth", external: false, label: "Get started" },
      note: "Billed securely online — no in-WordPress checkout.",
    },
  ].filter((p) => p.tiers.length > 0);

  return (
    <div className="space-y-16">
      {platforms.map((platform) => (
        <section key={platform.key} className="space-y-8">
          <div className="text-center">
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {platform.name}
            </span>
            <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">
              {platform.name} plans
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {platform.blurb}
            </p>
          </div>

          <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
            {platform.tiers.map((tier) => (
              <TierCard key={tier.key} tier={tier} cta={platform.cta} />
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground">{platform.note}</p>
        </section>
      ))}
    </div>
  );
}

function TierCard({
  tier,
  cta,
}: {
  tier: ResolvedProductTier;
  cta: { href: string; external: boolean; label: string };
}) {
  const isFree = tier.pricing.monthly === 0;
  const featureLabels = tier.features.map((k) => FEATURE_LABELS[k] ?? k);

  return (
    <Card
      className={`relative flex flex-col transition-shadow hover:shadow-md ${
        tier.highlightAsRecommended ? "border-primary shadow-lg ring-1 ring-primary/20" : ""
      }`}
    >
      {tier.highlightAsRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
          Recommended
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-lg">{tier.name}</CardTitle>
        <div className="mt-2 flex items-baseline gap-1">
          {isFree ? (
            <span className="text-3xl font-bold">Free</span>
          ) : (
            <>
              <span className="text-3xl font-bold">{formatMonthly(tier.pricing)}</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </>
          )}
        </div>
        {!isFree && tier.pricing.yearly > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatYearly(tier.pricing)} billed yearly · 2 months free
          </p>
        )}
        {tier.tagline && <CardDescription className="mt-2">{tier.tagline}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ul className="flex-1 space-y-2.5 text-sm">
          {featureLabels.map((label) => (
            <li key={label} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {label}
            </li>
          ))}
        </ul>
        <Button
          asChild
          className="w-full"
          variant={tier.highlightAsRecommended ? "default" : "outline"}
        >
          <Link
            href={cta.href}
            {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {isFree ? "Get started free" : `Get ${tier.name}`}
          </Link>
        </Button>
        {!isFree && tier.pricing.trialDays > 0 && (
          <p className="text-center text-[11px] text-muted-foreground">
            {tier.pricing.trialDays}-day free trial
          </p>
        )}
      </CardContent>
    </Card>
  );
}
