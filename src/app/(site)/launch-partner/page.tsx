import type { Metadata } from "next";
import { headers } from "next/headers";
import { SITE, cn } from "@/lib/utils";
import { LaunchFooter, LaunchPerks, LaunchSteps, LaunchTopBar, launchEyebrow, launchWrap } from "@/components/marketing/launch/launch-chrome";
import { LaunchPartnerForm } from "./launch-partner-form";

export const metadata: Metadata = {
  title: "Become a Launch Partner — Peakhour",
  description:
    "Join the Peakhour launch partner program. Work directly with our team to shape Peakhour Suite, and get early access ahead of public launch.",
};

/**
 * Pre-launch "Become a Launch Partner" capture. Self-contained (no Header/
 * Footer that link into the gated app), on the Daylight palette like the
 * coming-soon teaser (shared chrome: components/marketing/launch). Reachable through the coming-soon gate because
 * /launch-partner is allowlisted in middleware (alongside the legal routes).
 *
 * Applying = joining the waitlist (waitlist_signups). Ops approves applicants
 * in the CMS (/admin/waitlist → Invite); approval is what unlocks the
 * magic-link sign-in. No email address is exposed — the funnel is
 * apply -> approve -> sign in. The interactive form lives in a client
 * component so this page stays a server component for metadata.
 */
/** Only shopify/wordpress are meaningful entry surfaces; anything else is direct. */
function normalizeSource(raw?: string): "shopify" | "wordpress" | "direct" {
  return raw === "shopify" || raw === "wordpress" ? raw : "direct";
}

/**
 * ISO-3166 alpha-2 from Vercel's edge geo header, or undefined when it's
 * absent (local dev, a non-Vercel edge) or malformed.
 *
 * Deliberately NOT the `countryFrom` shape the /pricing pages use: that one
 * falls back to the literal "DEFAULT", which is a pricing-resolver sentinel.
 * The waitlist endpoint validates `country` as /^[A-Z]{2}$/, so "DEFAULT"
 * would fail the whole signup — an omitted field is the only safe fallback.
 *
 * Read here rather than asked on the form: geography is one of the two things
 * we genuinely want from an early applicant, and it's the one we can get for
 * free. A country dropdown would cost a field and buy nothing extra.
 */
function geoCountry(header: string | null): string | undefined {
  return header && /^[A-Za-z]{2}$/.test(header) ? header.toUpperCase() : undefined;
}

export default async function LaunchPartnerPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const [{ source }, h] = await Promise.all([searchParams, headers()]);
  const signupSource = normalizeSource(source);
  const country = geoCountry(h.get("x-vercel-ip-country"));
  return (
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col overflow-x-clip">
      <div className="flex-1 bg-[linear-gradient(180deg,var(--daylight-hero)_0%,var(--background)_80%)]">
        <LaunchTopBar back />
        {/* DOM order is the phone order: heading, form, perks, steps. On lg the grid puts the form in its own
            right-hand column, spanning the three left-hand rows. */}
        <main className={cn(launchWrap, "grid grid-cols-1 gap-8 pb-14 pt-4 sm:pt-8 lg:grid-cols-[1fr_0.95fr] lg:gap-x-14 lg:gap-y-10 lg:pb-20")}>
          <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:pt-4">
            <p className={launchEyebrow}>Launch Partner programme</p>
            <h1 className="mt-3 text-[2.4rem] font-black leading-[1.03] tracking-[-0.04em] text-balance sm:text-6xl">
              Build {SITE.name} <span className="daylight-mark">with us.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              We&rsquo;re onboarding a small group of launch partners ahead of public launch. Work directly with our team, shape the
              roadmap for Peakhour Suite, and get early access, with hands-on setup.
            </p>
          </div>

          <div className="min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
            <div className="rounded-[28px] border bg-card p-5 shadow-[var(--daylight-shadow)] sm:p-8">
              <LaunchPartnerForm source={signupSource} country={country} />
            </div>
          </div>

          <LaunchPerks className="lg:col-start-1 lg:row-start-2" />

          <div className="min-w-0 lg:col-start-1 lg:row-start-3">
            <p className={cn(launchEyebrow, "mb-4")}>How it works</p>
            <LaunchSteps />
          </div>
        </main>
      </div>
      <LaunchFooter />
    </div>
  );
}
