import { Check, CircleHelp, FileQuestion, Minus, X } from "lucide-react";
import { PeakhourWordmark } from "@/components/shared/peakhour-logo";
import { cn } from "@/lib/utils";
import type { CellValue, ComparisonCell, ComparisonContent, ComparisonVendor } from "./content-types";
import { linkCls } from "./styles";
import { safeHref } from "./safe-href";

/**
 * The cell vocabulary (Bible 7.4). Each value has its own icon AND word, so colour is never the only signal, and
 * "Not documented" is a different thing from "Not supported": a vendor that does not publish something has not been
 * shown to lack it, so it is never rendered as "No".
 */
const CELL: Record<CellValue, { label: string; icon: typeof Check; cls: string; meaning: string }> = {
  yes: {
    label: "Yes",
    icon: Check,
    cls: "border-[var(--daylight-ok)]/30 bg-[var(--daylight-ok-soft)] text-[var(--daylight-ok-ink)]",
    meaning: "The vendor's own documentation says it does this.",
  },
  partial: {
    label: "Partial",
    icon: Minus,
    cls: "border-[var(--daylight-amber)]/60 bg-[var(--daylight-warn-soft)] text-[var(--daylight-warn-ink)]",
    meaning: "It does part of this, or only on some plans or setups. The note says which.",
  },
  "not-documented": {
    label: "Not documented",
    icon: FileQuestion,
    cls: "border-border bg-muted text-foreground",
    meaning: "We found nothing public either way. This is not the same as No.",
  },
  "not-supported": {
    label: "Not supported",
    icon: X,
    cls: "border-[var(--daylight-bad)]/30 bg-[var(--daylight-bad-soft)] text-[var(--daylight-bad-ink)]",
    meaning: "The vendor's own documentation says it does not do this.",
  },
  unknown: {
    label: "Unknown",
    icon: CircleHelp,
    cls: "border-dashed border-border bg-background text-muted-foreground",
    meaning: "We have not checked yet. Nothing is claimed.",
  },
};

const ORDER: CellValue[] = ["yes", "partial", "not-documented", "not-supported", "unknown"];

function CellChip({ value }: { value: CellValue }) {
  const c = CELL[value];
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-bold", c.cls)}>
      <Icon aria-hidden className="size-3.5" strokeWidth={2.75} />
      {c.label}
    </span>
  );
}

function VendorName({ v }: { v: ComparisonVendor }) {
  // The Peakhour column is the official artwork, never a typed name (brand-guard).
  if (v.isPeakhour) {
    return (
      <span className="inline-flex">
        <PeakhourWordmark className="h-4 w-auto" />
        <span className="sr-only">{v.name}</span>
      </span>
    );
  }
  return <>{v.name}</>;
}

function CellBody({ cell }: { cell: ComparisonCell }) {
  return (
    <div className="grid justify-items-start gap-1.5">
      <CellChip value={cell.value} />
      {cell.note && <span className="text-sm text-muted-foreground">{cell.note}</span>}
      {cell.source ? (
        <span className="text-sm text-muted-foreground">
          <a href={safeHref(cell.source.href)} target="_blank" rel="noopener noreferrer nofollow" className={linkCls}>
            {cell.source.label}
          </a>
          {cell.observedAt && (
            <>
              {" "}
              · seen <time dateTime={cell.observedAt}>{cell.observedAt}</time>
            </>
          )}
        </span>
      ) : cell.value === "unknown" || cell.value === "not-documented" ? null : (
        // A claim (Yes, Partial, Not supported) with no source is flagged, never silently shown.
        <span className="text-sm font-semibold text-[var(--daylight-bad-ink)]">Source missing</span>
      )}
    </div>
  );
}

/**
 * Dimensions down, vendors across. From md it is a table; below md the same markup becomes one stacked card per
 * dimension (every cell prints its vendor's name), so a phone never scrolls sideways. The ARIA roles are explicit
 * because switching a table to `display:block` drops its table semantics in some browsers.
 */
export function ComparisonTable({ comparison }: { comparison: ComparisonContent }) {
  const { vendors, rows, lastChecked } = comparison;
  return (
    <div>
      <ul role="list" aria-label="What each answer means" className="mb-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {ORDER.map((v) => (
          <li key={v} className="grid justify-items-start gap-1.5 rounded-xl border bg-card p-3">
            <CellChip value={v} />
            <span className="text-sm text-muted-foreground">{CELL[v].meaning}</span>
          </li>
        ))}
      </ul>

      <table role="table" className="block w-full border-collapse text-left md:table">
        <caption className="sr-only">Side-by-side comparison, last checked {lastChecked}</caption>
        <thead role="rowgroup" className="sr-only md:not-sr-only md:table-header-group">
          <tr role="row" className="md:table-row">
            <th role="columnheader" scope="col" className="border-b-2 border-foreground px-3 py-3 text-sm font-extrabold md:w-1/5">
              What we compared
            </th>
            {vendors.map((v) => (
              <th key={v.id} role="columnheader" scope="col" className="border-b-2 border-foreground px-3 py-3 text-sm font-extrabold">
                <VendorName v={v} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="grid gap-3 md:table-row-group">
          {rows.map((r) => (
            <tr key={r.dimension} role="row" className="block rounded-2xl border bg-card p-4 md:table-row md:rounded-none md:border-0 md:border-b md:bg-transparent md:p-0">
              <th role="rowheader" scope="row" className="block pb-3 text-base font-extrabold md:table-cell md:px-3 md:py-4 md:align-top md:text-[15px]">
                {r.dimension}
              </th>
              {vendors.map((v) => {
                const cell = r.cells[v.id] ?? { value: "unknown" as const };
                return (
                  <td key={v.id} role="cell" className="block border-t py-3 first:border-t-0 md:table-cell md:border-t-0 md:px-3 md:py-4 md:align-top">
                    <span className="mb-1.5 block text-sm font-bold md:hidden">
                      <VendorName v={v} />
                    </span>
                    <CellBody cell={cell} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-sm text-muted-foreground">
        Last checked: <time dateTime={lastChecked}>{lastChecked}</time>. Every cell with a source links to it and shows the date we read it.
      </p>
    </div>
  );
}
