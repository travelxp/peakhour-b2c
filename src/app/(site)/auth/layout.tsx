import { Header } from "@/components/shared/header";

/**
 * Chrome for the auth flow (/auth, /auth/verify, /auth/accept-invite,
 * /auth/complete-profile).
 *
 * Header only — no footer. These are single-purpose flow pages, and /auth in
 * particular is a two-panel layout whose dark brand panel is meant to run to
 * the bottom of the viewport; a marketing footer underneath both cut that off
 * and offered a wall of exit links at the one point we want the visitor to
 * finish. The legal links the footer used to carry are restated inline on
 * /auth itself.
 *
 * `HeaderNav` already suppresses the marketing nav and auth CTAs on /auth
 * routes, so the header renders as the brand lockup alone.
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
    </div>
  );
}
