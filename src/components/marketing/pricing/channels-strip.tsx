import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CHANNELS, FEATURED_CHANNELS } from "@/lib/pricing-catalog";
import { ChannelTile } from "@/components/marketing/pricing/channel-tile";
import { StatusChip } from "@/components/marketing/pricing/status-chip";
import { channelIsComingSoon } from "@/lib/pillar-channels";

/**
 * "Works where you already run" — the channel strip. Each card explains, in one
 * line, what running Peakhour inside that tool gets you and where billing
 * happens, then links to the channel (its app-store listing or the pillar that
 * uses it). External links (the Shopify App Store) open in a new tab.
 *
 * A channel the catalog cannot vouch for is marked and, if its link points
 * off-site, stops being a link at all: an "Install from the Shopify App Store"
 * card wired to a listing that does not exist yet is the strongest false claim
 * this site can make. Internal links stay — /commerce and /content are real
 * pages whether or not the connector has shipped.
 */
export function ChannelsStrip({
  comingSoonKeys,
}: {
  /** Resolved by the page through lib/pillar-channels.ts. */
  comingSoonKeys: readonly string[];
}) {
  const badged = new Set(comingSoonKeys);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURED_CHANNELS.map((key) => {
        const ch = CHANNELS[key];
        const soon = channelIsComingSoon(key, badged);
        const external = ch.href.startsWith("http");
        const inner = (
          <>
            <ChannelTile channel={key} className="size-10 rounded-xl text-sm" />
            <h3 className="mt-3.5 flex flex-wrap items-center gap-2 font-bold">
              {ch.name}
              {soon && <StatusChip status="coming_soon" />}
            </h3>
            <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{ch.blurb}</p>
          </>
        );
        const shell =
          "flex flex-col rounded-2xl border bg-background p-5";

        if (soon && external) {
          return (
            <div key={key} className={shell}>
              {inner}
            </div>
          );
        }
        return (
          <Link
            key={key}
            href={ch.href}
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className={`group ${shell} transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`}
          >
            {inner}
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-strong">
              See what runs here
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
