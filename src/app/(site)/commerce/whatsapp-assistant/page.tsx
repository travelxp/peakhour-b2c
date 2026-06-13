import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  MessageCircle,
  Languages,
  Clock,
  Database,
  BotMessageSquare,
  MonitorSmartphone,
  History,
  ShieldCheck,
  Zap,
  Check,
  ChevronLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { resolveMarketingLocale } from "@/lib/marketing-locale";

export const metadata: Metadata = {
  title: "Shopify WhatsApp Assistant — Peakhour",
  description:
    "AI that knows your entire Shopify catalog. Answers shoppers on WhatsApp 24/7 in their language — stock, pricing, variants, delivery, returns. Zero agent time.",
};

const FEATURES = [
  {
    icon: Database,
    title: "Catalog-grounded accuracy",
    description:
      "Every answer is pulled from your live Shopify catalog — products, variants, stock levels, prices. No hallucinations, no outdated information, no wrong prices.",
  },
  {
    icon: Languages,
    title: "Multilingual by default",
    description:
      "Replies in the shopper's language: Spanish, French, Dutch, Portuguese, German, and more. Built for the reality that your customers shop in their own language.",
  },
  {
    icon: Clock,
    title: "24/7 availability",
    description:
      "Your catalog never sleeps. Shoppers ask at 2am on a Sunday — they get an instant, accurate answer. No agent shift, no support queue, no wait time.",
  },
  {
    icon: BotMessageSquare,
    title: "In-app assistant for merchants",
    description:
      "Ask your catalog anything from inside Shopify Admin. What's low on stock? What's trending this week? What needs a price review? Your data, answered instantly.",
  },
  {
    icon: Zap,
    title: "Live stock & pricing",
    description:
      "Catalog sync keeps the assistant grounded in real-time data. Variant-level stock, current prices, sale prices — the assistant always answers from the latest state.",
  },
  {
    icon: MonitorSmartphone,
    title: "On-store chat widget",
    description:
      "Catalog-grounded chat on your storefront for anonymous shoppers. One seamless sign-in nudge converts them into known customers before WhatsApp handoff.",
  },
  {
    icon: History,
    title: "Conversation history",
    description:
      "Full conversation history in Shopify Admin. See what shoppers asked, what the assistant answered, and which conversations converted to an order.",
  },
  {
    icon: ShieldCheck,
    title: "Zero markup on WhatsApp charges",
    description:
      "WhatsApp messaging fees go directly from your Meta account to Meta. Peakhour takes zero cut — ever. No hidden margin on your message costs.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Shopper sends a message to your WhatsApp Business number",
    description:
      "Any question — 'Do you have this in size M?', 'When will my order arrive?', 'What's the price in USD?' — arrives on your connected WhatsApp Business number.",
  },
  {
    step: "02",
    title: "Peakhour pulls live data from your Shopify catalog",
    description:
      "The assistant queries your catalog in real time: product details, variant-level stock, current prices, and any active discounts. No caching, no stale data.",
  },
  {
    step: "03",
    title: "AI generates a grounded reply in the shopper's language",
    description:
      "The reply is generated from your actual product data — not a general LLM guess. Spanish, French, Dutch, Portuguese: the assistant matches the shopper's language naturally.",
  },
  {
    step: "04",
    title: "Optional: handoff to on-store chat or human agent",
    description:
      "Complex queries or purchase-ready shoppers can be handed off to your on-store chat widget or a human agent — with full conversation context carried over.",
  },
];

