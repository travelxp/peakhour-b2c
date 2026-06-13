import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  Sparkles,
  Newspaper,
  ShoppingBag,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Info,
  Globe,
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
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { getPricing } from "@/lib/pricing";
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
    icon: Newspaper,
    title: "News-Powered Strategy",
    description:
      "AI Strategist pulls live headlines every morning, surfaces what's trending in your industry, and briefs your content team. No more staring at a blank screen.",
    detail: "News Strategist · Trend detection · Content briefs · Relevance scoring",
  },
  {
    icon: Sparkles,
    title: "Multi-Format AI Writer",
    description:
      "One brief becomes a newsletter, LinkedIn post, Instagram caption, and more. Each format native to its platform — all in your exact brand voice, every time.",
    detail: "6 write formats · Voice Cards · Beehiiv · LinkedIn · Instagram · X",
  },
  {
    icon: ShoppingBag,
    title: "Commerce on WhatsApp",
    description:
      "Your Shopify catalog, synced in real time. Shoppers ask questions on WhatsApp — your AI answers with accurate prices, stock, and product details in their language.",
    detail: "Catalog sync · WhatsApp Business · In-app chat · Multilingual",
  },
] as const;

const STEPS = [
  {
    step: "1",
    title: "Connect your business",
    description:
      "Add your website, Shopify store, or social profiles. AI maps your catalog, content, and brand voice in minutes.",
  },
  {
    step: "2",
    title: "AI writes content daily",
    description:
      "News Strategist spots opportunities. AI writers draft posts across every platform — sounding exactly like you, never generic.",
  },
  {
    step: "3",
    title: "Publish and grow on autopilot",
    description:
      "Smart scheduling, performance tracking, and real-time WhatsApp commerce — running 24/7 without you lifting a finger.",
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
  { name: "Shopify", icon: ShopifyIcon, color: "bg-[#96BF48]", description: "Commerce Assistant & catalog sync" },
  { name: "WordPress", icon: WordPressIcon, color: "bg-[#21759B]", description: "Blog content & CMS sync" },
  { name: "X (Twitter)", icon: TwitterIcon, color: "bg-black", description: "Posts & promoted content" },
] as const;

export default async function Home() {
  const h = await headers();
  const vercelCountry = h.get("x-vercel-ip-country");
  const country =
    vercelCountry && /^[A-Za-z]{2}$/.test(vercelCountry)
      ? vercelCountry.toUpperCase()
      : "DEFAULT";
  const pricing = await getPricing(country);

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
          {/* Ambient glow behind the hero */}
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden" aria-hidden>
            <div className="h-[600px] w-[1000px] rounded-full bg-primary/10 blur-3xl opacity-70" />
          </div>
          <div className="container">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <Sparkles className="size-3" />
                Agentic AI Marketing Platform
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-pretty sm:text-5xl lg:text-6xl">
                Every hour is{" "}
                <span className="text-primary">Peakhour</span>
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground lg:text-xl">
                News-powered content, AI writers for every platform, and a catalog-grounded
                WhatsApp assistant for your Shopify store — all running 24/7 in your brand voice.
              </p>
              <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
                {cta.disabled ? (
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

        {/* Features */}
        <section id="features" className="border-t bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
              <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">
                Three capabilities, one platform
              </h2>
              <p className="max-w-xl text-muted-foreground">
                Content strategy, AI writing, and live commerce intelligence — working
                together around the clock so you don&apos;t have to.
              </p>
              <div className="mt-8 grid w-full gap-6 md:grid-cols-3">
                {FEATURES.map((f) => {
                  const FeatureIcon = f.icon;
                  return (
                    <Card key={f.title} className="card-lift text-left">
                      <CardHeader className="pb-2">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
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

        {/* Integrations */}
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
                Import content from newsletters, social, blogs, and e-commerce — AI tags and
                distributes everything automatically.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrationCards.map((item) => (
                <Card key={item.id} className="card-lift-sm py-2">
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

        {/* Pricing */}
        <section id="pricing" className="py-20">
          <div className="container">
            <div className="mx-auto max-w-6xl">
              {pricing && pricing.plans.length > 0 ? (
                <PricingGrid plans={pricing.plans} products={pricing.products} />
              ) : (
                <div className="text-center">
                  <h2 className="text-3xl font-semibold text-pretty lg:text-4xl">
                    Simple, transparent pricing
                  </h2>
                  <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                    Free tier and paid plans. No credit card to start.
                  </p>
                  <Button asChild size="lg" className="mt-6">
                    <Link href="/pricing">View pricing</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-10 rounded-2xl border bg-background p-8 shadow-sm lg:grid-cols-2 lg:p-12">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                    <Globe className="size-4 text-primary" />
                  </span>
                  <h2 className="text-2xl font-bold lg:text-3xl">
                    Stop doing marketing.
                  </h2>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  Start growing.
                </p>
                <p className="mt-3 text-muted-foreground">
                  Join businesses that run their content, commerce, and customer
                  conversations on Peakhour — 24/7, hands-free.
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
                  { stat: "11", label: "platform integrations — social, email & e-commerce" },
                  { stat: "6", label: "AI write formats — newsletter to WhatsApp" },
                  { stat: "24/7", label: "commerce assistant & content scheduler" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4 rounded-xl border px-5 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5">
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
