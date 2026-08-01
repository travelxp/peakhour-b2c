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
  const reach = reachLine(prov.reach);

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {unverified ? (
          // No claim about WHO — we cannot tell, and the honest sentence is the
          // one that says nothing rather than the one that guesses.
          <Badge variant="outline">Audience</Badge>
        ) : unconfirmed ? (
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Auto-selected from your business
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" />
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
            {b.values.map((v) => (
              <Badge key={`${b.attribute}:${v}`} variant="outline" className="font-normal">
                {v}
              </Badge>
            ))}
          </li>
        ))}
      </ul>

      {unverified && (
        <p className="mt-2 text-xs text-muted-foreground">
          This is what we last recorded. The audience has changed since, so we can&apos;t say who
          chose the current one — open the audience editor to see it.
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
