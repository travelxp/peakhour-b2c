"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DraftThisPostButton } from "@/components/compose/draft-this-post-button";
import { whatChangedApi, type ChannelWhatChanged, type WhatChangedChannelKey, type WhatChangedLine } from "@/lib/api/what-changed";
import { emptyNote, GROUP_TITLE, joinWhatChanged } from "@/lib/what-changed-view";
import { useAuth } from "@/providers/auth-provider";

const TITLE_WITH_ACCOUNT = "What changed";

/**
 * "What changed in your posts": what is improving, declining or needs attention, from the results of what was published, with a "Draft this post"
 * button on every line that implies an action. The rules are the api's one rule set for every channel (free, no model call).
 *
 * `channel` set: one channel's card, which always answers (even "not enough history yet"). Left out (Results): every channel that has lines, and a
 * single honest note when none has. Must sit under a <ComposeSheetProvider/>.
 *
 * `accountLines` (a channel page only): the account's own trends from its insights, shown FIRST in the same card, so a page has one "What changed" and
 * not two. They are shown even while the post results load or when they cannot be read.
 */
export function WhatChangedCard({ channel, accountLines = [] }: { channel?: WhatChangedChannelKey; accountLines?: WhatChangedLine[] }) {
  const { business } = useAuth();
  const q = useQuery({
    // the business is in the key: the route is business-scoped, and a key that does not say which is one cache clear from showing another's
    queryKey: ["what-changed", business?._id ?? "none", channel ?? "all"],
    queryFn: () => whatChangedApi.read(channel),
    staleTime: 5 * 60_000,
    retry: false,
    // no business yet (first paint): no request, no cached error under a key that is not a business
    enabled: !!business,
  });
  const accountOnly = joinWhatChanged(accountLines, []);
  // A failed read says nothing: this is advice on top of a page, and an error card about advice would be noise.
  if (q.isError) return accountLines.length > 0 ? <OneCard title={TITLE_WITH_ACCOUNT} lines={accountOnly} /> : null;
  if (q.isLoading || !business) {
    return accountLines.length > 0 ? <OneCard title={TITLE_WITH_ACCOUNT} lines={accountOnly} /> : <Skeleton className="h-24 w-full" />;
  }
  const channels = q.data ?? [];
  // One channel's card is silent until the channel has results to speak of (a page for a channel with no measured posts has no business saying "not enough
  // history"); once it has some, it says how far it is from enough. Results lists only channels that have something to say.
  const shown = channel ? channels.filter((c) => c.lines.length > 0 || c.measuredPosts > 0) : channels.filter((c) => c.lines.length > 0);
  if (channel && shown.length === 0) return accountLines.length > 0 ? <OneCard title={TITLE_WITH_ACCOUNT} lines={accountOnly} /> : null;
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
  if (channel && accountLines.length > 0) {
    const c = shown[0]!;
    return <OneCard title={TITLE_WITH_ACCOUNT} lines={joinWhatChanged(accountLines, c.lines)} note={c.lines.length === 0 ? emptyNote(c) : undefined} />;
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

/** The one card of a Facebook or Instagram page: account trends, then post results, then (when the post results have nothing yet) why. */
function OneCard({ title, lines, note }: { title: string; lines: { key: string; line: WhatChangedLine }[]; note?: string | undefined }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <ul className="space-y-1.5">
          {lines.map(({ key, line }) => (
            <LineItem key={key} l={line} />
          ))}
        </ul>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </CardContent>
    </Card>
  );
}

function LineItem({ l }: { l: WhatChangedLine }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="min-w-0 flex-1">
        <span className="font-medium">{GROUP_TITLE[l.group]}: </span>
        {l.text}
      </span>
      {l.draft ? <DraftThisPostButton channel={l.draft.channel} brief={l.draft.brief} /> : null}
    </li>
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
            <LineItem key={l.id} l={l} />
          ))}
        </ul>
      )}
    </div>
  );
}
