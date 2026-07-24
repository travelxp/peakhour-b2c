import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * "Looking for an Agency or Enterprise plan?" band. Deliberately kept OFF the
 * per-pillar comparison tables (bundle plans aren't a pillar tier) and routed to
 * their own page. Reused on the hub and on every pillar pricing page.
 */
export function TeamsCtaBand({ pillarName }: { pillarName?: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 px-6 py-10 text-zinc-100 shadow-2xl sm:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-brand-gradient opacity-25 blur-3xl"
      />
      <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="max-w-xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
            For teams &amp; partners
          </span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-pretty">
            Looking for an Agency or Enterprise plan?
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Get {pillarName ? `${pillarName} and every other pillar` : "every pillar"}{" "}
            across many businesses, with volume Peaks, one unit per client and
            central billing.
          </p>
        </div>
        <Link
          href="/pricing/teams"
          className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        >
          See Agency &amp; Enterprise
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
