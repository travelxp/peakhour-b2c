import { CHANNELS, type ChannelKey } from "@/lib/pricing-catalog";

/**
 * A compact channel token — a brand-colored square + the channel name. Used on
 * the hub pillar cards ("runs inside Shopify, WooCommerce") and inline wherever
 * a pillar's delivery surfaces need a glanceable label.
 */
export function ChannelChip({ channel }: { channel: ChannelKey }) {
  const ch = CHANNELS[channel];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
      <span
        className="size-2 shrink-0 rounded-[3px]"
        style={{ backgroundColor: ch.color }}
        aria-hidden
      />
      {ch.name.replace(" App", "").replace(" Plugin", "")}
    </span>
  );
}
