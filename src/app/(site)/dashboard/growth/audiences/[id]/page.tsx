"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { ApiError } from "@/lib/api";
import { audienceLibraryApi } from "@/lib/api/audiences";
import { useAuth } from "@/providers/auth-provider";
import {
  audienceShape,
  critiqueTone,
  detailChannels,
  historyLine,
  originIsOurs,
  originLabel,
  outcomeLine,
} from "@/lib/audience-library-rules";
import { editLines } from "@/lib/audience-learning-rules";
import { ChannelCard } from "./_components/channel-card";

/**
 * One audience, and what it looks like on each channel (G3).
 *
 * ★THIS IS WHERE THE SEAM STOPS BEING A CLAIM IN A DOCUMENT. The library row
 * can say "1 thing X can't express"; this page has to say WHICH thing and WHY,
 * because that is the difference between a customer who knows their audience is
 * narrower on X and one who finds out by spending against it.
 *
 * ★AND THE HYPOTHESIS IS THE AUDIENCE. What is shown at the top is the
 * business-language description — no URNs, no platform enums — and each channel
 * card below it is that description RESOLVED, which is a cache of it rather
 * than the thing itself. A channel resolving badly does not make the audience
 * worse; it makes that channel a worse fit, and the page is arranged to say so.
 */
/** What to say when one audience will not load. Mirrors the list's own
 *  branching: the conditions are the route's, not this page's. */
function detailErrorState(error: unknown): {
  title: string;
  description: string;
  action?: { label: string; href: string };
} {
  const back = { label: "Back to your audiences", href: "/dashboard/growth/audiences" };
  const code = error instanceof ApiError ? error.code : undefined;
  if (code === "FORBIDDEN") {
    // ★NO ACTION, WHICH IS THE LIST'S RULE AND NOT A DIFFERENCE OF TASTE. The
    // list answers this same 403 with the same sentence and deliberately
    // offers no button; sending the customer "back to your audiences" walks
    // them from "Pick a business first" to "Pick a business first".
    return {
      title: "Pick a business first",
      description: "Audiences belong to one business at a time — choose one and this will load.",
    };
  }
  if (code === "VALIDATION_ERROR") {
    return {
      title: "That isn't an audience link",
      description: "The address is missing part of an audience id.",
      action: back,
    };
  }
  if (error instanceof ApiError && error.status === 404) {
    return {
      title: "We couldn't find that audience",
      description: "It may belong to another business, or have been removed.",
      action: back,
    };
  }
  return {
    title: "We couldn't load that audience",
    description: "That's on us. Nothing has been changed.",
    action: back,
  };
}

