import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Zap,
  LineChart,
  MessageSquarePlus,
  MousePointerClick,
  Tag,
  ShoppingCart,
  Repeat,
  ChevronLeft,
  Check,
  Store,
  Bot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Shopify Smart Rail — AI Storefront Merchandising by Peakhour",
  description:
    "AI-powered product rails that update themselves. Merchant places the block once in Shopify's theme editor. Peakhour manages what it shows forever — products, order, title, and urgency labels.",
};

const RAIL_TYPES = [
  { name: "Dead Stock Clearance", description: "Surfaces your highest-risk products first. AI chooses from the current dead-stock scoring data." },
  { name: "Trending Now", description: "Products with accelerating sales velocity this week — not last month's bestsellers." },
  { name: "New Arrivals", description: "Products added in the last 14 days, prioritised by early engagement signals." },
  { name: "Price Drops", description: "Products with active discounts or recent price reductions — auto-populated from Shopify." },
  { name: "Bestsellers", description: "Top performers by revenue over the last 30 days, updated nightly." },
  { name: "Back in Stock", description: "Products that were out of stock and have been restocked — high-intent signal for returning shoppers." },
  { name: "Low Inventory Selling Fast", description: "Urgency rail: products with fewer than 10 units remaining and positive velocity." },
  { name: "Complete the Look", description: "Category-based cross-sell: products that complete an outfit, kit, or set." },
  { name: "Frequently Bought Together", description: "Order-graph recommendations: products other shoppers bought in the same session." },
  { name: "Auto (AI decides)", description: "Peakhour picks the best rail type for the current moment — balancing clearance pressure, trending velocity, and inventory health." },
];

const FEATURES = [
  {
    icon: Layers,
    title: "10 intelligent rail types",
    description:
      "From Dead Stock Clearance to Frequently Bought Together — each rail type is driven by live intelligence data, not a static product collection.",
  },
  {
    icon: Zap,
    title: "Zero-code merchant setup",
    description:
      "Place the Smart Rail block in Shopify's theme editor via drag and drop. One block, one decision. Peakhour manages everything inside it from that point forward.",
  },
  {
    icon: Bot,
    title: "AI chooses products from scoring data",
    description:
      "The products that appear on your rail aren't manually selected — they're chosen from your live intelligence data. Dead-stock scores, velocity, and inventory levels all feed the selection.",
  },
  {
    icon: MousePointerClick,
    title: "Event tracking",
    description:
      "Every impression, click, and add-to-cart is captured. This data feeds back into dead-stock scoring and recommendation accuracy — the storefront becomes a live data collection layer.",
  },
  {
    icon: Tag,
    title: "Discount badge & urgency labels",
    description:
      "AI adds context labels where appropriate: 'Only 3 left', 'Price dropped', '40% off this weekend'. Generated from your actual inventory and discount data — not scripted.",
  },
  {
    icon: MessageSquarePlus,
    title: "On-store chat widget",
    description:
      "Catalog-grounded chat for storefront visitors. Anonymous shoppers get instant answers; a seamless sign-in nudge converts them into known customers before the session ends.",
  },
  {
    icon: ShoppingCart,
    title: "WhatsApp handoff button",
    description:
      "'Continue on WhatsApp' bridges the anonymous web session into your owned WhatsApp channel. One tap — the conversation context carries over, the shopper becomes known.",
  },
  {
    icon: Store,
    title: "Works with Dawn, Craft, Sense, and more",
    description:
      "Built as a native Shopify Theme App Extension. Compatible with all major Shopify themes — no custom theme required, no developer needed for installation.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Install the Smart Rail block in Shopify's theme editor",
    description:
      "Open your Shopify theme editor, find the Smart Rail block in the app extensions list, and drag it to any section of your homepage, collection page, or product page. No code, no developer.",
  },
  {
    step: "02",
    title: "Choose a rail type or set to Auto — Peakhour handles the rest",
    description:
      "Select from 10 rail types or leave it on Auto. When set to Auto, Peakhour evaluates your current inventory health, trending velocity, and clearance pressure to decide what the rail should show in real time.",
  },
  {
    step: "03",
    title: "Dead-stock intelligence feeds which products appear",
    description:
      "The products in your rail aren't guesses — they come from your daily dead-stock scoring data. Products with the highest clearance need and the lowest recent visibility get surfaced first.",
  },
  {
    step: "04",
    title: "Every click and add-to-cart feeds back into scoring",
    description:
      "Shopper interactions on the rail are captured as events. A product that's in the rail but getting zero clicks has a different problem than one getting clicks but no purchases. Both signals update the scoring model.",
  },
];

