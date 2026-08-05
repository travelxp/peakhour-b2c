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
  const conflicts = profile?.conflicts?.length ?? 0;
  /**
   * ★"NOTHING HERE YET" vs "WE COULDN'T WORK IT OUT" — the same empty profile,
   * two completely different facts. The panel spends forty lines on this
   * distinction; a summary that flattened it would be the absence-read-as-a-
   * finding failure, on the surface more people see. The profile records which
   * classifier produced it, and its absence means the deeper read never
   * succeeded.
   */
  const classified = Boolean(profile?.skillVersions?.understand_business_for_ads);
  /**
   * ★THE CTA MAY NOT SAY "SET IT UP" WHILE WE ARE STILL ASKING. `profile` is
   * null in three states — loading, failed, and genuinely absent — and only the
   * third is an invitation to build one. A first cut keyed the label off
   * `profile` alone, so a customer with a hand-corrected profile saw "Set it
   * up" every time the request was in flight, and permanently whenever it
   * failed: the rebuild-what-already-exists invitation the panel refuses two
   * screens down, and the exact rule the comment below claims to follow.
   */
  const cta = profile ? "Review it" : isLoading || isError ? "Open" : "Set it up";

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
                  // No article: `industry` is free-text model output, and "A
                  // Advertising business" is what an article costs.
                  industry ?? null,
                  // ★"KINDS OF BUYER", NOT "AUDIENCES". `personas` is the ICP's
                  // people; an AUDIENCE is a row in the library one nav item
                  // away, and using the same word for both would give a
                  // customer with four personas and an empty library two
                  // contradictory counts on adjacent screens.
                  personas > 0
                    ? `${personas} kind${personas === 1 ? "" : "s"} of buyer we recognise`
                    : null,
                  // ★"RECENT", BECAUSE THE SERVER CAPS THE LOG AT 200 AND TRIMS
                  // THE OLDEST. A bare count quietly stops going up, and the
                  // panel already says it this way.
                  corrections > 0
                    ? `${corrections} recent correction${corrections === 1 ? "" : "s"} from you`
                    : null,
                  // ★AND THE CONFLICTS, WHICH THE PANEL SHOWS EVEN COLLAPSED
                  // because they are the most interesting thing the engine
                  // found. Moving the panel off this hub took them off the one
                  // screen everybody visits before boosting; a count keeps the
                  // pointer.
                  conflicts > 0
                    ? `${conflicts} thing${conflicts === 1 ? "" : "s"} that don't line up`
                    : null,
                ].filter(Boolean).join(" · ") ||
                  // Neither a finding nor a failure: we read the business and
                  // either found little, or the deeper read never ran. Those
                  // are different sentences.
                  (classified
                    ? "We've read it, but haven't worked out much yet."
                    : "The deeper read hasn't run yet — re-read it and we'll try again.")}
              </p>
            )}
          </div>
        </div>
        <Button
          asChild
          variant={conflicts > 0 ? "default" : "outline"}
          size="sm"
          className="shrink-0"
        >
          <Link href="/dashboard/growth/business">
            {cta}
            <ArrowRight className="ml-1.5 size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
