import type { ComponentType } from "react";
import Image from "next/image";
import {
  ShopifyIcon,
  WordPressIcon,
  WooCommerceIcon,
  WhatsAppIcon,
} from "@/components/brand/brand-icons";
import { CHANNELS, type ChannelKey } from "@/lib/pricing-catalog";
import { cn } from "@/lib/utils";

/**
 * The brand tile on a channel card — "Works where you already run" on /pricing
 * and "Turn it on where you work" on /pricing/[pillar].
 *
 * Both surfaces used to render `ChannelMeta.tag`, a two-letter mark ("Sh",
 * "WP", "Wo", "Wa"), on a brand-coloured square: a boxed word where a logo
 * belonged. Channels we hold a real mark for now render it as a white glyph on
 * the same brand colour, matching the integration grid on the landing page.
 *
 * `tag` is still the fallback — BigCommerce has no mark here, and a two-letter
 * tile reads better than an empty square or a wrong logo.
 *
 * `native` is the exception to the exception. It is not a connector with a
 * brand colour, it is US — so it renders the actual Peakhour mark rather than
 * the letters "Ph" on an orange square, which is what a logo placeholder looks
 * like on a page that has the logo. The artwork is already a self-contained
 * disc, so it needs no tile colour behind it.
 */
const CHANNEL_ICONS: Partial<Record<ChannelKey, ComponentType<{ className?: string }>>> = {
  shopify: ShopifyIcon,
  wordpress: WordPressIcon,
  woocommerce: WooCommerceIcon,
  whatsapp: WhatsAppIcon,
};

export function ChannelTile({
  channel,
  className,
  iconClassName = "size-5",
}: {
  channel: ChannelKey;
  /** Size/radius/type-scale for the tile — the two call sites differ. */
  className?: string;
  iconClassName?: string;
}) {
  const ch = CHANNELS[channel];
  const Icon = CHANNEL_ICONS[channel];
  if (channel === "native") {
    return (
      <Image
        src="/peakhour-icon.svg"
        alt=""
        width={40}
        height={40}
        aria-hidden
        className={cn("shrink-0 object-contain dark:invert", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center font-bold text-white",
        className,
      )}
      style={{ backgroundColor: ch.color }}
      aria-hidden
    >
      {Icon ? <Icon className={iconClassName} /> : ch.tag}
    </span>
  );
}
