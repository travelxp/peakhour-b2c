import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CHANNELS, type ChannelKey } from "@/lib/pricing-catalog";
import { ChannelTile } from "@/components/marketing/pricing/channel-tile";

/**
 * Availability, said in the two words a buyer is actually looking for.
 *
 * `StatusChip` says "Live" / "Coming soon" and answers about a PRODUCT's stage;
 * this answers "can I switch this on today", which is the only question a
 * channel card raises. Kept local rather than added to StatusChip so the
 * product-stage vocabulary stays one thing and this stays another.
 */
function AvailabilityMark({ soon }: { soon: boolean }) {
  // shrink-0 on both: the mark sits beside a channel name that can be as long
  // as "WordPress Plugin", and a flex item allowed to shrink wraps "Coming
  // soon" onto two lines in the three-column grid.
  if (soon) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        Coming soon
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success-on-tint">
      <span className="size-1.5 rounded-full bg-success" aria-hidden />
      Available now
    </span>
  );
}

/**
 * "Use Peakhour <Pillar> where you already work." — the channels this pillar
 * runs inside, each marked with whether you can turn it on today.
 *
 * Compact by design: a tile, a name, an availability mark, one line, one link.
 * The cards used to also print where billing happens, which on five of six
 * channels was the same "Billed on peakhour.ai" — a row of identical sentences
 * that pushed the useful line down. `ChannelMeta.billed` is now set only where
 * billing genuinely happens somewhere else, so the exception still shows and
 * the repetition is gone at the source.
 *
 * `soon` is required per channel and comes from the shared catalog rule (see
 * lib/pillar-channels.ts), so this cannot disagree with the integrations grid.
 */
export function WhereItRuns({
  pillarName,
  channels,
  isComingSoon,
}: {
  pillarName: string;
  channels: ChannelKey[];
  isComingSoon: (key: ChannelKey) => boolean;
}) {
  if (channels.length === 0) return null;

  return (
    <section className="pt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-pretty">
          Use Peakhour {pillarName} where you already work.
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((key) => {
            const ch = CHANNELS[key];
            const external = ch.href.startsWith("http");
            const soon = isComingSoon(key);
            const shell = "flex flex-col rounded-2xl border bg-card p-4";
            const body = (
              <>
                <div className="flex items-center gap-3">
                  <ChannelTile
                    channel={key}
                    className="size-9 rounded-lg text-xs"
                    iconClassName="size-[18px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold leading-tight">{ch.name}</div>
                    {ch.billed && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {ch.billed}
                      </div>
                    )}
                  </div>
                  <AvailabilityMark soon={soon} />
                </div>
                <p className="mt-3 flex-1 text-sm text-muted-foreground">{ch.blurb}</p>
              </>
            );
            // An off-site link is an install path. Don't offer one for a
            // connector the catalog can't vouch for — the listing it points at
            // doesn't exist yet. Internal links stay: those pages are real
            // either way.
            if (soon && external) {
              return (
                <div key={key} className={shell}>
                  {body}
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
                className={`group ${shell} transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`}
              >
                {body}
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-strong">
                  See how it works
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
