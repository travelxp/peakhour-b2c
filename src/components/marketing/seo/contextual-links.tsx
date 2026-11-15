import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LinkItem } from "./content-types";
import { safeHref } from "./safe-href";

/**
 * Two to six related links, each with an anchor that says what is behind it ("WhatsApp COD confirmation for
 * Shopify", never "click here" or "learn more"), and a line of why. Plain anchors in the server HTML.
 */
export function ContextualLinks({ links, className }: { links: LinkItem[]; className?: string }) {
  // The kit's rule is 2 to 6; more than six reads as a link farm and is cut here rather than trusted to the author.
  const shown = links.slice(0, 6);
  if (shown.length === 0) return null;
  return (
    <ul role="list" className={className ?? "grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"}>
      {shown.map((l) => (
        <li key={l.href}>
          <Link
            href={safeHref(l.href)}
            className="group flex h-full flex-col gap-1.5 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <span className="flex items-center gap-2 font-extrabold tracking-tight">
              {l.label}
              <ArrowRight aria-hidden className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
            </span>
            {l.note && <span className="text-[15px] text-muted-foreground">{l.note}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
