import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Gauge,
  Zap,
  Shield,
  BarChart2,
  RefreshCw,
  MessageCircle,
  FileText,
  Undo2,
  ChevronLeft,
  Check,
  Bot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Shopify Autopilot Commerce — Peakhour",
  description:
    "Set your guardrails once. Peakhour runs your Shopify merchandising operation autonomously — scoring, recommending, executing, and reporting. You only hear from it when something needs you.",
};

const FEATURES = [
  {
    icon: Gauge,
    title: "Merchant-defined guardrails",
    description:
      "Set your rules once: max discount %, margin floor, excluded collections, new arrivals protection, campaign duration limit, revenue threshold for auto-execute. Peakhour never crosses them.",
  },
  {
    icon: Zap,
    title: "Autonomous campaign execution",
    description:
      "When a recommendation passes all guardrails, Peakhour executes without waiting for approval — discount created in Shopify, Smart Rail updated, campaign tracked. Zero clicks.",
  },
  {
    icon: Shield,
    title: "Stop-loss rules",
    description:
      "If a campaign scores more than 100 impressions with fewer than 5 clicks after 24 hours, Peakhour sends a WhatsApp alert and waits for your instruction before continuing.",
  },
  {
    icon: Undo2,
    title: "Rollback in one tap",
    description:
      "If you want to stop a running campaign, one tap in Shopify Admin or a WhatsApp reply deactivates the discount and Smart Rail immediately — no lag, no support ticket.",
  },
  {
    icon: FileText,
    title: "Full audit log (append-only)",
    description:
      "Every autopilot decision is logged: what triggered it, which guardrails it passed, what it executed, and what the outcome was. Append-only — no decision can be quietly deleted.",
  },
  {
    icon: BarChart2,
    title: "Peaks ROI dashboard",
    description:
      "See the ROI of every AI decision in Shopify Admin. This week: 14 AI decisions, 620 Peaks spent, ₹61,400 recovered. Every credit has a measurable return.",
  },
  {
    icon: RefreshCw,
    title: "Nightly learning loop",
    description:
      "Every night, Peakhour updates the voice card and recommendation bias based on what worked and what didn't. Autopilot gets smarter with every cycle — without configuration.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp alerts for exceptions only",
    description:
      "When autopilot is running well, you hear nothing. You only get a WhatsApp message when something needs a decision — a stop-loss trigger, a guardrail edge case, or a high-value opportunity.",
  },
];

const GUARDRAILS = [
  { label: "Max discount %", example: "e.g. Never offer more than 25% off" },
  { label: "Margin floor", example: "e.g. Never go below 40% margin per unit" },
  { label: "Excluded collections", example: "e.g. Never touch New Arrivals or Premium Line" },
  { label: "New arrivals protection", example: "e.g. Products < 30 days old are off-limits" },
  { label: "Campaign duration limit", example: "e.g. No campaign longer than 72 hours" },
  { label: "Revenue threshold", example: "e.g. Only auto-execute if expected recovery > ₹20,000" },
];

const STEPS = [
  {
    step: "01",
    title: "Merchant sets guardrails: max discount, excluded products, revenue threshold",
    description:
      "One-time setup in Shopify Admin. Six guardrails that define the boundary within which Peakhour can operate autonomously. These are your rules — Peakhour enforces them on every recommendation it considers executing.",
  },
  {
    step: "02",
    title: "Daily recommendation generated from intelligence data",
    description:
      "Every morning, Peakhour's intelligence layer runs: dead-stock scores updated, velocity trends recalculated, voice card reviewed. The best recovery opportunity is identified and a campaign recommendation is drafted.",
  },
  {
    step: "03",
    title: "Autopilot checks every guardrail — if passed, campaign executes automatically",
    description:
      "The recommendation is evaluated against all six guardrails. Discount within limit? Margin floor protected? Not in an excluded collection? Not a new arrival? Revenue threshold met? If every check passes, the campaign executes — discount live in Shopify, Smart Rail updated, campaign running.",
  },
  {
    step: "04",
    title: "Stop-loss monitors live campaigns; underperformers get a WhatsApp alert",
    description:
      "Every active campaign is monitored in real time. If a campaign accumulates over 100 impressions with fewer than 5 clicks within 24 hours, autopilot triggers stop-loss: a WhatsApp alert arrives with the performance data and options to stop the campaign or continue.",
  },
  {
    step: "05",
    title: "Nightly learning loop updates the voice card and recommendation bias",
    description:
      "After every campaign — approved manually or executed by autopilot — the outcome feeds the learning model. What discount level performed well at what margin? Which product clusters responded? The recommendation engine adjusts. Autopilot gets more precise over time.",
  },
];

