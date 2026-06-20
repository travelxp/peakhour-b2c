import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Brain,
  Zap,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  getPublicCatalog,
  dedupePublicIntegrations,
  signupCta,
} from "@/lib/catalog";
import {
  IntegrationBrandIcon,
  integrationBrandColor,
} from "@/components/marketing/integration-brand";
import {
  LinkedinIcon,
  FacebookIcon,
  InstagramIcon,
  GoogleIcon,
  YoutubeIcon,
  BeehiivIcon,
  SubstackIcon,
  MailchimpIcon,
  ShopifyIcon,
  WordPressIcon,
  TwitterIcon,
} from "@/components/ui/brand-icons";

const FEATURES = [
  {
    icon: Brain,
    title: "Content Intelligence",
    description:
      "Every piece of content is automatically tagged across 12 dimensions. Know which topics, audiences, and angles drive results.",
    detail:
      "Connects to any content platform, 12-dimension auto-tagger, content gap analysis",
  },
  {
    icon: Sparkles,
    title: "AI Creative Factory",
    description:
      "Turn one newsletter into 10+ platform-native ad creatives in minutes. LinkedIn Lead Gen, Meta, Google — all from your content.",
    detail: "AI generates headlines, body copy, and image briefs",
  },
  {
    icon: Zap,
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

const INTEGRATIONS = [
  { name: "LinkedIn", icon: LinkedinIcon, color: "bg-[#0A66C2]", description: "Organic posts & Lead Gen ads" },
  { name: "Facebook", icon: FacebookIcon, color: "bg-[#0668E1]", description: "Pages, ads & audience insights" },
  { name: "Instagram", icon: InstagramIcon, color: "bg-[#E4405F]", description: "Reels, stories & ad creatives" },
  { name: "Google Ads", icon: GoogleIcon, color: "bg-[#4285F4]", description: "Search, display & YouTube ads" },
  { name: "YouTube", icon: YoutubeIcon, color: "bg-[#FF0000]", description: "Video content & pre-roll ads" },
  { name: "Beehiiv", icon: BeehiivIcon, color: "bg-[#FFD100] text-black", description: "Newsletter import & tagging" },
  { name: "Substack", icon: SubstackIcon, color: "bg-[#FF6719]", description: "Newsletter content sync" },
  { name: "Mailchimp", icon: MailchimpIcon, color: "bg-[#FFE01B] text-black", description: "Email campaigns & audiences" },
  { name: "Shopify", icon: ShopifyIcon, color: "bg-[#96BF48]", description: "Product catalog & e-commerce" },
  { name: "WordPress", icon: WordPressIcon, color: "bg-[#21759B]", description: "Blog content & CMS sync" },
  { name: "X (Twitter)", icon: TwitterIcon, color: "bg-black", description: "Posts & promoted content" },
] as const;

export default async function Home() {
  // Integration catalog from the platform resolver (CMS-driven, env-gated,
  // stage-capped). Falls back to the static list below if the API is
  // unreachable so the landing never hard-fails (mirrors the pricing fallback).
  const catalog = await getPublicCatalog();
  const platform = catalog?.platform;
  const cta = signupCta(platform?.signupMode ?? "open");
  const integrationCards = catalog
    ? dedupePublicIntegrations(catalog.integrations).map((i) => ({
        id: i.key,
        name: i.name,
        description: i.tagline ?? i.description ?? i.comingSoon?.copy ?? "",
        colorClass: integrationBrandColor(i.display?.groupKey, i.key),
        icon: (
          <IntegrationBrandIcon
            groupKey={i.display?.groupKey}
            integrationKey={i.key}
            name={i.name}
          />
        ),
        comingSoon: i.surfacedState === "coming_soon",
      }))
    : INTEGRATIONS.map((item) => {
        const IntIcon = item.icon;
        return {
          id: item.name,
          name: item.name,
          description: item.description,
          colorClass: item.color,
          icon: <IntIcon className="h-5 w-5" />,
          comingSoon: false,
        };
      });

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
          {/* Leading icon so the tone isn't conveyed by color alone (a11y). */}
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
        {/* Hero — inspired by shadcnblocks hero1 */}
        <section className="py-24 sm:py-32">
          <div className="container">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <Sparkles className="size-3" />
                Agentic AI Marketing Platform
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-pretty sm:text-5xl lg:text-6xl">
                Every hour is Peakhour
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground lg:text-xl">
                Autonomous AI agents turn your content into high-performing campaigns
                across every channel — analyzing, creating, and optimizing around the
                clock, so your marketing runs at its peak even when you&rsquo;re off.
              </p>
              <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
                {cta.disabled ? (
                  // Pre-launch teaser: an intentional "Launching soon" pill, not a
                  // dead/greyed CTA (which reads as a bug).
                  <span className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-5 py-2.5 text-sm font-medium text-muted-foreground">
                    <Sparkles className="size-4" aria-hidden />
                    {cta.label}
                  </span>
                ) : (
                  <Button asChild size="lg" className="gap-2">
                    <Link href={cta.href}>
                      {cta.label}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="lg">
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features — inspired by shadcnblocks feature3 */}
        <section id="features" className="border-t bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
              <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">
                Three engines, one platform
              </h2>
              <p className="max-w-xl text-muted-foreground">
                Everything your marketing team does — content analysis, ad
                creation, performance optimization — automated by AI.
              </p>
              <div className="mt-8 grid w-full gap-6 md:grid-cols-3">
                {FEATURES.map((f) => {
                  const FeatureIcon = f.icon;
                  return (
                    <Card key={f.title} className="text-left transition-shadow hover:shadow-md">
                      <CardHeader className="pb-2">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <FeatureIcon className="size-5 text-primary" strokeWidth={1.5} />
                        </div>
                        <CardTitle className="text-lg">{f.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <CardDescription className="leading-relaxed">
                          {f.description}
                        </CardDescription>
                        <p className="text-xs text-muted-foreground/70">
                          {f.detail}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Integrations — inspired by shadcnblocks integration1 */}
        <section className="relative py-20">
          <div className="container">
            <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
              <Badge variant="outline" className="mb-4 gap-1.5 px-3 py-1 uppercase text-xs tracking-wider">
                Integrations
              </Badge>
              <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">
                Connect your favourite platforms
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Import content from newsletters, social media, blogs, and e-commerce — AI tags everything automatically.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrationCards.map((item) => (
                <Card key={item.id} className="py-2 transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${item.colorClass}`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <span className="truncate">{item.name}</span>
                        {item.comingSoon && (
                          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                            Coming soon
                          </Badge>
                        )}
                      </CardTitle>
                      {item.description && (
                        <CardDescription className="text-xs line-clamp-2">
                          {item.description}
                        </CardDescription>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <span>
                {platform && platform.stage !== "live"
                  ? "More integrations rolling out as we launch"
                  : "More integrations coming soon"}
              </span>
              {!cta.disabled && (
                <Button asChild variant="outline" size="sm">
                  <Link href={cta.href}>
                    {cta.label}
                    <ArrowRight className="ml-1 size-3" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-center text-3xl font-semibold text-pretty lg:text-4xl">
                Up and running in 3 steps
              </h2>
              <div className="mt-14 grid gap-10 md:grid-cols-3">
                {STEPS.map((s) => (
                  <div key={s.step} className="relative text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg">
                      {s.step}
                    </div>
                    {/* Connector line (hidden on mobile and last item) */}
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

        {/* Plans — the full comparison lives on its own page (/pricing).
            The landing only teases it with a CTA so plans stay in one place. */}
        <section id="pricing" className="py-20">
          <div className="container">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">
                Simple, transparent plans
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Commerce plans for Shopify and WooCommerce — start free, upgrade
                when you&rsquo;re ready. Every paid plan includes Peaks.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/pricing">View Plans</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/peaks">How Peaks work</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA — inspired by shadcnblocks cta3 */}
        <section className="border-t bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-10 rounded-2xl border bg-background p-8 shadow-sm lg:grid-cols-2 lg:p-12">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                    <BarChart3 className="size-4 text-primary" />
                  </span>
                  <h2 className="text-2xl font-bold lg:text-3xl">
                    Stop doing marketing.
                  </h2>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  Start growing.
                </p>
                <p className="mt-3 text-muted-foreground">
                  Join businesses that replaced their marketing busywork with an AI
                  engine that works 24/7.
                </p>
                <Button asChild size="lg" className="mt-6 gap-2">
                  <Link href="/auth">
                    Get started free
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
              <div className="flex flex-col justify-center gap-3">
                {[
                  { stat: "12", label: "dimensions of AI content tagging" },
                  { stat: "10+", label: "ad creatives from a single piece of content" },
                  { stat: "24/7", label: "automated performance optimization" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4 rounded-xl border px-5 py-3">
                    <span className="text-2xl font-bold text-primary">{item.stat}</span>
                    <span className="text-sm text-muted-foreground">{item.label}</span>
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
