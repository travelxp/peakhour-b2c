"use client";

import { AlertTriangle, HelpCircle, Loader2, PlugZap, RefreshCw } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  absenceText,
  brandLine,
  incompleteLine,
  partialLine,
} from "@/lib/visibility-funnel";
import type { VisibilityAbsence, VisibilityResponse, VisibilityStage } from "@/lib/api/growth";

/**
 * Found → chosen → convinced → bought.
 *
 * The four questions a shopkeeper actually asks, in the order a stranger
 * becomes a customer, on the screen that already answers "is any of this
 * working". Every figure comes from `GET /v1/growth/visibility` over ONE
 * window, which is the whole reason it is one request.
 *
 * ★★THIS COMPONENT PHRASES; IT NEVER DECIDES. The api withholds a stage total
 * when a connected source has not answered, and sends `incomplete` saying why.
 * A client that summed `figures` itself — trivially possible, and the obvious
 * thing — would put back the exact number the api refused to publish: a true
 * sum over the sources that happened to answer, which reads as a merchant's
 * reach having halved when their Business Profile sync stopped. That rule lives
 * in one place, and this is not it.
 *
 * The sentences themselves are in `lib/visibility-funnel.ts`, where they can be
 * tested and mutated without a DOM.
 */

/**
 * Icon per stated absence. The WORDS live in the lib; only the picture is here.
 *
 * ★A PICTURE CAN STILL CONTRADICT A SENTENCE. `unavailable` means WE could not
 * read it, and a broken-link glyph undid in the icon the distinction
 * `absenceText` is written to preserve — it pointed at the merchant's
 * connection for our own failure. A question mark says "we do not know", which
 * is what it is.
 *
 * ★AND THE SPINNER HAS TO SPIN. Every other Loader2 in this repo is paired with
 * `animate-spin`; a frozen one reads as a thing that has stalled rather than a
 * thing in progress, which is the opposite of "gathering data".
 */
const ABSENCE_ICON: Record<VisibilityAbsence, { icon: typeof PlugZap; className?: string }> = {
  not_connected: { icon: PlugZap },
  not_configured: { icon: AlertTriangle },
  pending: { icon: Loader2, className: "animate-spin" },
  stale: { icon: AlertTriangle },
  needs_reconnect: { icon: RefreshCw },
  unavailable: { icon: HelpCircle },
};

const SOURCE_LABEL: Record<string, string> = {
  google_search: "Google Search",
  google_business_profile: "Business Profile",
  google_analytics: "Your website",
};

/** ★NEVER THE RAW WIRE VALUE. The two repos deploy separately, so this build
 *  can meet a source it has no label for — and `google_business_profile` in a
 *  merchant-facing list is worse than a generic word. The same forward-compat
 *  hole was closed for the absence text and its icon two lines below. */
function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? "Another source";
}

const NUM = new Intl.NumberFormat("en-US");

function StageCard({ stage, windowDays }: { stage: VisibilityStage; windowDays: number }) {
  const hasTotal = typeof stage.total === "number";
  const partial = partialLine(stage, windowDays);
  return (
    <div className="flex flex-col gap-2 bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {stage.question}
      </p>

      {hasTotal ? (
        <p className="text-2xl font-bold tabular-nums">{NUM.format(stage.total as number)}</p>
      ) : (
        // ★NOT A ZERO, AND NOT A BARE DASH. The sentence is the answer.
        <p className="text-sm font-medium text-muted-foreground">{incompleteLine(stage)}</p>
      )}

      {partial ? <p className="text-xs text-muted-foreground">{partial}</p> : null}

      <ul className="mt-1 space-y-1">
        {stage.figures.map((f) => {
          const label = sourceLabel(f.source);
          if (f.available) {
            return (
              <li key={f.source} className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="tabular-nums">{NUM.format(f.value)}</span>
              </li>
            );
          }
          // ★A REASON THIS BUILD HAS NEVER HEARD OF STILL RENDERS. The union
          // has already grown twice, and `<undefined />` throws — which the
          // dashboard's error boundary turns into the whole Outcomes page
          // disappearing, the opposite of this component's own contract.
          const { icon: Icon, className } = ABSENCE_ICON[f.reason] ?? { icon: HelpCircle };
          return (
            <li key={f.source} className="flex justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Icon className={`size-3 ${className ?? ""}`} aria-hidden />
                {absenceText(f.reason)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function VisibilityFunnel({
  data,
  isPending,
}: {
  data: VisibilityResponse | undefined;
  isPending: boolean;
}) {
  if (isPending) return <Skeleton className="h-40 w-full" />;
  // ★NO ERROR STATE OF ITS OWN, AND THAT IS DELIBERATE. The funnel sits ABOVE a
  // page that works without it; a red panel here would tell a merchant
  // something is broken when the answer beneath it is fine. Absent is the
  // correct degradation, and every partial failure already arrives as a stated
  // absence INSIDE the payload rather than as a failed request.
  if (!data) return null;

  const brand = brandLine(data.brandSplit);

  return (
    <Card>
      <CardContent className="p-0">
        {/* ★★THREE CARDS, NOT FOUR, AND THE FOURTH QUESTION IS ANSWERED BELOW.
            "What was it worth?" already has a card on this page, fed by
            /v1/growth/outcomes and rendering the same `buildValueBlock` output
            in more detail. Drawing it here as well put the SAME FIGURE on the
            screen twice from TWO REQUESTS — and the two can disagree, because
            /visibility omits the block on a failed read while /outcomes always
            sends it. A transient failure would have shown "couldn't be read"
            above a real amount. One figure, one request.
            `data.value` therefore goes unread by this component, deliberately. */}
        {/* ★★SEPARATORS DRAWN AS GRID GAPS, NOT AS `divide-*`. With three cards
            in a two-column grid, `divide-y` and `divide-x` are both live at
            `sm` and Tailwind applies them by DOM ORDER rather than by grid
            position — so the second card took a stray top border and the third
            a stray left border, right across 640–1024px. A one-pixel gap over a
            border-coloured background draws the right lines in every wrap. */}
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {data.stages.map((s) => (
            <StageCard key={s.key} stage={s} windowDays={data.period.days} />
          ))}
        </div>
        {brand ? (
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">{brand}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
