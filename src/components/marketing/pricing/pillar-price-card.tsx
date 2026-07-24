import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fromMonthly, formatMonthly, type ResolvedProduct } from "@/lib/pricing";
import { pricingPillar } from "@/lib/pricing-catalog";
import { StatusChip } from "@/components/marketing/pricing/status-chip";
import { ChannelChip } from "@/components/marketing/pricing/channel-chip";
import { type PillarSlug } from "@/lib/pillars";

/**
 * A pillar card on the pricing hub's "add as you grow" grid. Identity (icon,
 * name, promise) is static; price, status and whether it's purchasable are read
 * from the live product. When the product isn't listed in this env (prod-hidden
 * while in_development) the card shows a "Coming soon" state but still links to
 * the pillar's pricing page, which renders the waitlist view.
 */
export function PillarPriceCard({
  slug,
  product,
}: {
  slug: PillarSlug;
  product?: ResolvedProduct;
}) {
  const pillar = pricingPillar(slug);
  const Icon = pillar.icon;
  const paidFrom = product ? fromMonthly(product) : null;
  const hasFree = !!product?.tiers.some((t) => t.pricing.monthly === 0);

  const priceLabel = !product
    ? "Coming soon"
    : paidFrom
      ? formatMonthly(paidFrom.pricing)
      : hasFree
        ? "Free"
        : "Coming soon";

  return (
    <Link
      href={`/pricing/${slug}`}
      className="group flex flex-col rounded-2xl border bg-background p-6 transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-xl focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft transition-colors group-hover:bg-brand-gradient">
          <Icon
            className="size-5 text-brand-ink transition-colors group-hover:text-brand-contrast"
            strokeWidth={2}
            aria-hidden
          />
        </span>
        <StatusChip status={product?.status} />
      </div>

      <h3 className="mt-4 text-xl font-bold tracking-tight">{pillar.name}</h3>
      <p className="mt-2 min-h-[2.75rem] text-sm text-muted-foreground">
        {pillar.promise}
      </p>

      <div className="mt-4 flex items-baseline gap-1.5">
        {paidFrom && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            from
          </span>
        )}
        <span
          className={`text-2xl font-extrabold tracking-tight ${
            priceLabel === "Free" ? "text-emerald-600 dark:text-emerald-400" : ""
          }`}
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          {priceLabel}
        </span>
        {paidFrom && <span className="text-sm text-muted-foreground">/mo</span>}
      </div>

      {pillar.channels.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-dashed pt-4">
          {pillar.channels.slice(0, 3).map((ch) => (
            <ChannelChip key={ch} channel={ch} />
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between pt-1">
        <span className="text-sm text-muted-foreground">
          {hasFree ? "Free & Paid" : product ? "Plans" : "Join the waitlist"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-strong">
          {product ? "Compare plans" : "Learn more"}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-1"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}
