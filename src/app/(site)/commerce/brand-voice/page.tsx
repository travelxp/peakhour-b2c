import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Brain,
  Gauge,
  Languages,
  BookOpen,
  RefreshCw,
  Pencil,
  ThumbsUp,
  ChevronLeft,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Shopify AI Recommendations with Your Brand Voice — Peakhour",
  description:
    "AI recommendations that sound like your brand wrote them. Auto-synthesised from your Shopify catalog. Commerce Voice Cards learn from every approval and rejection — gets better with every campaign.",
};

const FEATURES = [
  {
    icon: Sparkles,
    title: "Auto-synthesised on first connect",
    description:
      "No forms to fill. On your first catalog sync, Peakhour analyzes your product titles, tags, and descriptions to build your initial voice card automatically.",
  },
  {
    icon: BookOpen,
    title: "Brand register detection",
    description:
      "Peakhour infers your brand register: editorial or casual? Premium or accessible? Aspirational or practical? The voice card reflects how your catalog actually speaks.",
  },
  {
    icon: Languages,
    title: "Cultural vocabulary (India / GCC / SEA)",
    description:
      "A fashion brand targeting India uses different vocabulary than one targeting the GCC. Peakhour's voice synthesis is culturally aware — not just linguistically translated.",
  },
  {
    icon: BookOpen,
    title: "Category-specific terms",
    description:
      "Different product categories in the same store can have different voice profiles. Footwear copy is different from home decor copy — Peakhour tracks both separately.",
  },
  {
    icon: ThumbsUp,
    title: "Learning loop from approvals",
    description:
      "Every campaign approval, title edit, or rejection teaches the voice card. After 20 campaigns, Peakhour generates titles you wouldn't change. After 50, they sound like your copy team.",
  },
  {
    icon: Pencil,
    title: "Rail title generation",
    description:
      "Every Smart Rail gets an AI-generated title in your voice — not a generic category label. 'The Linen Edit — Last 12 Pieces' instead of 'Dead Stock Clearance'.",
  },
  {
    icon: Sparkles,
    title: "Campaign copy in your voice",
    description:
      "WhatsApp campaign messages, push notifications, and email subject lines — all generated in your brand voice, from your actual product data and intelligence scores.",
  },
  {
    icon: RefreshCw,
    title: "Rejection signals refine the model",
    description:
      "If you change 'Sale' to 'End of Season Edit', Peakhour learns that 'Sale' is not in your vocabulary. Negative signals are as valuable as positive ones for voice refinement.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "First catalog sync: Peakhour analyzes product titles, tags, and descriptions",
    description:
      "When your Shopify catalog syncs for the first time, Peakhour's voice synthesis engine reads every product title, tag, and description. It's looking for vocabulary patterns, formality register, cultural markers, and the words you use most vs. the words generic SaaS systems use.",
  },
  {
    step: "02",
    title: "Voice card auto-synthesised: brand register, preferred vocabulary, cultural context",
    description:
      "A Commerce Voice Card is created automatically. It captures: your brand's formality register, preferred category vocabulary, cultural context (India/GCC/SEA), and a 'never use' list inferred from what's absent in your copy. No forms. No setup calls.",
  },
  {
    step: "03",
    title: "AI recommendations generated daily — titles in your voice, discount and duration suggested",
    description:
      "Daily recommendations arrive with rail titles and campaign copy already in your brand voice. A fashion brand sees 'The Linen Edit — Last 12 Pieces'. A kitchenware brand sees 'The Summer Cookware Clear-Out — 48 Hours Only'. Same product type. Different voice.",
  },
  {
    step: "04",
    title: "Every approval/rejection teaches the voice card — gets smarter automatically",
    description:
      "When you approve a title unchanged, Peakhour marks it as good. When you edit it (changing 'clearance' to 'curated edit'), it learns the substitution. When you reject, it learns the pattern to avoid. After 20–50 campaigns, the voice card is precise enough that you rarely need to edit.",
  },
];

