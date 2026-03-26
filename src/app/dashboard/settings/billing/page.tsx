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

interface OrgBilling {
  name?: string;
  billing?: { plan?: string };
  createdAt?: string;
}

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

  const plan = details?.billing?.plan || "free";

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
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                {plan}
              </Badge>
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
              <p className="text-xs text-muted-foreground">Billing cycle</p>
              <p className="text-sm font-medium">Monthly</p>
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
                {plan === "pro" ? "All" : plan === "growth" ? "2" : "Preview only"}
              </span>
              {" "}included
            </p>
          </div>
        </div>

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
