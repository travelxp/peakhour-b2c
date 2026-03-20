import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

const FEATURES = [
  {
    title: "Content Intelligence",
    description:
      "Every piece of content is automatically tagged across 12 dimensions. Know which topics, audiences, and angles drive results.",
    detail:
      "Connects to any content platform, 12-dimension auto-tagger, content gap analysis",
  },
  {
    title: "AI Creative Factory",
    description:
      "Turn one newsletter into 10+ platform-native ad creatives in minutes. LinkedIn Lead Gen, Meta, Google — all from your content.",
    detail: "AI generates headlines, body copy, and image briefs",
  },
  {
    title: "Optimization Engine",
    description:
      "AI monitors performance hourly. Underperformers get paused, winners get boosted, budgets get rebalanced automatically.",
    detail: "Daily optimization, weekly strategy, monthly pattern mining",
  },
] as const;

const STEPS = [
  {
    step: "1",
    title: "Add your business",
    description:
      "Paste your website URL or describe what you do. AI discovers your brand, audience, and builds a strategy in minutes.",
  },
  {
    step: "2",
    title: "AI tags and creates ads",
    description:
      "Our AI reads every piece of content, tags it across 12 dimensions, scores ad potential, and generates platform-native creatives.",
  },
  {
    step: "3",
    title: "Launch and grow on autopilot",
    description:
      "Deploy to LinkedIn, Google, or Meta. The AI monitors hourly, pauses losers, boosts winners, and rebalances budgets — all hands-free.",
  },
] as const;

const PLANS = [
  {
    name: "Free",
    price: "0",
    description: "See what AI can do with your content",
    features: [
      "50 content pieces tagged",
      "Ad creative preview",
      "Content gap analysis",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "7,499",
    description: "Full AI marketing engine for growing businesses",
    features: [
      "Unlimited content tagging",
      "2 ad platforms",
      "Full optimization engine",
      "Pattern mining & insights",
      "Lead tracking",
    ],
    cta: "Get started",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "19,999",
    description: "For businesses ready to scale aggressively",
    features: [
      "Everything in Growth",
      "All ad platforms",
      "Subscriber enrichment",
      "Custom taxonomy",
      "API access",
    ],
    cta: "Get started",
    highlighted: false,
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Your AI Marketing Department
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              PeakHour turns your content into high-performing ads across every
              platform. Content intelligence, creative factory, and optimization
              engine — all powered by AI, all on autopilot.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/auth">Start free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#how-it-works">How it works</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t bg-muted/40 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-bold">
              Three engines, one platform
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Everything your marketing team does — content analysis, ad
              creation, performance optimization — automated by AI.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title}>
                  <CardHeader>
                    <CardTitle className="text-lg">{f.title}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{f.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-bold">
              Up and running in 3 steps
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.step} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    {s.step}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t bg-muted/40 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-bold">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Start free. Upgrade when you&apos;re ready to launch ads.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {PLANS.map((plan) => (
                <Card
                  key={plan.name}
                  className={
                    plan.highlighted
                      ? "relative border-primary shadow-lg"
                      : undefined
                  }
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                      Most popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold">
                        &#8377;{plan.price}
                      </span>
                      {plan.price !== "0" && (
                        <span className="text-sm text-muted-foreground">
                          /month
                        </span>
                      )}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <svg
                            aria-hidden="true"
                            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      <Link href="/auth">{plan.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-bold">
              Stop doing marketing. Start growing.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Join businesses that replaced their marketing busywork with an AI
              engine that works 24/7.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/auth">Get started free</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
