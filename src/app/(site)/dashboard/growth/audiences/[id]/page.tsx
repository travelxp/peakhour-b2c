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
  historyLine,
  LIBRARY_CHANNELS,
  originIsOurs,
  originLabel,
  outcomeLine,
} from "@/lib/audience-library-rules";
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
        <EmptyState
          icon={Users}
          title={
            set.error instanceof ApiError && set.error.status === 404
              ? "We couldn't find that audience"
              : "We couldn't load that audience"
          }
          description={
            set.error instanceof ApiError && set.error.status === 404
              ? "It may belong to another business, or have been removed."
              : "That's on us. Nothing has been changed."
          }
          action={{ label: "Back to your audiences", href: "/dashboard/growth/audiences" }}
        />
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{row.name}</h2>
              <Badge variant={originIsOurs(row.source) ? "outline" : "secondary"}>
                {originLabel(row.source)}
              </Badge>
            </div>
            {row.description && <p className="text-muted-foreground">{row.description}</p>}
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

          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold">On each channel</h3>
              <p className="text-sm text-muted-foreground">
                The same audience, expressed in each channel&apos;s own terms — including
                what a channel can&apos;t say.
              </p>
            </div>
            {LIBRARY_CHANNELS.map((platform) => (
              <ChannelCard key={platform} set={row} platform={platform} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
