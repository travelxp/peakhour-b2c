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
import { useAudienceSets } from "@/hooks/use-audience-library";
import { hasExclusions, overlapLine, summarizeExclusions } from "@/lib/audience-exclusions";

/** The api's page cap for the library (`limit` max). */
const PAGE = 50;

export function AudienceExclusionsCard() {
  // ★DISCARDED ONES ARE NOT ASKED FOR: an audience the merchant threw away
  //  costs nothing, and its overlaps are history.
  const sets = useAudienceSets({ excludeStatus: "discarded", limit: PAGE });
  // ★NO DATA — including a query paused offline — renders nothing rather than
  //  "nothing to exclude", which would be a claim made from no reading.
  if (!sets.data) return null;

  const summary = summarizeExclusions(sets.data.sets);
  const more = sets.data.total > sets.data.sets.length;

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
        ) : !hasExclusions(summary) ? (
          <p className="text-sm text-muted-foreground">
            {/* ★"No overlap measured", never "they do not overlap": an empty list
                can also mean there was only one audience to compare. */}
            Nothing to exclude across your {summary.audiences} audience{summary.audiences === 1 ? "" : "s"}, and no overlap
            measured between them.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            {summary.suggested.length > 0 && (
              <section className="space-y-1">
                <h4 className="font-medium">Suggested exclusions</h4>
                <ul className="list-disc space-y-1 pl-5">
                  {summary.suggested.map((s) => (
                    <li key={`${s.label}|${s.reason}|${s.values.join(",")}`}>
                      Leave out {s.reason} ({s.label}: {s.values.join(", ")}) — suggested for{" "}
                      {s.audiences.length === 1 ? s.audiences[0] : `${s.audiences.length} audiences: ${s.audiences.join(", ")}`}.
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
                    <li key={`${o.a}|${o.b}`}>{overlapLine(o)}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Figures are the platform&rsquo;s own rounded estimates.
                </p>
              </section>
            )}
            {summary.unmeasured.length > 0 && (
              <section className="space-y-1">
                <h4 className="font-medium">Overlap not measured</h4>
                <ul className="list-disc space-y-1 pl-5">
                  {summary.unmeasured.map((u) => (
                    <li key={u.reason}>
                      {u.audiences.join(", ")}: {u.reason}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="text-xs text-muted-foreground">
              These are suggestions: Peakhour does not add exclusions to your campaigns yet. To act on an overlap,
              keep one of the two audiences in{" "}
              <Link href="/dashboard/growth/audiences" className="underline underline-offset-2">
                Audiences
              </Link>
              .
            </p>
          </div>
        )}
        {more && (
          <p className="text-xs text-muted-foreground">
            Read from your {sets.data.sets.length} most recent audiences of {sets.data.total}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
