"use client";

import Link from "next/link";
import { Sparkles, History, PencilLine, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AudienceSet } from "@/lib/api/audiences";
import {
  audienceShape,
  channelNotes,
  historyLine,
  originIsOurs,
  originLabel,
  outcomeLine,
  platformLabel,
  reachReading,
  unaskedChannels,
} from "@/lib/audience-library-rules";

/**
 * One audience, as a person reads it.
 *
 * ★THE ROW IS MOSTLY ABOUT WHAT WE DO NOT KNOW, and every one of those is a
 * different sentence:
 *
 *   - a channel with a number → the number;
 *   - a channel without one → "no size from X", never a zero and never a blank;
 *   - a channel NOBODY HAS ASKED → said outright, because "we haven't looked"
 *     is not "it doesn't work there";
 *   - attributes a channel could not express → counted here, named in the
 *     per-channel view.
 *
 * The decisions all live in `audience-library-rules.ts` so they can be tested
 * without a DOM; this file is the arrangement.
 */

const ORIGIN_ICON = {
  suggested: Sparkles,
  imported: History,
  authored: PencilLine,
} as const;

export function AudienceSetCard({ set }: { set: AudienceSet }) {
  const shape = audienceShape(set);
  const history = historyLine(set);
  const outcome = outcomeLine(set.outcome);
  const unasked = unaskedChannels(set);
  const ours = originIsOurs(set.source);
  const OriginIcon =
    set.source === "imported"
      ? ORIGIN_ICON.imported
      : set.source === "user_defined"
        ? ORIGIN_ICON.authored
        : ORIGIN_ICON.suggested;

  return (
    <Card className={set.status === "discarded" ? "opacity-70" : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {/* ★THE ROW IS THE WAY IN. G3's per-channel view is where "1 thing
                X can't express" becomes WHICH thing and WHY, and a detail page
                nothing links to is the same as no detail page. */}
            <h3 className="font-semibold break-words">
              <Link
                href={`/dashboard/growth/audiences/${set.id}`}
                className="hover:underline focus-visible:underline"
              >
                {set.name}
                <ChevronRight className="ml-0.5 inline size-3.5 align-baseline" aria-hidden="true" />
              </Link>
            </h3>
            {set.description && (
              <p className="mt-0.5 text-sm text-muted-foreground break-words">{set.description}</p>
            )}
          </div>
          {/* ★THE ORIGIN BADGE IS THE BRIEF'S OWN DISTINCTION AND IT LEADS.
              "Peakhour suggested" and "you built this" are the difference
              between a suggestion and a fact about the business, and a library
              that renders them alike is one undifferentiated pile. */}
          <Badge variant={ours ? "outline" : "secondary"} className="shrink-0 gap-1">
            <OriginIcon className="size-3" aria-hidden="true" />
            {originLabel(set.source)}
          </Badge>
        </div>

        {shape.length > 0 ? (
          <ul className="space-y-1">
            {shape.map((row) => (
              <li key={row.attribute} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                {row.values.map((v, i) => (
                  // Keyed by index as well as value: two distinct entities can
                  // share a display name, and only the label survives here.
                  <Badge
                    key={`${row.attribute}:${i}:${v}`}
                    variant="outline"
                    className="font-normal whitespace-normal"
                  >
                    {v}
                  </Badge>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          // ★AN IMPORTED SET HAS NO HYPOTHESIS AND SAYING SO IS THE POINT. Its
          // targeting is the platform's own, read off a campaign they ran — so
          // there is no business-language description to show, and inventing
          // one out of URNs would be a sentence we made up.
          <p className="text-sm text-muted-foreground">
            Read off the campaign as it ran, so we don&apos;t have a plain-language
            description of who it targets.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {set.channels.map((channel) => {
            const reach = reachReading(channel);
            const notes = channelNotes(channel);
            return (
              <span key={channel.platform} className="flex items-center gap-1.5">
                <span
                  className={
                    reach.kind === "counted" ? "font-medium" : "text-muted-foreground italic"
                  }
                >
                  {reach.text}
                </span>
                {notes.map((note) => (
                  <span key={note} className="text-muted-foreground">
                    · {note}
                  </span>
                ))}
              </span>
            );
          })}
          {/* ★NOT A BLANK, AND NOT "DOESN'T WORK THERE". Nobody has asked this
              channel about this audience; the honest thing is to say so, and
              it is also where the next action is. */}
          {unasked.length > 0 && (
            <span className="text-muted-foreground">
              Not checked on {unasked.map(platformLabel).join(" or ")} yet
            </span>
          )}
        </div>

        {(history || outcome) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
            {history && <span>{history}</span>}
            {history && outcome && <span aria-hidden="true">·</span>}
            {/* Copied from the campaigns that ran it, never independently
                measured — the api's own `basis` says so on every row. */}
            {outcome && <span>{outcome}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
