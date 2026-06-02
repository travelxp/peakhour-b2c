import type { Metadata } from "next";
import { ArrowLeft, Mail } from "lucide-react";
import { SITE } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Become a Launch Partner — Peakhour",
  description:
    "Join the Peakhour launch partner program. Work directly with our team to shape Peakhour Commerce and Peakhour Marketing, and get early access ahead of public launch.",
};

const PARTNER_EMAIL = SITE.contactGeneral;
const MAILTO = `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent(
  "Peakhour Launch Partner",
)}&body=${encodeURIComponent(
  "Hi Peakhour team,\n\nWe'd like to join as a launch partner.\n\nBusiness name:\nWebsite:\nWhat we sell / publish:\nPlatform (Shopify / WooCommerce / other):\nWhat we'd love help with:\n\nThanks!",
)}`;

/**
 * Pre-launch "Become a Launch Partner" capture. Self-contained (no Header/
 * Footer that link into the gated app), same monochrome aesthetic as the
 * coming-soon teaser. Reachable through the coming-soon gate because
 * /launch-partner is allowlisted in middleware (alongside the legal routes).
 *
 * V1 is intentionally a mailto capture (no backend / no new collection) —
 * pre-launch volume is low and a thread with the team is the right first
 * touch. Swap for a real form + API when volume warrants it.
 */
export default function LaunchPartnerPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 bg-linear-to-b from-primary/5 to-transparent"
      />

      <div className="mx-auto flex max-w-xl flex-col items-center gap-7">
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

        <a
          href={MAILTO}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Mail className="size-4" aria-hidden />
          Email us to apply
        </a>

        <p className="text-xs text-muted-foreground">
          Or write to{" "}
          <a
            href={`mailto:${PARTNER_EMAIL}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {PARTNER_EMAIL}
          </a>
        </p>

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
