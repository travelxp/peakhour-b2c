import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatusChip } from "./capability-status";
import type { DirectoryItem } from "./content-types";

/** The cards of a family hub (features, integrations, industries, guides), each with its own status chip. */
export function DirectoryGrid({ items }: { items: DirectoryItem[] }) {
  return (
    <ul role="list" className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {items.map((it) => (
        <li key={it.href}>
          <Link
            href={it.href}
            className="group flex h-full flex-col gap-2 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="text-lg font-extrabold tracking-tight">{it.title}</span>
              <StatusChip status={it.status} className="shrink-0" />
            </span>
            <span className="text-[15px] text-muted-foreground">{it.body}</span>
            <span className="mt-auto flex items-center gap-2 pt-1 text-sm font-bold">
              {it.pillar && <span className="font-semibold text-muted-foreground">{it.pillar}</span>}
              <ArrowRight aria-hidden className="ml-auto size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
