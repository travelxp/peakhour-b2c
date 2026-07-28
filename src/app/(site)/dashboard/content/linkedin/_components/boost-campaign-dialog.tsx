"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { toastUnhandledApiError } from "@/lib/toast-errors";
import {
  linkedInAdsApi,
  type BoostObjective,
} from "@/lib/api/linkedin-ads";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Rocket } from "lucide-react";

/**
 * Boost-to-Campaign dialog (G1) — turns a ranked organic post into a
 * REAL LinkedIn campaign via POST /v1/linkedin/ads/boost.
 *
 * Safety framing baked into the copy: the campaign is created as a
 * LinkedIn DRAFT under a DRAFT group. Nothing spends from this dialog
 * — activation (the one spend-enabling action) lives in the Ads
 * Manager behind its own confirm.
 */

/**
 * Objectives a BOOST can use. `lead_generation` is deliberately absent:
 * LinkedIn requires a lead gen form on every creative under a lead-gen
 * campaign, and sponsoring an existing organic post gives us nowhere to
 * attach one — the server rejects that combination
 * (VALIDATION_LEADGEN_FORM_REQUIRED). Offering it here only ever
 * produced a guaranteed failure. Lead-gen campaigns are built in
 * LinkedIn Campaign Manager; the objective stays valid on other paths.
 */
const OBJECTIVES: Array<{ value: BoostObjective; label: string }> = [
  { value: "engagement", label: "Engagement (boost the post)" },
  { value: "brand_awareness", label: "Brand awareness" },
  { value: "website_traffic", label: "Website traffic" },
];

