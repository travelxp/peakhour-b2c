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
  featureLabel,
  type ResolvedProductTier,
} from "@/lib/pricing";

/** Call-to-action for a tier card — shared across pillar plan sections. */
export interface TierCta {
  href: string;
  external: boolean;
  label: string;
}

/**
 * A single product-tier comparison card. Pillar-agnostic: used by the Commerce
 * (platform-split) and Content plan sections alike. Feature labels prefer the
 * catalog's own `featureDetails` name (source of truth, from the API) and fall
 * back to the local `featureLabel` map for any key without a catalog row or
 * when an older API response omits `featureDetails`.
 */
export function TierCard({ tier, cta }: { tier: ResolvedProductTier; cta: TierCta }) {
  const isFree = tier.pricing.monthly === 0;
  const detailByKey = new Map(
    (tier.featureDetails ?? []).map((f) => [f.key, f] as const),
  );
  const features = tier.features.map((k) => ({
    key: k,
    label: detailByKey.get(k)?.name ?? featureLabel(k),
  }));

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
          {features.map(({ key, label }) => (
            <li key={key} className="flex items-start gap-2.5">
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
