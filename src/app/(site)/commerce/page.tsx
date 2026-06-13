import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  RefreshCw,
  MessageCircle,
  BotMessageSquare,
  Languages,
  BarChart2,
  Zap,
  ShoppingBag,
  Users,
  TrendingDown,
  Sparkles,
  Brain,
  Layers,
  Shield,
  LineChart,
  MonitorSmartphone,
  BadgeCheck,
  MessageSquarePlus,
  CircleDollarSign,
  Gauge,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { getPricing } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Peakhour Commerce — AI Commerce Platform for Shopify",
  description:
    "The most powerful AI commerce platform built for Shopify. WhatsApp assistant, dead-stock intelligence, Smart Rails, brand-voice AI recommendations, and autopilot campaigns. Zero markup on WhatsApp charges.",
};

const CAPABILITY_GROUPS = [
  {
    label: "AI Commerce Assistant",
    href: "/commerce/whatsapp-assistant",
    description:
      "Your catalog, available on every channel — 24/7, in any language.",
    features: [
      {
        icon: MessageCircle,
        title: "WhatsApp assistant for shoppers",
        description:
          "Answers every shopper question on your WhatsApp Business number in real time. Live stock, live prices, multilingual — no agent required.",
      },
      {
        icon: BotMessageSquare,
        title: "In-app assistant for merchants",
        description:
          "Ask your catalog anything right inside Shopify Admin. What's low on stock? What's trending this week? What needs a price review?",
      },
      {
        icon: Languages,
        title: "Multilingual replies",
        description:
          "Replies in the shopper's language — Hinglish, Hindi, Arabic, Tamil. Designed for markets where English is the second language, not the first.",
      },
      {
        icon: MonitorSmartphone,
        title: "On-store chat widget",
        description:
          "Catalog-grounded chat on your storefront. Anonymous shoppers get a taste; a seamless sign-in nudge turns them into known customers.",
      },
    ],
  },
  {
    label: "Inventory Intelligence",
    href: "/commerce/inventory-intelligence",
    description:
      "Know which products are turning dead before they cost you margin.",
    features: [
      {
        icon: TrendingDown,
        title: "Dead-stock scoring",
        description:
          "A weighted daily score for every product: days since last sale, stock age, views-to-purchase ratio, and sales velocity — combined into a single risk signal.",
      },
      {
        icon: Brain,
        title: "AI diagnosis per product group",
        description:
          "Not just a score — a plain-language diagnosis. 'High views, low add-to-cart — pricing problem' vs 'high stock, no views — discovery gap'. Actionable, not abstract.",
      },
      {
        icon: BarChart2,
        title: "Insights Network",
        description:
          "See how your store performs against anonymised cohort benchmarks. Know if your dead-stock rate is above or below merchants like you.",
      },
      {
        icon: RefreshCw,
        title: "Continuous catalog sync",
        description:
          "Products, variants, prices, and inventory pull automatically from Shopify. Every AI decision is grounded in live data — never stale.",
      },
    ],
  },
  {
    label: "Smart Rail — Storefront Merchandising",
    href: "/commerce/smart-rail",
    description:
      "Set your storefront once. Peakhour manages what it shows forever.",
    features: [
      {
        icon: Layers,
        title: "10 intelligent rail types",
        description:
          "Dead Stock Clearance · Trending Now · New Arrivals · Price Drops · Bestsellers · Back in Stock · Low Inventory · Complete the Look · Frequently Bought Together · Auto (AI decides).",
      },
      {
        icon: Zap,
        title: "Merchant sets it once",
        description:
          "Place the Smart Rail block via Shopify's theme editor. No code. Peakhour manages what products appear, in what order, with what title — autonomously.",
      },
      {
        icon: LineChart,
        title: "Event tracking",
        description:
          "Every impression, click, and add-to-cart feeds back into dead-stock scoring and recommendation accuracy. The storefront becomes a data collection layer.",
      },
      {
        icon: MessageSquarePlus,
        title: "WhatsApp handoff",
        description:
          "On-store chat widget offers 'Continue on WhatsApp' — bridges anonymous web sessions into your owned WhatsApp channel. Web to owned channel, one tap.",
      },
    ],
  },
  {
    label: "AI Recommendations & Brand Voice",
    href: "/commerce/brand-voice",
    description:
      "Recommendations that sound like your brand wrote them — not a generic SaaS.",
    features: [
      {
        icon: Sparkles,
        title: "Commerce voice cards",
        description:
          "Auto-synthesised from your catalog on first connect. Peakhour learns your brand register, preferred vocabulary, and words to avoid — without a single form to fill.",
      },
      {
        icon: Brain,
        title: "Brand-personalised titles",
        description:
          "Rail titles and campaign copy generated in your voice. 'The Linen Edit — Last 12 Pieces' instead of 'Dead Stock Clearance'. Your copy, not ours.",
      },
      {
        icon: Sparkles,
        title: "AI recommendations",
        description:
          "One recommendation per day, generated from your intelligence data. Products to surface, discount to suggest, expected recovery range — with a plain-language reason.",
      },
      {
        icon: Gauge,
        title: "Learning loop",
        description:
          "Every approval, edit, or rejection teaches the voice card. After 20 campaigns, Peakhour generates titles you wouldn't change. After 50, it sounds like your copy team wrote them.",
      },
    ],
  },
  {
    label: "WhatsApp Campaign Approval",
    href: "/commerce/campaign-approval",
    description:
      "Approve campaigns in seconds. Peakhour executes everything.",
    features: [
      {
        icon: MessageCircle,
        title: "Approve with a single reply",
        description:
          "Peakhour sends you a WhatsApp message: products, discount, duration, expected recovery. Reply 1 to approve. That's it — discount created, rail live, campaign running.",
      },
      {
        icon: Check,
        title: "Full control from chat",
        description:
          "Change the discount, exclude products, schedule for later — all via WhatsApp replies. 'Change to 10% and skip the blue ones' is a valid instruction.",
      },
      {
        icon: Clock,
        title: "Post-campaign summary",
        description:
          "One hour after every campaign ends, you get a WhatsApp summary: revenue recovered, top performer, next recommendation. Close the loop without opening a dashboard.",
      },
      {
        icon: Shield,
        title: "Discount via Shopify Billing API",
        description:
          "Every discount is created through Shopify's own Billing and Discounts APIs — not workarounds. Clean, auditable, uninstall-safe.",
      },
    ],
  },
  {
    label: "Autopilot — Set It Once",
    href: "/commerce/autopilot",
    description:
      "Your merchandising operation, running autonomously within your guardrails.",
    features: [
      {
        icon: Gauge,
        title: "Merchant guardrails",
        description:
          "Set your rules once: max discount %, margin floor, excluded collections, new arrivals protection, revenue threshold for auto-execute. Peakhour never crosses them.",
      },
      {
        icon: Zap,
        title: "Autonomous campaign execution",
        description:
          "When a recommendation passes all guardrails, Peakhour executes without waiting for approval. Rail active, discount live, campaign tracked — zero clicks.",
      },
      {
        icon: Shield,
        title: "Stop-loss rules",
        description:
          "If a campaign underperforms within 24 hours, Peakhour sends a WhatsApp alert and deactivates. You're never locked into a poor campaign.",
      },
      {
        icon: BarChart2,
        title: "Full audit log",
        description:
          "Every autopilot decision is logged: what triggered it, which guardrails applied, what the outcome was. Total transparency, zero black box.",
      },
    ],
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Install from the Shopify App Store",
    description:
      "Add Peakhour to your store. Catalog sync starts automatically — products, variants, prices, and stock, all pulled in.",
  },
  {
    step: "02",
    title: "Connect your WhatsApp Business number",
    description:
      "One-click connection via Meta Embedded Signup. Your shoppers can now ask questions on your WhatsApp number and get instant, accurate answers.",
  },
  {
    step: "03",
    title: "AI watches your catalog",
    description:
      "Peakhour scores every product daily. Dead-stock risks are diagnosed with plain-language explanations before they cost you margin.",
  },
  {
    step: "04",
    title: "Receive your first recommendation",
    description:
      "A WhatsApp message: products to surface, discount to run, duration, expected recovery. All in your brand voice, all from your real data.",
  },
  {
    step: "05",
    title: "Reply 1 to approve. Peakhour does the rest.",
    description:
      "Discount created in Shopify. Smart Rail updated on your storefront. Campaign tracked. Post-campaign summary arrives when it's done.",
  },
] as const;