export function BoostCampaignDialog({
  open,
  onOpenChange,
  postUrn,
  defaultName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postUrn: string;
  defaultName: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [objective, setObjective] = useState<BoostObjective>("engagement");
  const [dailyBudget, setDailyBudget] = useState("10");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [durationDays, setDurationDays] = useState("14");
  // Latched after PERSIST_FAILED: the draft EXISTS on LinkedIn, so a
  // resubmit would duplicate it — the button stays disabled for this
  // dialog instance.
  const [terminal, setTerminal] = useState(false);

  // Round ONCE up front so validation, the displayed cap, and the
  // payload can never disagree (typing "14.7" must not show a x14.7
  // cap while the server stores x15).
  const budgetNumber = Number(dailyBudget);
  const durationNumber = Math.round(Number(durationDays));
  /** Fat-finger ceiling for a daily spend input — the server accepts
   *  any positive number, so the UI is the sanity gate. */
  const MAX_DAILY_BUDGET = 1_000_000;
  const valid =
    name.trim().length > 0 &&
    Number.isFinite(budgetNumber) &&
    budgetNumber > 0 &&
    budgetNumber <= MAX_DAILY_BUDGET &&
    /^[A-Za-z]{3}$/.test(currencyCode.trim()) &&
    Number.isFinite(durationNumber) &&
    durationNumber >= 1 &&
    durationNumber <= 366;

  const boost = useMutation({
    mutationFn: () =>
      linkedInAdsApi.boost({
        postUrn,
        name: name.trim(),
        objective,
        dailyBudget: budgetNumber,
        currencyCode: currencyCode.trim().toUpperCase(),
        durationDays: durationNumber,
      }),
    onSuccess: () => {
      // The Ads Manager list must show the new campaign even within
      // its staleTime window.
      queryClient.invalidateQueries({ queryKey: ["linkedin-managed-campaigns"] });
      onOpenChange(false);
      toast.success("Draft campaign created on LinkedIn.", {
        description:
          "It won't spend until you activate it. Finish targeting, then activate from the Ads Manager.",
        action: {
          label: "Open Ads Manager",
          onClick: () => {
            // Name the channel — the hub otherwise defaults to whichever ad
            // channel is connected first, which may not be LinkedIn.
            window.location.href = "/dashboard/ads?channel=linkedin";
          },
        },
      });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "CURRENCY_MISMATCH") {
        // Server-authored ("Ad account 5123… bills in INR; use that
        // currency") — NOT provider text, and the only message worth
        // rendering verbatim on this surface.
        toast.error((err as ApiError).message);
      } else if (code === "NOT_CONNECTED") {
        // Also the code a STALE (needs_reauth) connection produces —
        // the server only uses active connections.
        toast.error("Connect (or reconnect) LinkedIn Ads first.", {
          action: {
            label: "Integrations",
            onClick: () => { window.location.href = "/dashboard/integrations"; },
          },
        });
      } else if (code === "NEEDS_REAUTH") {
        toast.error("LinkedIn Ads needs a reconnect before boosting.", {
          action: {
            label: "Reconnect",
            onClick: () => { window.location.href = "/dashboard/integrations"; },
          },
        });
      } else if (code === "NO_AD_ACCOUNT") {
        toast.error(
          "Your LinkedIn Ads connection has no ad account — reconnect it, or create an ad account in LinkedIn Campaign Manager first.",
        );
      } else if (code === "FORBIDDEN") {
        toast.error("Pick a business first, then boost.");
      } else if (code === "PERSIST_FAILED") {
        // The draft DOES exist on LinkedIn — retrying would duplicate it.
        setTerminal(true);
        toast.error(
          "The campaign was created on LinkedIn but couldn't be saved here. Contact support — don't retry.",
        );
      } else if (code === "DUPLICATE_DRAFT") {
        // An un-activated draft for this post already exists; sending
        // the user there beats letting them build a second one.
        onOpenChange(false);
        // The api also returns the existing row's id in error.details,
        // but no panel reads a ?campaign= param yet — linking to the hub
        // is what actually works. Row-level deep-linking is a follow-up.
        toast.error("You already have a draft campaign for this post.", {
          description: "Edit or activate it from the Ads Manager instead of creating a second one.",
          action: {
            label: "Open Ads Manager",
            onClick: () => { window.location.href = "/dashboard/ads?channel=linkedin"; },
          },
        });
      } else if (code === "RATE_LIMITED") {
        toast.error("LinkedIn is rate-limiting us — give it a minute and try again.");
      } else if (code === "VALIDATION_LEADGEN_FORM_REQUIRED") {
        // Defensive only — the objective isn't in OBJECTIVES, so this
        // dialog can't produce it today. Kept so re-adding the option
        // fails legibly rather than through the generic branch.
        toast.error(
          "Lead-generation campaigns need a LinkedIn lead gen form — pick another objective.",
        );
      } else {
        // Everything else: friendly copy keyed on the code, with the
        // request id for support. NOT err.message — see toast-errors.ts
        // for why surfacing raw provider text is the wrong fix.
        toastUnhandledApiError(err, "create the campaign", "LinkedIn");
      }
    },
  });

  const total =
    valid && Number.isFinite(budgetNumber * durationNumber)
      ? Math.round(budgetNumber * durationNumber * 100) / 100
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // No dismissal mid-flight: closing + reopening while the POST
        // is in flight would allow a concurrent duplicate boost.
        if (!next && boost.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-4" />
            Boost this post
          </DialogTitle>
          <DialogDescription>
            Creates a LinkedIn campaign sponsoring this post — as a{" "}
            <span className="font-medium">non-spending draft</span>. You finish
            audience targeting and activate it from the Ads Manager; only that
            activation starts spend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="boost-name">Campaign name</Label>
            <Input
              id="boost-name"
              value={name}
              maxLength={256}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="boost-objective">Objective</Label>
            <Select
              value={objective}
              onValueChange={(v) => setObjective(v as BoostObjective)}
            >
              <SelectTrigger id="boost-objective">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="boost-budget">Daily budget</Label>
              <Input
                id="boost-budget"
                type="number"
                min={1}
                max={MAX_DAILY_BUDGET}
                step="1"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="boost-currency">Currency</Label>
              <Input
                id="boost-currency"
                value={currencyCode}
                maxLength={3}
                onChange={(e) => setCurrencyCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="boost-days">Days</Label>
              <Input
                id="boost-days"
                type="number"
                min={1}
                max={366}
                step="1"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Currency must match your LinkedIn ad account&apos;s billing
            currency.
            {total !== null ? (
              <>
                {" "}
                Planned cap:{" "}
                <span className="font-medium">
                  {currencyCode.toUpperCase()} {total}
                </span>{" "}
                — the monitor auto-pauses the campaign when spend reaches it.
              </>
            ) : null}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={boost.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => boost.mutate()}
            disabled={!valid || boost.isPending || terminal}
          >
            {boost.isPending ? "Creating…" : terminal ? "Created — see support note" : "Create draft campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
