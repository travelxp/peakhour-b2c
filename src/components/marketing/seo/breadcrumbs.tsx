import Link from "next/link";
import type { Crumb } from "./content-types";
import { breadcrumbListLd } from "@/lib/seo/structured-data";
import { JsonLd } from "./json-ld";
import { safeHref } from "./safe-href";

/**
 * Semantic breadcrumb trail, and its BreadcrumbList JSON-LD from the SAME `crumbs`: one source feeds both, so the markup
 * can never differ from what is drawn (Bible 9.3). The last crumb is the current page.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
    <JsonLd data={breadcrumbListLd(crumbs)} />
    <nav aria-label="Breadcrumb" className="text-sm font-medium text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1.5">
              {last ? (
                <span aria-current="page" className="text-foreground">
                  {c.label}
                </span>
              ) : (
                <Link
                  href={safeHref(c.href)}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {c.label}
                </Link>
              )}
              {!last && (
                <span aria-hidden className="opacity-40">
                  &rsaquo;
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
    </>
  );
}
