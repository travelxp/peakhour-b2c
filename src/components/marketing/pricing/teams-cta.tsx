import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * "Looking for an Agency or Enterprise plan?" band. Deliberately kept OFF the
 * per-pillar comparison tables (bundle plans aren't a pillar tier) and routed to
 * their own page. Reused on the hub and on every pillar pricing page.
 *
 * Aligned with the redesigned pricing cards: the same 3xl radius, the same
 * subtle border and card ground, the same eyebrow-and-rule the section headings
 * use. It used to be a dark slab with a blurred gradient orb behind it, which
 * read as a different site's component sitting under an ivory page — the one
 * place on the surface with a heavy gradient. The accent it needed was the
 * brand rule and the filled CTA it already had, not the background.
 */
export function TeamsCtaBand({ pillarName }: { pillarName?: string }) {
  return (
    <div className="rounded-3xl border bg-card px-6 py-8 sm:px-10 sm:py-10">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
            <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
            For teams &amp; partners
          </span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-pretty">
            Looking for an Agency or Enterprise plan?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Get {pillarName ? `${pillarName} and every other pillar` : "every pillar"}{" "}
            across many businesses, with volume Peaks, one unit per client and
            central billing.
          </p>
        </div>
        <Link
          href="/pricing/teams"
          className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          See Agency &amp; Enterprise
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
