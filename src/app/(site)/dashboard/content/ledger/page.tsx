"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileClock, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { ContentLedgerTable } from "@/components/growth/content-ledger-table";
import { useAuth } from "@/providers/auth-provider";
import { growthApi, type ContentLedgerResponse } from "@/lib/api/growth";
import {
  analyticsTotalLine,
  LEDGER_WINDOWS,
  nothingInWindowDetail,
  periodPhrase,
  recordBeganLine,
  searchTotalLine,
  summaryHeadline,
} from "@/lib/content-ledger";

/**
 * The content ledger — what we published, and what it earned.
 *
 * ★THE ONE SCREEN THAT ANSWERS "WAS ANY OF THIS WORTH IT". Every other content
 * surface in the product is about work going out; this is the only one about
 * what came back, and it is the argument for the subscription.
 *
 * ★★AND ITS HONESTY IS THE WHOLE FEATURE. A ledger that filled its gaps with
 * zeroes would read as "we published four articles and they brought nobody" —
 * which is one missing analytics row away at all times, because the provider
 * stores the top 25 pages per sync and nothing else. Every refusal here was
 * made in the api; this page only phrases them, and `lib/content-ledger.ts`
 * holds the words.
 *
 * ★THE WINDOW FILTERS PUBLICATIONS, NOT MEASUREMENTS. A page inside it is
 * measured over its whole life, so the picker changes WHICH articles are listed
 * and never what any of them is said to have earned.
 */

/** ★THE WINDOWS AND THEIR LABELS COME FROM THE LIB, not from a copy here. The
 *  sentences under the picker name the period the merchant clicked, and they
 *  can only do that if the button and the phrase read the same row. */
const WINDOWS = LEDGER_WINDOWS;

export default function ContentLedgerPage() {
  const { business } = useAuth();
  const [days, setDays] = useState<number>(90);

  const ledger = useQuery({
    // Business in the key for the same reason every other business-scoped hook
    // pins it: the route is business-scoped server-side, and a key that does
    // not say which business is one cache clear away from showing another's.
    queryKey: ["content-ledger", business?._id ?? "none", days],
    queryFn: () => growthApi.contentLedger(days),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ledger</h2>
          <p className="text-muted-foreground">
            What you published through Peakhour, and what each page earned.
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-md border p-0.5">
          {WINDOWS.map((w) => (
            <Button
              key={w.days}
              type="button"
              size="sm"
              variant={days === w.days ? "secondary" : "ghost"}
              className="h-7 px-3 text-xs"
              aria-pressed={days === w.days}
              onClick={() => setDays(w.days)}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ★`isPending` ALONE, never `isPending && !isError` — the two statuses
          are mutually exclusive in Query v5, so the second is a guard after a
          stronger guard that can never fire while reading as a precaution. */}
      {ledger.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : ledger.isError ? (
        <EmptyState
          icon={FileClock}
          title="We couldn't load your ledger"
          description="That's on us — nothing has been changed. Try again in a moment."
          action={{ label: "Try again", onClick: () => void ledger.refetch() }}
        />
      ) : (
        <LedgerBody data={ledger.data} />
      )}
    </div>
  );
}

function LedgerBody({ data }: { data: ContentLedgerResponse }) {
  const began = recordBeganLine(data);

  if (data.rows.length === 0) {
    // ★★TWO EMPTY STATES, BECAUSE THERE ARE TWO REASONS, AND `stampedFrom` IS
    // WHAT TELLS THEM APART. A first version had one and asserted the harder
    // of the two: it told a merchant who published in February and happened to
    // be looking at 90 days that the ledger holds nothing recoverable and
    // "starts from your next one" — while the response in hand already proved
    // otherwise.
    const everPublished = data.stampedFrom !== null;
    return (
      <EmptyState
        icon={FileClock}
        title={
          everPublished
            ? `Nothing published in ${periodPhrase(data.period.days)}`
            : "Nothing published through Peakhour yet"
        }
        description={
          everPublished
            ? // ★IT NAMES WHAT IT DOES HOLD, so a merchant who published
              // earlier is pointed at the longer window rather than told their
              // work is gone — and at the LONGEST window, where there is no
              // longer one to point at, it says so instead of asking for the
              // impossible. That branch lives in the lib, with the phrase it
              // has to agree with.
              nothingInWindowDetail(data.stampedFrom as string, data.period.days)
            : // ★★AND THE REASON THE RECORD MAY BE SHORT IS OURS, NOT THEIRS.
              // Nothing recorded which page came from which publish until the
              // ledger shipped, and that link cannot be reconstructed.
              "Pages you publish from Peakhour appear here with what they earned. Articles published before this was switched on can't be matched back to their publish, so the ledger starts from your next one."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-lg font-semibold">
            {summaryHeadline(data.summary, data.truncated, data.period.days)}
          </p>
          {/* ★★THE TWO TOTALS ARE SEPARATE LINES, NOT ONE ROW OF TILES. They
              measure different things over different spans — a window against a
              set of per-page lifetimes — and side by side as bare numbers they
              read as two halves of one figure. */}
          <div className="space-y-2">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Search className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{searchTotalLine(data.summary)}</span>
            </p>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{analyticsTotalLine(data.summary)}</span>
            </p>
          </div>
          {began ? <p className="text-xs text-muted-foreground">{began}</p> : null}
        </CardContent>
      </Card>

      <ContentLedgerTable rows={data.rows} />
    </div>
  );
}
