import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatusChip } from "./capability-status";
import type { DirectoryItem } from "./content-types";
import { safeHref } from "./safe-href";

const cardCls = "flex h-full flex-col gap-2 rounded-2xl border bg-card p-5";
const compactCls = "flex h-full flex-col gap-1.5 rounded-2xl border bg-card p-4";

function CardBody({ it, linked, compact }: { it: DirectoryItem; linked: boolean; compact: boolean }) {
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={compact ? "text-base font-extrabold tracking-tight" : "text-lg font-extrabold tracking-tight"}>{it.title}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {it.draft && (
            <span className="rounded-full border border-[var(--daylight-amber)] px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide">Draft</span>
          )}
          {it.status && <StatusChip status={it.status} className="shrink-0" />}
        </span>
      </span>
      {it.body && <span className="text-[15px] text-muted-foreground">{it.body}</span>}
      {it.meta && <span className="text-sm text-muted-foreground">{it.meta}</span>}
      {(it.pillar || linked) && (
        <span className="mt-auto flex items-center gap-2 pt-1 text-sm font-bold">
          {it.pillar && <span className="font-semibold text-muted-foreground">{it.pillar}</span>}
          {linked && <ArrowRight aria-hidden className="ml-auto size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />}
        </span>
      )}
    </>
  );
}

/**
 * The cards of a family hub (features, integrations, industries, guides), each with its own status chip when a record
 * gives it one. A card with an `href` is a link; one without is plain text.
 *
 * With `balanced` the columns follow the count, so no row ends on a lone card: a count divisible by three runs in threes from the desktop
 * width; any other count runs in twos from the tablet width up. An odd last card spans the row.
 */
export function DirectoryGrid({ items, balanced = false, compact = false }: { items: DirectoryItem[]; balanced?: boolean; compact?: boolean }) {
  const cardBase = compact ? compactCls : cardCls;
  const cols = compact && !balanced
    ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    : !balanced
    ? "grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
    : items.length % 3 === 0
      ? "grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 sm:max-lg:[&>li:last-child:nth-child(odd)]:col-span-2"
      : "grid gap-3 sm:grid-cols-2 sm:gap-4 sm:[&>li:last-child:nth-child(odd)]:col-span-2";
  return (
    <ul role="list" className={cols}>
      {items.map((it, i) => (
        <li key={`${it.href ?? "card"}-${i}`}>
          {it.href ? (
            <Link
              href={safeHref(it.href)}
              className={`group ${cardBase} transition-all hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
            >
              <CardBody it={it} linked compact={compact} />
            </Link>
          ) : (
            <div className={cardBase}>
              <CardBody it={it} linked={false} compact={compact} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
