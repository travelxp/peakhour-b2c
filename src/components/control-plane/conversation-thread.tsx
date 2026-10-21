"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { MessagesSquare, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { displayTimeZone } from "@/lib/control-plane-activity";
import {
  anchorDayLabel,
  anchorKeyPart,
  autoLoadDirection,
  CONVERSATION_FAILED_TEXT,
  CONVERSATION_LEDE,
  CONVERSATION_OFFLINE_TEXT,
  CONVERSATION_RECENT_NOTE,
  conversationQuietWindowText,
  conversationRefusedText,
  CONVERSATION_REFUSED_TITLE,
  CONVERSATION_SCOPE_NOTE,
  CONVERSATION_TITLE,
  conversationEmptyCopy,
  conversationEmptyReason,
  conversationView,
  dayKeyIn,
  groupConversationByDay,
  isDayKey,
  LATEST_ANCHOR,
  orderedMessages,
  isNearBottom,
  scrollTopToRestore,
  shouldFollowNewest,
  windowPlacement,
  type ConversationAnchor,
  type PrependAnchor,
  senderLabel,
} from "@/lib/control-plane-conversation";
import { useConversation } from "@/hooks/use-control-plane-conversation";
import { useMerchantContacts } from "@/hooks/use-control-plane";

/**
 * WA M6: the Conversation tab. The signed-in user's own WhatsApp conversation
 * with Peakhour on this business, oldest at the top.
 *
 * Owner answers 2026-10-21: only this business's turns (item 19, decided by the
 * api), and it opens on the last 3 days, loads older messages as the reader
 * scrolls up, and can jump to a date (item 20).
 *
 * Every decision is in `lib/control-plane-conversation.ts`; this file does
 * layout, the hydration-safe clock, the scroll position and the observers.
 */

/**
 * The display zone, and `null` until the browser has it. The zone fallback
 * differs between the server and the browser, so it is read only after
 * hydration (the same `useSyncExternalStore` read as the Activity tab).
 */
function useDisplayZone(timeZonePreference: string | null | undefined): string | null {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return mounted ? displayTimeZone(timeZonePreference) : null;
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      <div className="h-10 w-2/3 rounded bg-muted animate-pulse" />
      <div className="ml-auto h-10 w-1/2 rounded bg-muted animate-pulse" />
      <div className="h-10 w-3/5 rounded bg-muted animate-pulse" />
    </div>
  );
}

/** The scroll box's attribute naming a line, so a jump can find it. */
const LINE_ATTR = "data-conversation-line";

