"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChannelIconCompact } from "@/components/ui/channel-icon";
import { ArrowLeft } from "lucide-react";
import {
  PostComposer,
  PostComposerSkeleton,
  useLinkedInIdentity,
} from "@/app/(site)/dashboard/content/linkedin/_components/post-composer";
import { TweetComposer } from "@/app/(site)/dashboard/content/x/_components/tweet-composer";

/**
 * <ComposeNewSheet/> — the "create from scratch" entry point that
 * existed nowhere before: a calendar-header CTA that opens a Sheet to
 * pick a platform and compose a brand-new post (publish now OR schedule)
 * without first having a draft/idea/repurpose source.
 *
 * It delegates entirely to the per-platform composers shipped earlier
 * (LinkedIn PostComposer, X TweetComposer) — each already bundles the
 * AI toolbar, emoji/hashtag primitives, AND a compose/schedule toggle
 * (<SchedulerComposer/>), so "schedule" is always available here with
 * no extra wiring. When the Beehiiv composer lands (buildout #5) it
 * slots into the picker the same way.
 *
 * On schedule, each composer invalidates the ["scheduler:items"] query
 * the calendar subscribes to, so the grid behind the sheet refreshes
 * live. The composer resets itself after publish/schedule; the user
 * closes the sheet when done (auto-close-on-success is a follow-up —
 * it needs the composers to expose a completion callback).
 */

type Platform = "linkedin" | "x";

const PLATFORMS: { value: Platform; label: string; blurb: string }[] = [
  { value: "linkedin", label: "LinkedIn", blurb: "Personal feed or a company page" },
  { value: "x", label: "X (Twitter)", blurb: "A single tweet or a thread" },
];

export interface ComposeNewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComposeNewSheet({ open, onOpenChange }: ComposeNewSheetProps) {
  const [platform, setPlatform] = useState<Platform | null>(null);

  function handleOpenChange(next: boolean) {
    // Reset the platform choice whenever the sheet closes so the next
    // open starts at the picker.
    if (!next) setPlatform(null);
    onOpenChange(next);
  }

  const activeLabel = PLATFORMS.find((p) => p.value === platform)?.label;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-base">
            {platform ? `Compose for ${activeLabel}` : "Compose new"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {platform
              ? "Write your post, then publish now or schedule it for later."
              : "Pick a channel to start a brand-new post."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-6 py-4">
          {!platform ? (
            <ul className="space-y-2">
              {PLATFORMS.map((p) => (
                <li key={p.value}>
                  <button
                    type="button"
                    onClick={() => setPlatform(p.value)}
                    className="flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <ChannelIconCompact channel={p.value} size={18} />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{p.label}</span>
                      <span className="text-xs text-muted-foreground">{p.blurb}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPlatform(null)}
                className="gap-1.5"
              >
                <ArrowLeft className="size-3.5" /> Change channel
              </Button>
              {platform === "linkedin" ? <LinkedInCompose /> : <TweetComposer />}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** LinkedIn branch — fetches the identity the PostComposer needs and
 *  renders the appropriate gate (loading / not-connected / composer). */
function LinkedInCompose() {
  const identity = useLinkedInIdentity();

  if (identity.isLoading) {
    return <PostComposerSkeleton />;
  }
  if (!identity.data) {
    return (
      <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
        Connect LinkedIn to compose here.{" "}
        <a
          href="/dashboard/integrations"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Manage integrations
        </a>
        .
      </div>
    );
  }
  return <PostComposer identity={identity.data} />;
}
