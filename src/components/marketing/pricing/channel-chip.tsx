import { CHANNELS, type ChannelKey } from "@/lib/pricing-catalog";
import { cn } from "@/lib/utils";

/**
 * A compact channel token — a brand-colored square + the channel name. Used on
 * the hub pillar cards ("runs inside Shopify, WooCommerce") and inline wherever
 * a pillar's delivery surfaces need a glanceable label.
 *
 * `soon` marks a channel the catalog can't vouch for, in the same vocabulary
 * the homepage pillar chips use — dashed edge, the short word. Dropping such a
 * channel from the strip instead was the first attempt and it was worse:
 * Commerce, the pillar whose whole proposition is "runs inside your store",
 * ended up naming no store at all. Where it runs is what the visitor came to
 * learn; when is the qualifier, not a reason to withhold the answer.
 */
export function ChannelChip({
  channel,
  soon = false,
}: {
  channel: ChannelKey;
  soon?: boolean;
}) {
  const ch = CHANNELS[channel];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground",
        soon ? "border-dashed border-muted-foreground/40" : "bg-muted/40",
      )}
    >
      <span
        className="size-2 shrink-0 rounded-[3px]"
        style={{ backgroundColor: ch.color }}
        aria-hidden
      />
      {ch.name.replace(" App", "").replace(" Plugin", "")}
      {soon && (
        <>
          <span aria-hidden>&middot; soon</span>
          <span className="sr-only"> &mdash; coming soon</span>
        </>
      )}
    </span>
  );
}