export default function AudienceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { business } = useAuth();

  const set = useQuery({
    queryKey: ["audience-set", business?._id ?? "none", id],
    queryFn: () => audienceLibraryApi.getSet(id),
    retry: false,
  });

  const row = set.data?.set;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard/growth/audiences">
          <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
          All audiences
        </Link>
      </Button>

      {set.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : set.isError || !row ? (
        // ★THE SAME VOCABULARY AS THE LIST, because they answer to the same
        // conditions. A customer with no active business got "Pick a business
        // first" one click away and "That's on us" here — two answers to one
        // condition inside one feature — and a pasted bad id got an apology for
        // something that is not our fault.
        <EmptyState icon={Users} {...detailErrorState(set.error)} />
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{row.name}</h2>
              <Badge variant={originIsOurs(row.source) ? "outline" : "secondary"}>
                {originLabel(row.source)}
              </Badge>
            </div>
            {/* ★THE DEEPER SURFACE MUST NOT SHOW LESS THAN THE CARD THAT LINKS
                TO IT. This page rendered `description` — the one-line label —
                while the list card rendered `explanation`, §15's prose about
                who these people actually are. So clicking through to "find out
                more" lost the most informative sentence we have. `GET /sets/:id`
                has always returned both. */}
            {(row.explanation ?? row.description) && (
              <p className="text-muted-foreground">{row.explanation ?? row.description}</p>
            )}
            {/* ★AND THE ENGINE'S OBJECTIONS TO ITS OWN SUGGESTION, for the same
                reason. This is the screen somebody opens before putting an
                audience on a campaign, which makes it the last place an
                argument against it is still useful. */}
            {row.critique?.length ? (
              <ul className="space-y-0.5">
                {row.critique.map((c, i) => {
                  const tone = critiqueTone(c.severity);
                  return (
                    <li key={`${c.code}-${i}`} className={tone.className}>
                      <span className="font-medium">{tone.lead}</span> {c.note}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {(() => {
              const history = historyLine(row);
              const outcome = outcomeLine(row.outcome);
              if (!history && !outcome) return null;
              return (
                <p className="text-sm text-muted-foreground">
                  {[history, outcome].filter(Boolean).join(" · ")}
                </p>
              );
            })()}
          </div>

          <Card>
            <CardContent className="space-y-2 p-4">
              <h3 className="text-sm font-medium">Who this audience is</h3>
              {(() => {
                const shape = audienceShape(row);
                if (shape.length === 0) {
                  // ★AN IMPORTED SET HAS NO HYPOTHESIS, AND SAYING SO IS THE
                  // POINT. Its targeting is the platform's own, read off a
                  // campaign that ran — there is no business-language
                  // description, and inventing one out of URNs would be a
                  // sentence we made up. The channel it came from still shows
                  // exactly what it targets, below.
                  return (
                    <p className="text-sm text-muted-foreground">
                      This one was read off a campaign as it ran, so we don&apos;t have a
                      plain-language description of who it targets — only the channel&apos;s own
                      targeting, below.
                    </p>
                  );
                }
                return (
                  <ul className="space-y-1">
                    {shape.map((r) => (
                      <li key={r.attribute} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-xs text-muted-foreground">{r.label}</span>
                        {r.values.map((v, i) => (
                          <Badge
                            key={`${r.attribute}:${i}:${v}`}
                            variant="outline"
                            className="font-normal whitespace-normal"
                          >
                            {v}
                          </Badge>
                        ))}
                      </li>
                    ))}
                  </ul>
                );
              })()}
              {row.hypothesis?.rationale && (
                <p className="pt-1 text-sm text-muted-foreground">{row.hypothesis.rationale}</p>
              )}
            </CardContent>
          </Card>

          {/* ★WHAT WE PROPOSED, WHAT YOU CHANGED, WHAT HAPPENED (H1). The
              corrections have been recorded on this row since B5 and shown to
              nobody — and a proposal-then-correction pair is what the design
              calls the single best signal this engine gets. A customer who
              cannot see that we kept theirs has no reason to make another. */}
          {(() => {
            const edits = editLines(row);
            if (edits.length === 0) return null;
            return (
              <Card>
                <CardContent className="space-y-2 p-4">
                  <h3 className="text-sm font-medium">What you changed</h3>
                  <ul className="space-y-1">
                    {edits.map((edit, i) => (
                      <li key={`${edit.attribute}:${i}`} className="text-sm text-muted-foreground">
                        {edit.text}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    We use these to change what we suggest next — see{" "}
                    <Link href="/dashboard/growth/business" className="underline">
                      what we&apos;ve learned
                    </Link>
                    .
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold">On each channel</h3>
              <p className="text-sm text-muted-foreground">
                The same audience, expressed in each channel&apos;s own terms — including
                what a channel can&apos;t say.
              </p>
            </div>
            {/* ★THE UNION OF WHAT WE KNOW AND WHAT COULD BE ASKED. Rendering
                the hardcoded list alone dropped any channel a set carries that
                the constant does not name — a legacy row born on a third
                platform showed a reach line on the library ROW and then
                vanished from the page whose premise is that it knows more. */}
            {detailChannels(row).map((platform) => (
              <ChannelCard key={platform} set={row} platform={platform} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
