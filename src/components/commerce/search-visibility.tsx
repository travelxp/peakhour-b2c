"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchVisibility } from "@/hooks/use-search-visibility";
import {
  badgeVariant,
  blockerNote,
  headline,
  isUsableVisibility,
  legendEntries,
  stateLabel,
  windowSentence,
  type ProductRow,
  type VisibilityReady,
} from "@/lib/search-visibility";

/**
 * Search visibility — which products Google shows, and which it never has.
 *
 * ── ★★THE ONE THING WE CAN TELL A MERCHANT THAT THEIR STORE ADMIN CANNOT ───
 *
 * Shopify and WooCommerce analytics report what happened after someone arrived.
 * Neither can say which products Google never showed anyone — there were no
 * sessions to record.
 *
 * ★AND IT IS A STATEMENT ABOUT THEIR BUSINESS, so this panel obeys the api's
 * gate rather than the numbers. `lib/search-visibility.ts` decides the sentence
 * and this renders whichever one comes back. A panel that read
 * `summary.unknown` and wrote its own headline would undo four rounds of api
 * work in one line, and it would read perfectly.
 *
 * ★THE SHOPIFY APP RENDERS THE SAME ANSWER FROM THE SAME FIELDS. Neither
 * surface decides anything; both phrase what the api already settled. That is
 * what stops one merchant reading two screens and being told two different
 * things about whether their products are invisible.
 *
 * ★AND IT DOES NOT RE-SORT. The api orders by what is actionable first.
 */

/** How many rows the panel shows before it stops. The api sends the worklist
 *  head already ordered; this is a panel on a page about listings, not a
 *  second catalogue. */
const VISIBLE_ROWS = 10;

export function SearchVisibilityPanel() {
  const { data, isLoading, isError } = useSearchVisibility();

  const ready = useMemo(() => (isUsableVisibility(data) ? data : null), [data]);

  if (isLoading) {
    return (
      <section className="mt-8">
        <PanelHeader />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  // ★A FAILED READ SAYS SO AND STOPS. This panel sits under a working product
  // table; claiming "no products appear in Google" because a fetch failed would
  // be the worst sentence on the page.
  if (isError) {
    return (
      <section className="mt-8">
        <PanelHeader />
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load your search data just now.
        </p>
      </section>
    );
  }

  // ★THE FIVE "NOT YET" ARMS EACH NAME THEIR OWN FIX. Collapsing them into "no
  // data" would leave the merchant with no idea which of five things to do —
  // the failure the api shaped its response to prevent.
  if (!ready) {
    const arm = data?.state;
    if (arm === "no_catalog" || arm === undefined) return null;
    return (
      <section className="mt-8">
        <PanelHeader />
        <p className="text-sm text-muted-foreground">{notReadyCopy(arm)}</p>
      </section>
    );
  }

  const h = headline(ready);
  const caveat = blockerNote(ready.absenceBlockers);
  const when = windowSentence(ready.window);
  const rows = ready.products.slice(0, VISIBLE_ROWS);

  return (
    <section className="mt-8">
      <PanelHeader />

      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        {h.count > 0 && (
          <Badge variant={h.asserted ? "destructive" : "secondary"}>{h.count}</Badge>
        )}
        <p className="text-sm font-medium">{h.text}</p>
      </div>

      {caveat && <p className="mb-3 text-xs text-muted-foreground">{caveat}</p>}

      {/* ★STALE AND TRUNCATED ARE SEPARATE FROM THE CAVEAT. Neither stops the
          claim — a dated claim stays true however old it is — but a merchant
          reading a month-old answer should know that is what it is. */}
      {ready.stale && (
        <p className="mb-3 text-xs text-muted-foreground">
          This is the last read we completed; the daily sync has not run since.
        </p>
      )}
      {ready.catalogTruncated && (
        <p className="mb-3 text-xs text-muted-foreground">
          Your catalogue is larger than we read in one pass, so these counts cover the first part
          of it.
        </p>
      )}

      <p className="mb-3 text-xs text-muted-foreground">
        Reading {ready.siteUrl}
        {when ? ` · ${when}` : ""}
      </p>

      {rows.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {rows.map((p) => (
            <Row key={p.productId} product={p} />
          ))}
        </ul>
      )}

      {/* ★★A COUNT, NOT A WORKLIST CLAIM. `matching` is the WHOLE catalogue
          when no state filter is sent, which this hook never sends — so "and
          490 more worth looking at first" printed directly under "every product
          is showing up in Google search". The same sentence the products table
          above already uses, and it is true in every state. */}
      {ready.matching > rows.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing the first {rows.length} of {ready.matching} products.
        </p>
      )}

      <Legend ready={ready} />
    </section>
  );
}

