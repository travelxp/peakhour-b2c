"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/dashboard/page-shell";
import { OverviewGreeting } from "@/components/dashboard/overview-greeting";
import { useAuth } from "@/providers/auth-provider";

/**
 * Home is the heaviest route chunk in the dashboard, so on a client navigation
 * this fallback is what the merchant sees while it downloads. It used to be a
 * grey bar where the title goes, so Home's <h1> appeared only once the whole
 * chunk had arrived (~1000ms against ~200ms elsewhere). The greeting needs no
 * data beyond the name the shell already holds, so it renders here for real.
 */
export default function OverviewLoading() {
  const { org, business } = useAuth();
  return (
    <PageShell width="wide">
      <OverviewGreeting businessName={business?.name ?? org?.name} />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
