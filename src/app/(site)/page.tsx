import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  RefreshCw,
  MessageCircle,
  BarChart2,
  Check,
  ShoppingBag,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getPublicCatalog } from "@/lib/catalog";
import { resolveMarketingLocale } from "@/lib/marketing-locale";

export const metadata: Metadata = {
  title: "Peakhour — AI Commerce Assistant for Shopify",
  description:
    "AI that knows your entire Shopify catalog. Answers shoppers on WhatsApp in real time, in their language. Now in early access for founding partners.",
};

const COMMERCE_FEATURES = [
  {
    icon: RefreshCw,
    title: "Catalog always in sync",
    description:
      "Products, prices, and stock pull automatically from Shopify. Your AI always answers from live data — no stale info, no wrong prices.",
  },
  {
    icon: MessageCircle,
    title: "Answers on WhatsApp, 24/7",
    description:
      "Shoppers ask questions on your WhatsApp Business number. AI replies instantly in their language — accurate, helpful, zero agent time.",
  },
  {
    icon: BarChart2,
    title: "Commerce insights",
    description:
      "See what shoppers ask most, spot catalog gaps, and benchmark against your cohort. Founding partners shape what we measure.",
  },
] as const;

const LAUNCH_BENEFITS = [
  "Early access before public launch",
  "Direct line to the founding team",
  "Shape the product roadmap with your feedback",
  "Founding-partner pricing — locked in forever",
  "Priority onboarding and setup support",
] as const;

const WHAT_IS_NEXT = [
  {
    label: "Content",
    detail: "AI writers · News desk · Multi-format publishing",
  },
  {
    label: "Growth",
    detail: "Ads intelligence · Audience analytics · Growth benchmarks",
  },
] as const;

