import Link from "next/link";
import { Header } from "@/components/shared/header";
import { SITE } from "@/lib/utils";

// `py-1 -my-1` grows the tap target toward WCAG 2.5.8 without adding height to
// the strip — /auth is fighting for vertical space on small screens.
const LEGAL_LINK =
  "rounded-sm py-1 -my-1 underline underline-offset-2 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Chrome for the auth flow (/auth, /auth/verify, /auth/accept-invite,
 * /auth/complete-profile).
 *
 * The marketing footer is replaced by a single-line legal strip rather than
 * simply dropped. /auth is a two-panel layout whose dark brand panel should
 * run the height of the viewport, and a multi-column footer both cut that off
 * and offered a wall of exit links at the one point we want the visitor to
 * finish — but the footer was also the only route to Terms, Privacy and the
 * Cookie Policy on all four of these pages, and /auth/complete-profile
 * collects personal data. The strip keeps that reachable at a fraction of the
 * height.
 *
 * Support is a mailto, not /contact: the middleware allowlists /auth (and the
 * three legal pages) so approved launch partners can sign in while the
 * coming-soon gate is up, but /contact is NOT allowlisted — a link there would
 * bounce the one visitor group this escape hatch exists for to the teaser page.
 *
 * `HeaderNav` already suppresses the marketing nav and the signed-out auth
 * CTAs on /auth routes, so for a signed-out visitor the header is the brand
 * lockup alone. A signed-in visitor still gets the user menu, which is what
 * you want on /auth/complete-profile and /auth/accept-invite.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // min-h-dvh, not min-h-screen: on mobile browsers `vh` is the tallest
    // viewport (URL bar retracted), so a min-h-screen column is taller than
    // what's actually visible and the page scrolls a little even when the
    // content fits. `dvh` tracks the live viewport, so it doesn't.
    //
    // Guarded rather than stacked: a browser without `dvh` DROPS the
    // declaration rather than falling back, which would leave the column with
    // no min-height at all and float the legal strip up mid-viewport. Writing
    // both classes bare would leave the winner to Tailwind's emit order; the
    // @supports variant always sorts after the base utility, so `dvh` wins
    // exactly where it is understood.
    <div className="flex min-h-screen flex-col supports-[min-height:100dvh]:min-h-dvh">
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4 py-3 text-center text-xs text-muted-foreground sm:py-4">
        {/* The address spells itself out only where there's width for it. At
            375px the full "Trouble signing in? hello@peakhour.ai" wrapped the
            strip onto a second line, which is height /auth can't spare. */}
        <a href={`mailto:${SITE.contactGeneral}`} className={LEGAL_LINK}>
          <span className="sm:hidden">Help</span>
          {/* sr-only keeps this in the accessibility tree at zero height, so
              the mobile link announces as "Help — email hello@peakhour.ai"
              instead of a bare "Help" that reads like a help page. The visible
              word stays a prefix of the accessible name (WCAG 2.5.3). */}
          <span className="sr-only sm:hidden"> — email {SITE.contactGeneral}</span>
          <span className="hidden sm:inline">
            Trouble signing in? {SITE.contactGeneral}
          </span>
        </a>
        <span aria-hidden className="opacity-40">
          ·
        </span>
        <Link href="/terms" className={LEGAL_LINK}>
          Terms
        </Link>
        <span aria-hidden className="opacity-40">
          ·
        </span>
        <Link href="/privacy-policy" className={LEGAL_LINK}>
          Privacy
        </Link>
        <span aria-hidden className="opacity-40">
          ·
        </span>
        <Link href="/cookie-policy" className={LEGAL_LINK}>
          Cookies
        </Link>
      </footer>
    </div>
  );
}
