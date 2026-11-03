"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useStorefrontChats,
  useStorefrontThread,
  useWaConnection,
  useWaConversations,
  useWaHandoff,
  useWaResume,
  useWaThread,
} from "@/hooks/use-wa-conversations";
import { useOrgMembers } from "@/hooks/use-control-plane";
import { useAuth } from "@/providers/auth-provider";
import { WaComposer, useComposerMemory, useReplyWindow } from "@/components/inbox/wa-composer";
import { HeldBadge, useThreadHoldFlow } from "@/components/inbox/legal-hold";
import { Bubble, DaySeparator } from "@/components/inbox/message-bubble";
import { ChannelChip, StatusPill, UnreadDot } from "@/components/inbox/inbox-badges";
import { ManagePanel } from "@/components/inbox/manage-panel";
import { ThreadHeader } from "@/components/inbox/thread-header";
import {
  memberNameLookup,
  replyingAsLine,
  senderLabel,
  statusErrorMessage,
  type ComposerStore,
  type ReplyWindow,
} from "@/lib/wa-inbox-reply";
import { listFetchState, showsRows, showsSkeleton } from "@/lib/list-fetch-state";
import { canExportConversations, downloadConversationExport, expiryBanner, threadExportPath } from "@/lib/wa-conversation-export";
import {
  CHANNEL_FILTERS,
  channelOfThread,
  clockLabel,
  combineListState,
  emptyListText,
  groupByDay,
  handoverAction,
  isUnread,
  browserStorage,
  loadReadMarks,
  markRead,
  mergeRows,
  paneClasses,
  previewTime,
  readMarksKey,
  rowOfStorefront,
  rowOfWhatsApp,
  saveReadMarks,
  waInboxState,
  waNotice,
  type ChannelFilter,
  type InboxRow,
  type ReadMarks,
} from "@/lib/inbox-view";

/**
 * The Conversations tab (Inbox phase 1): WhatsApp and storefront chats in one list, a thread beside it, and, below `lg`, the two as
 * separate views with a back button. Every decision is in `lib/inbox-view.ts` (tested); this is the markup and the wiring.
 */

/** Within this many pixels of the end counts as "at the bottom". */
const NEAR_BOTTOM_PX = 80;

/** One line of either kind of conversation: a storefront line has no source or author. */
interface Line {
  role: string;
  content: string;
  timestamp: string | null;
  source?: "phone" | "inbox";
  authorUserId?: string | null;
}

/** ✅WA T4: the 24h customer-service window, from a ticking clock. */
const WINDOW_TONE: Record<ReplyWindow["tone"], string> = {
  ok: "bg-success/15 text-success-on-tint",
  warning: "bg-warning/15 text-warning-on-tint",
  closed: "bg-muted text-muted-foreground",
};

