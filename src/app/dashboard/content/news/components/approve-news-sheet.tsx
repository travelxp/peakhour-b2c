"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SchedulerComposer } from "@/components/scheduler";
import { api } from "@/lib/api";
import { sourceTextHash } from "@/lib/scheduler/source-hash";
import type {
  CommitPlanRequest,
  CommitPlanResponse,
} from "@/lib/scheduler/types";
import type { NewsIdea } from "../types";

/**
 * <ApproveNewsSheet/> — the News Desk (N5) 1-tap approve. Opens the
 * shared <SchedulerComposer/> pre-filled from a corroborated, brand-voice
 * news draft sitting in the approval queue (cnt_ideas status "review").
 *
 * Approving an idea = scheduling it: the human's "go" IS the approval.
 * The commit is routed (via SchedulerComposer's `commit` override) to
 * POST /v1/content/ideas/:id/approve-schedule, which flips the idea out
 * of the queue AND commits the publish plan atomically server-side — so a
 * failed commit can't leave an orphan plan or a stuck idea.
 *
 * The publish text + source are derived server-side from the reviewed
 * content; the body below only carries scheduling parameters (channels,
 * time, timezone, stagger, auto-approve). The `source`/`payload` passed
 * to the composer drive its preview only.
 */

export interface ApproveNewsSheetProps {
  idea: NewsIdea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful approve+schedule so the host can
   *  invalidate the queue and close the sheet. */
  onApproved?: () => void;
}

export function ApproveNewsSheet({
  idea,
  open,
  onOpenChange,
  onApproved,
}: ApproveNewsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-base">Approve &amp; schedule</SheetTitle>
          <SheetDescription className="text-xs">
            Pick when this corroborated draft publishes. Approving it
            schedules it on the channels below.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 px-6 py-4">
          {idea ? (
            <ApproveBody idea={idea} onApproved={onApproved} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ApproveBody({
  idea,
  onApproved,
}: {
  idea: NewsIdea;
  onApproved?: () => void;
}) {
  const text = (
    idea.content?.plainText ||
    idea.content?.subject ||
    idea.description ||
    idea.title ||
    ""
  ).trim();
  const title = idea.content?.subject || idea.title;
  const channelKeys = idea.channels?.length ? idea.channels : ["x"];

  const channels = channelKeys.map((channel) => ({
    channel,
    payload: { text },
  }));

  // Commit override → the News Desk approve endpoint. Strips the
  // per-channel payloads and the source (both derived server-side from
  // the reviewed idea); forwards only the scheduling parameters.
  const commit = (body: CommitPlanRequest): Promise<CommitPlanResponse> =>
    api.post<CommitPlanResponse>(`/v1/content/ideas/${idea._id}/approve-schedule`, {
      channels: body.channels.map((c) => ({
        channel: c.channel,
        ...(c.connectionId ? { connectionId: c.connectionId } : {}),
        ...(c.preferredLocalTime
          ? { preferredLocalTime: c.preferredLocalTime }
          : {}),
        ...(c.publishViaReminder !== undefined
          ? { publishViaReminder: c.publishViaReminder }
          : {}),
      })),
      ...(body.staggerStrategy ? { staggerStrategy: body.staggerStrategy } : {}),
      canonicalScheduledAtUtc: body.canonicalScheduledAtUtc,
      timezone: body.timezone,
      ...(body.autoApprove ? { autoApprove: body.autoApprove } : {}),
      ...(body.title ? { title: body.title } : {}),
    });

  return (
    <SchedulerComposer
      source={{
        sourceType: "idea",
        sourceRef: idea._id,
        sourceTextHash: sourceTextHash(text),
      }}
      title={title}
      channels={channels}
      commit={commit}
      submitLabel="Approve & schedule"
      onScheduled={() => onApproved?.()}
    />
  );
}
