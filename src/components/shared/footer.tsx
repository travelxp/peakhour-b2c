import Link from "next/link";
import { SITE } from "@/lib/utils";

const FOOTER_LINKS = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
] as const;

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-bold text-primary-foreground">P</span>
            </div>
            <span className="text-sm font-semibold">{SITE.name}</span>
          </div>

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
