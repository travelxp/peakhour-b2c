"use client";

import { TrendingUp } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OutcomesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Outcomes</h2>
        <p className="text-muted-foreground">
          Track real business results, not vanity metrics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            See how many new customers your ads are bringing in, at what cost,
            and which content drives the best results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-muted to-muted/60 border border-border/50 shadow-sm mb-4">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              No more confusing dashboards with CTR and ROAS. We&apos;ll show
              you &quot;23 new customers this week at $12 each&quot; — numbers
              that make sense.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
