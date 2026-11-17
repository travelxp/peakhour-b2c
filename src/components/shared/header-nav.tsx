"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { PeakhourLogo } from "@/components/shared/peakhour-logo";
import { HOME_ROUTE } from "@/lib/nav-home";

// The five modules are the product — each has its own page. Pricing and Peaks
// are real routes today.
//
// ★PEAKS WAS FOOTER-ONLY. It is the one currency behind every module and the
// thing a buyer has to understand before a price means anything — and it was
// reachable only from the bottom of the page. It sits next to Pricing because
// that is the question it answers.
const NAV_LINKS = [
  { href: "/commerce", label: "commerce" },
  { href: "/content", label: "content" },
  { href: "/growth", label: "growth" },
  { href: "/support", label: "support" },
  { href: "/presence", label: "presence" },
  // ★Peaks sits BEFORE Pricing, not after it. Last place in a nav is the
  // weakest slot there is, and the order is also the argument: the five
  // modules are what you get, Peaks is what powers them, Pricing is what it
  // costs. Pricing stays rightmost because it is the rung nearest the CTA.
  { href: "/peaks", label: "peaks" },
  { href: "/pricing", label: "pricing" },
] as const;

// Nav link with a gold underline that wipes in on hover/focus.
const navLinkClass =
  "relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-brand after:transition-all after:duration-300 hover:after:w-full focus-visible:after:w-full";

// Gold-gradient primary CTA — self-contained so it doesn't fight the shadcn
// Button variant's background. Near-black ink (--brand-contrast) on molten gold.
const ctaClass =
  "inline-flex items-center justify-center rounded-md bg-brand-gradient px-4 py-2 text-sm font-semibold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

/**
 * Every string the header shows, resolved on the server (header.tsx) from messages/<locale>.json and
 * passed down, so this client component carries no i18n runtime and adds no client JS. `navLinks` is
 * keyed by NAV_LINKS' `label` key.
 */
export interface HeaderLabels {
  homeAria: string;
  primaryAria: string;
  navLinks: Record<(typeof NAV_LINKS)[number]["label"], string>;
  signIn: string;
  signOut: string;
  dashboard: string;
  settings: string;
  userMenu: string;
  openMenu: string;
  closeMenu: string;
  languageChip: string;
  languageChipShort: string;
  languageMore: string;
  languageTooltip: string;
}

/** The signup CTA resolved from the platform stage (see `signupCta`). Passed
 *  down from the server `Header` so the header label tracks the launch stage
 *  ("Start free trial" when open with a trial, "Get started" without one, "Join
 *  the waitlist" pre-launch) instead of always
 *  inviting signups. */
export interface HeaderCta {
  label: string;
  href: string;
  disabled?: boolean;
}

/**
 * @param minimal When true, renders only the brand lockup — no marketing nav
 *   (the five modules, Peaks and Pricing), no auth CTAs, no mobile menu. Used
 *   on the public legal pages, which are reachable pre-launch (through the
 *   coming-soon gate allowlist) where those links would point at gated or
 *   non-existent routes.
 * @param cta The signup CTA resolved from the platform stage.
 * @param labels The header's strings for the request's locale.
 * @param languageSwitcher The LanguageSwitcher, when more than one locale is published; it replaces the static English chip.
 */
export function HeaderNav({
  minimal = false,
  cta,
  labels,
  languageSwitcher,
}: {
  minimal?: boolean;
  cta: HeaderCta;
  labels: HeaderLabels;
  languageSwitcher?: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/auth");
  const isDashboard = pathname?.startsWith("/dashboard");
  const isOnboarding = pathname?.startsWith("/onboarding");
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Close mobile menu on route change
  useEffect(() => {
    // TODO: refactor to derive open state from pathname change without setState in effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  // Don't render header on dashboard (has its own sidebar) or onboarding (has step indicator)
  if (isDashboard || isOnboarding) return null;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center" aria-label={labels.homeAria}>
          <PeakhourLogo className="h-8 w-auto" decorative />
        </Link>

        {!minimal && !isAuthPage && (
          <>
            {/* Desktop nav — collapses to the mobile menu below lg so the
                seven items + auth cluster never crowd on small laptops and
                tablets. Seven is one more than this was measured at, so the
                gap tightens at lg and only opens back up at xl, where there is
                room for it. */}
            <nav aria-label={labels.primaryAria} className="hidden items-center gap-5 lg:flex xl:gap-6">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={navLinkClass}>
                  {labels.navLinks[link.label]}
                </Link>
              ))}
            </nav>
          </>
        )}

        {/* Right side: auth-aware (suppressed in minimal mode) */}
        {!minimal && (
        <div className="flex items-center gap-3">
          {!isLoading && isAuthenticated && user ? (
            <UserMenu user={user} onLogout={logout} labels={labels} />
          ) : !isAuthPage ? (
            <>
              {/* Desktop CTA */}
              <div className="hidden items-center gap-4 lg:flex">
                {languageSwitcher ?? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                    title={labels.languageTooltip}
                  >
                    <span aria-hidden="true">🌐</span> {labels.languageChipShort}
                  </span>
                )}
                <Link
                  href="/auth"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {labels.signIn}
                </Link>
                {!cta.disabled && (
                  <Link href={cta.href} className={ctaClass}>
                    {cta.label}
                  </Link>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-md border lg:hidden"
                aria-label={menuOpen ? labels.closeMenu : labels.openMenu}
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                  )}
                </svg>
              </button>
            </>
          ) : null}
        </div>
        )}
      </div>

      {/* Mobile nav panel */}
      {!minimal && !isAuthPage && menuOpen && (
        <div id="mobile-nav" className="border-t bg-background px-4 pb-4 pt-2 lg:hidden">
          <nav aria-label={labels.primaryAria} className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {labels.navLinks[link.label]}
              </Link>
            ))}
            <div className="mt-2 flex flex-col items-start gap-3 border-t pt-3">
              {languageSwitcher ?? (
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                  title={labels.languageTooltip}
                >
                  <span aria-hidden="true">🌐</span> {labels.languageChip}
                  <span className="font-normal">{labels.languageMore}</span>
                </span>
              )}
              {!isLoading && isAuthenticated ? (
                <>
                  <Link
                    href={HOME_ROUTE}
                    onClick={() => setMenuOpen(false)}
                    className="text-sm font-medium transition-colors hover:text-foreground"
                  >
                    {labels.dashboard}
                  </Link>
                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {labels.signOut}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth"
                    onClick={() => setMenuOpen(false)}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {labels.signIn}
                  </Link>
                  {!cta.disabled && (
                    <Link
                      href={cta.href}
                      onClick={() => setMenuOpen(false)}
                      className={ctaClass}
                    >
                      {cta.label}
                    </Link>
                  )}
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function UserMenu({
  user,
  onLogout,
  labels,
}: {
  user: { name?: string | null; email: string };
  onLogout: () => void;
  labels: HeaderLabels;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const initials = user.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : user.email[0].toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground transition-opacity hover:opacity-80"
        aria-label={labels.userMenu}
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-popover p-1 shadow-lg">
          <div className="px-3 py-2 border-b">
            {user.name && (
              <p className="text-sm font-medium">{user.name}</p>
            )}
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <Link
            href={HOME_ROUTE}
            onClick={() => setOpen(false)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            {labels.dashboard}
          </Link>
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            {labels.settings}
          </Link>
          <div className="border-t mt-1 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); onLogout(); }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              {labels.signOut}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
