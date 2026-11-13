import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { PeakMark } from "@/components/marketing/shopify/shopify-art";
import { SITE, cn } from "@/lib/utils";

/**
 * The chrome the two pre-launch pages share (/coming-soon, served for every
 * gated URL in production, and /launch-partner): a top bar, the Launch Partner
 * perks and steps, and the legal footer. Both pages wrap themselves in
 * .theme-daylight (globals.css), the palette /shopify uses.
 *
 * ★SELF-CONTAINED: no Header or Footer that link into the gated app. Every
 * link is next/link with prefetch={false}: every gated URL renders the teaser,
 * so a viewport prefetch would server-render /auth and /launch-partner on each
 * view. /auth, /launch-partner and the legal routes are allowlisted by the
 * coming-soon gate in middleware.ts.
 */
export const launchWrap = "mx-auto w-full max-w-6xl px-4 sm:px-6";
/** The Daylight type and button classes both pages use (one copy, so a restyle is one edit). */
export const launchEyebrow = "text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground";
export const launchH2 = "mt-3 text-[2rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-balance sm:text-5xl";
export const launchCoralBtn =
  "group inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-[15px] font-bold text-brand-contrast shadow-[0_8px_20px_-8px_var(--brand)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** What a launch partner gets. Each is a promise the team keeps by hand, not a feature. */
export const LAUNCH_PERKS: { title: string; body: string }[] = [
  { title: "Work directly with our team", body: "A named person on our side, and a channel to reach them." },
  { title: "Shape the roadmap", body: "Tell us what to build next for your business, and see it land." },
  { title: "Early access", body: "Use Peakhour Suite ahead of public launch." },
  { title: "Hands-on setup", body: "We connect your store and channels with you." },
];

/** The real order an application goes in: the form, ops approval in the CMS, then a magic-link sign-in. */
export const LAUNCH_STEPS: { title: string; body: string }[] = [
  { title: "Apply", body: "Your work email, and what you would like Peakhour to take off your plate." },
  { title: "We review", body: "Our team approves launch partners in small groups." },
  { title: "Sign in", body: "Approved? We email you a sign-in link. No password needed." },
];

export function LaunchTopBar({ back = false }: { back?: boolean }) {
  return (
    <header className={cn(launchWrap, "flex items-center justify-between gap-4 py-4 sm:py-5")}>
      <Link prefetch={false} href="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
        <span className="grid size-8 place-items-center rounded-[9px] bg-brand-gradient">
          <PeakMark className="size-5" />
        </span>
        {SITE.name}
      </Link>
      <nav className="flex items-center gap-2">
        {back && (
          <Link
            prefetch={false}
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
        )}
        {/* For approved launch partners: the magic-link endpoint sends a real link only to approved emails. */}
        <Link
          prefetch={false}
          href="/auth"
          className="inline-flex items-center rounded-full px-4 py-2 text-sm font-bold shadow-[inset_0_0_0_1.5px_var(--border)] transition-colors hover:shadow-[inset_0_0_0_1.5px_var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}

/** The four perks, with a check each. `tone` picks the ground they sit on. */
export function LaunchPerks({ tone = "light", className }: { tone?: "light" | "ink"; className?: string }) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {LAUNCH_PERKS.map((p) => (
        <li key={p.title} className="flex gap-3">
          <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={3} />
          <span>
            <b className="block">{p.title}</b>
            <span className={cn("text-[15px]", tone === "ink" ? "text-on-ink-dim" : "text-muted-foreground")}>{p.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The three steps, numbered because they are a real sequence. `tone` picks the ground they sit on. */
export function LaunchSteps({ tone = "light" }: { tone?: "light" | "ink" }) {
  return (
    <ol className="grid gap-5 sm:grid-cols-3">
      {LAUNCH_STEPS.map((s, i) => (
        <li key={s.title} className={cn("border-t-[3px] pt-4", tone === "ink" ? "border-on-ink/30" : "border-foreground")}>
          <span className="block text-3xl font-black leading-none text-brand">{i + 1}</span>
          <b className="mt-2.5 block text-lg tracking-tight">{s.title}</b>
          <span className={cn("mt-1 block text-[15px]", tone === "ink" ? "text-on-ink-dim" : "text-muted-foreground")}>{s.body}</span>
        </li>
      ))}
    </ol>
  );
}

export function LaunchFooter() {
  return (
    <footer className={cn(launchWrap, "flex flex-col items-center justify-between gap-3 border-t py-6 text-sm text-muted-foreground sm:flex-row")}>
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link prefetch={false} href="/privacy-policy" className="transition-colors hover:text-foreground">
          Privacy Policy
        </Link>
        <Link prefetch={false} href="/terms" className="transition-colors hover:text-foreground">
          Terms of Service
        </Link>
        <Link prefetch={false} href="/cookie-policy" className="transition-colors hover:text-foreground">
          Cookie Policy
        </Link>
        <Link prefetch={false} href="/data-deletion" className="transition-colors hover:text-foreground">
          Data Deletion
        </Link>
      </nav>
      <p>
        © {new Date().getFullYear()} {SITE.company.legalName}. All rights reserved.
      </p>
    </footer>
  );
}
