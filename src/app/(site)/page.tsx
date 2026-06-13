import Link from "next/link";
import { headers } from "next/headers";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { getPricing } from "@/lib/pricing";
import { getPublicCatalog } from "@/lib/catalog";

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

export default async function Home() {
  const h = await headers();
  const vercelCountry = h.get("x-vercel-ip-country");
  const country =
    vercelCountry && /^[A-Za-z]{2}$/.test(vercelCountry)
      ? vercelCountry.toUpperCase()
      : "DEFAULT";

  const [pricing, catalog] = await Promise.all([
    getPricing(country),
    getPublicCatalog(),
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
        {/* Hero */}
        <section className="relative overflow-hidden py-24 sm:py-32">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
            aria-hidden
          >
            <div className="h-[600px] w-[1000px] rounded-full bg-primary/10 blur-3xl opacity-70" />
          </div>
          <div className="container">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <ShoppingBag className="size-3" />
                Shopify App · Early Access
              </Badge>

              <h1 className="text-4xl font-bold tracking-tight text-pretty sm:text-5xl lg:text-6xl">
                Your Shopify store,{" "}
                <span className="text-primary">always on WhatsApp</span>
              </h1>

              <p className="max-w-2xl text-lg text-muted-foreground lg:text-xl">
                AI that knows every product in your catalog. Answers shoppers in
                real time, in their language, around the clock — so you never
                miss a sale.
              </p>

              <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/launch-partner">
                    Apply as a launch partner
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>Built for Shopify</span>
                <span aria-hidden>·</span>
                <span>WhatsApp Business</span>
                <span aria-hidden>·</span>
                <span>No credit card required</span>
                <span aria-hidden>·</span>
                <span>Limited spots</span>
              </div>
            </div>
          </div>
        </section>

        {/* Commerce features */}
        <section id="features" className="border-t bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">
                  What the Commerce Assistant does
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                  Three capabilities that turn your Shopify catalog into an
                  always-on sales assistant.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {COMMERCE_FEATURES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <Card key={f.title} className="card-lift">
                      <CardHeader className="pb-2">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Icon
                            className="size-5 text-primary"
                            strokeWidth={1.5}
                          />
                        </div>
                        <CardTitle className="text-base">{f.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {f.description}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-center text-3xl font-semibold text-pretty lg:text-4xl">
                Live in minutes
              </h2>
              <div className="mt-14 grid gap-10 md:grid-cols-3">
                {[
                  {
                    step: "1",
                    title: "Install from Shopify App Store",
                    description:
                      "Add Peakhour to your store. Catalog sync starts automatically — no CSV exports, no manual setup.",
                  },
                  {
                    step: "2",
                    title: "Connect WhatsApp Business",
                    description:
                      "Link your WhatsApp Business number in one click. Shoppers can now ask questions and get instant, accurate answers.",
                  },
                  {
                    step: "3",
                    title: "AI handles the rest",
                    description:
                      "Track conversations, see what shoppers ask most, and spot gaps in your catalog — while your store runs 24/7.",
                  },
                ].map((s) => (
                  <div key={s.step} className="relative text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
                      {s.step}
                    </div>
                    {s.step !== "3" && (
                      <div className="absolute top-7 left-[calc(50%+2rem)] hidden h-px w-[calc(100%-4rem)] bg-border md:block" />
                    )}
                    <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Launch partner section */}
        <section className="border-t bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <div className="rounded-2xl border bg-background p-8 shadow-sm lg:p-12">
                <Badge className="mb-4 gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                  Founding Partner Program · Limited spots
                </Badge>
                <h2 className="text-2xl font-bold lg:text-3xl">
                  Be among the first Shopify merchants on Peakhour
                </h2>
                <p className="mt-3 text-muted-foreground">
                  We&apos;re opening early access to a small cohort of Shopify
                  merchants who will help shape the product before public launch.
                  You get locked-in pricing, direct access to the team, and
                  first say on what we build next.
                </p>
                <ul className="mt-6 space-y-3">
                  {LAUNCH_BENEFITS.map((b) => (
                    <li key={b} className="flex items-center gap-3 text-sm">
                      <Check className="size-4 shrink-0 text-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" className="mt-8 gap-2">
                  <Link href="/launch-partner">
                    Apply as a launch partner
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <p className="mt-4 text-xs text-muted-foreground">
                  No credit card required. We&apos;ll reach out to confirm your
                  spot.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What's next — Content + Growth teasers */}
        <section className="py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-4 flex items-center justify-center gap-2">
                <Layers className="size-4 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  What&apos;s next on Peakhour
                </span>
              </div>
              <p className="mb-8 text-muted-foreground">
                Commerce is just the beginning. Two more pillars are in
                development for merchants who want to grow beyond WhatsApp.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                {WHAT_IS_NEXT.map((pillar) => (
                  <div
                    key={pillar.label}
                    className="rounded-xl border bg-muted/30 px-6 py-4 text-left sm:flex-1"
                  >
                    <p className="text-sm font-semibold">{pillar.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pillar.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing — only shown in dev when commerce_assistant product is seeded */}
        {pricing && pricing.products.length > 0 && (
          <section id="pricing" className="border-t py-20">
            <div className="container">
              <div className="mx-auto max-w-6xl">
                <PricingGrid plans={pricing.plans} products={pricing.products} />
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
