"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { audiencesApi, type ProposalResponse } from "@/lib/api/audiences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { reachLine } from "@/lib/audience-card-rules";
import {
  MAX_COUNTRIES,
  parseCountryCodes,
  unusableCountryTokens,
} from "@/lib/audience-preview-rules";
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

/**
 * The proposal for a given confirmed geography.
 *
 * ★A HOOK, SO THE DIALOG CAN READ THE SAME ANSWER. The dialog needs to know
 * whether the campaign will get an audience at all — the Boost button, its copy
 * and its success toast are otherwise identical whether targeting was applied
 * or not, and an untargeted campaign that looks ready is exactly the failure
 * this screen exists to delete. A callback fired from the child's render would
 * have been an update to a DIFFERENT component during render, which React warns
 * about and which has no defensible ordering; react-query shares one cache
 * entry between the two callers, so this costs no extra request.
 */
export function useAudienceProposal(geo: string[] | undefined) {
  return useQuery<ProposalResponse>({
    // The geography is part of the key: a different confirmation is a
    // different audience, and reusing the cached one would show the user the
    // audience they just changed away from.
    queryKey: ["audience-proposal", geo ?? null],
    queryFn: () => audiencesApi.propose(geo ? { geo } : {}),
    // The answer depends on the business profile and LinkedIn's own counts,
    // neither of which moves minute to minute.
    staleTime: 5 * 60_000,
    // A proposal is a read. Retrying a refusal would just re-ask a question the
    // user has to answer.
    retry: false,
  });
}

export function AudiencePreview({
  geo,
  onGeoChange,
}: {
  /** Confirmed ISO-2 codes, or undefined for "use what we inferred". */
  geo: string[] | undefined;
  onGeoChange: (next: string[] | undefined) => void;
}) {
  const [editing, setEditing] = useState<{ draft: string } | null>(null);
  const { data, isLoading, isError } = useAudienceProposal(geo);

  const proposal = data?.proposal ?? null;
  const refusal = data?.refusal ?? null;


  // ★THE CODES, NOT THE LABELS. `basis[].values` are display names — "India",
  // never "IN" — so seeding them into a two-letter box turned the act of
  // CONFIRMING the inference into an act of deleting it. `geoCodes` is what the
  // audience was actually built from, and only what resolved.
  // `?? []` is also the DEPLOY-SKEW guard: an api that predates `geoCodes`
    // sends none, and pre-filling from the labels instead would put "India" in
    // a two-letter box — the exact defect this field was added to remove.
  const inferredCodes = proposal?.geoCodes ?? [];

  // ★SEEDED AT OPEN, not in an effect. The editor's initial text is whatever is
  // currently in force — the user's own confirmation if they made one, else
  // what we inferred — and an effect that re-seeded it while open would
  // overwrite what they are typing the moment a refetch changed the inference.
  const openEditor = () => setEditing({ draft: (geo ?? inferredCodes).join(", ") });

  const draftCodes = editing ? parseCountryCodes(editing.draft) : [];
  const draftUnusable = editing ? unusableCountryTokens(editing.draft) : [];
  /**
   * ★AN EMPTY BOX AND AN UNREADABLE BOX ARE NOT THE SAME ANSWER. Empty means
   * "none of these", which the api treats as a statement and which produces an
   * untargeted campaign — a real thing a user may want to say. "India" means
   * they tried to name a country and we could not read it, and treating THAT as
   * the same statement is how confirming an audience came to delete it.
   */
  const overCap = editing !== null && parseCountryCodes(editing.draft).length >= MAX_COUNTRIES
    && editing.draft.split(/[,\s]+/).filter((t) => /^[A-Za-z]{2}$/.test(t.trim())).length > MAX_COUNTRIES;
  const blocked =
    editing === null
      ? undefined
      : overCap
        ? // ★NAMED, NOT TRUNCATED. Silently dropping the 26th country is the
          // same silent narrowing this screen exists to prevent, and neither
          // the unusable-token hint nor the parser said a word about it.
          `We can only target ${MAX_COUNTRIES} countries — take some out.`
        : draftCodes.length === 0 && editing.draft.trim().length > 0
          ? draftUnusable.length > 0
            ? `We need two-letter country codes — "${draftUnusable[0]}" isn't one. India is IN, Singapore is SG.`
            : "Use two-letter country codes, like IN or SG."
          : undefined;

  const apply = () => {
    if (!editing || blocked) return;
    onGeoChange(draftCodes);
    setEditing(null);
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Audience</span>
        {editing === null && (
          <div className="flex items-center gap-1">
            {geo !== undefined && (
              // The way back to "use what we inferred". Without it, a user who
              // confirmed a list — or emptied it — had no route back short of
              // closing the dialog and losing everything else they typed.
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onGeoChange(undefined)}
              >
                Use ours
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={openEditor}
              aria-label="Change the countries this campaign targets"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-4 w-56" />
      ) : isError ? (
        // Not a blocker: the boost builds its own audience server-side, so a
        // failed PREVIEW must not stop the campaign. Say what we can't do.
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t work out the audience just now, so we can&apos;t show you what this
          campaign would target.
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
            {geo === undefined &&
              // ★"INFERRED" ONLY WHEN IT WAS. The geography usually comes from
              // the business record or the user's own correction, both of which
              // are STATED — calling a customer's typed fact a guess is the
              // opposite of what the evidence tiers are for.
              (proposal.basis
                .find((b) => b.attribute === "geo")
                ?.evidence.some((e) => e.tier === "stated")
                ? " · from your business profile — change it if it's wrong"
                : " · our best guess — change it if it's wrong")}
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
              aria-describedby={blocked ? "audience-geo-error" : "audience-geo-hint"}
              aria-invalid={blocked !== undefined}
              onKeyDown={(e) => {
                // Enter applies, because a box with one affirmative action
                // should take the obvious key.
                //
                // ⚠️ ESCAPE IS NOT HANDLED HERE, and an earlier version's claim
                // that it "closes the editor, not the dialog" was false: Radix
                // listens for Escape with a DOCUMENT-LEVEL CAPTURE listener, so
                // a bubble-phase stopPropagation never runs first. Escape
                // closes the whole boost dialog — which is true of every field
                // in it, not just this one, so Cancel is the exit this editor
                // documents.
                if (e.key === "Enter") {
                  e.preventDefault();
                  apply();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={apply}
              disabled={blocked !== undefined}
            >
              {/* ★THE EMPTY CASE SAYS WHAT IT DOES. "Use these" on an empty box
                  means "create this campaign with no audience", which is a real
                  thing to want and a terrible thing to do by accident — and the
                  no_geography refusal literally invites the user to press it. */}
              {editing.draft.trim().length === 0 ? "Create without an audience" : "Use these"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
          {blocked ? (
            <p id="audience-geo-error" className="text-xs text-destructive" aria-live="polite">
              {blocked}
            </p>
          ) : (
            <p id="audience-geo-hint" className="text-xs text-muted-foreground">
              This decides where the budget goes, so it&apos;s the one thing we ask you to check.
              {draftUnusable.length > 0 &&
                ` We'll ignore: ${draftUnusable.join(", ")}.`}
              {editing !== null && editing.draft.trim().length === 0 &&
                " Leave it empty to tell us none of these — the campaign will be created without an audience."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
