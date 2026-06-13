import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Zap, Globe2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "About — Peakhour",
  description:
    "Peakhour is building AI that helps merchants sell more — starting with WhatsApp for Shopify. Learn who we are and why we're building this.",
};

const VALUES = [
  {
    icon: Zap,
    title: "Merchants first",
    description:
      "Every feature we ship has a direct, measurable impact for the merchant. No vanity metrics, no feature theatre — just more revenue and less manual work.",
  },
  {
    icon: Globe2,
    title: "Built for merchants everywhere",
    description:
      "WhatsApp is the fastest-growing commerce channel in the world. We're building for the merchants who serve their customers there — from New York to London to São Paulo.",
  },
  {
    icon: Users,
    title: "Small team, big surface area",
    description:
      "We're a focused founding team that moves fast. Founding partners get direct access to us — not a support queue, not a chatbot.",
  },
] as const;

export default function AboutPage() {
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
                "radial-gradient(oklch(from var(--primary) calc(l * 0.7) calc(c * 1.8) h / 0.12) 1.5px, transparent 1.5px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div
            className="pointer-events-none absolute right-0 top-0 -z-10 h-125 w-150 translate-x-1/3 -translate-y-1/4 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <Badge variant="outline" className="mb-5 gap-1.5 px-3 py-1 text-xs">
                Our story
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Every hour is{" "}
                <span className="text-primary">Peakhour</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                We started Peakhour because we watched smart merchants lose sales
                to slow replies. A shopper asks about a product at 11 PM, gets no
                answer until morning, and buys elsewhere. That gap is the
                problem we&apos;re solving.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                We&apos;re building AI commerce infrastructure — starting with the
                channel where most of the world already shops: WhatsApp. Every
                hour your store is live on WhatsApp is a potential peak hour.
              </p>
            </div>
          </div>
        </section>

        {/* ── Values ── */}
        <section className="border-t py-20">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                How we work
              </p>
              <h2 className="mb-12 text-3xl font-bold tracking-tight">
                What we stand for
              </h2>
              <div className="grid gap-6 md:grid-cols-3">
                {VALUES.map((v) => {
                  const Icon = v.icon;
                  return (
                    <div
                      key={v.title}
                      className="group rounded-2xl border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                    >
                      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15">
                        <Icon className="size-5 text-primary" strokeWidth={1.5} />
                      </div>
                      <h3 className="mb-2 font-semibold">{v.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {v.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── What we're building ── */}
        <section className="border-t bg-muted/30 py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                The bigger picture
              </p>
              <h2 className="mb-6 text-3xl font-bold tracking-tight">
                Three pillars, one platform
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  We&apos;re building Peakhour in three acts. <strong className="text-foreground">Commerce</strong> comes
                  first — catalog-aware AI on WhatsApp for Shopify merchants.
                  Once that&apos;s proven, we add <strong className="text-foreground">Content</strong> — AI writers,
                  news desk, and multi-format publishing so merchants can feed
                  every channel with brand-consistent content, automatically.
                </p>
                <p className="leading-relaxed">
                  The third act is <strong className="text-foreground">Growth</strong> — ads intelligence, audience
                  analytics, and performance benchmarks that close the loop
                  between what you publish, what you sell, and what you should
                  do next.
                </p>
                <p className="leading-relaxed">
                  We&apos;re not building three separate products. We&apos;re building one
                  intelligence layer that compounds across commerce, content, and
                  growth — each pillar making the others smarter.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">
                Shape the product from day one
              </h2>
              <p className="mt-3 text-muted-foreground">
                We&apos;re accepting a small founding cohort of Shopify merchants who
                want to be part of building this. You&apos;ll get direct access to the
                team, locked-in pricing, and first say on what we build.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="gap-2 px-8">
                  <Link href="/launch-partner">
                    Apply as a launch partner
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/commerce">See Peakhour Commerce</Link>
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
