import { getPublicCatalog, signupCta } from "@/lib/catalog";
import { HeaderNav } from "@/components/shared/header-nav";

/**
 * Site header (server wrapper). Resolves the signup CTA from the live platform
 * stage so the header's primary button tracks the launch state — "Start free"
 * when signups are open, "Join the waitlist" / "Request an invite" pre-launch,
 * and hidden when closed — instead of always inviting signups. The interactive
 * shell (nav, mobile menu, user menu) lives in the client `HeaderNav`.
 *
 * @param minimal Renders only the brand lockup (no nav, no CTA) — used on the
 *   legal pages. Skips the catalog fetch since nothing reads the CTA there.
 */
export async function Header({ minimal = false }: { minimal?: boolean } = {}) {
  // Legal pages show no CTA — don't pay for the catalog fetch.
  const cta = minimal
    ? { label: "Start free", href: "/auth" }
    : signupCta((await getPublicCatalog())?.platform?.signupMode ?? "open");

  return <HeaderNav minimal={minimal} cta={cta} />;
}
