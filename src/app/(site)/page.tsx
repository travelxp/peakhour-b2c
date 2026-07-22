import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ShoppingBag,
  PenLine,
  TrendingUp,
  MessageSquare,
  MapPin,
  Check,
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
} from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { pageMetadata } from "@/lib/seo";
import { HOW_IT_WORKS_STEPS } from "@/lib/how-it-works";
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

export const metadata = pageMetadata({
  title: "Peakhour.ai — The AI business platform for growing brands",
  description:
    "Five AI pillars — Commerce, Content, Growth, Support, Presence — that sell, publish, advertise, answer, and get you found. A free plan on every pillar. No credit card.",
  path: "/",
});

/**
 * The five pillars are the product. This list is stable brand architecture
 * (mirrors cfg_products.pillar); the section ids give each pillar an on-page
 * anchor (the header/footer now link to the dedicated /commerce … pages).
 * Integrations below stay catalog-driven.
 */
const PILLARS = [
  {
    id: "commerce",
    icon: ShoppingBag,
    name: "Commerce",
    blurb:
      "An AI assistant that knows your whole catalog and sells on WhatsApp and your storefront, 24/7.",
    points: ["Catalog always in sync", "WhatsApp storefront chat", "Inventory intelligence"],
    free: "Free plan included",
  },
  {
    id: "content",
    icon: PenLine,
    name: "Content",
    blurb:
      "AI writers that publish in your voice — blogs, newsletters, socials — from your news desk to every channel.",
    points: ["Brand-voice AI writers", "News-driven ideas", "Multi-format publishing"],
    free: "Free plan included",
  },
  {
    id: "growth",
    icon: TrendingUp,
    name: "Growth",
    blurb:
      "Ads and LinkedIn on autopilot — campaigns drafted, leads captured, budgets optimized while you sleep.",
    points: ["LinkedIn growth engine", "Ad campaigns + optimizer", "Lead inbox"],
    free: "Free plan included",
  },
  {
    id: "support",
    icon: MessageSquare,
    name: "Support",
    blurb:
      "One inbox for every channel. AI answers what it can, hands you what it can't — with full context.",
    points: ["Omnichannel inbox", "AI-drafted replies", "Human handoff"],
    free: "Free plan included",
  },
  {
    id: "presence",
    icon: MapPin,
    name: "Presence",
    blurb:
      "Own how you show up on Google — listings, hours, photos, and reviews managed from one place.",
    points: ["Google Business Profile", "Review management", "Listing health"],
    free: "Always free",
  },
] as const;

/** Live console rows in the hero — illustrative snapshot of the five pillars. */
const CONSOLE_ROWS = [
  { name: "Commerce", status: "Answered 34 shoppers on WhatsApp today" },
  { name: "Content", status: "2 articles drafted from this week's news" },
  { name: "Growth", status: "LinkedIn post scheduled · 3 leads in inbox" },
  { name: "Support", status: "Inbox clear — 12 conversations resolved" },
  { name: "Presence", status: "Google listing synced · 2 new reviews" },
] as const;

const FREE_POINTS = [
  {
    title: "No credit card, ever, to start",
    detail: "Sign up with email. Upgrade only when you outgrow your free Peaks.",
  },
  {
    title: "No feature paywalls",
    detail: "Free users see the same screens, skills, and quality — never a locked door.",
  },
  {
    title: "One currency, five pillars",
    detail: "Peaks spent on a blog post or a WhatsApp reply come from the same pool.",
  },
] as const;

// Shared with the standalone /how-it-works page (single source of truth).
const STEPS = HOW_IT_WORKS_STEPS;

