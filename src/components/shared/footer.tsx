import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";

const FOOTER_LINKS = {
  product: [
    { href: "/#engines", label: "Solutions" },
    { href: "/#lifecycle", label: "Neural Engine" },
    { href: "/pricing", label: "Pricing" },
  ],
  company: [
    { href: "/contact", label: "Contact" },
    { href: "/privacy-policy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ],
} as const;

export function Footer() {
  return (
    <footer className="border-t border-border bg-[--ph-bg-shell]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Brand */}
          <div>
            <span className="font-display text-lg font-bold tracking-tighter text-foreground">
              peakhour<span className="text-primary">.ai</span>
            </span>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your AI marketing department. Content intelligence, creative factory,
              and optimization engine — all in one platform.
            </p>
          </div>

          {/* Product links */}
          <div>
            <MonoLabel as="h4" size="xs" color="muted">
              Product
            </MonoLabel>
            <nav className="mt-4 flex flex-col gap-3">
              {FOOTER_LINKS.product.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[--ph-text-secondary] transition-colors duration-200 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Company links */}
          <div>
            <MonoLabel as="h4" size="xs" color="muted">
              Company
            </MonoLabel>
            <nav className="mt-4 flex flex-col gap-3">
              {FOOTER_LINKS.company.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[--ph-text-secondary] transition-colors duration-200 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
            &copy; {new Date().getFullYear()} Media Worldwide Limited. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