export default function BrandVoicePage() {
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
                  <Sparkles className="size-3" />
                  Commerce Voice Cards
                </Badge>
                <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                  AI Recommendations & Brand Voice
                </Badge>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                AI recommendations that sound like{" "}
                <span className="text-primary">your brand wrote them</span>
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Commerce Voice Cards are auto-synthesised from your catalog on
                first connect. Peakhour infers your brand register, preferred
                vocabulary, and cultural context — no forms, no setup. Gets
                smarter with every campaign you approve or reject.
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
                  "Auto-synthesised — no setup forms",
                  "Learns from every approval and rejection",
                  "India / GCC / SEA cultural vocabulary",
                  "Gets smarter after every campaign",
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

        {/* ── Voice example callout ── */}
        <div className="border-y bg-muted/30">
          <div className="container">
            <div className="mx-auto max-w-5xl py-12">
              <div className="mb-8 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  The difference
                </p>
                <h2 className="mt-2 text-2xl font-bold">Same product. Different voice.</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border bg-background px-6 py-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Generic SaaS output
                  </p>
                  <div className="space-y-2">
                    {[
                      "Dead Stock Clearance",
                      "Sale — Up to 40% Off",
                      "Clearance Items",
                      "Discounted Products",
                    ].map((label) => (
                      <div key={label} className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground line-through">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-6 py-5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">
                    Peakhour in your brand voice
                  </p>
                  <div className="space-y-2">
                    {[
                      "The Linen Edit — Last 12 Pieces",
                      "Season's End · Limited Stock",
                      "The Curated Clear-Out — 48 Hours",
                      "New Season In. Time to Move These Out.",
                    ].map((label) => (
                      <div key={label} className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm font-medium">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Generated from your catalog. In your voice. Not a template — a learned synthesis.
              </p>
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
                  From catalog to voice card to campaign copy
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Four steps, fully automatic. You never fill a form. You never
                  define a style guide. Peakhour reads your catalog and learns
                  your voice from what&apos;s already there.
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
                  Everything Commerce Voice Cards includes
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Eight capabilities that turn generic AI output into
                  brand-consistent commerce copy — synthesised from your catalog,
                  refined by your behaviour.
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

        {/* ── Learning loop callout ── */}
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
                    The moat
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight text-balance lg:text-3xl">
                    &ldquo;The Linen Edit — Last 12 Pieces&rdquo; vs &ldquo;Dead Stock Clearance&rdquo;. That&apos;s the difference.
                  </h2>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    Generic commerce AI generates generic commerce copy. When
                    every app uses the same underlying model, every Shopify store
                    gets the same vocabulary — &ldquo;sale&rdquo;, &ldquo;clearance&rdquo;, &ldquo;deal&rdquo;.
                    Commerce Voice Cards are trained on your store specifically.
                  </p>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    A fashion brand in India that uses &ldquo;edit&rdquo; and &ldquo;pieces&rdquo; gets
                    those words back in every recommendation title. A kitchenware
                    brand that never uses &ldquo;limited time&rdquo; never sees it. The
                    moat deepens with every campaign — your competitor can&apos;t
                    copy a voice card they don&apos;t have.
                  </p>
                  <div className="mt-6 space-y-2">
                    {[
                      { milestone: "After 1st connect", outcome: "Initial voice card synthesised from catalog" },
                      { milestone: "After 10 campaigns", outcome: "Vocabulary precision noticeably better" },
                      { milestone: "After 20 campaigns", outcome: "Titles rarely need editing" },
                      { milestone: "After 50 campaigns", outcome: "Sounds like your copy team wrote it" },
                    ].map((m) => (
                      <div key={m.milestone} className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5">
                        <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {m.milestone}
                        </span>
                        <span className="text-sm text-muted-foreground">{m.outcome}</span>
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
                Recommendations in your voice. Starting today.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Apply as a launch partner. Voice card synthesises automatically
                on first catalog sync. No setup, no forms, no style guide to
                write — just a better AI from day one.
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