export default async function WhatsAppAssistantPage() {
  const locale = await resolveMarketingLocale();
  const langStr = locale.languages.slice(0, 3).join(", ");
  const langStrip = locale.languages.slice(0, 4).join(" · ");

  const features = FEATURES.map((f) =>
    f.title === "Multilingual by default"
      ? {
          ...f,
          description: `Replies in the shopper's language: ${langStr}, and more. Built for the reality that your customers shop in their own language.`,
        }
      : f,
  );
  const steps = STEPS.map((s) =>
    s.step === "03"
      ? {
          ...s,
          description: `The reply is generated from your actual product data — not a general LLM guess. ${langStr}: the assistant matches the shopper's language naturally.`,
        }
      : s,
  );

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
                  <MessageCircle className="size-3" />
                  WhatsApp-first
                </Badge>
                <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                  AI Commerce Assistant
                </Badge>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                Your Shopify catalog,{" "}
                <span className="text-primary">answering shoppers on WhatsApp 24/7</span>
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                AI grounded in your live catalog answers every shopper question
                on your WhatsApp Business number — stock, pricing, variants,
                delivery, returns — in real time, in their language. You stop
                losing the 11pm &ldquo;do you have this in medium?&rdquo; customer. It
                never invents products: every answer comes from your real,
                synced catalog. Zero agent required.
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
                  "Zero markup on WhatsApp charges",
                  "Live catalog sync — no stale data",
                  langStrip,
                  "No agent required",
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

        {/* ── Callout stat ── */}
        <div className="border-y bg-muted/30">
          <div className="container">
            <div className="mx-auto max-w-5xl py-10">
              <div className="grid gap-6 md:grid-cols-3">
                {[
                  {
                    stat: "0%",
                    label: "markup on WhatsApp charges",
                    detail: "Paid directly from your Meta account to Meta. Peakhour takes nothing.",
                  },
                  {
                    stat: "Real-time",
                    label: "catalog grounding",
                    detail: "Every reply pulls live variant stock and current prices — not a cached snapshot.",
                  },
                  {
                    stat: "6+",
                    label: "languages supported",
                    detail: `${locale.languages.join(", ")}, English, and expanding. Natural, not translated.`,
                  },
                ].map((item) => (
                  <div key={item.stat} className="flex flex-col gap-1.5 px-2 py-4 md:px-4">
                    <div className="text-2xl font-bold text-primary">{item.stat}</div>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs leading-relaxed text-muted-foreground">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── How it works ── */}
        <section className="py-24">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="mb-14">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  How it works
                </p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
                  From shopper question to accurate reply in seconds
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  No agent routing, no knowledge-base maintenance, no scripted flows.
                  The assistant reads your live catalog and answers directly.
                  You&apos;ll be live before your first coffee is cold — and you never
                  have to &ldquo;update the bot&rdquo;.
                </p>
              </div>

              <div className="space-y-0">
                {steps.map((s, idx) => (
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

        {/* ── Feature cards ── */}
        <section className="border-t bg-muted/20 py-24">
          <div className="container">
            <div className="mx-auto max-w-6xl">
              <div className="mb-14">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  Full feature set
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-balance lg:text-4xl">
                  Everything the WhatsApp assistant includes
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  No stale data. No wrong prices. No agent time. Every capability
                  is live from the moment you connect your WhatsApp Business number.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {features.map((f) => {
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

        {/* ── Trust callout ── */}
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
                <div className="relative max-w-2xl">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                    The difference
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight text-balance lg:text-3xl">
                    "No stale data. No wrong prices. No agent time."
                  </h2>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    Most WhatsApp chatbots are scripted flows built on a static
                    knowledge base that someone has to maintain. When you change
                    a price or a product goes out of stock, the bot still gives
                    the old answer.
                  </p>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    Peakhour&apos;s assistant is grounded in your live Shopify
                    catalog. Every answer is generated from what your store
                    actually shows right now — variant-level stock, current
                    prices, active discounts. It can&apos;t give a wrong price
                    because it doesn&apos;t have a stored price to be wrong about.
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
                    <ShieldCheck className="size-4" />
                    Zero markup on WhatsApp charges — paid directly to Meta
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
                Your WhatsApp number. Your catalog. 24/7.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Apply as a launch partner and get early access to the WhatsApp
                assistant before public launch — with founding-partner pricing
                locked in forever.
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