function Row({ product }: { product: ProductRow }) {
  const s = stateLabel(String(product.state ?? ""));
  // ★A PRODUCT THE WINDOW DOES NOT COVER SAYS SO ON ITS OWN ROW. It is excluded
  // from the headline count; without a marker the merchant sees a row that looks
  // like every other "No data" one and a total that does not add up to the list.
  const uncovered = product.state === "unknown" && product.windowCoverage !== "full";
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm">{product.title || "Untitled product"}</p>
        {uncovered && (
          <p className="text-xs text-muted-foreground">
            added part-way through, or too recently to judge
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {/* ★★NO METRICS WHERE THERE ARE NONE, AND NO ZEROES EITHER. The api omits
            clicks and impressions on a product it could not measure precisely so
            this cannot print "0" — which would read as "shown 0 times, clicked 0
            times" rather than "we hold nothing for this product". */}
        {typeof product.impressions === "number" && (
          <span className="text-xs text-muted-foreground">
            {product.impressions.toLocaleString()} shown
          </span>
        )}
        {typeof product.clicks === "number" && (
          <span className="text-xs text-muted-foreground">
            {product.clicks.toLocaleString()} clicks
          </span>
        )}
        <Badge variant={badgeVariant(s.tone)}>{s.label}</Badge>
      </div>
    </li>
  );
}

/**
 * What each verdict means, for the states actually on screen.
 *
 * ★THE SELECTION IS `legendEntries` IN THE LIB, where it can be tested and
 * mutated; this only draws it. This repo tests framework-agnostic logic and
 * renders untested, so a decision left in the JSX is a decision nothing scores —
 * which is how the blurbs came to be dead in the first place.
 */
function Legend({ ready }: { ready: VisibilityReady }) {
  const entries = legendEntries(ready.products);
  if (entries.length === 0) return null;
  return (
    <div className="mt-4 space-y-1">
      <p className="text-xs font-medium">What these mean</p>
      {entries.map((e) => (
        <p key={e.state} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={e.tone}>{e.label}</Badge>
          {e.blurb}
        </p>
      ))}
    </div>
  );
}

function PanelHeader() {
  return (
    <header className="mb-3 flex items-center gap-2">
      <Search className="size-4 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold">Search visibility</h2>
    </header>
  );
}

/**
 * ★EACH ARM NAMES ITS OWN FIX, and none of them points at a control that does
 * not exist — the Search Console connection lives in Integrations on this
 * surface, which is where these send the merchant.
 *
 * ★AND `not_configured` DOES NOT SAY HOW MANY SITES THEY HAVE. The api answers
 * it when NO property is set, which covers a merchant with several verified
 * sites and none chosen AND one with none at all.
 */
function notReadyCopy(arm: string | undefined): string {
  if (arm === "not_connected") {
    return "Connect Google Search Console in Integrations to see how your products appear in Google.";
  }
  if (arm === "not_configured") {
    return "No Search Console site is set for this business yet. Pick the site this store sells from in Integrations.";
  }
  if (arm === "pending") {
    return "We read Google Search Console about once a day. This fills in after the first pass finds your store.";
  }
  // ★AN ARM WE DO NOT RECOGNISE IS NOT `pending`. Every one names a different
  // fix, so falling through would tell the merchant to wait for a sync when the
  // real answer might be "connect your store".
  return "We can't show this yet. Refresh in a few minutes — if it persists, contact support.";
}
