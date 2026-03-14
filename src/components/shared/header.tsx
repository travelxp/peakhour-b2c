"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
] as const;

export function Header() {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith("/auth");

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">P</span>
          </div>
          <span className="text-lg font-bold tracking-tight">{SITE.name}</span>
        </Link>

        {!isAuth && (
          <>
            <nav className="hidden items-center gap-6 md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Link
                href="/auth"
                className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
              >
                Sign in
              </Link>
              <Button asChild size="sm">
                <Link href="/auth">Get started free</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
