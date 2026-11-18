"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChannelIconCompact } from "@/components/brand/channel-icon";
import { ArrowLeft } from "lucide-react";
import { PostComposer } from "@/app/(site)/dashboard/content/linkedin/_components/post-composer";
import {
  PostComposerSkeleton,
  useLinkedInIdentity,
} from "@/app/(site)/dashboard/content/linkedin/_components/composer-identity";
import { TweetComposer } from "@/app/(site)/dashboard/content/x/_components/tweet-composer";
import { contentHubIntegrationsQuery } from "@/lib/nav-queries";
import {
  CONNECTED_ACCOUNTS_LABEL,
  META_COMPOSE_RULES,
  metaComposeTargets,
  isMetaComposeChannel,
  type MetaComposeChannel,
} from "@/lib/meta-compose";
import { MetaComposer } from "./meta-composer";

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
 * no extra wiring. Facebook, Instagram and Threads share ONE composer
 * (<MetaComposer/>) and appear in the picker only once that channel is
 * connected: the same connection list the content hub reads. When the
 * Beehiiv composer lands (buildout #5) it slots into the picker the
 * same way.
 *
 * On schedule, each composer invalidates the ["scheduler:items"] query
 * the calendar subscribes to, so the grid behind the sheet refreshes
 * live. The composer resets itself after publish/schedule; the user
 * closes the sheet when done (auto-close-on-success is a follow-up —
 * it needs the composers to expose a completion callback).
 */

type Platform = "linkedin" | "x" | MetaComposeChannel;

interface PlatformOption {
  value: Platform;
  label: string;
  blurb: string;
  /** "Posting to ..." for a Meta channel, from the connection. */
  postingTo?: string | null;
}

const BASE_PLATFORMS: PlatformOption[] = [
  { value: "linkedin", label: "LinkedIn", blurb: "Personal feed or a company page" },
  { value: "x", label: "X (Twitter)", blurb: "A single tweet or a thread" },
];

export interface ComposeNewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComposeNewSheet({ open, onOpenChange }: ComposeNewSheetProps) {
  // The option as it was when picked. Held whole, not looked up again: the connection list refetches on window focus, and a channel
  // that drops out of it mid-compose must not change the header or the "Posting to" line under the merchant's hands.
  const [chosen, setChosen] = useState<PlatformOption | null>(null);
  const platform = chosen?.value ?? null;

  // Facebook, Instagram and Threads are offered only when connected. While the list is loading (or failed) none is offered:
  // a channel that is not known to be connected is not shown, rather than shown and then refused.
  const integrations = useQuery({ ...contentHubIntegrationsQuery, enabled: open });
  const platforms = useMemo<PlatformOption[]>(
    () => [
      ...BASE_PLATFORMS,
      ...metaComposeTargets(integrations.data?.integrations).map((t) => ({
        value: t.channel,
        label: META_COMPOSE_RULES[t.channel].label,
        blurb: META_COMPOSE_RULES[t.channel].blurb,
        postingTo: t.postingTo,
      })),
    ],
    [integrations.data],
  );

  function handleOpenChange(next: boolean) {
    // Reset the platform choice whenever the sheet closes so the next
    // open starts at the picker.
    if (!next) setChosen(null);
    onOpenChange(next);
  }

  const activeLabel = chosen?.label;

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
              {platforms.map((p) => (
                <li key={p.value}>
                  <button
                    type="button"
                    onClick={() => setChosen(p)}
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
              <li className="px-1 pt-1 text-xs text-muted-foreground">
                Facebook, Instagram or Threads missing? Connect it in{" "}
                <Link href="/dashboard/integrations" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
                  {CONNECTED_ACCOUNTS_LABEL}
                </Link>
                .
              </li>
            </ul>
          ) : (
            <div className="space-y-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setChosen(null)}
                className="gap-1.5"
              >
                <ArrowLeft className="size-3.5" /> Change channel
              </Button>
              {platform === "linkedin" ? (
                <LinkedInCompose />
              ) : platform === "x" ? (
                <TweetComposer />
              ) : isMetaComposeChannel(platform) ? (
                // keyed by channel so the text and pictures never carry from one channel to another
                <MetaComposer key={platform} channel={platform} postingTo={chosen?.postingTo ?? null} />
              ) : null}
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
        <Link
          href="/dashboard/integrations"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Manage integrations
        </Link>
        .
      </div>
    );
  }
  return <PostComposer identity={identity.data} />;
}
