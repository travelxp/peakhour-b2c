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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { getPricing } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Shopify Commerce Assistant — Peakhour",
  description:
    "AI that answers your Shopify shoppers on WhatsApp in real time. Catalog sync, multilingual replies, and actionable insights — starting free.",
};

const FEATURES = [
  {
    icon: RefreshCw,
    title: "Automatic catalog sync",
    description:
      "Products, prices, and stock levels sync continuously from your Shopify store. Your AI always answers from live data — never stale.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp assistant",
    description:
      "Answers shoppers on your WhatsApp Business number around the clock. Natural conversation, accurate answers, zero agent time.",
  },
  {
    icon: BotMessageSquare,
    title: "In-app assistant",
    description:
      "Chat with your catalog right inside Shopify admin. Ask what's low on stock, what's trending, what needs a price update — instantly.",
  },
  {
    icon: Languages,
    title: "Multilingual replies",
    description:
      "Replies in the shopper's own language — including Hinglish. Reach every customer in the language they're most comfortable with.",
  },
  {
    icon: BarChart2,
    title: "Insights Network",
    description:
      "See how your store performs against anonymised cohort benchmarks. Founding members get priority access and shape the data model.",
  },
  {
    icon: Zap,
    title: "AI Commerce Assistant",
    description:
      "The core engine: natural language, catalog-grounded, always accurate. Understands nuanced queries, suggests upsells, handles returns policy.",
  },
] as const;

const LAUNCH_BENEFITS = [
  "Early access before the public launch",
  "Direct line to the founding team",
  "Shape the product with your feedback",
  "Founding-partner pricing locked in forever",
  "Priority onboarding and setup support",
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
        {/* Hero */}
        <section className="relative overflow-hidden border-b py-24 sm:py-32">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden" aria-hidden>
            <div className="h-[600px] w-[1000px] rounded-full bg-primary/10 blur-3xl opacity-70" />
          </div>
          <div className="container">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 px-3 py-1">
                  <ShoppingBag className="size-3" />
                  Shopify Commerce
                </Badge>
                {!isLive && (
                  <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10 px-3 py-1 text-xs font-medium border-primary/20">
                    Early Access
                  </Badge>
                )}
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-pretty sm:text-5xl lg:text-6xl">
                Your catalog, always-on{" "}
                <span className="text-primary">WhatsApp</span>
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground lg:text-xl">
                AI that knows every product in your Shopify store and answers shoppers
                on WhatsApp in real time — in their own language, with live prices and stock.
              </p>

              <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
                {isLive ? (
                  <>
                    <Button asChild size="lg" className="gap-2">
                      <Link href="#plans">
                        See plans
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link href="#features">Learn more</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="lg" className="gap-2">
                      <Link href="/launch-partner">
                        Join as a launch partner
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link href="#features">See what&apos;s coming</Link>
                    </Button>
                  </>
                )}
              </div>

              {/* Shopify trust mark */}
              <p className="text-xs text-muted-foreground">
                Built for Shopify · Billed through your Shopify account · Available in the Shopify App Store
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">
                  Everything your store needs to sell smarter
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                  Six capabilities that turn your Shopify catalog into an always-on
                  sales and support assistant.
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map((f) => {
                  const FeatureIcon = f.icon;
                  return (
                    <Card key={f.title} className="card-lift">
                      <CardHeader className="pb-2">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <FeatureIcon className="size-5 text-primary" strokeWidth={1.5} />
                        </div>
                        <CardTitle className="text-base">{f.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">
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
        <section className="py-20">
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
                      "Add the Peakhour app to your store. Catalog sync starts automatically — no CSV exports, no manual setup.",
                  },
                  {
                    step: "2",
                    title: "Connect WhatsApp Business",
                    description:
                      "Link your WhatsApp Business number. Shoppers can now ask product questions and get instant, accurate answers.",
                  },
                  {
                    step: "3",
                    title: "Grow with insights",
                    description:
                      "Track conversations, see what shoppers ask most, spot gaps in your catalog, and benchmark against your cohort.",
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

        {/* Plans (dev only) OR Launch partner CTA (prod) */}
        {isLive ? (
          <section id="plans" className="border-t bg-muted/40 py-20">
            <div className="container">
              <div className="mx-auto max-w-3xl">
                <PricingGrid plans={[]} products={pricing?.products ?? []} showHeader={false} />
              </div>
            </div>
          </section>
        ) : (
          <section className="border-t bg-muted/40 py-20">
            <div className="container">
              <div className="mx-auto max-w-3xl">
                <div className="rounded-2xl border bg-background p-8 shadow-sm lg:p-12">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <Users className="size-5 text-primary" />
                    </span>
                    <div>
                      <h2 className="text-2xl font-bold">Be a founding partner</h2>
                      <p className="text-sm text-muted-foreground">Limited spots · Shopify merchants only</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-8">
                    We&apos;re opening early access to a small cohort of Shopify merchants who will
                    help shape the Commerce Assistant before public launch. Founding partners get
                    locked-in pricing, direct access to the team, and first say on what we build next.
                  </p>
                  <ul className="mb-8 space-y-3">
                    {LAUNCH_BENEFITS.map((b) => (
                      <li key={b} className="flex items-center gap-3 text-sm">
                        <Check className="size-4 shrink-0 text-primary" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Button asChild size="lg" className="gap-2">
                    <Link href="/launch-partner">
                      Apply as a launch partner
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <p className="mt-4 text-xs text-muted-foreground">
                    No credit card required. We&apos;ll reach out to confirm your spot.
                  </p>
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
