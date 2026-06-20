import Link from "next/link";
import { SITE } from "@/lib/utils";
import { PeakhourLogo } from "@/components/shared/peakhour-logo";

const FOOTER_LINKS = [
  { href: "/peaks", label: "Peaks" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cookie-policy", label: "Cookie Policy" },
  { href: "/data-deletion", label: "Data Deletion" },
] as const;

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Link href="/" className="flex items-center" aria-label="Peakhour.ai home">
            <PeakhourLogo className="h-7 w-auto" />
          </Link>

          <nav className="flex items-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          {SITE.name} &copy; {new Date().getFullYear()}. AI-powered marketing
          for growing businesses.
        </div>
      </div>
    </footer>
  );
}