// Static fallback for the integrations strip when the catalog API is
// unreachable — mirrors the resolved shape so the section never hard-fails.
const INTEGRATIONS = [
  { name: "Shopify", icon: ShopifyIcon, color: "bg-[#96BF48]", description: "Catalog & storefront" },
  { name: "WordPress", icon: WordPressIcon, color: "bg-[#21759B]", description: "Content & CMS sync" },
  { name: "LinkedIn", icon: LinkedinIcon, color: "bg-[#0A66C2]", description: "Organic posts & Lead Gen" },
  { name: "Facebook", icon: FacebookIcon, color: "bg-[#0668E1]", description: "Pages, ads & insights" },
  { name: "Instagram", icon: InstagramIcon, color: "bg-[#E4405F]", description: "Reels, stories & ads" },
  { name: "Google Ads", icon: GoogleIcon, color: "bg-[#4285F4]", description: "Search, display & video" },
  { name: "YouTube", icon: YoutubeIcon, color: "bg-[#FF0000]", description: "Video content & pre-roll" },
  { name: "Beehiiv", icon: BeehiivIcon, color: "bg-[#FFD100] text-black", description: "Newsletter import" },
  { name: "Substack", icon: SubstackIcon, color: "bg-[#FF6719]", description: "Newsletter content sync" },
  { name: "Mailchimp", icon: MailchimpIcon, color: "bg-[#FFE01B] text-black", description: "Email campaigns" },
  { name: "X (Twitter)", icon: TwitterIcon, color: "bg-black", description: "Posts & promoted content" },
] as const;

