import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Sparkles, Zap, RefreshCw, ArrowRight, Check } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { Button } from "@/components/ui/button";
import { PeaksMark } from "@/components/icons/peaks-mark";
import { getPeaks, formatPackPrice, type PeakPack } from "@/lib/peaks";

export const metadata: Metadata = {
  title: "Peaks — AI credits that power Peakhour",
  description:
    "Peaks are the AI credits behind every Peakhour feature. Each plan includes a monthly allowance; top up anytime with one-time Peaks packs that stack on your plan.",
};

/**
 * /peaks — public marketing page explaining the Peaks currency + the one-time
 * top-up packs. Server-rendered with the visitor's country resolved from the
 * Vercel edge geo header (`x-vercel-ip-country`), so the API returns packs in
 * the right currency without client-side flicker. Mirrors /pricing.
 *
 * Packs are data-driven from peakhour-api `/v1/platform/peaks` (cfg_addons) —
 * nothing is hardcoded. When ops hasn't published any pack the list is empty
 * and we render the plan-managed fallback instead of a broken table.
 */
export default async function PeaksPage() {
  const h = await headers();
  const vercelCountry = h.get("x-vercel-ip-country");
  const country =
    vercelCountry && /^[A-Za-z]{2}$/.test(vercelCountry)
      ? vercelCountry.toUpperCase()
      : "DEFAULT";

  const peaks = await getPeaks(country);
  const packs = peaks?.packs ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="border-b">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <div className="mx-auto mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-(--brand,oklch(0.77_0.146_67)) text-(--brand-ink,oklch(0.27_0.05_55)) shadow-sm">
              <PeaksMark className="size-7" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Peaks</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Peaks are the AI credits that power every Peakhour feature — writing posts,
              generating images, scoring engagement, and more. Your plan includes a monthly
              allowance, and you can top up anytime when you need more.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth">
                  Start free trial <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">Compare plans</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── How Peaks work ───────────────────────────────────────────── */}
        <section className="border-b bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid gap-6 sm:grid-cols-3">
              <HowItWorksCard
                icon={<Sparkles className="size-5" />}
                title="Included with your plan"
                body="Every paid plan comes with a monthly Peaks allowance that resets on your billing date. Most teams never need more."
              />
              <HowItWorksCard
                icon={<Zap className="size-5" />}
                title="Spent only when AI works"
                body="Peaks are consumed when the AI actually runs — drafting, generating, analysing. Writing and editing yourself costs nothing."
              />
              <HowItWorksCard
                icon={<RefreshCw className="size-5" />}
                title="Top up anytime"
                body="Running a campaign sprint? Add a one-time Peaks pack to your current billing window — it stacks on top of your plan's allowance."
              />
            </div>
          </div>
        </section>

        {/* ── Top-up packs ─────────────────────────────────────────────── */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Peaks top-up packs</h2>
              <p className="mt-4 text-muted-foreground">
                One-time top-ups that add Peaks to your current billing window. Yours for the
                month, on top of what your plan already includes — no new subscription.
              </p>
            </div>

            {packs.length > 0 ? (
              <>
                <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
                  {packs.map((pack) => (
                    <PackCard key={pack.key} pack={pack} />
                  ))}
                </div>
                <p className="mt-10 text-center text-sm text-muted-foreground">
                  Top-ups are available on any paid plan — buy them from your dashboard once
                  you&rsquo;re signed in.
                </p>
                {peaks && peaks.country !== "DEFAULT" && (
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    Prices shown for <code className="font-mono">{peaks.country}</code>, detected
                    from your IP.
                  </p>
                )}
              </>
            ) : (
              <div className="mx-auto mt-12 max-w-xl rounded-xl border bg-card p-8 text-center">
                <div className="mx-auto mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-(--brand,oklch(0.77_0.146_67)) text-(--brand-ink,oklch(0.27_0.05_55))">
                  <PeaksMark className="size-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Peaks come bundled with every paid plan. Self-serve top-up packs are rolling
                  out soon — in the meantime, your plan&rsquo;s monthly allowance has you
                  covered, and our team can add Peaks on request.
                </p>
                <Button asChild className="mt-6">
                  <Link href="/pricing">See what each plan includes</Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* ── CTA band ─────────────────────────────────────────────────── */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight">
              Start with a plan — Peaks are included
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Pick a plan to get your monthly Peaks allowance, then top up whenever a busy month
              calls for it.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth">
                  Start free trial <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">Compare plans</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function HowItWorksCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="inline-flex size-10 items-center justify-center rounded-lg bg-(--brand-soft,oklch(0.95_0.045_78)) text-(--brand-strong,oklch(0.66_0.156_50))">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function PackCard({ pack }: { pack: PeakPack }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
        pack.highlight ? "border-(--brand,oklch(0.77_0.146_67)) ring-1 ring-(--brand,oklch(0.77_0.146_67)) shadow-sm" : ""
      }`}
    >
      {pack.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-(--brand,oklch(0.77_0.146_67)) px-3 py-0.5 text-xs font-semibold text-(--brand-ink,oklch(0.27_0.05_55))">
          Best value
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-md bg-(--brand,oklch(0.77_0.146_67)) text-(--brand-ink,oklch(0.27_0.05_55))">
          <PeaksMark className="size-3.5" />
        </span>
        <h3 className="font-semibold">{pack.name}</h3>
      </div>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-bold tabular-nums tracking-tight">
          {formatPackPrice(pack)}
        </span>
        <span className="text-sm text-muted-foreground">one-time</span>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-(--brand-strong,oklch(0.66_0.156_50))">
        <Check className="size-4" />
        +{pack.credits.toLocaleString()} Peaks
      </p>

      {pack.description && (
        <p className="mt-3 text-sm text-muted-foreground">{pack.description}</p>
      )}
    </div>
  );
}
