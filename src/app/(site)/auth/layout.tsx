import Link from "next/link";
import { Header } from "@/components/shared/header";
import { SITE } from "@/lib/utils";

const LEGAL_LINK =
  "rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4 py-4 text-center text-xs text-muted-foreground">
        <span>
          Trouble signing in?{" "}
          <a href={`mailto:${SITE.contactGeneral}`} className={LEGAL_LINK}>
            {SITE.contactGeneral}
          </a>
        </span>
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
