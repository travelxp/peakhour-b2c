import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CHANNELS, FEATURED_CHANNELS } from "@/lib/pricing-catalog";

/**
 * "Works where you already run" — the channel strip. Each card explains, in one
 * line, what running Peakhour inside that tool gets you and where billing
 * happens, then links to the channel (its app-store listing or the pillar that
 * uses it). External links (the Shopify App Store) open in a new tab.
 */
export function ChannelsStrip() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURED_CHANNELS.map((key) => {
        const ch = CHANNELS[key];
        const external = ch.href.startsWith("http");
        return (
          <Link
            key={key}
            href={ch.href}
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="group flex flex-col rounded-2xl border bg-background p-5 transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <span
              className="flex size-10 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: ch.color }}
              aria-hidden
            >
              {ch.tag}
            </span>
            <h3 className="mt-3.5 font-bold">{ch.name}</h3>
            <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{ch.blurb}</p>
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