function WhatsAppMockup() {
  return (
    <div className="relative mx-auto w-72 select-none overflow-hidden rounded-[2rem] border-[6px] border-foreground/10 bg-background shadow-2xl dark:border-foreground/20">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-foreground/5 px-4 py-1.5">
        <span className="text-[10px] font-medium tabular-nums">9:41</span>
        <div className="flex items-center gap-1.5">
          <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
          <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
        </div>
      </div>
      {/* WhatsApp header */}
      <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: "#075E54" }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
          {locale.exampleInitials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">{locale.exampleStore}</p>
          <p className="text-[10px] text-white/70">Online</p>
        </div>
      </div>
      {/* Chat area */}
      <div className="space-y-3 px-3 py-4" style={{ background: "#E5DDD5", minHeight: 260 }}>
        {/* Shopper bubble */}
        <div className="flex justify-end">
          <div className="max-w-[82%] rounded-2xl rounded-br-sm px-3 py-2 shadow-sm" style={{ background: "#DCF8C6" }}>
            <p className="text-[11px] leading-snug text-gray-800">
              Do you have Nike Air Max in size 10?
            </p>
            <p className="mt-0.5 text-right text-[9px] text-gray-500">2:34 PM ✓✓</p>
          </div>
        </div>
        {/* AI response */}
        <div className="flex justify-start">
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-800">Nike Air Max 270</p>
            <div className="mt-1.5 space-y-0.5 text-[10px] text-gray-600">
              <p>✓ &nbsp;Size 10 — In stock (3 left)</p>
              <p>{locale.examplePrice} · Free delivery</p>
            </div>
            <p className="mt-1.5 text-[10px]" style={{ color: "#075E54" }}>
              Want me to help you order? 😊
            </p>
            <p className="mt-0.5 text-[9px] text-gray-400">2:34 PM</p>
          </div>
        </div>
        {/* Second shopper message */}
        <div className="flex justify-end">
          <div className="max-w-[70%] rounded-2xl rounded-br-sm px-3 py-2 shadow-sm" style={{ background: "#DCF8C6" }}>
            <p className="text-[11px] leading-snug text-gray-800">
              Yes! What colours?
            </p>
            <p className="mt-0.5 text-right text-[9px] text-gray-500">2:35 PM ✓✓</p>
          </div>
        </div>
        {/* AI response 2 */}
        <div className="flex justify-start">
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Available in <span className="font-medium text-gray-800">Black</span>, <span className="font-medium text-gray-800">White</span> and <span className="font-medium text-gray-800">Wolf Grey</span> in your size.
            </p>
            <p className="mt-0.5 text-[9px] text-gray-400">2:35 PM</p>
          </div>
        </div>
      </div>
      {/* Input bar */}
      <div className="flex items-center gap-2 bg-[#F0F0F0] px-3 py-2">
        <div className="flex-1 rounded-full bg-white px-3 py-1.5">
          <p className="text-[10px] text-gray-400">Message</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "#25D366" }}>
          <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const [catalog, locale] = await Promise.all([
    getPublicCatalog(),
    resolveMarketingLocale(),
  ]);
  const platform = catalog?.platform;

  return (
    <div className="flex min-h-screen flex-col">
      {platform?.banner?.enabled && platform.banner.copy ? (
        <div
          role="status"
          className={
            "flex items-center justify-center gap-2 border-b px-4 py-2 text-center text-sm " +
            (platform.banner.tone === "warn"
              ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              : platform.banner.tone === "success"
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200")
          }
        >
          {platform.banner.tone === "warn" ? (
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
          ) : platform.banner.tone === "success" ? (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          ) : (
            <Info className="size-4 shrink-0" aria-hidden />
          )}
          <span>{platform.banner.copy}</span>
        </div>
      ) : null}

      <Header />

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden py-20 sm:py-28 lg:py-32">
          {/* Dot grid texture (CSS from shadcnblocks/background-pattern117) */}
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(oklch(from var(--primary) calc(l * 0.7) calc(c * 1.8) h / 0.18) 1.5px, transparent 1.5px)",
              backgroundSize: "28px 28px",
            }}
          />
          {/* Amber glow — keeps the warm depth under the copy */}
          <div
            className="pointer-events-none absolute -z-10 h-160 w-200 -translate-x-1/3 -translate-y-1/4 rounded-full bg-primary/15 blur-3xl"
            aria-hidden
          />

          <div className="container">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Left — copy */}
              <div className="flex flex-col items-start gap-6">
                <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
                  <ShoppingBag className="size-3" />
                  Shopify App · Early Access
                </Badge>

                <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                  Your Shopify store,{" "}
                  <span className="text-primary">always on WhatsApp</span>
                </h1>

                <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                  AI that knows every product in your catalog. Answers shoppers
                  in real time, in their language, around the clock — so you
                  never miss a sale.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="gap-2 px-6">
                    <Link href="/launch-partner">
                      Apply as a launch partner
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="px-6">
                    <Link href="#how-it-works">See how it works</Link>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                  {["Built for Shopify", "WhatsApp Business", "No credit card required", "Limited spots"].map(
                    (t) => (
                      <span key={t} className="flex items-center gap-2">
                        <span className="inline-flex size-1 rounded-full bg-primary/60" />
                        {t}
                      </span>
                    ),
                  )}
                </div>
              </div>

              {/* Right — product visual */}
              <div className="flex justify-center lg:justify-end">
                <div className="relative">
                  {/* Decorative ring behind mockup */}
                  <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-xl" />
                  <WhatsAppMockup />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <div className="border-y bg-muted/30">
          <div className="container">
            <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                { stat: "Real-time", label: "catalog sync from Shopify" },
                { stat: "Multilingual", label: "WhatsApp replies in any language" },
                { stat: "24/7", label: "sales coverage, zero agent cost" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-0.5 px-6 py-5 text-center"
                >
                  <span className="text-xl font-bold text-primary">{item.stat}</span>
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Commerce features ── */}
        <section id="features" className="py-24">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="mb-14 max-w-xl">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  What it does
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-balance lg:text-4xl">
                  Three capabilities, working together
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Your store connected to WhatsApp — catalog accurate, replies
                  instant, insights growing.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                {COMMERCE_FEATURES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div
                      key={f.title}
                      className="group relative rounded-2xl border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                    >
                      {/* Hover tint */}
                      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{ background: "radial-gradient(ellipse at top left, oklch(0.60 0.20 68 / 0.04) 0%, transparent 70%)" }}
                        aria-hidden
                      />
                      <div className="relative">
                        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors duration-300 group-hover:bg-primary/15">
                          <Icon className="size-5 text-primary" strokeWidth={1.5} />
                        </div>
                        <h3 className="mb-2 font-semibold">{f.title}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
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

        {/* ── How it works ── */}
        <section id="how-it-works" className="border-t bg-muted/30 py-24">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="mb-14 text-center">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  Setup
                </p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
                  Live in minutes
                </h2>
              </div>

              <div className="grid gap-10 md:grid-cols-3">
                {[
                  {
                    step: "01",
                    icon: ShoppingBag,
                    title: "Install from Shopify App Store",
                    description:
                      "Add Peakhour to your store. Catalog sync starts automatically — no CSV exports, no manual setup.",
                  },
                  {
                    step: "02",
                    icon: MessageCircle,
                    title: "Connect WhatsApp Business",
                    description:
                      "Link your WhatsApp Business number in one click. Shoppers can now ask questions and get instant, accurate answers.",
                  },
                  {
                    step: "03",
                    icon: Zap,
                    title: "AI handles the rest",
                    description:
                      "Track conversations, see what shoppers ask most, and spot gaps in your catalog — while your store runs 24/7.",
                  },
                ].map((s, idx) => {
                  const StepIcon = s.icon;
                  return (
                    <div key={s.step} className="relative flex flex-col items-center text-center">
                      {/* Connector line */}
                      {idx < 2 && (
                        <div className="absolute top-8 left-[calc(50%+3rem)] hidden h-px w-[calc(100%-6rem)] border-t border-dashed border-border md:block" />
                      )}
                      <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
                        <StepIcon className="size-6 text-primary-foreground" strokeWidth={1.5} />
                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px] font-bold ring-1 ring-border">
                          {idx + 1}
                        </span>
                      </div>
                      <h3 className="mb-2 font-semibold">{s.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Launch partner CTA ── */}
        <section className="py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="relative overflow-hidden rounded-3xl border bg-background px-8 py-10 shadow-sm lg:px-14 lg:py-14">
                {/* Dot grid texture */}
                <div
                  className="pointer-events-none absolute inset-0"
                  aria-hidden
                  style={{
                    backgroundImage:
                      "radial-gradient(oklch(from var(--primary) calc(l * 0.7) calc(c * 1.8) h / 0.12) 1.5px, transparent 1.5px)",
                    backgroundSize: "28px 28px",
                    maskImage: "radial-gradient(ellipse 60% 60% at 100% 0%, black 0%, transparent 70%)",
                    WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 100% 0%, black 0%, transparent 70%)",
                  }}
                />
                {/* Amber glow accent */}
                <div
                  className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl"
                  style={{ background: "oklch(0.60 0.20 68 / 0.12)" }}
                  aria-hidden
                />
                <div className="relative">
                  <Badge className="mb-5 gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                    Founding Partner Program · Limited spots
                  </Badge>
                  <h2 className="text-2xl font-bold tracking-tight text-balance lg:text-3xl">
                    Be among the first Shopify merchants on Peakhour
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    We&apos;re opening early access to a small cohort of Shopify
                    merchants who will help shape the product before public
                    launch. You get locked-in pricing, direct access to the
                    team, and first say on what we build next.
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

        {/* ── What's next — Content + Growth teasers ── */}
        <section className="border-t py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 flex items-center gap-2">
                <Layers className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  What&apos;s next on Peakhour
                </span>
              </div>
              <p className="mb-8 max-w-xl text-muted-foreground">
                Commerce is just the beginning. Two more pillars are in
                development for merchants who want to grow beyond WhatsApp.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                {WHAT_IS_NEXT.map((pillar) => (
                  <div
                    key={pillar.label}
                    className="flex flex-col gap-1 rounded-2xl border bg-muted/20 px-6 py-5 sm:flex-1"
                  >
                    <span className="text-sm font-semibold">{pillar.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {pillar.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
