import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  TrendingDown,
  Brain,
  BarChart2,
  RefreshCw,
  Clock,
  Target,
  AlertTriangle,
  ChevronLeft,
  Check,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Shopify Dead-Stock Intelligence — Peakhour",
  description:
    "AI that scores every product in your Shopify store daily. Know which products are at risk before they cost you margin. Five risk bands, plain-language diagnosis, actionable next steps.",
};

const FEATURES = [
  {
    icon: Activity,
    title: "Daily automated scoring",
    description:
      "Every product scored every day, without you doing anything. The algorithm runs on the latest sales, stock, and traffic data from your Shopify store.",
  },
  {
    icon: AlertTriangle,
    title: "5 risk score bands",
    description:
      "Healthy (0–30), Watchlist (31–50), Slow-moving (51–70), Dead-stock risk (71–85), Critical (86–100). Know exactly where every product sits on the risk curve.",
  },
  {
    icon: Brain,
    title: "AI diagnosis per product group",
    description:
      "Not just a score — a sentence you can act on: \"These 12 jackets get lots of views but few add-to-carts — this looks like a pricing problem, not a visibility problem.\" You find out a product is dying weeks before it becomes dead money on a shelf.",
  },
  {
    icon: Clock,
    title: "Inventory age tracking",
    description:
      "How long has each unit been sitting in your warehouse? Age-weighted scoring means a product that's been unsold for 90 days gets flagged before it becomes a write-off.",
  },
  {
    icon: Target,
    title: "Actionable next steps",
    description:
      "Every diagnosis comes with a recommended action: 'Run a 15% discount this weekend', 'Move to a bundle', 'Increase storefront visibility'. Not just a number — a direction.",
  },
  {
    icon: BarChart2,
    title: "Insights Network benchmarks",
    description:
      "Your dead-stock rate compared to anonymised cohorts of merchants in your category. Know if you're above or below average — and by how much.",
  },
  {
    icon: RefreshCw,
    title: "Continuous catalog sync",
    description:
      "Products, variants, prices, and inventory levels pull automatically from Shopify. Every score is grounded in the current state of your store — never a stale snapshot.",
  },
  {
    icon: TrendingDown,
    title: "Score history & trend lines",
    description:
      "Track how a product's score has changed over the last 30 days. A score moving from 40 to 70 in two weeks is a different signal than a product that's been at 70 for three months.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Catalog sync pulls every product, variant, and inventory level from Shopify",
    description:
      "Peakhour connects to your Shopify store and syncs your full catalog: every product, every variant, every SKU, and current inventory levels. Sync is continuous — new products appear automatically.",
  },
  {
    step: "02",
    title: "Order history gives Peakhour sales velocity and purchase patterns",
    description:
      "Historical orders show which products are selling, at what rate, and in what pattern. A product with seasonal velocity is scored differently from one with a flat, declining curve.",
  },
  {
    step: "03",
    title: "Daily scoring job runs on every product, assigning a 0–100 score",
    description:
      "The scoring algorithm runs every night. Days since last sale (40%), stock age (20%), sales velocity (20%), views-to-purchase ratio (20%). Every product gets a fresh score each morning.",
  },
  {
    step: "04",
    title: "AI groups products by score band and root cause, generates a plain-language diagnosis",
    description:
      "Products aren't just scored — they're grouped by what's actually wrong. One morning you might see: 'Kurtis in Grey & Beige — 14 products, score 71–85 — High views, low add-to-cart. Likely a pricing or imagery problem.' That's a diagnosis, not just a number.",
  },
];