export default function SmartRailPage() {
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
                  <Layers className="size-3" />
                  Shopify Theme App Extension
                </Badge>
                <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                  Smart Rail
                </Badge>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                Place the block once.{" "}
                <span className="text-primary">Peakhour manages your storefront forever.</span>
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                A Shopify Theme App Extension block that merchants place once via
                the theme editor. Peakhour controls what products appear, in what
                order, with what AI-generated title — autonomously, in real time,
                without the merchant ever touching the theme again.
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
                  "10 intelligent rail types",
                  "Zero code required",
                  "Works with all major Shopify themes",
                  "On-store chat + WhatsApp handoff",
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

        {/* ── Rail types grid ── */}
        <section className="border-y bg-muted/30 py-16">
          <div className="container">
            <div className="mx-auto max-w-6xl">
              <div className="mb-10 text-center">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  10 rail types
                </p>
                <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">
                  Every rail type is intelligence-driven, not manually curated
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                  Choose the right rail for the moment — or set to Auto and let
                  Peakhour decide what your storefront needs right now.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {RAIL_TYPES.map((rail) => (
                  <div
                    key={rail.name}
                    className="rounded-xl border bg-background p-4 transition-colors hover:border-primary/30"
                  >
                    <p className="text-sm font-semibold">{rail.name}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {rail.description}
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
                  Set it once. Peakhour manages it forever.
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  The merchant makes one decision — where to put the block. From
                  there, every product selection, ordering, and merchandising
                  decision is made by Peakhour.
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
                  The storefront that manages itself
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Eight capabilities that turn your product rail from a static
                  block you maintain manually into a live, intelligent, self-managing
                  storefront layer.
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

        {/* ── Callout ── */}
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
                      Why it matters
                    </p>
                    <h2 className="text-2xl font-bold tracking-tight text-balance lg:text-3xl">
                      "Set it once. Peakhour manages it forever."
                    </h2>
                    <p className="mt-4 leading-relaxed text-muted-foreground">
                      Manual product curation is invisible work. Every weekend
                      someone has to log in, drag products around, update
                      featured collections, remove out-of-stock items, and add new
                      arrivals. It takes hours and it&apos;s never perfectly current.
                    </p>
                    <p className="mt-3 leading-relaxed text-muted-foreground">
                      Smart Rail eliminates that entirely. The block you place
                      once becomes a live intelligence surface — pulling from your
                      dead-stock scores, your trending velocity, your inventory
                      levels. What shoppers see tonight is different from what
                      they saw this morning, without you touching a thing.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl border bg-muted/40 px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Without Smart Rail</p>
                      <ul className="mt-3 space-y-2">
                        {[
                          "Manually update featured products weekly",
                          "Out-of-stock items showing to shoppers",
                          "Dead stock buried in unpromoted collections",
                          "No data on which rail products convert",
                        ].map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-1 shrink-0 size-1.5 rounded-full bg-muted-foreground/40" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-primary">With Smart Rail</p>
                      <ul className="mt-3 space-y-2">
                        {[
                          "Rail updates itself from live intelligence data",
                          "Dead stock surfaced with urgency labels automatically",
                          "Every click + add-to-cart feeds back into scoring",
                          "WhatsApp handoff converts anonymous web sessions",
                        ].map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
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
                Your storefront, managed autonomously
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Apply as a launch partner and get Smart Rail — plus every other
                Commerce capability — before the public Shopify App Store launch.
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
