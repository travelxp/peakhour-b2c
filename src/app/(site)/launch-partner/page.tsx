import type { Metadata } from "next";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { SITE } from "@/lib/utils";
import { LaunchPartnerForm } from "./launch-partner-form";

export const metadata: Metadata = {
  title: "Become a Launch Partner — Peakhour",
  description:
    "Join the Peakhour launch partner program. Work directly with our team to shape Peakhour Commerce and Peakhour Marketing, and get early access ahead of public launch.",
};

/**
 * Pre-launch "Become a Launch Partner" capture. Self-contained (no Header/
 * Footer that link into the gated app), same monochrome aesthetic as the
 * coming-soon teaser. Reachable through the coming-soon gate because
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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 bg-linear-to-b from-primary/5 to-transparent"
      />

      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-7">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Launch Partner Program
        </span>

        <h1 className="text-pretty text-4xl font-bold tracking-tight sm:text-5xl">
          Build {SITE.name} with us
        </h1>

        <p className="max-w-lg text-balance text-lg text-muted-foreground">
          We&rsquo;re onboarding a small group of launch partners ahead of public
          launch. Work directly with our team, shape the roadmap for Peakhour
          Commerce and Peakhour Marketing, and get early access &mdash; with
          hands-on setup.
        </p>

        <LaunchPartnerForm source={signupSource} country={country} />

        <a
          href="/coming-soon"
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </a>
      </div>
    </main>
  );
}
