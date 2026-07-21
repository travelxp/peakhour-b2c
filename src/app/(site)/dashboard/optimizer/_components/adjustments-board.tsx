"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  growthApi,
  type OptimizerProposal,
  type OptimizerRun,
  type ProposalStatus,
} from "@/lib/api/growth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/molecules/empty-state";
import { Check, ChevronDown, ChevronUp, Play, Sparkles, X } from "lucide-react";

/**
 * AdjustmentsBoard — the weekly optimizer's proposal review surface
 * (G3, autonomy L0/L1: every decision is a human's).
 *
 * Honesty rules baked in: quiet weeks render the optimizer's own
 * "not enough signal" note; inputsDigest shows exactly what a run
 * looked at; a budget approval reports what ACTUALLY happened
 * (approved / applied / failed with the reason) — never a fake
 * success.
 */

/** Channel display names — runs are platform-stamped; never hardcode
 *  the channel in copy (channel-common surface). */
const PLATFORM_LABEL: Record<string, string> = { linkedin: "LinkedIn" };
const platformLabel = (p: string) => PLATFORM_LABEL[p] ?? p;

const TYPE_LABEL: Record<OptimizerProposal["type"], string> = {
  hook_weighting: "Hook style",
  posting_cadence: "Posting cadence",
  budget_resplit: "Budget re-split",
  boost_threshold: "Boost threshold",
  audience_emphasis: "Audience emphasis",
};

