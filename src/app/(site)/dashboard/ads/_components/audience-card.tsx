"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastUnhandledApiError } from "@/lib/toast-errors";
import { linkedInAdsApi, type ManagedCampaign } from "@/lib/api/linkedin-ads";
import { audienceClaim, reachLine } from "@/lib/audience-card-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

/**
 * The audience a campaign actually has, said out loud.
 *
 * ★THE FIELD THIS READS WAS WRITE-ONLY. mig 208 records who chose a campaign's
 * audience, on what evidence, and whether a human ever agreed — and until this
 * card, nothing rendered any of it. The engine had been picking audiences and
 * labelling them "you can change this" in a comment, to nobody.
 *
 * Three states, and conflating any two of them is the failure this exists to
 * prevent:
 *
 *   - AUTO-SELECTED, UNCONFIRMED — ours, nobody has looked. Say so, and offer
 *     the one-click agreement. This is the state every boosted campaign starts
 *     in, and the state the 2026-07-30 outage was invisible inside.
 *   - CONFIRMED / USER-SET — a human decided. Never label a person's own choice
 *     "auto-selected from your business".
 *   - UNVERIFIED — the provenance no longer matches the targeting, so we
 *     genuinely cannot say who chose it. Show the audience, claim nothing.
 *     "We cannot tell" rendering as "we chose this" is the same class of lie as
 *     a row claiming an audience the platform does not have.
 *
 * `verified` comes from the api because it depends on a fingerprint comparison
 * the client cannot make.
 */

/** Business-language attribute names. An unknown attribute renders under its
 *  own id rather than vanishing — a silent omission would make a narrower
 *  audience look complete, which is the one thing this card must not do. */
const ATTRIBUTE_LABEL: Record<string, string> = {
  geo: "Location",
  company_industry: "Industry",
  company_size: "Company size",
  job_title: "Job title",
  seniority: "Seniority",
  job_function: "Job function",
  member_interest: "Interests",
  company_name: "Companies",
  skill: "Skills",
};

export function AudienceCard({ campaign }: { campaign: ManagedCampaign }) {
  const queryClient = useQueryClient();
  const prov = campaign.targetingProvenance;
  const origin = campaign.audienceOrigin;

  const confirm = useMutation({
    mutationFn: () => linkedInAdsApi.confirmAudience(campaign._id),
    onSuccess: (res) => {
      toast.success(
        res.alreadyConfirmed
          ? "Already noted — thanks."
          : "Noted. We'll stop calling this one unreviewed.",
      );
      void queryClient.invalidateQueries({ queryKey: ["linkedin-managed-campaigns"] });
    },
    onError: (err) => toastUnhandledApiError(err, "record that you approved this audience"),
  });

  if (!prov?.basis?.length) return null;

  const claim = audienceClaim(origin);
  const unconfirmed = claim === "auto_unconfirmed";
  const unverified = claim === "unverified";
  // ★REACH IS SUPPRESSED WHEN WE CANNOT VERIFY THE RECORD. The api $unsets the
  // engine's reach the moment a human edits an audience, for a reason it states
  // plainly: "reach is the number a customer divides their budget by, so a
  // stale one is worse than none". A record that no longer matches the
  // targeting is exactly that stale number, and rendering it above a paragraph
  // saying we can't confirm the audience would be the worst of both.
  const reach = unverified ? null : reachLine(prov.reach);

  return (
    // `whitespace-normal`: TableCell's base class sets `whitespace-nowrap` and
    // white-space INHERITS, so every paragraph below would render as one
    // unbreakable line and push a horizontal scrollbar onto the whole
    // nine-column table.
    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-normal">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {unverified || claim === "unclaimed" ? (
          // No claim about WHO. For `unverified` we cannot tell; for
          // `unclaimed` the record IS current and simply nobody has approved
          // it. Both are honest as a bare label; neither may borrow the other's
          // sentence.
          <Badge variant="outline">Audience</Badge>
        ) : unconfirmed ? (
          <Badge variant="outline" className="gap-1">
    <Sparkles className="h-3 w-3" aria-hidden="true" />
            Auto-selected from your business
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" aria-hidden="true" />
            {claim === "user_set" ? "You chose this" : "You approved this"}
          </Badge>
        )}
        {reach && <span className="text-xs text-muted-foreground">{reach}</span>}
      </div>

      <ul className="space-y-1">
        {prov.basis.map((b) => (
          <li key={b.attribute} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-xs text-muted-foreground">
              {ATTRIBUTE_LABEL[b.attribute] ?? b.attribute}
            </span>
            {/* Readable chips, never URNs — "Mumbai", not urn:li:geo:1. */}
            {b.values.map((v, i) => (
              // Keyed by index as well as value: two distinct URNs can share a
              // display name (LinkedIn has several "Cambridge"), and the label
              // is all that survives into the basis.
              <Badge
                key={`${b.attribute}:${i}:${v}`}
                variant="outline"
                // Badge is `whitespace-nowrap` by default, so a long job title
                // would overflow the cell the same way the prose did.
                className="font-normal whitespace-normal"
              >
                {v}
              </Badge>
            ))}
          </li>
        ))}
      </ul>

      {unverified && (
        <p className="mt-2 text-xs text-muted-foreground">
          This is what we last recorded. We can&apos;t confirm it still describes the campaign&apos;s
          current audience, so we&apos;re not saying who chose it — open the audience editor to see
          what it is now.
        </p>
      )}

      {unconfirmed && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            You can change it — or tell us it&apos;s right and we&apos;ll learn from that.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => confirm.mutate()}
            disabled={confirm.isPending}
          >
            {confirm.isPending ? "Saving…" : "Looks right"}
          </Button>
        </div>
      )}
    </div>
  );
}
