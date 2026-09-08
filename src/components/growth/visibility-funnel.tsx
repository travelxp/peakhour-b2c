"use client";

import { AlertTriangle, Link2Off, Loader2, PlugZap, RefreshCw } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, orderCountLine, provenanceLine } from "@/lib/outcome-value";
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

/** Icon per stated absence. The WORDS live in the lib; only the picture is
 *  here, because a picture cannot be wrong in the way a sentence can. */
const ABSENCE_ICON: Record<VisibilityAbsence, typeof PlugZap> = {
  not_connected: PlugZap,
  not_configured: AlertTriangle,
  pending: Loader2,
  stale: AlertTriangle,
  needs_reconnect: RefreshCw,
  unavailable: Link2Off,
};

const SOURCE_LABEL: Record<string, string> = {
  google_search: "Google Search",
  google_business_profile: "Business Profile",
  google_analytics: "Your website",
};

const NUM = new Intl.NumberFormat("en-US");

function StageCard({ stage, windowDays }: { stage: VisibilityStage; windowDays: number }) {
  const hasTotal = typeof stage.total === "number";
  const partial = partialLine(stage, windowDays);
  return (
    <div className="flex flex-col gap-2 p-4">
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
          const label = SOURCE_LABEL[f.source] ?? f.source;
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
          const Icon = ABSENCE_ICON[f.reason] ?? AlertTriangle;
          return (
            <li key={f.source} className="flex justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Icon className="size-3" aria-hidden />
                {absenceText(f.reason)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * "What was it worth?" — the money, phrased with the helpers the Outcomes card
 * below already uses.
 *
 * ★★NOTHING HERE DECIDES WHETHER AN AMOUNT MAY BE SHOWN. `available: false`
 * with a reason arrives from the api, which is the single place in the platform
 * allowed to make that call — including the `unconfirmed_zero` refusal, where
 * GA4's 0 for a property with no purchase tracking is indistinguishable from a
 * shop that sold nothing. Printing that as "0" is the one thing this card must
 * never do.
 *
 * ★AND AN ABSENT `value` IS NOT A REFUSAL. The api omits the block entirely
 * when the reconciliation could not be READ, which is not a claim about the
 * merchant's data and must not be rendered as one.
 */
function BoughtCard({ value }: { value: VisibilityResponse["value"] }) {
  const orders = value ? orderCountLine(value) : null;
  return (
    <div className="flex flex-col gap-2 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        What was it worth?
      </p>

      {!value ? (
        <p className="text-sm font-medium text-muted-foreground">Couldn&apos;t be read</p>
      ) : value.available ? (
        <p className="text-2xl font-bold tabular-nums">
          {formatMoney(value.amount, value.currency)}
        </p>
      ) : (
        <p className="text-sm font-medium text-muted-foreground">Not counted yet</p>
      )}

      {value?.available ? (
        <p className="text-xs text-muted-foreground">{provenanceLine(value)}</p>
      ) : value ? (
        <p className="text-xs text-muted-foreground">{value.message}</p>
      ) : null}

      {orders ? <p className="text-xs text-muted-foreground">{orders}</p> : null}
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
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
          {data.stages.map((s) => (
            <StageCard key={s.key} stage={s} windowDays={data.period.days} />
          ))}
          {/* ★★THE FOURTH QUESTION, AND IT IS NOT ONE OF `stages`. The api
              keeps money out of that array deliberately — the other three are
              sums of comparable integers, this is an amount in a currency with
              its own covered window and its own three refusals, all decided in
              buildValueBlock. Rendering it from the same StageCard would have
              meant re-deciding here whether an amount may be shown. */}
          <BoughtCard value={data.value} />
        </div>
        {brand ? (
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">{brand}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
