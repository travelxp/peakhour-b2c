import { Header } from "@/components/shared/header";
import { FlowLegalStrip, flowScreen } from "@/components/marketing/flow/flow-kit";

/**
 * Chrome for the auth flow (/auth, /auth/verify, /auth/accept-invite,
 * /auth/complete-profile).
 *
 * The marketing footer is replaced by a single-line legal strip rather than
 * simply dropped. /auth is a two-panel layout whose product panel should
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
    // `flowScreen` is the min-h-dvh column (see flow-kit.tsx for why dvh, and why guarded).
    // .theme-daylight makes the whole auth flow the marketing palette whether or not the site-wide default has landed.
    <div className={`theme-daylight ${flowScreen}`}>
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <FlowLegalStrip />
    </div>
  );
}
