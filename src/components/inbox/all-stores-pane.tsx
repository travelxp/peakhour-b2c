"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllStoresConversations } from "@/hooks/use-all-stores-inbox";
import { useAuth } from "@/providers/auth-provider";
import { AssigneeBadge, TimerChip } from "@/components/inbox/desk-badges";
import { ChannelChip, StatusPill, TestChip } from "@/components/inbox/inbox-badges";
import { WaitingForConnection } from "@/components/inbox/conversations-pane";
import { ASSIGNEE_FILTERS, type AssigneeFilter } from "@/lib/inbox-desk";
import { ALL_STORES_EMPTY, ALL_STORES_NOTE, openAllStoresRow, rowOfAllStores, storeChipLabel, type AllStoresRow } from "@/lib/inbox-all-stores";
import { DEFAULT_STATUS_FILTER, STATUS_FILTERS, visibleChannelFilters, previewTime, type Channel, type ChannelFilter, type StatusFilter } from "@/lib/inbox-view";
import { listFetchState, showsRows, showsSkeleton } from "@/lib/list-fetch-state";

/**
 * "All my stores" (I3f): a read-only list of the conversations in every store the person belongs to, each row naming its store.
 * Opening a row SWITCHES THE SESSION to that row's store and then opens the conversation there (`openAllStoresRow`), so the session
 * stays pinned to one store and every action still runs inside it. Nothing here replies, assigns or marks done.
 */
export function AllStoresPane({ onOpen }: { onOpen: (threadId: string) => void }) {
  const { business, switchBusiness } = useAuth();
  const [status, setStatus] = useState<StatusFilter>(DEFAULT_STATUS_FILTER);
  const [assignee, setAssignee] = useState<AssigneeFilter>("all");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [store, setStore] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const list = useAllStoresConversations({ status, assignee, channel, store }, true);
  const rows = list.conversations.map(rowOfAllStores);
  // Messenger, Instagram and X chips show only for channels the loaded conversations are on (or the one chosen)
  // ...and once seen they stay, so choosing a channel (or a store) that happens to be empty does not hide the others
  const [everSeen, setEverSeen] = useState<ReadonlySet<Channel>>(new Set());
  const seenNow = rows.map((r) => r.channel);
  if (seenNow.some((c) => !everSeen.has(c))) setEverSeen(new Set([...everSeen, ...seenNow]));
  const seenChannels = [...everSeen];
  const state = listFetchState(list, rows.length);
  const now = new Date();

  async function open(row: AllStoresRow) {
    if (opening) return; // a double click is one switch
    setOpening(row.threadId);
    const res = await openAllStoresRow({ row, activeBusinessId: business?._id, switchBusiness, open: onOpen });
    setOpening(null);
    if (!res.ok) toast.error(res.message);
  }

  return (
    <div data-testid="all-stores-pane">
      <p className="mb-3 text-xs text-muted-foreground">{ALL_STORES_NOTE}</p>
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Status">
          {STATUS_FILTERS.map((f) => (
            <Button key={f.value} size="xs" variant={status === f.value ? "default" : "outline"} aria-pressed={status === f.value} onClick={() => setStatus(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Assignee">
          {ASSIGNEE_FILTERS.map((f) => (
            <Button key={f.value} size="xs" variant={assignee === f.value ? "secondary" : "ghost"} aria-pressed={assignee === f.value} onClick={() => setAssignee(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Channel">
          {visibleChannelFilters(seenChannels, channel).map((f) => (
            <Button key={f.value} size="xs" variant={channel === f.value ? "secondary" : "ghost"} aria-pressed={channel === f.value} onClick={() => setChannel(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Store">
          <Button size="xs" variant={store === null ? "secondary" : "ghost"} aria-pressed={store === null} onClick={() => setStore(null)}>
            All stores
          </Button>
          {list.stores.map((s) => (
            <Button key={s.id} size="xs" variant={store === s.id ? "secondary" : "ghost"} aria-pressed={store === s.id} onClick={() => setStore(s.id)}>
              {storeChipLabel(s)}
            </Button>
          ))}
        </div>
        {list.capNote && <p className="text-xs text-muted-foreground">{list.capNote}</p>}
      </div>

      <Card className="max-h-[70vh] overflow-y-auto p-2">
        {showsSkeleton(state) && (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {state === "paused" && (
          <div className="p-2">
            <WaitingForConnection what="conversations" />
          </div>
        )}
        {state === "error" && (
          <div className="space-y-2 p-4 text-center">
            <p className="text-sm font-medium">Couldn&apos;t load your conversations</p>
            <p className="text-xs text-muted-foreground">This is a problem loading the list, not an empty inbox.</p>
            <Button size="sm" variant="outline" onClick={() => void list.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {state === "empty" && <p className="p-4 text-sm text-muted-foreground">{ALL_STORES_EMPTY}</p>}
        {showsRows(state) &&
          rows.map((row) => (
            <button
              key={`${row.businessId}:${row.threadId}`}
              disabled={opening !== null}
              onClick={() => void open(row)}
              className="flex w-full min-w-0 flex-col gap-0.5 rounded-lg p-2.5 text-left hover:bg-muted disabled:opacity-60"
              data-testid="all-stores-row"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{row.title}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <AssigneeBadge assignee={row.assignee} />
                  <span className="text-[11px] text-muted-foreground">{previewTime(row.updatedAt, now)}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium" data-testid="store-chip">
                  {row.businessName}
                </span>
                <ChannelChip channel={row.channel} />
                {row.test && <TestChip />}
                <StatusPill status={row.status} needsYou={row.needsYou} state={row.state} />
                <TimerChip timer={row.timer} />
              </div>
              <span className="truncate text-xs text-muted-foreground">{row.preview || "..."}</span>
            </button>
          ))}
        {showsRows(state) && list.hasNextPage && (
          <div className="p-2 text-center">
            <Button size="sm" variant="outline" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
              {list.isFetchingNextPage ? "Loading..." : "Show more conversations"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
