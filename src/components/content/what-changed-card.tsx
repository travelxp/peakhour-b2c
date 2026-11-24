"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DraftThisPostButton } from "@/components/compose/draft-this-post-button";
import { whatChangedApi, type ChannelWhatChanged, type WhatChangedChannelKey } from "@/lib/api/what-changed";
import { emptyNote, GROUP_TITLE } from "@/lib/what-changed-view";
import { useAuth } from "@/providers/auth-provider";

/**
 * "What changed in your posts": what is improving, declining or needs attention, from the results of what was published, with a "Draft this post"
 * button on every line that implies an action. The rules are the api's one rule set for every channel (free, no model call).
 *
 * `channel` set: one channel's card, which always answers (even "not enough history yet"). Left out (Results): every channel that has lines, and a
 * single honest note when none has. Must sit under a <ComposeSheetProvider/>.
 */
export function WhatChangedCard({ channel }: { channel?: WhatChangedChannelKey }) {
  const { business } = useAuth();
  const q = useQuery({
    // the business is in the key: the route is business-scoped, and a key that does not say which is one cache clear from showing another's
    queryKey: ["what-changed", business?._id ?? "none", channel ?? "all"],
    queryFn: () => whatChangedApi.read(channel),
    staleTime: 5 * 60_000,
    retry: false,
  });
  // A failed read says nothing: this is advice on top of a page, and an error card about advice would be noise.
  if (q.isError) return null;
  if (q.isLoading) return <Skeleton className="h-24 w-full" />;
  const channels = q.data ?? [];
  // One channel's card is silent until the channel has results to speak of (a page for a channel with no measured posts has no business saying "not enough
  // history"); once it has some, it says how far it is from enough. Results lists only channels that have something to say.
  const shown = channel ? channels.filter((c) => c.lines.length > 0 || c.measuredPosts > 0) : channels.filter((c) => c.lines.length > 0);
  if (channel && shown.length === 0) return null;
  if (!channel && shown.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-1 p-4">
          <h3 className="text-sm font-semibold">What changed in your posts</h3>
          <p className="text-sm text-muted-foreground">Nothing to report yet. This fills in once your posts on a channel have a few weeks of results.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">What changed in your posts</h3>
        {shown.map((c) => (
          <ChannelLines key={c.channel} c={c} showName={!channel} />
        ))}
      </CardContent>
    </Card>
  );
}

function ChannelLines({ c, showName }: { c: ChannelWhatChanged; showName: boolean }) {
  return (
    <div className="space-y-2">
      {showName ? <h4 className="text-sm font-medium">{c.name}</h4> : null}
      {c.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyNote(c)}</p>
      ) : (
        <ul className="space-y-2">
          {c.lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{GROUP_TITLE[l.group]}: </span>
                {l.text}
              </span>
              {l.draft ? <DraftThisPostButton channel={l.draft.channel} brief={l.draft.brief} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
