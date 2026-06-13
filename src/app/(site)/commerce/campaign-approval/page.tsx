import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  MessageCircle,
  Check,
  Clock,
  Shield,
  Zap,
  BarChart2,
  CircleDollarSign,
  History,
  StopCircle,
  ChevronLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Shopify Campaign Approval via WhatsApp — Peakhour",
  description:
    "Approve Shopify discount campaigns with a single WhatsApp reply. Peakhour creates the discount, activates the Smart Rail, tracks the campaign, and sends a results summary when it ends.",
};

const FEATURES = [
  {
    icon: MessageCircle,
    title: "WhatsApp-first approval (reply 1/2/3)",
    description:
      "Peakhour sends a structured WhatsApp message with all campaign details. Reply 1 to approve, 2 to change the discount, 3 to see the product list. No app to open.",
  },
  {
    icon: Zap,
    title: "Natural language edits via chat",
    description:
      "Free-text instructions work too. 'Change to 10% and skip the blue ones' is a valid instruction — Peakhour parses it and adjusts the campaign before creating the discount.",
  },
  {
    icon: Shield,
    title: "Shopify discount via Billing API",
    description:
      "Every discount is created through Shopify's own Billing and Discounts APIs — not workarounds. Clean, auditable, and uninstall-safe. The discount lives in Shopify Admin.",
  },
  {
    icon: BarChart2,
    title: "Campaign lifecycle tracking",
    description:
      "Pending → Approved → Running → Completed. The full campaign state is tracked in real time. Impressions, clicks, add-to-carts, and conversions all logged as the campaign runs.",
  },
  {
    icon: Clock,
    title: "Post-campaign WhatsApp summary",
    description:
      "One hour after every campaign ends, a WhatsApp summary arrives: revenue recovered, top-performing product, attribution vs. organic, and the next recommendation.",
  },
  {
    icon: History,
    title: "Campaign history in Shopify Admin",
    description:
      "Full campaign history viewable inside Shopify Admin. Every approval, every outcome, every WhatsApp exchange — logged and searchable. No separate dashboard to maintain.",
  },
  {
    icon: StopCircle,
    title: "Stop campaign from Admin",
    description:
      "If something looks off mid-campaign, you can stop it from Shopify Admin with one click. Peakhour deactivates the discount and the Smart Rail immediately.",
  },
  {
    icon: CircleDollarSign,
    title: "Zero markup on WhatsApp",
    description:
      "Campaign approval messages and post-campaign summaries are sent via WhatsApp. Like all Peakhour WhatsApp usage, fees go directly from your Meta account to Meta — no Peakhour cut.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Dead-stock intelligence identifies a recovery opportunity",
    description:
      "Peakhour's daily scoring identifies a cluster of products above the critical threshold. Risk score, velocity trend, and days-in-stock converge into a recovery recommendation — products, suggested discount %, and recommended duration.",
  },
  {
    step: "02",
    title: "Peakhour sends a WhatsApp message: products, discount, duration, expected $ recovery",
    description:
      "You receive a structured WhatsApp message: product group name, count, risk score, suggested discount, campaign duration, and expected revenue recovery range in your local currency. All from your real data.",
  },
  {
    step: "03",
    title: "Reply 1 to approve — Peakhour creates the discount in Shopify via the Billing API",
    description:
      "A single reply creates the Shopify discount code, sets the applicable product list, and activates it — all via Shopify's official Billing and Discounts API. Takes under 10 seconds from reply to live discount.",
  },
  {
    step: "04",
    title: "Smart Rail activates with the discounted products; campaign is tracked in real time",
    description:
      "The Smart Rail on your storefront updates immediately to show the discounted products with urgency labels. Every impression, click, and add-to-cart is tracked against the campaign. You can see live performance in Shopify Admin.",
  },
  {
    step: "05",
    title: "1 hour after campaign ends: WhatsApp summary arrives",
    description:
      "The campaign summary comes to you — no dashboard to open. Revenue recovered, top-performing product, attribution vs. organic baseline, and a suggested next action if stock remains. Close the loop without leaving WhatsApp.",
  },
];

const REPLY_OPTIONS = [
  { key: "1", action: "Approve", detail: "Campaign creates and goes live immediately" },
  { key: "2 [x%]", action: "Change discount", detail: "e.g. '2 10' changes the discount to 10%" },
  { key: "3", action: "Show product list", detail: "Peakhour sends the full product list for review" },
  { key: "4 [time]", action: "Schedule later", detail: "e.g. '4 Saturday 10am' — schedules the campaign" },
  { key: "5", action: "Reject", detail: "Campaign dismissed; Peakhour won't re-suggest for 7 days" },
];

