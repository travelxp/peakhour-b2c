"use client";

import Link from "next/link";
import { ExternalLink, Lightbulb } from "lucide-react";

import {
  analyticsAbsenceText,
  analyticsCoverageLine,
  analyticsFiguresLine,
  daysLiveLine,
  ledgerDate,
  rowHref,
  rowTitle,
  searchAbsenceText,
  searchFiguresLine,
  searchTrendLine,
  searchWindowLine,
  suggestionLine,
} from "@/lib/content-ledger";
import type { LedgerRow } from "@/lib/api/growth";

/**
 * What we published, and what each page earned — one row per page.
 *
 * ★★THIS COMPONENT PHRASES; IT NEVER DECIDES. Every refusal on this screen was
 * made in the api: a page with no analytics row arrives as `no_page_rows`
 * rather than a zero, a search total the pages cannot share arrives withheld,
 * and every measurement date arrives from the data rather than from the period
 * asked for. A client that reached past any of those to a `?? 0` would put back
 * the exact figure the api declined to publish — and the one it declines hardest
 * is "0 visitors" on a page that was simply outside the top 25 the provider
 * stores.
 *
 * The sentences themselves are in `lib/content-ledger.ts`, where they can be
 * tested and mutated without a DOM.
 *
 * ★★AND THE TWO NUMBER COLUMNS ARE NOT COMPARABLE, WHICH IS WHY THEY ARE
 * LABELLED SEPARATELY. Search is a 28-day WINDOW carrying its own bounds;
 * analytics is a SERIES summed from the publish date. Putting them under one
 * "performance" heading would invite a reader to subtract one from the other.
 */

/** A figure with the sentence that says what it covers, or the sentence alone. */
function Measure({
  value,
  sub,
  absent,
}: {
  value?: string;
  sub?: string | null;
  absent?: string;
}) {
  if (absent !== undefined) {
    // ★NOT A ZERO, AND NOT A BARE DASH. The sentence is the answer — a muted
    // dash here is read as "nothing happened", which is the claim the api
    // refused to make.
    return <p className="text-xs text-muted-foreground">{absent}</p>;
  }
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Row({ row }: { row: LedgerRow }) {
  const title = rowTitle(row);
  const href = rowHref(row);
  const suggestion = row.suggestion ? suggestionLine(row.suggestion) : null;

  return (
    <div className="grid grid-cols-1 gap-3 border-b p-4 last:border-b-0 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-1">
        {/* ★★NO LINK WHEN THERE IS NO ADDRESS WE CAN OPEN, AND NO ICON EITHER.
            A stored url that will not parse — or one with no scheme, which is a
            RELATIVE href — sent "open in a new tab" to the dashboard's own 404.
            An icon promising a link beside text that is not one is the same
            broken promise, one step quieter. */}
        <div className="flex min-w-0 items-start gap-2">
          {href ? (
            <>
              <Link
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 truncate text-sm font-medium hover:underline"
              >
                {title}
              </Link>
              <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
            </>
          ) : (
            <span className="min-w-0 truncate text-sm font-medium">{title}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {/* ★THE PUBLISH DATE IS OURS, not the CMS's — it is the date every
              measurement on this row is counted from, and the one nothing
              downstream can rewrite. */}
          Published {ledgerDate(row.publishedAt)} · {daysLiveLine(row)}
        </p>
        {suggestion ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lightbulb className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span>{suggestion}</span>
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Google search
        </p>
        {row.search.state === "measured" ? (
          <Measure
            value={searchFiguresLine(row.search)}
            sub={[searchWindowLine(row.search), searchTrendLine(row.search)]
              .filter(Boolean)
              .join(" · ")}
          />
        ) : (
          <Measure absent={searchAbsenceText(row.search.reason)} />
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Visitors
        </p>
        {row.analytics.state === "measured" ? (
          <Measure
            value={analyticsFiguresLine(row.analytics)}
            sub={analyticsCoverageLine(row.analytics)}
          />
        ) : (
          <Measure absent={analyticsAbsenceText(row.analytics.reason)} />
        )}
      </div>
    </div>
  );
}

export function ContentLedgerTable({ rows }: { rows: LedgerRow[] }) {
  return (
    <div className="divide-y rounded-lg border bg-card">
      {rows.map((row) => (
        // ★KEYED ON THE URL, which is the node's own natural key — one node per
        // URL per channel, so it is unique within a response and stable across
        // refetches in a way an array index is not.
        <Row key={`${row.channel}:${row.url}`} row={row} />
      ))}
    </div>
  );
}
