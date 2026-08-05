"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { audiencesApi } from "@/lib/api/audiences";

/**
 * "What we understand about your business", in one line, with the way to it
 * (G2).
 *
 * ★THE PANEL ITSELF MOVED TO ITS OWN PAGE, and this is what the Ads hub keeps.
 * The profile is channel-NEUTRAL — the same understanding decides who a
 * LinkedIn campaign and an X campaign target, and Content, Support and Commerce
 * will all want to read it — so it is not an ads setting. But a boost flow that
 * says nothing about where its targeting comes from is the state the whole
 * engine was invisible inside, so the link is not optional either.
 *
 * ★AND IT ASKS FOR NOTHING NEW. Same query key as the panel, so on a page that
 * has already loaded it this is a cache read, and on one that has not the panel
 * gets a warm cache when the customer follows the link.
 */
export function BusinessProfileSummary() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audience-profile"],
    queryFn: () => audiencesApi.getProfile(),
  });

  const profile = data?.profile ?? null;
  const industry = profile?.classification?.industry?.value;
  const personas = profile?.personas?.length ?? 0;
  const corrections = profile?.corrections?.length ?? 0;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-sm font-medium">What we understand about your business</div>
            {isLoading ? (
              <Skeleton className="mt-1 h-3 w-64" />
            ) : isError && !data ? (
              // A failed READ is not "no profile" — saying "we haven't read
              // your business" here would invite a rebuild of something that
              // may already exist. Same rule the panel states.
              <p className="text-sm text-muted-foreground">
                We couldn&apos;t load it just now.
              </p>
            ) : !profile ? (
              <p className="text-sm text-muted-foreground">
                We haven&apos;t read your business yet. Every campaign is targeted from this.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {[
                  industry ? `A ${industry} business` : "Read",
                  personas > 0
                    ? `${personas} audience${personas === 1 ? "" : "s"} we recognise`
                    : null,
                  // ★SAID, BECAUSE A CORRECTION IS THE BEST SIGNAL THIS ENGINE
                  // GETS. A customer who has told us we were wrong should see
                  // that we kept it.
                  corrections > 0
                    ? `${corrections} correction${corrections === 1 ? "" : "s"} from you`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/growth/business">
            {profile ? "Review it" : "Set it up"}
            <ArrowRight className="ml-1.5 size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
