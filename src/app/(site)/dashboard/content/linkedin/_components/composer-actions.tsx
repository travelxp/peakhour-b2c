"use client";

import { CalendarClock, GalleryHorizontalEnd, ListChecks, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCost } from "@/components/dashboard/action-cost";
import type { ComposerPolicyAdvisory } from "@/lib/api/linkedin-content";
import { PolicyChip } from "./composer-policy-check";

/** The composer's action row: policy chip, Schedule, Poll, Carousel, Publish. */
export function ComposerActions({
  policy,
  pollActive,
  scheduleDisabled,
  onSchedule,
  onTogglePoll,
  carouselDisabled,
  carouselTooShort,
  carouselPending,
  onCarousel,
  publishDisabled,
  publishPending,
  onPublish,
}: {
  policy: ComposerPolicyAdvisory | null | undefined;
  pollActive: boolean;
  scheduleDisabled: boolean;
  onSchedule: () => void;
  onTogglePoll: () => void;
  carouselDisabled: boolean;
  carouselTooShort: boolean;
  carouselPending: boolean;
  onCarousel: () => void;
  publishDisabled: boolean;
  publishPending: boolean;
  onPublish: () => void;
}) {
  return (
    <>
      <PolicyChip state={policy} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onSchedule}
        disabled={scheduleDisabled}
        className="gap-1.5"
        title={
          pollActive
            ? "Polls can't be scheduled yet — publish now, or remove the poll to schedule."
            : undefined
        }
      >
        <CalendarClock className="size-4" /> Schedule
      </Button>
      <Button
        type="button"
        variant={pollActive ? "secondary" : "outline"}
        size="sm"
        onClick={onTogglePoll}
        aria-pressed={pollActive}
        className="gap-1.5"
        title={
          pollActive
            ? "Remove the poll"
            : "Add a poll (question + 2–4 options). Your text shows above the poll."
        }
      >
        <ListChecks className="size-4" />
        Poll
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCarousel}
        disabled={carouselDisabled}
        aria-busy={carouselPending}
        className="gap-1.5"
        title={
          carouselTooShort
            ? "Write a few sentences first — a carousel splits your text into slides."
            : "Generate a swipeable LinkedIn carousel and review it before publishing. Takes ~30–60s."
        }
      >
        {carouselPending ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <GalleryHorizontalEnd className="size-4" />
        )}
        {carouselPending ? "Generating preview…" : "Carousel"}
      </Button>
      <ActionCost action="linkedinCarousel" className="text-micro" />
      <Button onClick={onPublish} disabled={publishDisabled} aria-busy={publishPending}>
        <Send className="size-4 mr-1.5" />
        {publishPending ? "Publishing…" : "Publish"}
      </Button>
    </>
  );
}
