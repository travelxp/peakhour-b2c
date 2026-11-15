import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusChip } from "./capability-status";
import type { PlatformItem } from "./content-types";

/**
 * One card per surface the thing runs on, each with its OWN status: a live Shopify build says nothing about
 * WooCommerce, so the chooser never shows one chip for all of them. A card links only when it has a page.
 */
export function PlatformChooser({ platforms }: { platforms: PlatformItem[] }) {
  return (
    <ul
      role="list"
      className={cn(
        "grid gap-3 sm:gap-4",
        platforms.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : platforms.length === 2 ? "sm:grid-cols-2" : "",
      )}
    >
      {platforms.map((p) => {
        const body = (
          <>
            <span className="flex items-start justify-between gap-3">
              <span className="text-lg font-extrabold tracking-tight">{p.label}</span>
              <StatusChip status={p.status} className="shrink-0" />
            </span>
            <span className="text-[15px] text-muted-foreground">{p.body}</span>
            {p.limitations && p.limitations.length > 0 && (
              <span className="text-sm text-muted-foreground">
                <b className="font-bold text-foreground">Not yet: </b>
                {p.limitations.join("; ")}
              </span>
            )}
            {p.href && (
              <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-bold">
                See {p.label}
                <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
              </span>
            )}
          </>
        );
        const cls = "group flex h-full flex-col gap-2.5 rounded-2xl border bg-card p-5";
        return (
          <li key={p.surface}>
            {p.href ? (
              <Link
                href={p.href}
                className={cn(cls, "transition-all hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0")}
              >
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