export default function CampaignApprovalPage() {
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
                  Campaign Approval
                </Badge>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
                Approve campaigns with a WhatsApp reply.{" "}
                <span className="text-primary">Peakhour executes everything.</span>
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                You approve a revenue-recovery campaign from the school pickup
                line, in five seconds. Peakhour sends you a WhatsApp message —
                products, discount, duration, expected recovery — and you reply
                1 to approve. Discount created in Shopify, Smart Rail live,
                campaign tracked, post-campaign summary delivered. All in under
                10 seconds.
              </p>

              <div className="w-full max-w-lg rounded-2xl border bg-muted/40 px-5 py-4 text-left text-sm leading-relaxed">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                  Example message from Peakhour
                </p>
                <p className="text-muted-foreground">
                  Found $8,400 of slow-moving stock. Suggested: The Season-End
                  Edit — 14 products, 15% off, 72 hours.{" "}
                  <span className="font-medium text-foreground">Reply 1</span> to
                  approve.{" "}
                  <span className="font-medium text-foreground">Reply 2 10</span>{" "}
                  to change the discount to 10%.{" "}
                  <span className="font-medium text-foreground">Reply 3</span> to
                  see the products.
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
                  "Reply 1 to approve — that's it",
                  "Discount via Shopify Billing API",
                  "Post-campaign summary on WhatsApp",
                  "Zero markup on WhatsApp charges",
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

        {/* ── Reply options visual ── */}
        <section className="border-y bg-muted/30 py-16">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <div className="grid gap-10 md:grid-cols-2 md:items-start">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                    Reply options
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">
                    Five reply options. Natural language also works.
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Structured replies for speed, free text for nuance.
                    &ldquo;Change to 10% and skip the blue ones&rdquo; is a valid instruction
                    — Peakhour parses it before creating the discount.
                  </p>
                  <div className="mt-6 space-y-2.5">
                    {REPLY_OPTIONS.map((opt) => (
                      <div key={opt.key} className="flex items-start gap-3 rounded-xl border bg-background px-4 py-3">
                        <span className="mt-0.5 inline-flex h-7 min-w-[3rem] shrink-0 items-center justify-center rounded-lg bg-primary/10 px-2 text-[11px] font-bold text-primary">
                          {opt.key}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{opt.action}</p>
                          <p className="text-xs text-muted-foreground">{opt.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                    Example message
                  </p>
                  <div className="rounded-2xl border bg-background p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <MessageCircle className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">Peakhour Commerce</p>
                        <p className="text-[10px] text-muted-foreground">WhatsApp Business</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-4 py-4 text-sm leading-relaxed">
                      <p className="font-semibold">📦 Campaign Recommendation</p>
                      <p className="mt-2 text-muted-foreground">
                        <strong>Products:</strong> Linen Kurtis — Grey & Beige (14 SKUs)<br />
                        <strong>Risk score:</strong> 74–82 · Slow-moving to Critical<br />
                        <strong>Suggested discount:</strong> 20% off for 72 hours<br />
                        <strong>Expected recovery:</strong> $3,200 – $4,400<br />
                        <strong>Smart Rail:</strong> &ldquo;The Linen Edit — Last 14 Pieces&rdquo;
                      </p>
                      <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                        Reply <strong>1</strong> Approve · <strong>2 [x%]</strong> Change discount ·{" "}
                        <strong>3</strong> Show list · <strong>4 [time]</strong> Schedule · <strong>5</strong> Reject
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <div className="rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary">
                        1
                      </div>
                    </div>
                    <div className="mt-2 rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                      ✅ <strong>Approved.</strong> Discount created in Shopify. Smart Rail live. Campaign running. I&apos;ll send a summary when it ends.
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
                  From recommendation to live campaign in under 10 seconds
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Five steps. You&apos;re involved in one of them. Peakhour does the rest.
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
                  From recommendation to live campaign in under 10 seconds
                </h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Eight capabilities — from WhatsApp approval through campaign
                  tracking to post-campaign summary. You never need to leave
                  WhatsApp to run a full campaign.
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

        {/* ── Speed callout ── */}
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
                    The speed advantage
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight text-balance lg:text-3xl">
                    &ldquo;From recommendation to live campaign in under 10 seconds.&rdquo;
                  </h2>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    The old process: log into Shopify Admin, find the products,
                    create a discount code manually, set the conditions, pick the
                    applicable products, activate it, update your storefront
                    collection, set a reminder to deactivate it. 20–30 minutes
                    per campaign, minimum.
                  </p>
                  <p className="mt-3 leading-relaxed text-muted-foreground">
                    With Peakhour: read the WhatsApp message. Reply 1. Done.
                    The discount is live in Shopify, the Smart Rail is updated,
                    the campaign is being tracked, and you&apos;ll get a summary
                    when it ends — without opening a single dashboard.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {[
                      { label: "Time to approve", before: "20–30 min", after: "< 10 seconds" },
                      { label: "Steps required", before: "8–12 manual steps", after: "1 reply" },
                      { label: "Storefront update", before: "Manual collection edit", after: "Automatic" },
                      { label: "Campaign debrief", before: "Dashboard check required", after: "WhatsApp summary" },
                    ].map((row) => (
                      <div key={row.label} className="rounded-xl border bg-muted/40 px-4 py-3">
                        <p className="text-xs font-semibold text-muted-foreground">{row.label}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground line-through">{row.before}</p>
                        <p className="text-sm font-bold text-primary">{row.after}</p>
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
                Campaigns live in under 10 seconds
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Apply as a launch partner and get full campaign approval — from
                WhatsApp recommendation to live Shopify discount — before the
                public launch.
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