const STATUS_BADGE: Record<ProposalStatus, string> = {
  proposed: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  approved: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  applied: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  dismissed: "bg-muted/60 text-muted-foreground",
  failed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

function weekLabel(iso: string): string {
  const d = new Date(iso);
  // weekStart is Monday 00:00 UTC — format in UTC or UTC-negative
  // timezones render the previous Sunday.
  return `Week of ${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
}

export function AdjustmentsBoard() {
  const queryClient = useQueryClient();
  const runs = useQuery({
    queryKey: ["growth-adjustments"],
    queryFn: () => growthApi.adjustments(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const settings = useQuery({
    queryKey: ["growth-settings"],
    queryFn: () => growthApi.settings(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["growth-adjustments"] });

  const optimizerEnabled = settings.data?.settings.optimizerEnabled === true;

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => growthApi.updateSettings({ optimizerEnabled: enabled }),
    onSuccess: (res) => {
      queryClient.setQueryData(["growth-settings"], res);
      toast.success(
        res.settings.optimizerEnabled
          ? "Optimizer enabled — it reviews this business every Monday. Run the first review whenever you like."
          : "Optimizer disabled — no further weekly reviews.",
      );
    },
    onError: () => toast.error("Couldn't update the optimizer setting. Try again in a moment."),
  });

  const runNow = useMutation({
    mutationFn: () => growthApi.runNow(),
    onSuccess: (res) => {
      if (res.created) {
        toast.success(
          res.proposalCount > 0
            ? `Optimizer reviewed the week — ${res.proposalCount} proposal${res.proposalCount === 1 ? "" : "s"} to decide.`
            : "Optimizer reviewed the week — nothing worth changing (a quiet week is a valid result).",
        );
        invalidate();
      } else if (res.reason === "already_ran") {
        toast.info("This week's review already ran — it runs once per week.");
      } else if (res.reason === "optimizer_disabled") {
        toast.info("The optimizer isn't enabled for this business yet.");
      } else {
        toast.info("Nothing to analyse yet — publish posts or run campaigns first.");
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "FORBIDDEN") {
        toast.error("Pick a business first, then run the review.");
      } else {
        toast.error("Couldn't run the optimizer. Try again in a moment.");
      }
    },
  });

  if (runs.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (runs.isError) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Couldn't load optimizer reviews"
        description="Try refreshing in a moment."
      />
    );
  }

  const rows = runs.data?.runs ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Switch
              id="optimizer-enabled"
              checked={optimizerEnabled}
              disabled={settings.isLoading || toggle.isPending}
              onCheckedChange={(v) => toggle.mutate(v)}
            />
            <Label htmlFor="optimizer-enabled" className="text-sm">
              {optimizerEnabled
                ? "Weekly reviews are ON — every Monday for this business."
                : "Weekly reviews are OFF — enable to get Monday reviews."}
            </Label>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={runNow.isPending || !optimizerEnabled}
            title={optimizerEnabled ? undefined : "Enable the optimizer first"}
            onClick={() => runNow.mutate()}
          >
            <Play className="mr-1 size-3" />
            {runNow.isPending ? "Reviewing…" : "Run this week's review"}
          </Button>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Weekly review of your organic + paid outcomes — at most three
        small, evidence-backed proposals. You decide; nothing applies
        itself.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No reviews yet"
          description={
            optimizerEnabled
              ? "Run this week's review now, or wait for Monday. It needs some published posts or campaigns to analyse."
              : "Turn the optimizer on above to get a review every Monday — at most three small proposals, and you decide every one."
          }
        />
      ) : (
        rows.map((run) => <RunCard key={run._id} run={run} onChanged={invalidate} />)
      )}
    </div>
  );
}

function RunCard({ run, onChanged }: { run: OptimizerRun; onChanged: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold leading-none">{weekLabel(run.weekStart)}</h3>
          {run.inputsDigest ? (
            <span className="text-[11px] text-muted-foreground">
              Looked at {run.inputsDigest.organicPosts} post
              {run.inputsDigest.organicPosts === 1 ? "" : "s"} ·{" "}
              {run.inputsDigest.campaignsAnalysed} campaign
              {run.inputsDigest.campaignsAnalysed === 1 ? "" : "s"} ·{" "}
              {run.inputsDigest.windowDays}-day window
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {run.proposals.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
            {run.noAdjustmentReason || "Nothing worth changing this week."}
          </p>
        ) : (
          run.proposals.map((p) => (
            <ProposalRow
              key={p.id}
              runId={run._id}
              platform={run.platform}
              proposal={p}
              onChanged={onChanged}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ProposalRow({
  runId,
  platform,
  proposal,
  onChanged,
}: {
  runId: string;
  platform: string;
  proposal: OptimizerProposal;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const platformName = platformLabel(platform);

  const decide = useMutation({
    mutationFn: (decision: "approve" | "dismiss") =>
      growthApi.decide(runId, proposal.id, decision),
    onSuccess: (res) => {
      if (res.status === "applied") {
        toast.success(`Approved and applied — the budget change is live on ${platformName}.`);
      } else if (res.status === "retryable") {
        // The proposal reverted to proposed — fixable, decide again.
        toast.warning(
          res.failReason
            ? `Couldn't apply it yet: ${res.failReason}. Fix that and approve again.`
            : "Couldn't apply it yet — fix the cause and approve again.",
        );
      } else if (res.status === "failed") {
        toast.error(res.failReason || "This proposal can't be applied — see the reason on the card.");
      } else if (res.status === "approved") {
        // Honest: recorded for the engine; consumption lands in a
        // follow-up — no fake "it's live" claim.
        toast.success("Approved and recorded — the engine picks this up as its consumers ship.");
      } else {
        toast.success("Dismissed.");
      }
      onChanged();
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "ALREADY_DECIDED") {
        toast.info("This proposal was already decided — refreshing.");
        onChanged();
      } else if (code === "NEEDS_REAUTH") {
        toast.error(`${platformName} Ads needs a reconnect before applying budget changes.`, {
          action: {
            label: "Reconnect",
            onClick: () => { window.location.href = "/dashboard/integrations"; },
          },
        });
        onChanged();
      } else if (code === "NOT_FOUND") {
        toast.error("This proposal no longer exists — refreshing.");
        onChanged();
      } else if (code === "FORBIDDEN") {
        toast.error("Pick a business first.");
      } else {
        toast.error("Couldn't record the decision. Try again in a moment.");
      }
    },
  });

  const open = proposal.status === "proposed";

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_BADGE[proposal.status]}`}
            >
              {proposal.status}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {TYPE_LABEL[proposal.type] ?? proposal.type}
            </Badge>
          </div>
          <p className="text-sm font-medium">{proposal.summary}</p>
          {proposal.failReason && (proposal.status === "failed" || proposal.status === "proposed") ? (
            <p className="text-xs text-red-700 dark:text-red-300">
              {proposal.status === "proposed" ? "Last attempt: " : ""}
              {proposal.failReason}
            </p>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
            aria-expanded={expanded}
            aria-controls={`proposal-detail-${proposal.id}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? "Hide the numbers" : "See the numbers behind it"}
          </button>
          {expanded ? (
            <div id={`proposal-detail-${proposal.id}`} className="space-y-1.5 rounded-md bg-muted/30 p-2 text-xs">
              <div>
                <p className="font-medium">Evidence</p>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {proposal.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
              <p>
                <span className="font-medium">Expected effect:</span>{" "}
                <span className="text-muted-foreground">{proposal.expectedEffect}</span>
              </p>
              <p>
                <span className="font-medium">Rollback if:</span>{" "}
                <span className="text-muted-foreground">{proposal.rollbackCondition}</span>
              </p>
            </div>
          ) : null}
        </div>
        {open ? (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-7 px-2 text-xs"
              disabled={decide.isPending}
              title={
                proposal.type === "budget_resplit"
                  ? `Approve — applies the budget change on ${platformName} (guarded: never an increase beyond your envelope)`
                  : "Approve this adjustment"
              }
              onClick={() => decide.mutate("approve")}
            >
              <Check className="mr-1 size-3" />
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={decide.isPending}
              onClick={() => decide.mutate("dismiss")}
            >
              <X className="mr-1 size-3" />
              Dismiss
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
