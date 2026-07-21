"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
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
 * LinkedIn DRAFT under a paused group. Nothing spends from this dialog
 * — activation (the one spend-enabling action) lives in the Ads
 * Manager behind its own confirm.
 */

const OBJECTIVES: Array<{ value: BoostObjective; label: string }> = [
  { value: "engagement", label: "Engagement (boost the post)" },
  { value: "brand_awareness", label: "Brand awareness" },
  { value: "website_traffic", label: "Website traffic" },
  { value: "lead_generation", label: "Lead generation" },
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
  const [name, setName] = useState(defaultName);
  const [objective, setObjective] = useState<BoostObjective>("engagement");
  const [dailyBudget, setDailyBudget] = useState("10");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [durationDays, setDurationDays] = useState("14");

  const boost = useMutation({
    mutationFn: () =>
      linkedInAdsApi.boost({
        postUrn,
        name: name.trim(),
        objective,
        dailyBudget: Number(dailyBudget),
        currencyCode: currencyCode.trim().toUpperCase(),
        durationDays: Math.round(Number(durationDays)),
      }),
    onSuccess: () => {
      onOpenChange(false);
      toast.success("Draft campaign created on LinkedIn.", {
        description:
          "It won't spend until you activate it. Finish targeting, then activate from the Ads Manager.",
        action: {
          label: "Open Ads Manager",
          onClick: () => {
            window.location.href = "/dashboard/ads";
          },
        },
      });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "CURRENCY_MISMATCH") {
        toast.error(err.message || "Use your ad account's billing currency.");
      } else if (err instanceof ApiError && err.code === "NOT_CONNECTED") {
        toast.error("Connect LinkedIn Ads first (Integrations page).");
      } else if (err instanceof ApiError && err.code === "NEEDS_REAUTH") {
        toast.error("LinkedIn Ads needs a reconnect before boosting.");
      } else {
        toast.error("Couldn't create the campaign. Try again in a moment.");
      }
    },
  });

  const budgetNumber = Number(dailyBudget);
  const durationNumber = Number(durationDays);
  const valid =
    name.trim().length > 0 &&
    Number.isFinite(budgetNumber) &&
    budgetNumber > 0 &&
    /^[A-Za-z]{3}$/.test(currencyCode.trim()) &&
    Number.isFinite(durationNumber) &&
    durationNumber >= 1 &&
    durationNumber <= 366;

  const total =
    valid && Number.isFinite(budgetNumber * durationNumber)
      ? Math.round(budgetNumber * durationNumber * 100) / 100
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Label>Objective</Label>
            <Select
              value={objective}
              onValueChange={(v) => setObjective(v as BoostObjective)}
            >
              <SelectTrigger>
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
            disabled={!valid || boost.isPending}
          >
            {boost.isPending ? "Creating…" : "Create draft campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
