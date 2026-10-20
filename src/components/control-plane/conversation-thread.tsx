"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
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
import { cn } from "@/lib/utils";
import { displayTimeZone } from "@/lib/control-plane-activity";
import {
  CONVERSATION_FAILED_TEXT,
  CONVERSATION_LEDE,
  CONVERSATION_OFFLINE_TEXT,
  conversationRefusedText,
  CONVERSATION_REFUSED_TITLE,
  CONVERSATION_SCOPE_NOTE,
  CONVERSATION_TITLE,
  conversationEmptyCopy,
  conversationEmptyReason,
  conversationView,
  groupConversationByDay,
  orderedMessages,
  isNearBottom,
  scrollTopToRestore,
  type PrependAnchor,
  senderLabel,
} from "@/lib/control-plane-conversation";
import { useConversation } from "@/hooks/use-control-plane-conversation";
import { useMerchantContacts } from "@/hooks/use-control-plane";

/**
 * WA M6: the Conversation tab. The signed-in user's own WhatsApp conversation
 * with Peakhour, oldest at the top, with "Load older" above it.
 *
 * Every decision is in `lib/control-plane-conversation.ts`; this file does
 * layout, the hydration-safe clock, and the scroll position.
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
  const conversation = useConversation();
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
  // prepended, so "Load older" never reads as a new message arriving.
  const newestKey = days[days.length - 1]?.items.at(-1)?.key ?? null;

  const scrollRef = useRef<HTMLDivElement>(null);
  // The reader's position before "Load older", restored once that page lands.
  const prependAnchor = useRef<PrependAnchor | null>(null);
  // Whether the reader is at the newest line. Set by the box's scroll events.
  const atBottom = useRef(true);

  // Each time the box mounts (first load, or back from a refusal, a failure or
  // the empty state) it opens on the newest line, whatever the last box said.
  useLayoutEffect(() => {
    if (!showingThread) return;
    atBottom.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [showingThread]);

  useLayoutEffect(() => {
    // Any change in the page count consumes the anchor, whether or not it is
    // the page the anchor was taken for, so a cancelled "Load older" cannot
    // move the reader on some later change. (A refused one adds a page, but the
    // refusal card has replaced the box by then.)
    const anchor = prependAnchor.current;
    prependAnchor.current = null;
    const el = scrollRef.current;
    if (!el) return;
    const top = scrollTopToRestore(anchor, pageCount, el.scrollHeight);
    if (top !== null) el.scrollTop = top;
  }, [pageCount]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !newestKey || !atBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [newestKey, timeZone]);

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

  // The two fetches cancel each other in react-query (each defaults to
  // `cancelRefetch`), so neither button is offered while the other runs.
  const refreshing = conversation.isFetching && !conversation.isFetchingNextPage;
  const busy = conversation.isFetching;

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
          {/* Asking again refetches from the newest page, so access restored
              by an Owner shows without leaving the tab. */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => void conversation.refetch()}
            disabled={busy}
          >
            Try again
          </Button>
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
          {scopeNote}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent className="space-y-4">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            atBottom.current = isNearBottom(e.currentTarget);
          }}
          // `overflow-anchor: none` because the position after "Load older" is
          // restored by hand; a browser's own anchoring would move it twice.
          className="max-h-[32rem] overflow-y-auto rounded-lg border border-border p-3 [overflow-anchor:none]"
        >
          {conversation.hasNextPage && (
            <div className="mb-3 flex flex-col items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={loadOlder}
                disabled={busy}
              >
                {conversation.isFetchingNextPage ? "Loading…" : "Load older"}
              </Button>
              {conversation.isFetchNextPageError && (
                <p role="alert" className="text-xs text-destructive">
                  Could not load older messages. Try again in a moment.
                </p>
              )}
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
                      <li key={key} className={cn("flex", mine ? "justify-end" : "justify-start")}>
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
        </div>

        {conversation.isError && !conversation.isFetchNextPageError && (
          <p role="status" className="text-xs text-muted-foreground">
            Could not check for new messages. Showing the conversation as it was
            last loaded.
          </p>
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
