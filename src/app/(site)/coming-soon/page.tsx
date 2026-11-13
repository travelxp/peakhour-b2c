import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ShopifyHeroDemo } from "@/components/marketing/shopify/shopify-hero-demo";
import {
  LaunchFooter,
  LaunchPerks,
  LaunchSteps,
  LaunchTopBar,
  launchCoralBtn,
  launchEyebrow,
  launchH2,
  launchWrap,
} from "@/components/marketing/launch/launch-chrome";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Peakhour — your AI team behind every channel you sell on",
  description:
    "Peakhour answers your customers, fixes your product pages, writes in your voice and runs your growth, across your store, your website and Google. You approve what goes live. Launching soon: become a launch partner.",
};

/**
 * The pre-launch teaser, served for EVERY gated route in production while the
 * coming-soon gate is on (middleware.ts). Preview at /coming-soon, or set
 * COMING_SOON=true locally. Daylight palette (.theme-daylight), like /shopify.
 *
 * Positioning (owner 2026-10-29: "Peakhour is an engine concept"): what
 * Peakhour does for a business, behind the channels it already uses, not a
 * count of modules. Every job named here is built; the channel list names
 * integrations that exist today. The hero shows the product (the /shopify
 * sample-store demo), because a teaser with no product is the page's old flaw.
 */
const JOBS: { dot: string; job: string; body: string }[] = [
  {
    dot: "var(--daylight-dot-commerce)",
    job: "Sell",
    body: "A shopping assistant that answers from your real catalogue, shelves that sell, and COD orders confirmed on WhatsApp.",
  },
  {
    dot: "var(--daylight-dot-support)",
    job: "Answer",
    body: "Your WhatsApp and website conversations in one inbox, answered by AI or by you.",
  },
  {
    dot: "var(--daylight-dot-content)",
    job: "Publish",
    body: "Posts for LinkedIn and X, newsletters and blog articles, written in your voice.",
  },
  {
    dot: "var(--daylight-dot-growth)",
    job: "Grow",
    body: "Ads and LinkedIn growth, with a plan you review before anything spends.",
  },
  {
    dot: "var(--daylight-dot-presence)",
    job: "Get found",
    body: "Connect your Google Business Profile and see how people find you.",
  },
];

const CHANNELS = ["Shopify", "WordPress", "WhatsApp", "Google Business Profile", "LinkedIn", "X", "Beehiiv"];

const eyebrow = launchEyebrow;
const h2 = launchH2;
const coralBtn = launchCoralBtn;

export default function ComingSoonPage() {
  return (
    // overflow-x-clip: the demo's floating cards sit outside its box; nothing may scroll the page sideways.
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col overflow-x-clip">
      <div className="bg-[linear-gradient(180deg,var(--daylight-hero)_0%,var(--background)_92%)]">
        <LaunchTopBar />
      </div>
      <main className="flex-1">
        <div className="bg-[linear-gradient(180deg,var(--daylight-hero)_-40%,var(--background)_92%)]">
          {/* Hero: what Peakhour does, and the product doing it */}
          <section className={cn(launchWrap, "grid grid-cols-1 items-center gap-10 pb-14 pt-6 sm:pt-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pb-20")}>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-bold shadow-sm">
                <span className="size-2 rounded-full bg-brand" aria-hidden />
                Launching soon · Launch Partner programme open
              </p>
              <h1 className="mt-5 text-[2.6rem] font-black leading-[1.02] tracking-[-0.04em] text-balance sm:text-6xl lg:text-[4.1rem]">
                Your AI team behind <span className="daylight-mark">every channel you sell on.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground sm:text-xl">
                Peakhour answers your customers, fixes your product pages, writes in your voice and runs your growth,
                across your store, your website and Google. You approve what goes live, and almost everything can be undone.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link prefetch={false} href="/launch-partner" className={coralBtn}>
                  Become a Launch Partner
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
                <a
                  href="#what"
                  className="inline-flex items-center rounded-full px-6 py-3.5 text-[15px] font-bold shadow-[inset_0_0_0_2px_var(--foreground)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  See what it does
                </a>
              </div>
            </div>
            <div className="min-w-0">
              <ShopifyHeroDemo />
            </div>
          </section>
        </div>

      {/* What it does: jobs, not a module count */}
      <section id="what" aria-labelledby="what-h" className="scroll-mt-6 border-t py-14 sm:py-20">
        <div className={launchWrap}>
          <p className={eyebrow}>What it does</p>
          <h2 id="what-h" className={h2}>
            The work behind a growing business, done with you.
          </h2>
          <ul className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-5">
            {JOBS.map((j) => (
              <li key={j.job} className="flex flex-col gap-2 rounded-2xl border bg-card p-5">
                <span className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: j.dot }} />
                  {j.job}
                </span>
                <span className="text-[15px] text-muted-foreground">{j.body}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="shrink-0 text-sm font-bold">Works with</p>
            <ul className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <li key={c} className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Launch Partner: the page's one dark band */}
      <section aria-labelledby="partner-h" className="bg-ink text-on-ink">
        <div className={cn(launchWrap, "grid grid-cols-1 gap-10 py-14 sm:py-20 lg:grid-cols-[1fr_1fr] lg:gap-16")}>
          <div className="min-w-0">
            <p className={cn(eyebrow, "text-on-ink-dim")}>Launch Partner programme</p>
            <h2 id="partner-h" className={h2}>
              Build Peakhour <span className="text-brand">with us.</span>
            </h2>
            <p className="mt-4 max-w-xl text-lg text-on-ink/85">
              We are onboarding a small group of businesses ahead of public launch, with our team alongside them.
            </p>
            <LaunchPerks tone="ink" className="mt-7" />
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-8">
            <LaunchSteps tone="ink" />
            <div>
              <Link prefetch={false} href="/launch-partner" className={cn(coralBtn, "focus-visible:ring-white focus-visible:ring-offset-ink")}>
                Apply to be a launch partner
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>
      </main>

      <LaunchFooter />
    </div>
  );
}
