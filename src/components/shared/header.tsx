"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { PeakhourLogo } from "@/components/shared/peakhour-logo";

// The five pillars are the product. Links target homepage anchors until the
// dedicated pillar pages ship (PR-5); before then they resolve to the homepage
// (graceful — no 404). Pricing is a real route today.
const NAV_LINKS = [
  { href: "/#commerce", label: "Commerce" },
  { href: "/#content", label: "Content" },
  { href: "/#growth", label: "Growth" },
  { href: "/#support", label: "Support" },
  { href: "/#presence", label: "Presence" },
  { href: "/pricing", label: "Pricing" },
] as const;

// Nav link with a gold underline that wipes in on hover/focus.
const navLinkClass =
  "relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-brand after:transition-all after:duration-300 hover:after:w-full focus-visible:after:w-full";

// Gold-gradient primary CTA — self-contained so it doesn't fight the shadcn
// Button variant's background. Near-black ink (--brand-contrast) on molten gold.
const ctaClass =
  "inline-flex items-center justify-center rounded-md bg-brand-gradient px-4 py-2 text-sm font-semibold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5";

/**
 * @param minimal When true, renders only the brand lockup — no marketing nav
 *   (Features/Pricing), no auth CTAs, no mobile menu. Used on the public
 *   legal pages, which are reachable pre-launch (through the coming-soon gate
 *   allowlist) where those links would point at gated/non-existent routes.
 */
export function Header({ minimal = false }: { minimal?: boolean } = {}) {
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
        <Link href="/" className="flex items-center" aria-label="Peakhour.ai home">
          <PeakhourLogo className="h-8 w-auto" />
        </Link>

        {!minimal && !isAuthPage && (
          <>
            {/* Desktop nav */}
            <nav className="hidden items-center gap-6 md:flex">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={navLinkClass}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </>
        )}

        {/* Right side: auth-aware (suppressed in minimal mode) */}
        {!minimal && (
        <div className="flex items-center gap-3">
          {!isLoading && isAuthenticated && user ? (
            <UserMenu user={user} onLogout={logout} />
          ) : !isAuthPage ? (
            <>
              {/* Desktop CTA */}
              <div className="hidden items-center gap-4 md:flex">
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                  title="Available in English; more languages coming"
                >
                  <span aria-hidden="true">🌐</span> EN
                </span>
                <Link
                  href="/auth"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Sign in
                </Link>
                <Link href="/auth" className={ctaClass}>
                  Start free
                </Link>
              </div>

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-md border md:hidden"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
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
        <div id="mobile-nav" className="border-t bg-background px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t pt-3">
              {!isLoading && isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard/overview"
                    onClick={() => setMenuOpen(false)}
                    className="text-sm font-medium transition-colors hover:text-foreground"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth"
                    onClick={() => setMenuOpen(false)}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/auth"
                    onClick={() => setMenuOpen(false)}
                    className={ctaClass}
                  >
                    Start free
                  </Link>
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
}: {
  user: { name?: string | null; email: string };
  onLogout: () => void;
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
        aria-label="User menu"
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
            href="/dashboard/overview"
            onClick={() => setOpen(false)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            Settings
          </Link>
          <div className="border-t mt-1 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); onLogout(); }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