function WindowBadge({ store, threadId, endsAt }: { store: ComposerStore; threadId: string; endsAt: string | null | undefined }) {
  // ★THE COMPOSER'S OWN READING (`useReplyWindow`), so the two cannot disagree.
  const win = useReplyWindow(store, threadId, endsAt);
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${WINDOW_TONE[win.tone]}`}>{win.label}</span>;
}

/**
 * What a lane says while it is waiting on the network.
 *
 * ★ONE SENTENCE, THREE LANES. A paused query never resolves and never errors, so without this the merchant watches placeholders
 * for ever with nothing to act on.
 */
export function WaitingForConnection({ what }: { what: string }) {
  return <p className="text-center text-xs text-muted-foreground">Waiting for a connection — your {what} will load when you&apos;re back online.</p>;
}

/** The card for a WhatsApp state that is not "ok": connect, reconnect, or not available yet. Never "Couldn't load". */
export function WaNoticeCard({ state }: { state: ReturnType<typeof waInboxState> }) {
  const notice = waNotice(state);
  if (!notice) return null;
  return (
    <div role="status" className="mb-2 rounded-lg border bg-muted/30 p-3 text-sm" data-testid="wa-notice">
      <p className="font-medium">{notice.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{notice.body}</p>
      {notice.cta && (
        <Button asChild size="sm" className="mt-2">
          <Link href={notice.cta.href}>{notice.cta.label}</Link>
        </Button>
      )}
    </div>
  );
}

export function ConversationsPane({
  role,
  selected,
  onSelect,
  composerStore,
}: {
  role: string | null;
  selected: string | null;
  onSelect: (threadId: string | null) => void;
  composerStore: ComposerStore;
}) {
  const { user, business } = useAuth();
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const wa = useWaConversations({ expiringOnly });
  const storefront = useStorefrontChats({ expiringOnly });

  // ── the list ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const waState = waInboxState({ data: wa.data, error: wa.error });
  // ★A 404 IS "NOT AVAILABLE YET", NOT A FAILURE: that half is settled (empty), and its card says so.
  const waFetch = waState === "not_available" ? "empty" : listFetchState(wa, wa.conversations.length);
  const sfFetch = listFetchState(storefront, storefront.chats.length);
  const rows = useMemo(
    () => mergeRows(waState === "not_available" ? [] : wa.conversations.map(rowOfWhatsApp), storefront.chats.map(rowOfStorefront), channel),
    [waState, wa.conversations, storefront.chats, channel],
  );
  // a filter ignores the half it does not show, so a failure there is not this list's
  const listState = combineListState(channel === "storefront" ? "empty" : waFetch, channel === "whatsapp" ? "empty" : sfFetch, rows.length);
  const retryList = () => {
    if (channel !== "storefront") void wa.refetch();
    if (channel !== "whatsapp") void storefront.refetch();
  };
  const notice = channel === "storefront" ? null : <WaNoticeCard state={waState} />;
  const expiry = expiryBanner(wa.expiringCount, wa.expiringFrom);

  // ── the unread dot: kept in this browser ──────────────────────────────────────────────────────────────────────────────
  const marksKey = readMarksKey(user?._id, business?._id);
  // ★KEYED BY THE KEY IT WAS LOADED UNDER: when the person or business changes, the old marks are not the new ones. Held as one value so
  //  a save can never pair one key's marks with another key's name.
  const [loaded, setLoaded] = useState<{ key: string; marks: ReadMarks } | null>(null);
  const marks = loaded && loaded.key === marksKey ? loaded.marks : null;
  const setMarks = (next: ReadMarks) => setLoaded({ key: marksKey, marks: next });
  useEffect(() => {
    // read after mount: storage does not exist on the server render (and may not be reachable in the browser)
    setLoaded({ key: marksKey, marks: loadReadMarks(browserStorage(), marksKey, new Date()) });
  }, [marksKey]);
  // ★EVERY CHANGE IS SAVED, THE FIRST LOAD INCLUDED. The baseline ("this browser first saw the Inbox") is only a baseline if it
  //  survives a visit in which nothing was opened; saved only on a click, it was "now" again on every load and the dot missed
  //  everything that arrived while the merchant was away. (A side effect, so it is here and not inside a state updater.)
  useEffect(() => {
    if (marks) saveReadMarks(browserStorage(), marksKey, marks);
  }, [marks, marksKey]);
  const open = (row: Pick<InboxRow, "threadId">) => onSelect(row.threadId);

  // ── the open conversation ─────────────────────────────────────────────────────────────────────────────────────────────
  const selectedChannel = selected ? channelOfThread(selected) : null;
  const waThreadQuery = useWaThread(selectedChannel === "whatsapp" ? selected : null);
  const sfThreadQuery = useStorefrontThread(selectedChannel === "storefront" ? selected : null);
  const waThread = waThreadQuery.data;
  const sfThread = sfThreadQuery.data;
  const threadQuery = selectedChannel === "storefront" ? sfThreadQuery : waThreadQuery;
  const messages: Line[] | undefined = selectedChannel === "storefront" ? sfThread?.messages : waThread?.messages;
  // ★AND THE SAME `enabled`-GATED TRAP: with no thread selected the query is pending and idle for ever. Silent rather than false.
  const threadState = listFetchState(threadQuery, messages?.length ?? 0);
  const handoff = useWaHandoff();
  const resume = useWaResume();
  const members = useOrgMembers();
  const connection = useWaConnection(selectedChannel === "whatsapp");
  const memberName = memberNameLookup(members.data);
  // ★NO HAND-BACK WHILE A REPLY IS IN FLIGHT (review R3): the api escalated before sending, and a Resume landing mid-send gives
  //  the shopper the AI's answer and the person's reply at once.
  const replyInFlight = useComposerMemory(composerStore, selected ?? "").pending;

  // ★THE OPEN CONVERSATION IS READ, HOWEVER IT WAS OPENED (a click, an alert email's link, the Manage list) AND WHILE IT STAYS OPEN:
  //  a message that arrives on the poll of a conversation you are looking at does not bring its dot back.
  const selectedActivity = selected ? (rows.find((r) => r.threadId === selected)?.activityAt ?? null) : null;
  // ...but only once it LOADED: a conversation that failed to open (a 404, offline) was not read
  const selectedLoaded = selectedChannel === "storefront" ? Boolean(sfThread) : Boolean(waThread);
  useEffect(() => {
    if (!selected || !marks || !selectedLoaded) return;
    const row = { threadId: selected, activityAt: selectedActivity };
    const unread = selectedActivity ? isUnread(row, marks) : marks.reads[selected] === undefined;
    if (unread) setMarks(markRead(marks, row, new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setMarks only closes over marksKey, which `marks` already tracks
  }, [selected, selectedActivity, selectedLoaded, marks]);

  // H2: conversation export is for owner and admin (the API enforces it; this only decides what to show)
  const canExport = canExportConversations(role);
  const [exporting, setExporting] = useState(false);
  async function runExport(path: string | null) {
    if (exporting) return; // one at a time: a double click would spend the rate limit on itself
    if (!path) {
      toast.error("Choose the first day to export from, and a last day only if you want one (a real date).");
      return;
    }
    setExporting(true);
    let out: Awaited<ReturnType<typeof downloadConversationExport>>;
    try {
      out = await downloadConversationExport(path);
    } finally {
      setExporting(false);
    }
    if (out.ok) toast.success(`Saved ${out.filename}`);
    else toast.error(out.message);
  }

  const hold = useThreadHoldFlow({ threadId: selected ?? "", held: (selectedChannel === "storefront" ? sfThread?.held : waThread?.held) ?? null, role });

  // ── open at the newest message ────────────────────────────────────────────────────────────────────────────────────────
  const scroller = useRef<HTMLDivElement>(null);
  const lastShown = messages?.length ?? 0;
  // ★ONLY WHILE THE READER IS AT THE BOTTOM (or has just opened the conversation): the thread polls, and a new message must not
  //  yank someone away from the earlier ones they scrolled up to read.
  const atBottom = useRef(true);
  useEffect(() => {
    atBottom.current = true;
  }, [selected]);
  useEffect(() => {
    const el = scroller.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [selected, lastShown]);

  const panes = paneClasses(selected);
  const now = new Date();
  const days = useMemo(() => groupByDay(messages ?? [], new Date()), [messages]);
  // a bubble's key is its place in the whole conversation, not in its day, so a message arriving never re-keys the ones before it
  const lineKeys = useMemo(() => new Map((messages ?? []).map((m, i) => [m, i] as const)), [messages]);
  const contactName = selectedChannel === "storefront" ? sfThread?.contactName : waThread?.contactName;
  const takeover = waThread ? handoverAction(waThread.status) : null;

  return (
    <>
      {/* H2: the same count the weekly email states. Shown only when something is about to be deleted. */}
      {expiry && (
        <div role="status" className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">{expiry.heading}</p>
          <p className="mt-0.5 text-muted-foreground">{expiry.body}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setExpiringOnly((v) => !v)}>
            {expiringOnly ? "Show all conversations" : "Show only those"}
          </Button>
        </div>
      )}
      {/* H2: the way back from the filter even when the count is gone (the last expiring conversation was exported and aged out) */}
      {expiringOnly && !expiry && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground">Showing only conversations about to be deleted.</p>
          <Button size="sm" variant="outline" onClick={() => setExpiringOnly(false)}>
            Show all conversations
          </Button>
        </div>
      )}

      <div className={`mb-3 flex items-center justify-between gap-2 ${selected ? "max-lg:hidden" : ""}`}>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="Channel">
          {CHANNEL_FILTERS.map((f) => (
            <Button key={f.value} size="xs" variant={channel === f.value ? "default" : "outline"} aria-pressed={channel === f.value} onClick={() => setChannel(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
        <ManagePanel role={role} canExport={canExport} exporting={exporting} onRunExport={runExport} onOpenThread={(id) => onSelect(id)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Thread list */}
        <Card className={`max-h-[70vh] overflow-y-auto p-2 ${panes.list}`}>
          {notice}
          {/* ⚠️★★★`showsSkeleton` — `waiting` is a disabled query, and a skeleton for it never resolves. */}
          {showsSkeleton(listState) && (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}
          {listState === "paused" && (
            <div className="p-2">
              <WaitingForConnection what="conversations" />
            </div>
          )}
          {listState === "error" && (
            <div className="space-y-2 p-4 text-center">
              <p className="text-sm font-medium">Couldn&apos;t load your conversations</p>
              <p className="text-xs text-muted-foreground">This is a problem loading the list, not an empty inbox.</p>
              <Button size="sm" variant="outline" onClick={retryList}>
                Retry
              </Button>
            </div>
          )}
          {listState === "empty" && <p className="p-4 text-sm text-muted-foreground">{emptyListText(channel, waState)}</p>}
          {/* ⚠️★★★A FAILED REFRESH SAYS SO WITHOUT TAKING THE ROWS AWAY. This lane polls every thirty seconds, so `error` here is
              usually a failed BACKGROUND refetch with the last good list still behind it. */}
          {listState === "stale" && (
            <p className="px-2 pb-1 text-[11px] text-muted-foreground">
              Couldn&apos;t refresh just now — showing the last update.{" "}
              <button onClick={retryList} className="underline underline-offset-2">
                Retry
              </button>
            </p>
          )}
          {showsRows(listState) &&
            rows.map((row) => {
              const unread = marks ? isUnread(row, marks) : false;
              return (
                <button
                  key={row.threadId}
                  onClick={() => open(row)}
                  className={`flex w-full min-w-0 flex-col gap-0.5 rounded-lg p-2.5 text-left hover:bg-muted ${selected === row.threadId ? "bg-muted" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {unread && <UnreadDot />}
                      <span className={`truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}>{row.title}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{previewTime(row.updatedAt, now)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <ChannelChip channel={row.channel} />
                    <HeldBadge held={row.held} />
                    <StatusPill status={row.status} needsYou={row.needsYou} />
                  </div>
                  <span className="truncate text-xs text-muted-foreground">{row.preview || "…"}</span>
                </button>
              );
            })}
        </Card>

        {/* Thread view */}
        <Card className={`h-[calc(100dvh-13rem)] min-h-0 flex-col overflow-hidden p-0 lg:h-auto lg:max-h-[70vh] ${panes.thread}`}>
          {!selected && <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">Select a conversation to view it.</div>}
          {selected && (
            <>
              <ThreadHeader
                title={contactName || (selectedChannel === "storefront" ? "Storefront visitor" : selected.split(":").slice(2).join(":"))}
                channel={selectedChannel ?? "whatsapp"}
                status={(selectedChannel === "storefront" ? sfThread?.status : waThread?.status) ?? "active"}
                needsYou={selectedChannel === "whatsapp" && waThread?.needsYou === true}
                held={(selectedChannel === "storefront" ? sfThread?.held : waThread?.held) ?? null}
                windowBadge={
                  selectedChannel === "whatsapp" && waThread ? <WindowBadge store={composerStore} threadId={waThread.threadId} endsAt={waThread.replyWindowEndsAt} /> : null
                }
                onBack={() => onSelect(null)}
                hold={{ available: hold.available && (selectedChannel === "storefront" ? Boolean(sfThread) : Boolean(waThread)), label: hold.label, start: () => void hold.start() }}
                canExport={canExport}
                exporting={exporting}
                onExport={() => runExport(threadExportPath(selected))}
                handover={
                  selectedChannel === "whatsapp" && waThread && waThread.threadId === selected && takeover
                    ? {
                        label: takeover.label,
                        variant: takeover.variant,
                        pending: takeover.kind === "return" ? resume.isPending : handoff.isPending,
                        disabled: takeover.kind === "return" ? resume.isPending || replyInFlight : handoff.isPending,
                        onClick: () =>
                          takeover.kind === "return"
                            ? resume.mutate(
                                { threadId: selected, thread: waThread },
                                {
                                  onSuccess: () => toast.success("Handed back — the assistant will reply again."),
                                  onError: (e: Error) => toast.error(statusErrorMessage(e, "hand back")),
                                },
                              )
                            : handoff.mutate(selected, {
                                onSuccess: () => toast.success("You've taken over. The assistant won't reply to this shopper until you return it."),
                                onError: (e: Error) => toast.error(statusErrorMessage(e, "take over")),
                              }),
                      }
                    : null
                }
              />
              {hold.dialog}
              <div
                ref={scroller}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
                }}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/40 p-3"
              >
                {threadState === "loading" && <Skeleton className="h-20 w-full" />}
                {threadState === "paused" && <WaitingForConnection what="messages" />}
                {threadState === "error" && <p className="p-4 text-center text-sm text-muted-foreground">Couldn&apos;t load this conversation. Try again in a moment.</p>}
                {days.map((g, gi) => (
                  <div key={g.key + gi} className="space-y-2">
                    <DaySeparator label={g.label} />
                    {g.items.map((m) => (
                      <Bubble
                        key={lineKeys.get(m) ?? 0}
                        role={m.role}
                        content={m.content}
                        time={clockLabel(m.timestamp)}
                        sender={senderLabel(m, { contactName: contactName ?? null, currentUserId: user?._id ?? null, memberName })}
                      />
                    ))}
                  </div>
                ))}
                {threadState === "empty" && <p className="p-4 text-center text-sm text-muted-foreground">No messages.</p>}
              </div>
              {/* A web visitor cannot be messaged back, so a storefront chat has no composer, and says why. */}
              {selectedChannel === "storefront" && sfThread && (
                <div className="border-t bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    This chat is on your storefront. The visitor gave no way to reach them, so it is here to read, not to reply to.
                  </p>
                </div>
              )}
              {/* ✅WA T4: the composer. ★KEYED BY THREAD, so a draft written to one shopper can never be sent to the next one opened.
                  It sits outside the scrolling pane, so on a phone it stays at the bottom while the messages scroll. */}
              {selectedChannel === "whatsapp" && waThread && waThread.threadId === selected && (
                <div className="sticky bottom-0 border-t bg-background">
                  <WaComposer
                    key={selected}
                    threadId={selected}
                    status={waThread.status}
                    role={role}
                    endsAt={waThread.replyWindowEndsAt}
                    replyingAs={replyingAsLine(selected, connection.data)}
                    store={composerStore}
                  />
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
