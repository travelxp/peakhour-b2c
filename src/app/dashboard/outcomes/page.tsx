"use client";

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
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <svg
                aria-hidden="true"
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
                />
              </svg>
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