const SCORE_BANDS = [
  { range: "0 – 30", label: "Healthy", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", description: "Selling well, stock turning over as expected." },
  { range: "31 – 50", label: "Watchlist", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", description: "Slowing down. Worth monitoring this week." },
  { range: "51 – 70", label: "Slow-moving", color: "text-orange-600", bg: "bg-orange-50 border-orange-200", description: "Velocity has dropped. Consider a promotion or price test." },
  { range: "71 – 85", label: "Dead-stock risk", color: "text-red-600", bg: "bg-red-50 border-red-200", description: "High risk. Intervention recommended within 14 days." },
  { range: "86 – 100", label: "Critical", color: "text-red-800", bg: "bg-red-100 border-red-300", description: "Urgent. Recovery window is closing — act this week." },
];

export default function InventoryIntelligencePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden py-20 sm:py-28 lg:py-32">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(oklch(from var(--primary) calc(l * 0.7) calc(c * 1.8) h / 0.14) 1.5px, transparent 1.5px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-175 w-225 -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl"
            aria-hidden
            style={{ background: "oklch(0.60 0.20 68 / 0.10)" }}
          />

          <div className="container">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
              <Link
                href="/commerce"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="size-3" />
                Back to Commerce
              </Link>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
                  <TrendingDown className="size-3" />
                  Dead-stock prevention
                </Badge>
                <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                  Inventory Intelligence
                </Badge>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                Know which Shopify products are at risk{" "}
                <span className="text-primary">before they cost you margin</span>
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Daily dead-stock scoring for every product using a weighted
                algorithm. Five risk bands. AI diagnosis per product group.
                Plain-language explanation of what&apos;s wrong — and what to do
                about it.
              </p>

              <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2 px-8">
                  <Link href="/launch-partner">
                    Apply as a launch partner
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/commerce">See all features</Link>
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                {[
                  "Runs every night on every product",
                  "Plain-language diagnosis",
                  "5 risk score bands",
                  "Actionable next steps",
                ].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check className="size-3 text-primary" strokeWidth={2.5} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Score bands visual ── */}
        <section className="border-y bg-muted/30 py-16">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="mb-10 text-center">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  The scoring system
                </p>
                <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">
                  Five risk bands — instantly actionable
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                  A 0–100 score built from four weighted signals: days since last
                  sale (40%), stock age (20%), sales velocity (20%), and
                  views-to-purchase ratio (20%).
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {SCORE_BANDS.map((band) => (
                  <div
                    key={band.label}
                    className={`rounded-xl border px-4 py-4 ${band.bg}`}
                  >
                    <div className={`text-lg font-bold ${band.color}`}>{band.range}</div>
                    <div className={`mt-0.5 text-sm font-semibold ${band.color}`}>{band.label}</div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {band.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-24">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="mb-14">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  How it works
                </p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
                  From Shopify data to a morning diagnosis
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Four steps, fully automated. You wake up to a prioritised view
                  of your inventory risk — no spreadsheets, no manual analysis.
                </p>
              </div>

              <div className="space-y-0">
                {STEPS.map((s, idx) => (
                  <div key={s.step} className="relative flex gap-6 pb-10 last:pb-0">
                    {idx < STEPS.length - 1 && (
                      <div className="absolute left-6 top-14 h-full w-px border-l border-dashed border-border" />
                    )}
                    <div
                      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xs font-bold text-primary-foreground shadow-lg"
                      style={{ background: "oklch(0.60 0.20 68)" }}
                    >
                      {s.step}
                    </div>
                    <div className="pt-2.5">
                      <p className="font-semibold">{s.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature grid ── */}
        <section className="border-t bg-muted/20 py-24">
          <div className="container">
            <div className="mx-auto max-w-6xl">
              <div className="mb-14">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  Full feature set
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-balance lg:text-4xl">
                  Know your dead-stock risk before it&apos;s unrecoverable
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Eight capabilities that give you complete visibility into every
                  product&apos;s performance trajectory — before margin erosion
                  becomes unavoidable.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div
                      key={f.title}
                      className="group relative rounded-2xl border bg-background p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                    >
                      <div
                        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        aria-hidden
                        style={{
                          background:
                            "radial-gradient(ellipse at top left, oklch(0.60 0.20 68 / 0.03) 0%, transparent 70%)",
                        }}
                      />
                      <div className="relative">
                        <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15 transition-colors group-hover:bg-primary/15">
                          <Icon className="size-4 text-primary" strokeWidth={1.5} />
                        </div>
                        <p className="mb-1 text-sm font-semibold leading-snug">{f.title}</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {f.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Diagnosis example callout ── */}
        <section className="border-t py-16">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-background px-8 py-10 lg:px-14 lg:py-12">
                <div
                  className="pointer-events-none absolute inset-0 rounded-3xl"
                  aria-hidden
                  style={{
                    backgroundImage:
                      "radial-gradient(oklch(from var(--primary) calc(l * 0.7) calc(c * 1.8) h / 0.08) 1.5px, transparent 1.5px)",
                    backgroundSize: "28px 28px",
                    maskImage:
                      "radial-gradient(ellipse 80% 100% at 100% 50%, black 0%, transparent 70%)",
                    WebkitMaskImage:
                      "radial-gradient(ellipse 80% 100% at 100% 50%, black 0%, transparent 70%)",
                  }}
                />
                <div
                  className="pointer-events-none absolute -right-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full blur-3xl"
                  style={{ background: "oklch(0.60 0.20 68 / 0.10)" }}
                  aria-hidden
                />
                <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                      Example diagnosis
                    </p>
                    <h2 className="text-2xl font-bold tracking-tight text-balance lg:text-3xl">
                      Not just a score. A reason. A direction.
                    </h2>
                    <p className="mt-4 leading-relaxed text-muted-foreground">
                      Two products can have the same score (say, 74) for completely
                      different reasons. One has high storefront traffic but nobody
                      adds to cart — a pricing or presentation problem. The other
                      has zero views — a discovery gap.
                    </p>
                    <p className="mt-3 leading-relaxed text-muted-foreground">
                      Peakhour separates them into different diagnosis groups and
                      gives you the right intervention for each. Not a single
                      "your inventory is risky" headline — a specific, root-cause
                      explanation for every cluster of products.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {[
                      {
                        score: "74",
                        group: "High views, low add-to-cart",
                        diagnosis: "Pricing or imagery problem. Shoppers are finding it — they're not convinced.",
                        action: "A/B price test or refresh product images",
                      },
                      {
                        score: "74",
                        group: "High stock, near-zero views",
                        diagnosis: "Discovery gap. The product isn't being seen, not rejected.",
                        action: "Surface in Smart Rail or run a search ad",
                      },
                      {
                        score: "82",
                        group: "Was selling — stopped 30 days ago",
                        diagnosis: "Trend shift or seasonal end. Stock is accumulating fast.",
                        action: "Run a time-boxed discount campaign this week",
                      },
                    ].map((row) => (
                      <div key={row.group} className="rounded-xl border bg-muted/40 px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                            {row.score}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{row.group}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.diagnosis}
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-primary">
                              → {row.action}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="border-t py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                Get started
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-balance lg:text-4xl">
                Know your dead-stock risk before it&apos;s unrecoverable
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Apply as a launch partner and get full inventory intelligence —
                daily scoring, AI diagnosis, and campaign recommendations —
                before public launch.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2 px-8">
                  <Link href="/launch-partner">
                    Apply as a launch partner
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/commerce">
                    <ChevronLeft className="size-4" />
                    Back to Commerce
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
