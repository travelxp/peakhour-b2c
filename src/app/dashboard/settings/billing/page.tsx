"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useLocale } from "@/hooks/use-locale";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OrgBilling {
  name?: string;
  /** Backward-compat alias on /v1/dashboard/org — `plan` is derived from
   *  subscription.plan. New surfaces should consume `subscription`
   *  directly (richer shape including trial state). */
  billing?: { plan?: string };
  subscription?: {
    plan?: string;
    planVersion?: number;
    trialEndsAt?: string | null;
    trialActive?: boolean;
    trialDaysRemaining?: number;
  };
  entitlements?: {
    plan?: string;
    planVersion?: number;
    computedAt?: string | null;
    features?: string[];
  } | null;
  createdAt?: string;
}

// Mirrors the navbar PlanBadge tier accents so plan presentation stays
// consistent across surfaces.
const PLAN_STYLES: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  starter:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  growth:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  agency:
    "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  enterprise:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
};

export default function BillingPage() {
  const { org } = useAuth();
  const { formatDate } = useLocale();
  const [details, setDetails] = useState<OrgBilling | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?._id) return;
    api
      .get<OrgBilling>("/v1/dashboard/org")
      .then(setDetails)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [org?._id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  // Prefer subscription.plan (canonical); fall back to billing.plan
  // (legacy alias from the endpoint, also derived from subscription
  // but kept on the response for old consumers).
  const plan = details?.subscription?.plan ?? details?.billing?.plan ?? "free";
  const planClass = PLAN_STYLES[plan] ?? PLAN_STYLES.free;
  const trialActive = details?.subscription?.trialActive === true;
  const trialDays = details?.subscription?.trialDaysRemaining ?? 0;
  const trialEndsAt = details?.subscription?.trialEndsAt
    ? new Date(details.subscription.trialEndsAt)
    : null;
  const features = details?.entitlements?.features ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground mt-1">
          Manage your plan, usage, and payment details
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Current plan card */}
        <div className="rounded-2xl border bg-muted/30 px-5 pt-4 pb-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Current Plan</h3>
              <Badge
                variant="secondary"
                className={cn("font-medium capitalize", planClass)}
              >
                {plan}
              </Badge>
              {trialActive && trialDays > 0 ? (
                <Badge variant="outline" className="font-medium">
                  Trial · {trialDays}d left
                </Badge>
              ) : null}
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:hello@peakhour.ai">Upgrade plan</a>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Organization</p>
              <p className="text-sm font-medium">{details?.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Member since</p>
              <p className="text-sm font-medium">
                {formatDate(details?.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {trialActive ? "Trial ends" : "Billing cycle"}
              </p>
              <p className="text-sm font-medium">
                {trialActive && trialEndsAt
                  ? formatDate(trialEndsAt.toISOString())
                  : "Monthly"}
              </p>
            </div>
          </div>
        </div>

        {/* Usage cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-muted/30 px-4 pt-3 pb-5">
            <p className="font-semibold mb-1">Content pieces</p>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">
                {plan === "free" ? "50" : "Unlimited"}
              </span>
              {plan === "free" ? " / 50 included" : " included"}
            </p>
            {plan === "free" && (
              <div className="relative mt-2 h-1 w-full rounded-full bg-muted">
                <span className="absolute top-0 left-0 h-full w-1/2 rounded-full bg-amber-500" />
              </div>
            )}
          </div>
          <div className="rounded-2xl border bg-muted/30 px-4 pt-3 pb-5">
            <p className="font-semibold mb-1">Ad platforms</p>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">
                {plan === "enterprise" || plan === "agency"
                  ? "All"
                  : plan === "growth"
                    ? "2"
                    : "Preview only"}
              </span>
              {" "}included
            </p>
          </div>
        </div>

        {/* Features unlocked on this plan — sourced from the entitlements
            snapshot so it reflects whatever cfg_plans currently grants,
            not a hardcoded enumeration that would drift from the seed. */}
        {features.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Features included</CardTitle>
              <CardDescription>
                Resolved from your plan + any add-ons or platform grants.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-1.5">
                {features.map((f) => (
                  <li key={f}>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {f}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* Payment method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Method</CardTitle>
            <CardDescription>
              Manage your payment details and billing address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No payment method on file. Contact us to set up billing.
            </p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <a href="mailto:hello@peakhour.ai">Contact support</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