const LAUNCH_BENEFITS = [
  "Early access before public launch",
  "Direct line to the founding team",
  "Shape the product roadmap with your feedback",
  "Founding-partner pricing — locked in forever",
  "Priority onboarding and dedicated setup support",
] as const;

export default async function CommercePage() {
  const h = await headers();
  const vercelCountry = h.get("x-vercel-ip-country");
  const country =
    vercelCountry && /^[A-Za-z]{2}$/.test(vercelCountry)
      ? vercelCountry.toUpperCase()
      : "DEFAULT";

  const pricing = await getPricing(country);
  const commerceProduct = pricing?.products?.find(
    (p) => p.key === "commerce_assistant",
  );
  const isLive = Boolean(commerceProduct);

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
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-175 w-225 -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />

          <div className="container">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
                  <ShoppingBag className="size-3" />
                  Built for Shopify
                </Badge>
                <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                  Founding Partner Program · Limited spots
                </Badge>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                The AI commerce platform{" "}
                <span className="text-primary">built for your Shopify store</span>
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                WhatsApp assistant, dead-stock intelligence, AI-powered Smart
                Rails, brand-voice campaign recommendations, and autonomous
                execution — all inside Shopify Admin. From first install to
                fully autonomous operation.
              </p>

              <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
                {isLive ? (
                  <>
                    <Button asChild size="lg" className="gap-2 px-8">
                      <Link href="#plans">
                        See plans
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link href="#features">Explore features</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="lg" className="gap-2 px-8">
                      <Link href="/launch-partner">
                        Apply as a launch partner
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link href="#features">Explore all features</Link>
                    </Button>
                  </>
                )}
              </div>

              {/* Trust strip */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                {[
                  "Zero markup on WhatsApp charges",
                  "Billed through Shopify",
                  "No credit card to start",
                  "Built for Shopify badge track",
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

        {/* ── Three trust callouts ── */}
        <div className="border-y bg-muted/30">
          <div className="container">
            <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
              {[
                {
                  icon: CircleDollarSign,
                  stat: "0% markup",
                  label: "on WhatsApp charges",
                  detail:
                    "WhatsApp messaging fees go directly from your Meta account to Meta. Peakhour takes zero cut. Fully transparent.",
                },
                {
                  icon: BadgeCheck,
                  stat: "Native",
                  label: "inside Shopify Admin",
                  detail:
                    "Polaris design system throughout. Session-token auth. No external logins, no iframe hacks. Built the way Shopify intended.",
                },
                {
                  icon: Gauge,
                  stat: "Per-action",
                  label: "Peaks billing model",
                  detail:
                    "Every AI action earns you a measurable outcome. See exactly what each campaign, diagnosis, and recommendation costs in Peaks — and what it recovered.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.stat}
                    className="flex flex-col gap-2 px-6 py-6 md:px-8"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="size-4 text-primary" strokeWidth={1.5} />
                      </div>
                      <div>
                        <span className="text-base font-bold text-foreground">{item.stat}</span>
                        <span className="ml-1 text-sm text-muted-foreground">{item.label}</span>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Full feature grid ── */}
        <section id="features" className="py-24">
          <div className="container">
            <div className="mx-auto max-w-6xl">
              <div className="mb-16 max-w-2xl">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  Full platform
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-balance lg:text-4xl">
                  Everything a Shopify merchant needs to sell more
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Six capability layers, one platform. Each layer makes the
                  others more intelligent over time.
                </p>
              </div>

              <div className="space-y-16">
                {CAPABILITY_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="mb-6 flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={group.href}
                          className="group/heading inline-flex items-center gap-2"
                        >
                          <h3 className="text-xl font-bold transition-colors group-hover/heading:text-primary">
                            {group.label}
                          </h3>
                          <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover/heading:translate-x-0.5 group-hover/heading:text-primary group-hover/heading:opacity-100" />
                        </Link>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {group.description}
                        </p>
                      </div>
                      <Link
                        href={group.href}
                        className="hidden shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline sm:block"
                      >
                        Learn more →
                      </Link>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {group.features.map((f) => {
                        const Icon = f.icon;
                        return (
                          <div
                            key={f.title}
                            className="group relative flex flex-col rounded-2xl border bg-background p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                          >
                            <div
                              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                              aria-hidden
                              style={{
                                background:
                                  "radial-gradient(ellipse at top left, oklch(0.60 0.20 68 / 0.03) 0%, transparent 70%)",
                              }}
                            />
                            <div className="relative flex flex-1 flex-col">
                              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15 transition-colors group-hover:bg-primary/15">
                                <Icon className="size-4 text-primary" strokeWidth={1.5} />
                              </div>
                              <p className="mb-1 text-sm font-semibold leading-snug">
                                {f.title}
                              </p>
                              <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                                {f.description}
                              </p>
                              <Link
                                href={group.href}
                                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                              >
                                Learn more
                                <ArrowRight className="size-3" />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── WhatsApp transparency callout ── */}
        <section className="border-t border-b bg-muted/30 py-16">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-background px-8 py-10 shadow-sm lg:px-14 lg:py-12">
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
                <div className="relative grid gap-8 md:grid-cols-2 md:gap-16 md:items-center">
                  <div>
                    <Badge className="mb-4 gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                      On billing transparency
                    </Badge>
                    <h2 className="text-2xl font-bold tracking-tight text-balance lg:text-3xl">
                      We charge zero markup on WhatsApp
                    </h2>
                    <p className="mt-3 leading-relaxed text-muted-foreground">
                      WhatsApp messaging fees are charged directly from your
                      Meta account to Meta. Peakhour takes no cut, no margin,
                      no markup — ever. We believe you should know exactly what
                      you&apos;re paying and who you&apos;re paying it to.
                    </p>
                    <p className="mt-3 leading-relaxed text-muted-foreground">
                      Peakhour&apos;s own billing is through Shopify — on your existing Shopify bill,
                      no new payment method required. AI actions are tracked in Peaks — a transparent,
                      per-action credit that shows you exactly what each decision cost and what it recovered.
                    </p>
                  </div>
                  <div className="space-y-4">
                    {[
                      {
                        label: "WhatsApp charges",
                        who: "Paid directly to Meta",
                        markup: "0% Peakhour markup",
                      },
                      {
                        label: "App subscription",
                        who: "Billed through Shopify",
                        markup: "On your existing Shopify bill",
                      },
                      {
                        label: "AI actions (Peaks)",
                        who: "Per-action, pay-as-you-go",
                        markup: "See exact ROI for every credit spent",
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="rounded-xl border bg-muted/40 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">{row.label}</p>
                            <p className="text-xs text-muted-foreground">{row.who}</p>
                          </div>
                          <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {row.markup}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-24">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="mb-14 text-center">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  From install to autopilot
                </p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
                  How it works
                </h2>
              </div>

              <div className="space-y-0">
                {HOW_IT_WORKS.map((s, idx) => (
                  <div
                    key={s.step}
                    className="relative flex gap-6 pb-10 last:pb-0"
                  >
                    {/* Connector line */}
                    {idx < HOW_IT_WORKS.length - 1 && (
                      <div className="absolute left-6 top-14 h-full w-px border-l border-dashed border-border" />
                    )}
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25 text-xs font-bold text-primary-foreground">
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

        {/* ── Peaks ROI callout ── */}
        <section className="border-t bg-muted/30 py-16">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <div className="grid gap-8 md:grid-cols-2 md:items-center">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                    Peaks — AI credits
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight text-balance lg:text-3xl">
                    Every Peaks credit has a measurable return
                  </h2>
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    Unlike opaque AI subscriptions, Peaks are per-action.
                    You see exactly what each AI decision costs and what it
                    recovered — inside Shopify Admin. No surprises on your bill.
                  </p>
                  <div className="mt-6 rounded-xl border bg-background px-5 py-4 text-sm font-medium">
                    <span className="text-muted-foreground">Example outcome:&nbsp;</span>
                    620 Peaks spent &rarr;{" "}
                    <span className="text-primary font-bold">₹61,400 recovered</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { action: "Dead-stock analysis (full store, daily)", peaks: "50 Peaks" },
                    { action: "AI diagnosis per product group", peaks: "10 Peaks" },
                    { action: "Campaign recommendation generated", peaks: "30 Peaks" },
                    { action: "Rail title in your brand voice", peaks: "10 Peaks" },
                    { action: "Campaign summary sent via WhatsApp", peaks: "10 Peaks" },
                    { action: "Autopilot execution (per campaign)", peaks: "15 Peaks" },
                  ].map((row) => (
                    <div
                      key={row.action}
                      className="flex items-center justify-between gap-4 rounded-lg border bg-background px-4 py-2.5"
                    >
                      <span className="text-xs text-muted-foreground">{row.action}</span>
                      <span className="shrink-0 text-xs font-semibold text-primary">{row.peaks}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Competitive position ── */}
        <section className="border-t py-20">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="mb-10 text-center">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  Why Peakhour
                </p>
                <h2 className="text-3xl font-bold tracking-tight">
                  No other Shopify app does all seven
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    phase: "Foundation",
                    capability:
                      "Catalog sync + AI assistant grounded in live product data",
                  },
                  {
                    phase: "Intelligence",
                    capability:
                      "Know which products are at risk before they become a problem",
                  },
                  {
                    phase: "Storefront",
                    capability:
                      "AI manages your rails and on-site chat without touching the theme",
                  },
                  {
                    phase: "Brand voice",
                    capability:
                      "Recommendations that sound like your brand, not a generic SaaS",
                  },
                  {
                    phase: "Approval",
                    capability:
                      "Approve campaigns on WhatsApp in seconds — Peakhour executes",
                  },
                  {
                    phase: "Autopilot",
                    capability:
                      "Set your guardrails once — Peakhour runs the operation autonomously",
                  },
                  {
                    phase: "Transparency",
                    capability:
                      "Zero markup on WhatsApp · per-action Peaks · billed through Shopify",
                  },
                  {
                    phase: "India / GCC first",
                    capability:
                      "WhatsApp-first for SMB merchants, multilingual, built for emerging markets",
                  },
                ].map((row) => (
                  <div
                    key={row.phase}
                    className="rounded-2xl border bg-background p-4"
                  >
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-primary">
                      {row.phase}
                    </span>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {row.capability}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Plans (dev only) OR Launch partner CTA (prod) ── */}
        {isLive ? (
          <section id="plans" className="border-t py-20">
            <div className="container">
              <div className="mx-auto max-w-6xl">
                <PricingGrid plans={[]} products={pricing?.products ?? []} showHeader />
              </div>
            </div>
          </section>
        ) : (
          <section className="border-t py-20">
            <div className="container">
              <div className="mx-auto max-w-3xl">
                <div className="relative overflow-hidden rounded-3xl border bg-background px-8 py-10 shadow-sm lg:px-14 lg:py-14">
                  <div
                    className="pointer-events-none absolute inset-0"
                    aria-hidden
                    style={{
                      backgroundImage:
                        "radial-gradient(oklch(from var(--primary) calc(l * 0.7) calc(c * 1.8) h / 0.12) 1.5px, transparent 1.5px)",
                      backgroundSize: "28px 28px",
                      maskImage:
                        "radial-gradient(ellipse 60% 60% at 100% 0%, black 0%, transparent 70%)",
                      WebkitMaskImage:
                        "radial-gradient(ellipse 60% 60% at 100% 0%, black 0%, transparent 70%)",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl"
                    style={{ background: "oklch(0.60 0.20 68 / 0.12)" }}
                    aria-hidden
                  />
                  <div className="relative">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                        <Users className="size-5 text-primary" />
                      </span>
                      <div>
                        <h2 className="text-2xl font-bold">Be a founding partner</h2>
                        <p className="text-sm text-muted-foreground">
                          Limited spots · Shopify merchants only
                        </p>
                      </div>
                    </div>
                    <p className="text-muted-foreground">
                      We&apos;re opening early access to a small cohort of Shopify
                      merchants who will help shape the full Commerce Platform
                      before public launch. Founding partners get every
                      capability — WhatsApp assistant, dead-stock intelligence,
                      Smart Rail, AI recommendations, autopilot — plus locked-in
                      pricing and direct access to the team.
                    </p>
                    <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                      {LAUNCH_BENEFITS.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-sm">
                          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
                            <Check className="size-2.5 text-primary" strokeWidth={3} />
                          </span>
                          {b}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Button asChild size="lg" className="gap-2 px-8">
                        <Link href="/launch-partner">
                          Apply as a launch partner
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        No credit card required · We&apos;ll reach out to confirm your spot
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