export function ConversationThread({
  timeZonePreference,
  currentUserId,
  isAdmin,
  numbersHref,
}: {
  /** The viewer's own zone, when they have set one. */
  timeZonePreference: string | null | undefined;
  currentUserId: string | null;
  isAdmin: boolean;
  /** The Numbers & routing tab, with the page's other parameters kept. */
  numbersHref: string;
}) {
  const [anchor, setAnchor] = useState<ConversationAnchor>(LATEST_ANCHOR);
  const anchorPart = anchorKeyPart(anchor);
  const conversation = useConversation(anchor);
  const contacts = useMerchantContacts();
  const timeZone = useDisplayZone(timeZonePreference);

  const pages = conversation.data?.pages;
  const view = conversationView({
    entries: pages,
    status: conversation.status,
    fetchStatus: conversation.fetchStatus,
  });

  // Grouped on the pages alone (a stable reference until the cache changes),
  // so a fetch starting or ending does not regroup and reformat every line.
  const days = useMemo(
    () =>
      pages && timeZone
        ? groupConversationByDay(orderedMessages(pages), { locale: undefined, timeZone })
        : [],
    [pages, timeZone],
  );
  const showingThread = view.kind === "messages" && timeZone !== null;

  const pageCount = conversation.data?.pages.length ?? 0;
  // The newest line's own key, which does not change when older pages are
  // prepended, so loading older never reads as a new message arriving.
  const newestKey = days[days.length - 1]?.items.at(-1)?.key ?? null;
  // The line the tab opened on: the first of its window, or, for a quiet
  // window, the nearest newer line.
  const placement = pages ? windowPlacement(pages) : null;
  const windowLineKey = placement
    ? (days.flatMap((d) => d.items)[placement.index]?.key ?? null)
    : null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const bottomSentinel = useRef<HTMLDivElement>(null);
  // The reader's position before an older page was asked for, restored once
  // that page lands.
  const prependAnchor = useRef<PrependAnchor | null>(null);
  // Whether the reader is at the newest line. Set by the box's scroll events.
  const atBottom = useRef(true);
  // Whether the previous render's bottom was the live end (nothing newer to
  // load). Read by the follow effect BEFORE the effect below updates it.
  const wasAtLiveEnd = useRef(true);
  const [topVisible, setTopVisible] = useState(false);
  const [bottomVisible, setBottomVisible] = useState(false);

  // Each time the box mounts (first load, a jump, or back from a refusal, a
  // failure or the empty state) it opens where the tab was asked to open: the
  // newest line, or the first line of the day it jumped to.
  useLayoutEffect(() => {
    if (!showingThread) return;
    const el = scrollRef.current;
    if (!el) return;
    if (anchor.kind === "day") {
      const target = windowLineKey
        ? el.querySelector<HTMLElement>(`[${LINE_ATTR}="${CSS.escape(windowLineKey)}"]`)
        : null;
      if (target) {
        // Leave room for the day's heading above its first line.
        el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top - 40;
      } else {
        el.scrollTop = el.scrollHeight;
      }
      atBottom.current = isNearBottom(el);
      return;
    }
    atBottom.current = true;
    el.scrollTop = el.scrollHeight;
    // Only on mount and on a jump: later pages keep the reader where they are.
  }, [showingThread, anchorPart]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    // Any change in the page count consumes the anchor, whether or not it is
    // the page the anchor was taken for, so a cancelled older load cannot move
    // the reader on some later change. (A refused one adds a page, but the
    // refusal card has replaced the box by then.)
    const anchorBefore = prependAnchor.current;
    prependAnchor.current = null;
    const el = scrollRef.current;
    if (!el) return;
    const top = scrollTopToRestore(anchorBefore, pageCount, el.scrollHeight);
    if (top !== null) el.scrollTop = top;
  }, [pageCount]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !newestKey) return;
    if (!shouldFollowNewest(atBottom.current, wasAtLiveEnd.current)) return;
    el.scrollTop = el.scrollHeight;
  }, [newestKey, timeZone]);

  useLayoutEffect(() => {
    wasAtLiveEnd.current = !conversation.hasPreviousPage;
  });

  // The two ends of the box: in view means "load more that way".
  useEffect(() => {
    if (!showingThread) return;
    const root = scrollRef.current;
    const top = topSentinel.current;
    const bottom = bottomSentinel.current;
    if (!root || !top || !bottom || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === top) setTopVisible(entry.isIntersecting);
          if (entry.target === bottom) setBottomVisible(entry.isIntersecting);
        }
      },
      // Start loading a little before the reader reaches the very end.
      { root, rootMargin: "120px 0px" },
    );
    observer.observe(top);
    observer.observe(bottom);
    return () => {
      observer.disconnect();
      setTopVisible(false);
      setBottomVisible(false);
    };
  }, [showingThread, anchorPart]);

  function loadOlder() {
    const el = scrollRef.current;
    if (el) {
      prependAnchor.current = {
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        pages: pageCount,
      };
    }
    void conversation.fetchNextPage();
  }

  function loadNewer() {
    // Appended below the reader, so nothing on screen moves.
    void conversation.fetchPreviousPage();
  }

  const direction = autoLoadDirection({
    topVisible,
    bottomVisible,
    hasOlder: conversation.hasNextPage,
    hasNewer: conversation.hasPreviousPage,
    isFetching: conversation.isFetching,
    olderFailed: conversation.isFetchNextPageError,
    newerFailed: conversation.isFetchPreviousPageError,
  });
  useEffect(() => {
    if (!showingThread || direction === null) return;
    if (direction === "older") loadOlder();
    else loadNewer();
    // `pageCount` re-asks after each page: a box still too short to scroll
    // keeps its sentinel in view without a new intersection event.
  }, [direction, showingThread, pageCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // A refresh (not a page) is running. The fetches cancel each other in
  // react-query, so no button is offered while any of them runs.
  const loadingPage = conversation.isFetchingNextPage || conversation.isFetchingPreviousPage;
  const refreshing = conversation.isFetching && !loadingPage;
  const busy = conversation.isFetching;

  // ── Jump to a date ──
  const [jumpValue, setJumpValue] = useState("");
  function jump(day: string) {
    if (!timeZone || !isDayKey(day)) return;
    setAnchor({ kind: "day", day, timeZone });
  }
  const dayLabel = anchorDayLabel(anchor, undefined);

  const header = (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <MessagesSquare className="size-4" aria-hidden />
        <h2 className="text-base font-semibold">{CONVERSATION_TITLE}</h2>
      </CardTitle>
      <CardDescription>{CONVERSATION_LEDE}</CardDescription>
    </CardHeader>
  );

  const scopeNote = (
    <p className="text-xs text-muted-foreground">{CONVERSATION_SCOPE_NOTE}</p>
  );

  const backToLatest = anchor.kind === "day" && (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        setJumpValue("");
        setAnchor(LATEST_ANCHOR);
      }}
    >
      Back to latest
    </Button>
  );

  if (view.kind === "refused") {
    return (
      <Card>
        {header}
        <CardContent>
          <div
            role="alert"
            className="flex gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">{CONVERSATION_REFUSED_TITLE}</p>
              <p>{conversationRefusedText(view.reason)}</p>
            </div>
          </div>
          {/* Asking again refetches from the page it opened on, so access
              restored by an Owner shows without leaving the tab. */}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void conversation.refetch()}
            disabled={conversation.isFetching}
          >
            {conversation.isFetching ? "Checking…" : "Check again"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (view.kind === "failed") {
    return (
      <Card>
        {header}
        <CardContent className="space-y-3">
          <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {CONVERSATION_FAILED_TEXT}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void conversation.refetch()}
              disabled={busy}
            >
              Try again
            </Button>
            {backToLatest}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (view.kind === "offline") {
    return (
      <Card>
        {header}
        <CardContent>
          <p role="status" className="text-sm text-muted-foreground">
            {CONVERSATION_OFFLINE_TEXT}
          </p>
        </CardContent>
      </Card>
    );
  }

  // The empty state names a reason from the contacts read, so it waits for that
  // read rather than flash one reason and then another.
  const contactsWaiting = contacts.isPending && contacts.fetchStatus === "fetching";

  if (view.kind === "loading" || !timeZone || (view.kind === "empty" && contactsWaiting)) {
    return (
      <Card>
        {header}
        <CardContent>
          <Skeleton label="Loading your conversation" />
        </CardContent>
      </Card>
    );
  }

  if (view.kind === "empty") {
    const copy = conversationEmptyCopy(
      conversationEmptyReason(contacts.data, currentUserId),
      isAdmin,
    );
    return (
      <Card>
        {header}
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {copy.text}
            {copy.link && (
              <>
                {" "}
                {/* `replace`, as the page's own tab switch: a tab is not a
                    place, so Back leaves the page rather than walking tabs. */}
                <Link href={numbersHref} replace scroll={false} className="underline">
                  {copy.link.label}
                </Link>
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              // The contacts too: the reason above is read from them, and a code
              // entered on another device changes it.
              onClick={() => {
                void conversation.refetch();
                void contacts.refetch();
              }}
              disabled={busy}
            >
              {refreshing ? "Checking…" : "Check for new messages"}
            </Button>
            {backToLatest}
          </div>
          {scopeNote}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            jump(jumpValue);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="conversation-jump" className="text-xs">
              Jump to a date
            </Label>
            <Input
              id="conversation-jump"
              type="date"
              className="h-8 w-auto"
              // Today in the display zone, read when the picker is opened rather
              // than during render, so it is never a day stale.
              onFocus={(e) => {
                if (timeZone) e.currentTarget.max = dayKeyIn(Date.now(), timeZone);
              }}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={!isDayKey(jumpValue)}>
            Go
          </Button>
          {backToLatest}
        </form>

        {placement?.empty && (
          <p role="status" className="text-sm text-muted-foreground">
            {conversationQuietWindowText(anchor, dayLabel)}
          </p>
        )}

        <div
          ref={scrollRef}
          onScroll={(e) => {
            atBottom.current = isNearBottom(e.currentTarget);
          }}
          // `overflow-anchor: none` because the position after an older page is
          // restored by hand; a browser's own anchoring would move it twice.
          className="max-h-[32rem] overflow-y-auto rounded-lg border border-border p-3 [overflow-anchor:none]"
        >
          <div ref={topSentinel} aria-hidden className="h-px" />
          {conversation.isFetchingNextPage && (
            <p role="status" className="mb-3 text-center text-xs text-muted-foreground">
              Loading older messages…
            </p>
          )}
          {conversation.isFetchNextPageError && (
            <div className="mb-3 flex flex-col items-center gap-1">
              <p role="alert" className="text-xs text-destructive">
                Could not load older messages.
              </p>
              <Button variant="outline" size="sm" onClick={loadOlder} disabled={busy}>
                Try again
              </Button>
            </div>
          )}

          <ol className="space-y-4" aria-label={CONVERSATION_TITLE}>
            {days.map((day) => (
              <li key={day.key} className="space-y-2">
                <p className="text-center text-xs font-medium text-muted-foreground">
                  {day.label}
                </p>
                <ol className="space-y-2">
                  {day.items.map(({ key, message, time }) => {
                    const mine = message.sender === "merchant";
                    return (
                      <li
                        key={key}
                        {...{ [LINE_ATTR]: key }}
                        className={cn("flex", mine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                            mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                          )}
                        >
                          <p className="sr-only">{senderLabel(message.sender)}:</p>
                          <p className="whitespace-pre-wrap break-words">{message.text}</p>
                          <time
                            dateTime={message.sentAt}
                            className={cn(
                              "mt-1 block text-right text-xs tabular-nums",
                              mine ? "text-primary-foreground/80" : "text-muted-foreground",
                            )}
                          >
                            {time}
                          </time>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>

          {conversation.isFetchingPreviousPage && (
            <p role="status" className="mt-3 text-center text-xs text-muted-foreground">
              Loading newer messages…
            </p>
          )}
          {conversation.isFetchPreviousPageError && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <p role="alert" className="text-xs text-destructive">
                Could not load newer messages.
              </p>
              <Button variant="outline" size="sm" onClick={loadNewer} disabled={busy}>
                Try again
              </Button>
            </div>
          )}
          <div ref={bottomSentinel} aria-hidden className="h-px" />
        </div>

        {conversation.isError &&
          !conversation.isFetchNextPageError &&
          !conversation.isFetchPreviousPageError && (
            <p role="status" className="text-xs text-muted-foreground">
              Could not check for new messages. Showing the conversation as it was
              last loaded.
            </p>
          )}

        {anchor.kind === "latest" && (
          <p className="text-xs text-muted-foreground">{CONVERSATION_RECENT_NOTE}</p>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => void conversation.refetch()}
          disabled={busy}
        >
          {refreshing ? "Checking…" : "Check for new messages"}
        </Button>

        {scopeNote}
      </CardContent>
    </Card>
  );
}
