import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  fromMonthly,
  formatMonthly,
  freeTier,
  type ResolvedProduct,
} from "@/lib/pricing";
import { pricingPillar } from "@/lib/pricing-catalog";
import { channelIsComingSoon } from "@/lib/pillar-channels";
import { StatusChip } from "@/components/marketing/pricing/status-chip";
import { ChannelChip } from "@/components/marketing/pricing/channel-chip";
import { TerrainCanvas } from "@/components/marketing/terrain-canvas";
import { type PillarSlug } from "@/lib/pillars";

/**
 * Each module's own mark: a summit from the same generator as the hero ground,
 * in that module's chart-series colour. Seeded per slug so a module's terrain
 * never changes shape between renders or between pages.
 *
 * The colours are the DARK-theme steps and are hardcoded rather than read from
 * the CSS token, because the tile behind them is always ink — the series is
 * pinned to the entity, not to the theme (see the note above --chart-1), so
 * the value that reads on ink is the right one in both themes.
 */
const MODULE_MARK: Record<PillarSlug, { seed: number; rgb: string }> = {
  commerce: { seed: 11, rgb: "201,130,12" },
  content: { seed: 27, rgb: "142,118,232" },
  growth: { seed: 43, rgb: "16,156,135" },
  support: { seed: 61, rgb: "74,143,224" },
  presence: { seed: 79, rgb: "224,90,147" },
};

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
  comingSoonKeys,
  suiteIncluded = false,
}: {
  slug: PillarSlug;
  product?: ResolvedProduct;
  /**
   * Resolved by the page through lib/pillar-channels.ts. Required: this card
   * NAMES channels, so it makes an availability claim whether or not it
   * intends to, and a caller who forgets should fail to compile.
   */
  comingSoonKeys: readonly string[];
  /**
   * Peakhour Suite is on sale, so this module is included in it.
   *
   * The card then stops quoting a per-module price. It is not that ₹1,499 has
   * become untrue — the tier still exists until it retires — it is that a grid
   * of five separate prices under a headline promising one price is the
   * contradiction the Suite exists to remove, and a visitor doing the five-way
   * arithmetic is doing the wrong sum.
   */
  suiteIncluded?: boolean;
}) {
  const pillar = pricingPillar(slug);
  const Icon = pillar.icon;
  const paidFrom = product ? fromMonthly(product) : null;
  // Every channel still gets named; the ones the catalog can't vouch for are
  // marked rather than dropped. The pillar's own StatusChip above says where
  // the PILLAR stands — this strip answers "where does it run", and the
  // honest answer for an unbuilt connector is "there, soon", not silence.
  const badged = new Set(comingSoonKeys);
  // ★`freeTier`, NOT `tiers.some(t => t.pricing.monthly === 0)`. The naive
  // check searches the RAW tier list, which carries the account-level bundles —
  // and Enterprise is sales-led, priced 0/0, so it matches. Every product would
  // read as having a free tier whether or not it does, which is latent today
  // only because they all happen to have one. `freeTier` excludes bundles by
  // key and requires both intervals to be zero; its docblock documents this
  // exact trap.
  const hasFree = !!(product && freeTier(product));

  const priceLabel = !product
    ? "Coming soon"
    : suiteIncluded
      ? "Included"
      : paidFrom
        ? formatMonthly(paidFrom.pricing)
        : hasFree
          ? "Free"
          : "Coming soon";
  // "from ₹1,499 /mo" only reads as a price when a price is what is shown.
  const showPriceAffixes = !!paidFrom && !suiteIncluded;

  return (
    <Link
      href={`/pricing/${slug}`}
      className="group flex flex-col rounded-2xl border bg-background p-6 transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-xl focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3">
        {/* The icon sits ON the module's own mark rather than on a flat
            tint. Same generator as the hero, one summit, the module's series
            colour — five cards that share a construction read as one system,
            which is the whole argument for generating them instead of
            commissioning five illustrations. */}
        <span className="relative flex size-11 items-center justify-center overflow-hidden rounded-xl bg-ink">
          <span aria-hidden className="absolute inset-0">
            <TerrainCanvas variant="mark" {...MODULE_MARK[slug]} />
          </span>
          <Icon
            className="relative size-5 text-on-ink transition-transform group-hover:scale-110"
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
        {showPriceAffixes && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            from
          </span>
        )}
        <span
          className={`text-2xl font-extrabold tracking-tight ${
            priceLabel === "Free" || priceLabel === "Included"
              ? "text-success-on-tint"
              : ""
          }`}
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          {priceLabel}
        </span>
        {showPriceAffixes && <span className="text-sm text-muted-foreground">/mo</span>}
        {suiteIncluded && (
          <span className="text-sm text-muted-foreground">in Peakhour Suite</span>
        )}
      </div>

      {pillar.runsIn.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-dashed pt-4">
          {/* No slice. It was capped at 3 while every pillar had at most 3,
              so it hid nothing — and the moment WhatsApp joined commerce it
              would have dropped a channel with no "+1" to show for it, which
              is the same silent-hide this PR removed everywhere else. The
              chips wrap. */}
          {pillar.runsIn.map((ch) => (
            <ChannelChip key={ch} channel={ch} soon={channelIsComingSoon(ch, badged)} />
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between pt-1">
        <span className="text-sm text-muted-foreground">
          {suiteIncluded
            ? "Free tier available"
            : hasFree
              ? "Free & Paid"
              : product
                ? "Plans"
                : "Join the waitlist"}
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
