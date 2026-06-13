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
  PLAN_BULLETS,
  FEATURE_LABELS,
  type PlanKey,
  type ResolvedPlan,
  type ResolvedProduct,
  type ResolvedProductTier,
} from "@/lib/pricing";

const SHOPIFY_APP_STORE_URL =
  process.env.NEXT_PUBLIC_SHOPIFY_APP_STORE_URL ?? "https://apps.shopify.com/";

/**
 * Country-aware pricing grid — renders the API-resolved pricing
 * entries with marketing-grade bullets per tier. Used both on the
 * dedicated /pricing page and the landing-page Pricing section.
 *
 * Rendered as a server component — pricing data comes pre-fetched
 * from the caller (the page reads the Vercel IP country header and
 * passes it to `getPricing`). No client-side state, no currency-toggle
 * UI in MVP — the API picks the right entry by country.
 *
 * Enterprise renders below the comparison row as a contact-sales
 * banner instead of a fifth narrow column.
 *
 * When `products` is non-empty (env-gated: only shows in prod when the
 * product status is coming_soon/live), a per-product section renders
 * below the main SaaS grid showing pillar-branded tier cards.
 */
export function PricingGrid({
  plans,
  products = [],
  showHeader = true,
}: {
  plans: ResolvedPlan[];
  products?: ResolvedProduct[];
  showHeader?: boolean;
}) {
  const comparisonPlans = plans.filter((p) => p.key !== "enterprise");
  const enterprise = plans.find((p) => p.key === "enterprise");

  return (
    <div className="space-y-16">
      {/* ── Main SaaS plan grid ─────────────────────────────────────── */}
      <div className="space-y-8">
        {showHeader && (
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Start free. Upgrade when you&apos;re ready. Prices shown in your
              local currency.
            </p>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {comparisonPlans.map((plan) => (
            <PlanCard key={plan.key} plan={plan} />
          ))}
        </div>

        {enterprise ? <EnterpriseBanner plan={enterprise} /> : null}
      </div>

      {/* ── Product-scoped tier sections (env-gated) ────────────────── */}
      {products.map((product) => (
        <ProductSection key={product.key} product={product} />
      ))}
    </div>
  );
}

function PlanCard({ plan }: { plan: ResolvedPlan }) {
  const bullets = PLAN_BULLETS[plan.key as PlanKey] ?? [];
  const showFreeTagline = plan.pricing.monthly === 0 && plan.pricing.tagline;

  return (
    <Card
      className={`relative flex flex-col transition-shadow hover:shadow-md ${
        plan.highlightAsRecommended
          ? "border-primary shadow-lg ring-1 ring-primary/20"
          : ""
      }`}
    >
      {plan.highlightAsRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
          Most popular
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-lg capitalize">{plan.name}</CardTitle>
        <div className="mt-2 flex items-baseline gap-1">
          {showFreeTagline ? (
            <span className="text-3xl font-bold">
              {plan.pricing.tagline}
            </span>
          ) : (
            <>
              <span className="text-3xl font-bold">
                {formatMonthly(plan.pricing)}
              </span>
              <span className="text-sm text-muted-foreground">/month</span>
            </>
          )}
        </div>
        {!showFreeTagline && plan.pricing.yearly > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatYearly(plan.pricing)} billed yearly · 2 months free
          </p>
        )}
        {plan.tagline && (
          <CardDescription className="mt-2">{plan.tagline}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ul className="flex-1 space-y-2.5 text-sm">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {b}
            </li>
          ))}
        </ul>
        <Button
          asChild
          className="w-full"
          variant={plan.highlightAsRecommended ? "default" : "outline"}
        >
          <Link href="/auth">
            {plan.key === "free" ? "Start free" : `Try ${plan.name}`}
          </Link>
        </Button>
        {plan.pricing.trialDays > 0 && plan.pricing.monthly > 0 && (
          <p className="text-center text-[11px] text-muted-foreground">
            {plan.pricing.trialDays}-day free trial · no credit card needed
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EnterpriseBanner({ plan }: { plan: ResolvedPlan }) {
  return (
    <Card className="border-violet-300/60 bg-gradient-to-br from-violet-50 to-background dark:from-violet-950/30">
      <CardContent className="flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">{plan.name}</h3>
          {plan.tagline && (
            <p className="text-sm text-muted-foreground">{plan.tagline}</p>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(PLAN_BULLETS.enterprise ?? []).map((b) => (
              <li key={b} className="flex items-center gap-1.5">
                <Check className="size-3 text-primary" />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <Button asChild size="lg">
          <Link href="mailto:sales@peakhour.ai?subject=Enterprise%20plan%20inquiry">
            {plan.pricing.tagline ?? "Contact sales"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Product-scoped tier section ────────────────────────────────────────────

function ProductSection({ product }: { product: ResolvedProduct }) {
  return (
    <div className="space-y-8">
      <div className="border-t pt-10">
        <div className="text-center">
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary capitalize">
            {product.pillar}
          </span>
          <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">
            {product.name}
          </h2>
          {product.tagline && (
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {product.tagline}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:max-w-3xl lg:mx-auto">
        {product.tiers.map((tier) => (
          <ProductTierCard key={tier.key} tier={tier} />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Billed through your Shopify account · available in the Shopify App
        Store
      </p>
    </div>
  );
}

function ProductTierCard({ tier }: { tier: ResolvedProductTier }) {
  const isFree = tier.pricing.monthly === 0;
  const featureLabels = tier.features.map(
    (k) => FEATURE_LABELS[k] ?? k,
  );

  return (
    <Card
      className={`relative flex flex-col transition-shadow hover:shadow-md ${
        tier.highlightAsRecommended
          ? "border-primary shadow-lg ring-1 ring-primary/20"
          : ""
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
              <span className="text-3xl font-bold">
                {formatMonthly(tier.pricing)}
              </span>
              <span className="text-sm text-muted-foreground">/month</span>
            </>
          )}
        </div>
        {!isFree && tier.pricing.yearly > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatYearly(tier.pricing)} billed yearly · 2 months free
          </p>
        )}
        {tier.tagline && (
          <CardDescription className="mt-2">{tier.tagline}</CardDescription>
        )}
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
          <Link href={SHOPIFY_APP_STORE_URL} target="_blank" rel="noopener noreferrer">
            {isFree ? "Get started free" : `Get ${tier.name}`}
          </Link>
        </Button>
        {!isFree && tier.pricing.trialDays > 0 && (
          <p className="text-center text-[11px] text-muted-foreground">
            {tier.pricing.trialDays}-day free trial · billed through Shopify
          </p>
        )}
      </CardContent>
    </Card>
  );
}
