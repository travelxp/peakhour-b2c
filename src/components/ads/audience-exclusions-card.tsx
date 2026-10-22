"use client";

/**
 * D-06 — WHO PEAKHOUR'S AUDIENCES SHOULD NOT REACH, beside the guardrails.
 *
 * The api works this out every time it plans a portfolio
 * (`services/ads/audience-exclusions.ts`) and stores it on each audience; this
 * card is the first place a merchant sees it. Channel-neutral, so it sits
 * above the channel tabs next to the guardrails card, for that card's reason.
 *
 * ★READ-ONLY, AND IT SAYS SO. The exclusions are suggestions: nothing applies
 * them to a campaign yet (the campaign editor carries include targeting only),
 * so a switch here would be a control that changes nothing. The card says what
 * the engine measured and suggested, and where to act on it.
 */
import Link from "next/link";
import { UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAudienceSets } from "@/hooks/use-audience-library";
import { hasExclusions, namesLine, overlapLine, summarizeExclusions, variantNote } from "@/lib/audience-exclusions";

/** The api's page cap for the library (`limit` max). */
const PAGE = 50;

export function AudienceExclusionsCard() {
  // ★ONLY THE AUDIENCES THAT CAN RUN, ASKED FOR BY STATUS (review R1): a page
  //  that merely left out discarded ones filled up with superseded rows, and a
  //  business with live audiences was told it had none. The api takes one
  //  status per query, so the two live ones are two queries.
  const proposed = useAudienceSets({ status: "proposed", limit: PAGE });
  const applied = useAudienceSets({ status: "applied", limit: PAGE });

  if (!proposed.data || !applied.data) {
    // ★A FAILED READ SAYS SO (review R2) — a card that silently vanishes is
    //  indistinguishable from one that does not exist. No data and no error
    //  (loading, or paused offline) renders nothing: "nothing to exclude"
    //  would be a claim made from no reading.
    if (!proposed.isError && !applied.isError) return null;
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-6 text-sm">
          <span className="text-muted-foreground">We couldn&rsquo;t load your audience exclusions.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void proposed.refetch();
              void applied.refetch();
            }}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const read = [...proposed.data.sets, ...applied.data.sets];
  const total = proposed.data.total + applied.data.total;
  const more = total > read.length;
  const summary = summarizeExclusions(read);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <UserX className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden />
          <div>
            <h3 className="font-medium">Audience exclusions</h3>
            <p className="text-sm text-muted-foreground">
              Who your audiences should leave out, and which of them compete for the same people.
            </p>
          </div>
        </div>

        {summary.audiences === 0 ? (
          <p className="text-sm text-muted-foreground">
            No audiences yet.{" "}
            <Link href="/dashboard/growth/audiences" className="underline underline-offset-2">
              Plan some in Audiences
            </Link>{" "}
            and Peakhour will check them for overlap and suggest who to leave out.
          </p>
        ) : summary.checked === 0 ? (
          <p className="text-sm text-muted-foreground">
            {/* ★NOT "NOTHING TO EXCLUDE" (review R2): audiences imported, built
                by hand or planned before this check carry no reading at all. */}
            Peakhour hasn&rsquo;t checked your audiences yet &mdash; it works out exclusions and overlaps when it plans
            a portfolio in{" "}
            <Link href="/dashboard/growth/audiences" className="underline underline-offset-2">
              Audiences
            </Link>
            .
          </p>
        ) : !hasExclusions(summary) ? (
          <p className="text-sm text-muted-foreground">
            {/* ★"No overlap measured", never "they do not overlap": an empty list
                can also mean there was only one audience to compare. */}
            Nothing to exclude across the {summary.checked} audience{summary.checked === 1 ? "" : "s"} Peakhour has
            checked, and no overlap measured between them.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            {summary.suggested.length > 0 && (
              <section className="space-y-1">
                <h4 className="font-medium">Suggested exclusions</h4>
                <ul className="list-disc space-y-1 pl-5">
                  {summary.suggested.map((s) => (
                    <li key={s.key}>
                      Leave out {s.reason} ({s.label}: {s.values.join(", ")}
                      {variantNote(s.variant)}) — suggested for{" "}
                      {s.audiences.length === 1 ? s.audiences[0] : `${s.audiences.length} audiences: ${namesLine(s.audiences)}`}.
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {summary.overlaps.length > 0 && (
              <section className="space-y-1">
                <h4 className="font-medium">Audiences that overlap</h4>
                <ul className="list-disc space-y-1 pl-5">
                  {summary.overlaps.map((o) => (
                    <li key={o.key}>{overlapLine(o)}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Figures are the platform&rsquo;s own rounded estimates. To act on an overlap, keep one of the two
                  audiences in{" "}
                  <Link href="/dashboard/growth/audiences" className="underline underline-offset-2">
                    Audiences
                  </Link>
                  .
                </p>
              </section>
            )}
            {summary.unmeasured.length > 0 && (
              <section className="space-y-1">
                <h4 className="font-medium">Overlap not measured</h4>
                <ul className="list-disc space-y-1 pl-5">
                  {summary.unmeasured.map((u) => (
                    <li key={u.reason}>
                      {namesLine(u.audiences)}: {u.reason}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="text-xs text-muted-foreground">
              These are suggestions: Peakhour does not add exclusions to your campaigns yet.
            </p>
          </div>
        )}
        {more && (
          <p className="text-xs text-muted-foreground">
            {/* ★WHAT WAS READ, EXACTLY (review R2): two pages, one per status. */}
            Read from your {PAGE} newest suggested and {PAGE} newest in-use audiences ({read.length} of {total}).
            Overlaps with audiences not read here are not shown.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