// Same validator as /auth — sanitises a tampered ?ref= so the redirect target
// only ever carries a well-formed inviter code.
const REFERRAL_CODE_PATTERN = /^[0-9A-Z]{4,32}$/;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; n?: string | string[] }>;
}) {
  // Back-compat redirect for waitlist share links minted with the old
  // `/?ref=…` shape → forward to /auth so the inviter code is captured + the
  // inviter credited on signup. `n` (cache-bust nonce) forwarded when present.
  const params = await searchParams;
  const refRaw = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const nRaw = Array.isArray(params.n) ? params.n[0] : params.n;
  if (refRaw) {
    const refUpper = refRaw.toUpperCase();
    if (REFERRAL_CODE_PATTERN.test(refUpper)) {
      const qs = new URLSearchParams({ ref: refUpper });
      if (nRaw) qs.set("n", nRaw);
      redirect(`/auth?${qs.toString()}`);
    }
  }

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

      {/* Free-first announcement bar */}
      <div className="bg-brand-gradient px-4 py-2 text-center text-sm font-semibold text-brand-contrast">
        Every pillar has a Free plan — no credit card required.{" "}
        <span className="font-normal opacity-80">
          Start with any pillar, add the rest when you&rsquo;re ready.
        </span>
      </div>

      <Header />

      <main>
        {/* Hero */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                The AI business platform for growing brands
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.03] tracking-tight text-pretty sm:text-5xl lg:text-6xl">
                Five AI pillars. One platform.{" "}
                <span className="font-serif italic font-normal text-brand-gradient">
                  Free to start.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                Peakhour runs the work a growing business can&rsquo;t hire for yet —
                selling, publishing, advertising, answering, and being found — with
                AI that learns your brand and reports back in plain language.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {cta.disabled ? (
                  <span className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-5 py-3 text-sm font-medium text-muted-foreground">
                    <Zap className="size-4" aria-hidden />
                    {cta.label}
                  </span>
                ) : (
                  <Link
                    href={cta.href}
                    className="group inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {cta.label} — all five pillars
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
                <Link
                  href="/peaks"
                  className="inline-flex items-center gap-2 rounded-xl border-2 px-6 py-3 text-sm font-bold transition-colors hover:border-brand hover:text-brand"
                >
                  See how Peaks work
                </Link>
              </div>
              <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span aria-hidden className="font-bold text-brand-label">✓</span> No credit card
                <span aria-hidden className="opacity-40">·</span>
                <span aria-hidden className="font-bold text-brand-label">✓</span> Free plan on every pillar
                <span aria-hidden className="opacity-40">·</span>
                <span aria-hidden className="font-bold text-brand-label">✓</span> Live the same day
              </p>
            </div>

            {/* Pillar console — always-dark product panel (fixed tones so it
                reads on both light and dark grounds). */}
            <div
              className="rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"
              role="img"
              aria-label="Peakhour console showing five active pillars"
            >
              <div className="flex items-center justify-between px-1 pb-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-zinc-400">
                <span>Your business, at a glance</span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
                  live
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {CONSOLE_ROWS.map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-3.5 py-2.5 text-sm"
                  >
                    <span className="size-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                    <span className="w-20 shrink-0 font-bold text-zinc-100">{row.name}</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-400">{row.status}</span>
                    <span className="shrink-0 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-emerald-400">
                      Free
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-1 pt-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  Metered in{" "}
                  <span aria-hidden className="text-brand">⚡</span>
                  <span className="font-bold text-brand-gradient">Peaks</span>
                </span>
                <span>1,240 free Peaks/mo</span>
              </div>
            </div>
          </div>
        </section>

        {/* Pillar grid — section ids back the header/footer anchors */}
        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                The five pillars
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                Everything a modern business does online, run by AI you approve.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Each pillar works alone. Together they share one brain — your
                catalog, your brand voice, your customers.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PILLARS.map((pillar) => {
                const PillarIcon = pillar.icon;
                return (
                  <div
                    key={pillar.id}
                    id={pillar.id}
                    className="group flex scroll-mt-24 flex-col gap-3 rounded-2xl border bg-background p-6 transition-all hover:-translate-y-1.5 hover:border-foreground hover:shadow-xl"
                  >
                    <div className="flex size-11 items-center justify-center rounded-xl bg-brand-gradient shadow-inner transition-transform group-hover:scale-105">
                      <PillarIcon className="size-5 text-brand-contrast" strokeWidth={2} />
                    </div>
                    <h3 className="text-lg font-bold tracking-tight">{pillar.name}</h3>
                    <p className="flex-1 text-sm text-muted-foreground">{pillar.blurb}</p>
                    <ul className="flex flex-col gap-1.5">
                      {pillar.points.map((point) => (
                        <li
                          key={point}
                          className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
                        >
                          <Check className="size-3.5 shrink-0 text-brand" strokeWidth={2.5} />
                          {point}
                        </li>
                      ))}
                    </ul>
                    <span className="self-start rounded-full bg-brand-soft px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-ink">
                      {pillar.free}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Free-first economics — always-dark panel */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-8 text-zinc-100 shadow-2xl lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
              <div>
                <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand">
                  <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                  Free means free
                </span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                  Same product on Free and Paid.{" "}
                  <span className="text-brand-gradient">
                    The only difference is how much AI work you get.
                  </span>
                </h2>
                <p className="mt-4 max-w-lg text-zinc-400">
                  Every plan — Free included — gets the full product with identical
                  polish. AI work is metered in{" "}
                  <span className="font-bold text-brand-gradient">Peaks</span>, one
                  transparent currency across all five pillars. Free plans refill
                  monthly; paid plans simply carry more Peaks and higher limits.
                </p>
              </div>
              <div className="flex flex-col gap-3.5">
                {FREE_POINTS.map((point) => (
                  <div
                    key={point.title}
                    className="flex gap-3 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3.5 transition-colors hover:border-brand/60"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} />
                    <div>
                      <p className="text-sm font-bold">{point.title}</p>
                      <p className="text-xs text-zinc-400">{point.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24 border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                How it works
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                Live in minutes, not quarters.
              </h2>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <div
                  key={s.step}
                  className="rounded-2xl border bg-background p-7 transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-xl"
                >
                  <div className="font-serif text-4xl font-normal italic text-brand-gradient">
                    {s.step}
                  </div>
                  <h3 className="mt-3 text-lg font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Integrations — catalog-driven */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                Works with your stack
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                Plugged into the tools you already use.
              </h2>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrationCards.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border bg-background p-4 transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-md"
                >
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-white ${item.colorClass}`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <span className="truncate">{item.name}</span>
                      {item.comingSoon && (
                        <span className="shrink-0 rounded-full border px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                          Coming soon
                        </span>
                      )}
                    </p>
                    {item.description && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA — always-dark panel */}
        <section className="pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 px-6 py-16 text-center text-zinc-100 shadow-2xl sm:py-20">
              <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-pretty sm:text-4xl">
                Start with one pillar.{" "}
                <span className="font-serif italic font-normal text-brand-gradient">
                  Keep all five.
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-zinc-400">
                Free plans on Commerce, Content, Growth, Support, and Presence. No
                credit card. Your first Peaks are on us.
              </p>
              {!cta.disabled && (
                <Link
                  href={cta.href}
                  className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-7 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                >
                  {cta.label}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
