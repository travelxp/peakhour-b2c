"use client";

import { useState } from "react";
import Image from "next/image";
import { resolveBrandLogo } from "@/lib/brand-logos";
import { cn } from "@/lib/utils";
import type { ChannelConfig } from "../channels.config";

/** A channel's mark, falling back to its initial when the logo is missing or fails to load. */
export function ChannelLogo({ channel }: { channel: ChannelConfig }) {
  // Track CDN failures locally so a blocked / 404'd logo gracefully falls
  // back to the initial-circle without a broken-image icon.
  const [errored, setErrored] = useState(false);
  // Resolve again here (not just in channels-from-catalog) so the hardcoded
  // channels.config fallback list, used when the catalog API is unreachable,
  // gets the same self-hosted marks instead of first-letter squares.
  const logoUrl = resolveBrandLogo(channel.providerKey, channel.logoUrl);
  if (logoUrl && !errored) {
    return (
      <Image
        src={logoUrl}
        alt=""
        aria-hidden
        width={40}
        height={40}
        className={cn(
          // object-contain: not every official mark is square (the Woo swoosh
          // is ~2:1) and a fixed 40x40 box would otherwise distort it.
          "size-10 shrink-0 rounded object-contain",
          channel.logoInvertOnDark && "dark:invert",
        )}
        unoptimized
        loading="lazy"
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-sm font-semibold text-muted-foreground"
    >
      {channel.name.charAt(0)}
    </div>
  );
}