export default function AutopilotPage() {
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
                  <Bot className="size-3" />
                  Fully autonomous
                </Badge>
                <Badge className="gap-1 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                  Autopilot
                </Badge>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                Set your guardrails once.{" "}
                <span className="text-primary">Peakhour runs the operation.</span>
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                The store works while you sleep, but you&apos;re always the boss.
                When autopilot is enabled, Peakhour evaluates recommendations
                against merchant-defined guardrails and, if they pass, executes
                campaigns without waiting for approval. Every decision is logged.
                Stop-loss rules protect against underperforming campaigns. You
                only hear from Peakhour when something needs you.
              </p>

              <div className="w-full max-w-lg rounded-2xl border bg-muted/40 px-5 py-4 text-left text-sm leading-relaxed">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                  This week&apos;s autopilot summary
                </p>
                <p className="text-muted-foreground">
                  14 AI decisions, 620 Peaks spent,{" "}
                  <span className="font-bold text-primary">₹61,400 of inventory recovered</span>.
                  Total transparency — you can judge for yourself whether your
                  AI teammate is earning its keep.
                </p>
              </div>

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
                  "Merchant-defined guardrails",
                  "Stop-loss rules protect every campaign",
                  "Full audit log — append-only",
                  "WhatsApp alerts for exceptions only",
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

        {/* ── Guardrails visual ── */}
        <section className="border-y bg-muted/30 py-16">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="grid gap-10 md:grid-cols-2 md:items-start">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                    Six guardrails
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">
                    Your rules. Peakhour never crosses them.
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Set your business boundaries once — max discount, margin
                    floor, protected collections, new arrivals protection,
                    campaign duration, and minimum revenue threshold. Autopilot
                    evaluates every recommendation against all six before
                    executing a single action.
                  </p>
                  <div className="mt-6 space-y-2.5">
                    {GUARDRAILS.map((g) => (
                      <div key={g.label} className="flex items-start gap-3 rounded-xl border bg-background px-4 py-3">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Check className="size-3 text-primary" strokeWidth={3} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{g.label}</p>
                          <p className="text-xs text-muted-foreground">{g.example}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border bg-background p-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
                      Example: autopilot decision log
                    </p>
                    <div className="space-y-2.5">
                      {[
                        { time: "07:14", action: "Recommendation generated", detail: "Linen Kurtis · 14 SKUs · score 78" },
                        { time: "07:14", action: "Guardrail: discount check", detail: "Suggested 20% · limit 25% ✓" },
                        { time: "07:14", action: "Guardrail: margin floor", detail: "Margin at 42% · floor 40% ✓" },
                        { time: "07:14", action: "Guardrail: collection exclusion", detail: "Not in New Arrivals ✓" },
                        { time: "07:14", action: "Guardrail: revenue threshold", detail: "Expected ₹48k · threshold ₹20k ✓" },
                        { time: "07:15", action: "Campaign executed", detail: "Discount live · Smart Rail updated" },
                      ].map((entry) => (
                        <div key={entry.action} className="flex items-start gap-3">
                          <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {entry.time}
                          </span>
                          <div>
                            <p className="text-xs font-semibold">{entry.action}</p>
                            <p className="text-[11px] text-muted-foreground">{entry.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
                    <p className="text-xs font-semibold text-primary">This week&apos;s autopilot summary</p>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {[
                        { value: "14", label: "AI decisions" },
                        { value: "620", label: "Peaks spent" },
                        { value: "₹61,400", label: "Recovered" },
                      ].map((stat) => (
                        <div key={stat.label} className="text-center">
                          <p className="text-lg font-bold text-primary">{stat.value}</p>
                          <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                        </div>
                      ))}
                    </div>
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
              <div className="mb-14">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  How it works
                </p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
                  From guardrails to autonomous execution
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Five steps. You configure it once. Peakhour runs it every day —
                  and only interrupts you when something genuinely needs your
                  decision.
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
                  The merchandising operation that runs itself
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Eight capabilities — from guardrail enforcement through
                  stop-loss protection to nightly learning. Autonomous, but never
                  a black box.
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

        {/* ── Main callout ── */}
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
                    The promise
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight text-balance lg:text-3xl">
                    &ldquo;The merchandising operation runs itself. You only hear from Peakhour when something needs you.&rdquo;
                  </h2>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    The Peakhour autopilot is not an AI that asks you questions
                    and waits for instructions. It&apos;s a system that evaluates,
                    decides, executes, and learns — within boundaries you set
                    once. You&apos;re not in the loop on routine decisions.
                  </p>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    You&apos;re in the loop when a campaign underperforms beyond
                    the stop-loss threshold. When a new product category appears
                    that wasn&apos;t in your original guardrails. When the recommended
                    discount would push a product below your margin floor. Those
                    are the moments Peakhour sends a WhatsApp message. Not routine
                    execution — only genuine exceptions.
                  </p>
                  <div className="mt-6 rounded-xl border bg-muted/40 px-5 py-4">
                    <p className="text-xs font-semibold text-muted-foreground">Example Peaks ROI summary</p>
                    <p className="mt-2 text-sm">
                      This week: <strong>14 AI decisions</strong> ·{" "}
                      <strong>620 Peaks spent</strong> ·{" "}
                      <strong className="text-primary">₹61,400 recovered</strong>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You were involved in 0 of those 14 decisions. 2 stop-loss alerts were triggered; both resolved automatically.
                    </p>
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
                Your merchandising operation. Autonomous.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Apply as a launch partner and get early access to autopilot —
                with full guardrail configuration, stop-loss rules, and Peaks ROI
                tracking — before public launch.
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
