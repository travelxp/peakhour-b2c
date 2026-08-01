"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { audiencesApi, type ProposalResponse } from "@/lib/api/audiences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { reachLine } from "@/lib/audience-card-rules";
import { parseCountryCodes } from "@/lib/audience-preview-rules";
import { Pencil } from "lucide-react";

/**
 * The audience this boost will get, shown BEFORE the money is committed — and
 * the one inference the user is asked to confirm (decision D13).
 *
 * ★WHY GEOGRAPHY IS THE ONLY QUESTION. Objective alone does not determine an
 * audience, and geography does more work than any other attribute: we cannot
 * reliably infer it, LinkedIn will not serve without it, and against an
 * India-first product a wrong guess puts the budget in the wrong hemisphere.
 * `locale` must never be read as geography — it falls back to "en-US" meaning
 * *unknown*. So the design's "one question" is deliberately relaxed by exactly
 * one confirmable fact, and nothing else is asked: no facet picking, no
 * seniority, no company size.
 *
 * ★AND THE CONFIRMATION IS SENT WITH THE BOOST. The parent lifts the confirmed
 * codes and passes them to `/boost`, which resolves the audience server-side
 * from the same input — otherwise this screen would show one audience and the
 * campaign would get another, which is worse than showing nothing at all.
 *
 * A refusal is not an error here. "We don't know your country" is a question
 * for the user, and the api answers 200 with a reason code precisely so this
 * can ask it.
 */

export function AudiencePreview({
  geo,
  onGeoChange,
  enabled,
}: {
  /** Confirmed ISO-2 codes, or undefined for "use what we inferred". */
  geo: string[] | undefined;
  onGeoChange: (next: string[] | undefined) => void;
  /** False while the dialog is closed — no point asking LinkedIn for a count
   *  nobody is looking at, and /propose costs a typeahead round trip per
   *  country plus an audienceCounts call. */
  enabled: boolean;
}) {
  const [editing, setEditing] = useState<{ draft: string } | null>(null);

  const { data, isLoading, isError } = useQuery<ProposalResponse>({
    // The geography is part of the key: a different confirmation is a
    // different audience, and reusing the cached one would show the user the
    // audience they just changed away from.
    queryKey: ["audience-proposal", geo ?? null],
    queryFn: () => audiencesApi.propose(geo ? { geo } : {}),
    enabled,
    // The answer depends on the business profile and LinkedIn's own counts,
    // neither of which moves minute to minute.
    staleTime: 5 * 60_000,
    // A proposal is a read. Retrying a refusal would just re-ask a question the
    // user has to answer.
    retry: false,
  });

  const proposal = data?.proposal ?? null;
  const refusal = data?.refusal ?? null;

  const inferredCodes = useMemo(
    () =>
      proposal?.basis.find((b) => b.attribute === "geo")?.values ?? [],
    [proposal],
  );

  // ★SEEDED AT OPEN, not in an effect. The editor's initial text is whatever is
  // currently in force — the user's own confirmation if they made one, else
  // what we inferred — and an effect that re-seeded it while open would
  // overwrite what they are typing the moment a refetch changed the inference.
  const openEditor = () => setEditing({ draft: (geo ?? inferredCodes).join(", ") });

  const apply = () => {
    if (!editing) return;
    const codes = parseCountryCodes(editing.draft);
    // An empty box means "none of these", which the api treats as a statement
    // rather than a fallback — so it is sent as an empty array, not undefined.
    onGeoChange(codes);
    setEditing(null);
  };

  if (!enabled) return null;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Audience</Label>
        {editing === null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={openEditor}
            aria-label="Change the countries this campaign targets"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-4 w-56" />
      ) : isError ? (
        // Not a blocker: the boost builds its own audience server-side, so a
        // failed PREVIEW must not stop the campaign. Say what we can't do.
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t work out the audience just now. Boosting still picks one from your
          business profile.
        </p>
      ) : refusal ? (
        <p className="text-sm text-muted-foreground">{refusal.message}</p>
      ) : proposal ? (
        <>
          <ul className="space-y-1">
            {proposal.basis.map((b) => (
              <li key={b.attribute} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-xs text-muted-foreground">
                  {b.attribute === "geo" ? "Where" : "Who"}
                </span>
                {b.values.map((v, i) => (
                  <Badge
                    key={`${b.attribute}:${i}:${v}`}
                    variant="outline"
                    className="font-normal whitespace-normal"
                  >
                    {v}
                  </Badge>
                ))}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {reachLine(proposal.reach) ?? "We couldn't get a size for this audience"}
            {geo === undefined && " · inferred from your business — change it if it's wrong"}
          </p>
          {proposal.unresolved.length > 0 && (
            // ★NAMED, NOT DROPPED. A campaign narrower than the profile — one
            // country of three, no industry qualifier — is a DIFFERENT
            // audience, and silently is the one way that must not happen.
            <p className="text-xs text-muted-foreground">
              We couldn&apos;t use:{" "}
              {proposal.unresolved.map((u) => u.value).join(", ")}
            </p>
          )}
        </>
      ) : null}

      {editing !== null && (
        <div className="space-y-1.5">
          <Label htmlFor="audience-geo" className="text-xs">
            Countries — two-letter codes, comma separated
          </Label>
          <div className="flex gap-2">
            <Input
              id="audience-geo"
              value={editing.draft}
              onChange={(e) => setEditing({ draft: e.target.value })}
              placeholder="IN, SG, AE"
              autoFocus
            />
            <Button type="button" variant="outline" onClick={apply}>
              Use these
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This decides where the budget goes, so it&apos;s the one thing we ask you to check.
          </p>
        </div>
      )}
    </div>
  );
}
