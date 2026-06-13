import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TrendingUp, Target, BarChart2, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Growth — Peakhour",
  description:
    "Ads intelligence, audience analytics, and growth benchmarks — coming soon on Peakhour. Get early access.",
};

const FEATURES = [
  {
    icon: Target,
    title: "Ads intelligence",
    description:
      "See what creatives and copy are working across Meta, X, and Google — not just for you, but against your cohort. Stop guessing; start scaling what works.",
  },
  {
    icon: BarChart2,
    title: "Audience analytics",
    description:
      "Understand who your best customers are, what they respond to, and where they drop off. Slice by channel, campaign, and cohort.",
  },
  {
    icon: TrendingUp,
    title: "Growth benchmarks",
    description:
      "Compare your acquisition costs, conversion rates, and content performance against merchants like you. Know where you stand and what to fix first.",
  },
  {
    icon: Lightbulb,
    title: "AI-driven recommendations",
    description:
      "Close the loop between content, commerce, and ads. Peakhour identifies the patterns that drive revenue and surfaces the next best action.",
  },
] as const;

export default function GrowthPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(oklch(from var(--primary) calc(l * 0.7) calc(c * 1.8) h / 0.10) 1.5px, transparent 1.5px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div
            className="pointer-events-none absolute -right-32 top-0 -z-10 h-[500px] w-[600px] translate-x-1/4 -translate-y-1/4 rounded-full bg-primary/8 blur-3xl"
            aria-hidden
          />
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="mb-5 gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                Coming soon · Growth pillar
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Know what&apos;s working.{" "}
                <span className="text-primary">Scale it faster.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Ads intelligence, audience analytics, and performance benchmarks
                that close the loop between what you publish, what you sell, and
                what you should do next. Peakhour Growth is in development —
                and founding partners get first access.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="gap-2 px-8">
                  <Link href="/launch-partner">
                    Join the waitlist
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/commerce">See Peakhour Commerce →</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="border-t py-20">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                What&apos;s coming
              </p>
              <h2 className="mb-12 text-3xl font-bold tracking-tight">
                Intelligence that compounds over time
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {FEATURES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div
                      key={f.title}
                      className="group rounded-2xl border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                    >
                      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15">
                        <Icon className="size-5 text-primary" strokeWidth={1.5} />
                      </div>
                      <h3 className="mb-2 font-semibold">{f.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {f.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Commerce first CTA ── */}
        <section className="border-t bg-muted/30 py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Peakhour Growth launches after Commerce and Content.{" "}
                <Link href="/commerce" className="text-primary underline-offset-4 hover:underline">
                  See what&apos;s live now →
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
