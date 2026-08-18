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
 * ★AND IT ASKS FOR NOTHING NEW. Same query key as the panel — one endpoint,
 * one cache entry, and whichever surface is visited second gets a warm one
 * (within the client's 30s staleTime; after that it is the same single request
 * the panel used to make from here).
 */
export function BusinessProfileSummary() {
  // ★`isPending`, NOT `isLoading`. In TanStack v5 `isLoading` is
  // `isPending && isFetching`, so a query PAUSED by the default
  // `networkMode: "online"` — an offline tab — reports false for it: the card
  // would fall through to "We haven't read your business yet" beside a button
  // reading "Set it up", over a profile that exists and simply could not be
  // fetched. That is the rebuild-what-already-exists invitation this component
  // was rewritten to remove, reachable by losing connectivity.
  const { data, isPending, isError } = useQuery({
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
  /**
   * ★"SET IT UP" ONLY WHEN WE HAVE AN ANSWER SAYING THERE IS NOTHING. `profile`
   * is null in three states — nobody asked yet, the ask failed, and the ask
   * succeeded and said null — and only the third is an invitation to build one.
   * Keying on `data` rather than on the loading/error flags is what makes the
   * three distinguishable: a response we hold is knowledge, however stale.
   */
  const cta = profile ? "Review it" : data ? "Set it up" : "Open";
  /**
   * Whether the profile says ANYTHING, across every field the panel renders —
   * not just the four this card counts.
   *
   * ★A FIRST CUT ASKED ONLY THE FOUR, and three of them are the commonly-empty
   * ones. A business with `subIndustry`, an ICP, pain points and a market type
   * — four full sections on the panel — read "We've read it, but haven't
   * worked out much yet" on the hub.
   */
  const hasAnything = Boolean(
    profile &&
      (industry ||
        profile.classification?.subIndustry?.value ||
        profile.classification?.marketType?.value ||
        (profile.classification?.regionalPresence?.length ?? 0) > 0 ||
        profile.icp?.length ||
        personas ||
        profile.decisionMakers?.length ||
        profile.painPoints?.length ||
        profile.intentSignals?.length ||
        corrections ||
        conflicts),
  );

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-sm font-medium">What we understand about your business</div>
            {isPending ? (
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
            ) : !hasAnything && classified ? (
              <p className="text-sm text-muted-foreground">
                We&apos;ve read it, but haven&apos;t worked out much yet.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {[
                  // No article: `industry` is free-text model output, and "A
                  // Advertising business" is what an article costs. The noun
                  // stays, because a bare "Advertising" on an ads hub is a
                  // fragment nobody can place.
                  industry ? `${industry} business` : null,
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
                  // ★SAID WHENEVER THE DEEPER READ HAS NOT RUN, NOT ONLY WHEN
                  // EVERYTHING ELSE IS EMPTY. A first cut reached this only
                  // through the `||` fallback below — and the EVIDENCED half of
                  // the profile fills `industry`, `personas` and `conflicts`
                  // without the classifier ever succeeding, so a business that
                  // picked a sector at onboarding rendered exactly like a fully
                  // classified one while the panel two clicks away showed its
                  // "the deeper read hasn't run for this business yet" notice.
                  // Two surfaces, opposite claims, about the same profile.
                  !classified ? "the deeper read hasn't run yet" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                  // Read, and genuinely quiet. Distinct from the line above:
                  // this one says we looked and found little, which is a
                  // finding rather than a gap.
                  "We've read it, but haven't worked out much yet."}
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
