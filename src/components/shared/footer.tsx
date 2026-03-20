import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";

const FOOTER_LINKS = {
  product: [
    { href: "/dashboard/overview", label: "Character Engine" },
    { href: "/dashboard/ads", label: "Autonomous Ads" },
    { href: "/dashboard/integrations", label: "Integrations" },
  ],
  solutions: [
    { href: "/pricing", label: "Enterprise" },
    { href: "/#engines", label: "Creator Studio" },
    { href: "/contact", label: "Case Studies" },
  ],
  company: [
    { href: "/contact", label: "Careers" },
    { href: "/privacy-policy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ],
  support: [
    { href: "/contact", label: "Docs" },
    { href: "/contact", label: "API Status" },
    { href: "/contact", label: "Contact" },
  ],
} as const;

export function Footer() {
  return (
    <footer className="border-t border-border/5 bg-[--ph-surface-150]">
      <div className="mx-auto grid max-w-360 grid-cols-2 gap-12 px-12 py-24 md:grid-cols-4 lg:grid-cols-6">
        {/* Brand */}
        <div className="col-span-2 space-y-8">
          <span className="font-display text-xl font-bold">peakhour.ai</span>
          <p className="max-w-xs text-sm leading-relaxed text-foreground/40">
            Autonomous marketing infrastructure for the intelligent monolith.
            Build, scale, and dominate the digital landscape.
          </p>
        </div>

        {/* Link columns */}
        {(
          Object.entries(FOOTER_LINKS) as [
            string,
            ReadonlyArray<{ href: string; label: string }>,
          ][]
        ).map(([section, links]) => (
          <div key={section} className="space-y-6">
            <h5 className="font-display text-xs font-bold uppercase tracking-widest">
              {section}
            </h5>
            <ul className="space-y-4 font-mono text-sm">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-foreground/60 underline decoration-1 underline-offset-4 transition-all hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-360 border-t border-border/10 px-12 py-12">
        <MonoLabel size="xs" color="faint" className="tracking-[0.2em]">
          &copy; {new Date().getFullYear()} peakhour.ai. All rights reserved.
          Built for the Intelligent Monolith.
        </MonoLabel>
      </div>
    </footer>
  );
}
