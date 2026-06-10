import type { Metadata } from "next";
import { Sparkles, ShoppingBag, Megaphone, ArrowRight } from "lucide-react";
import { SITE } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Peakhour — Autonomous Customer Engagement",
  description:
    "Peakhour helps businesses build visibility, engage customers, and unlock growth opportunities across every channel — without a full-scale marketing team. Two solutions, one platform: Peakhour Commerce and Peakhour Marketing. Launching soon.",
};

/**
 * Standalone pre-launch teaser. Served for EVERY route in production while the
 * coming-soon gate is on (see middleware.ts) — deliberately self-contained
 * (no Header/Footer that link into the gated app). Preview locally at
 * /coming-soon, or set COMING_SOON=true to exercise the full gate in dev.
 *
 * Positioning: one Peakhour platform with two solution entry points
 * (Commerce + Marketing). Links use plain <a> so they resolve straight
 * through the coming-soon gate — /launch-partner is allowlisted in
 * middleware alongside the legal routes; #commerce / #marketing are
 * in-page anchors (no separate gated routes to loop back on).
 */
export default function ComingSoonPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Subtle backdrop (standard utilities — no brittle arbitrary theme()). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 bg-linear-to-b from-primary/5 to-transparent"
      />

      {/* Sign in — for approved launch partners (e.g. quests.travel). Plain
          <a> so it resolves straight through the coming-soon gate, which
          allowlists /auth (see middleware.ts). The magic-link endpoint only
          sends a real link to ops-approved emails; everyone else is routed to
          the waitlist from the sign-in page itself. */}
      <a
        href="/auth"
        className="absolute right-6 top-6 z-10 inline-flex items-center rounded-full border bg-background/80 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-muted/60"
      >
        Sign in
      </a>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden />
            Autonomous Customer Engagement
          </span>

          <h1 className="text-pretty text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Every hour is{" "}
            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {SITE.name}
            </span>
          </h1>

          <p className="max-w-xl text-balance text-lg text-muted-foreground">
            {SITE.name} helps businesses build visibility, engage customers,
            and unlock growth opportunities across every channel&mdash;without
            a full-scale marketing team.
          </p>

          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="/launch-partner"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Become a Launch Partner
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a
              href="#commerce"
              className="inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
            >
              Explore Peakhour Commerce
            </a>
          </div>
        </div>
      </section>

      {/* ── Built for growing businesses ─────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-28">
        <h2 className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Built for growing businesses
        </h2>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {/* Commerce */}
          <div
            id="commerce"
            className="group flex scroll-mt-24 flex-col rounded-2xl border bg-card p-7 text-left transition-colors hover:border-foreground/20"
          >
            <span className="inline-flex size-11 items-center justify-center rounded-xl border bg-muted/40 text-foreground">
              <ShoppingBag className="size-5" aria-hidden />
            </span>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">
              Peakhour Commerce
            </h3>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
              For Shopify, WooCommerce and D2C brands that want to recover
              carts, re-engage customers, and grow revenue with less manual
              effort.
            </p>
            {/* Pre-launch, "Learn more" routes to the launch-partner capture.
                Swap to /commerce once the solution page ships post-launch. */}
            <a
              href="/launch-partner"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors group-hover:gap-2.5"
            >
              Learn more
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>

          {/* Marketing */}
          <div
            id="marketing"
            className="group flex scroll-mt-24 flex-col rounded-2xl border bg-card p-7 text-left transition-colors hover:border-foreground/20"
          >
            <span className="inline-flex size-11 items-center justify-center rounded-xl border bg-muted/40 text-foreground">
              <Megaphone className="size-5" aria-hidden />
            </span>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">
              Peakhour Marketing
            </h3>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
              For publishers, brands and marketing teams that want to create,
              optimize and automate campaigns across channels.
            </p>
            <a
              href="/launch-partner"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors group-hover:gap-2.5"
            >
              Learn more
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer (normal flow — page now scrolls past one viewport) ── */}
      <footer className="mt-auto flex flex-col items-center gap-3 px-6 pb-8 text-center text-xs text-muted-foreground">
        {/* Plain <a> (not next/link) so these resolve straight through the
            coming-soon gate, which allowlists the legal routes. */}
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <a href="/privacy-policy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </a>
          <a href="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </a>
          <a href="/cookie-policy" className="transition-colors hover:text-foreground">
            Cookie Policy
          </a>
          <a href="/data-deletion" className="transition-colors hover:text-foreground">
            Data Deletion
          </a>
        </nav>
        <p>
          © {new Date().getFullYear()} {SITE.company.legalName}. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
