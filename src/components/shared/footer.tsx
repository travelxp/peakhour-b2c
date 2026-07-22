import Link from "next/link";
import { SITE } from "@/lib/utils";
import { PeakhourLogo } from "@/components/shared/peakhour-logo";

// Grouped footer nav. Every href below is a route that exists today.
const FOOTER_GROUPS = [
  {
    heading: "Platform",
    links: [
      { href: "/commerce", label: "Commerce" },
      { href: "/content", label: "Content" },
      { href: "/growth", label: "Growth" },
      { href: "/support", label: "Support" },
      { href: "/presence", label: "Presence" },
    ],
  },
  {
    heading: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/peaks", label: "Peaks" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/cookie-policy", label: "Cookie Policy" },
      { href: "/data-deletion", label: "Data Deletion" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <Link
              href="/"
              className="flex items-center"
              aria-label="Peakhour.ai home"
            >
              <PeakhourLogo className="h-7 w-auto" />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              The AI business platform for growing brands. Five pillars, one
              brain, free to start.
            </p>
            <span
              className="mt-4 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground"
              title="Available in English; more languages coming"
            >
              <span aria-hidden="true">🌐</span> English
              <span className="font-normal">· more soon</span>
            </span>
          </div>

          {/* Link groups */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-14">
            {FOOTER_GROUPS.map((group) => (
              <nav key={group.heading} aria-label={group.heading}>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {group.heading}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-brand"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          {SITE.name} &copy; {new Date().getFullYear()}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
