"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { creativeApi, type PostIdea, type PostIdeasResponse } from "@/lib/api/creative";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { QueryError } from "@/components/dashboard/query-error";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { commerceStoresQuery } from "@/hooks/use-commerce-stores";
import { useAuth } from "@/providers/auth-provider";
import { STUDIO_KEYS, useStudioAvailability, usePostIdeas } from "@/hooks/use-studio";
import { createDismissals } from "@/lib/studio-dismissals";
import { capabilityState, hiddenUntilLine, ideasFeedStatus, STUDIO_ROUTES, type IdeasFeedStatus } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { IdeaCard } from "./idea-card";

const C = STUDIO_COPY.ideas;

/** How long the "Undo" toast stays up. The dismissal is already sent; Undo asks the api to take it back. */
export const UNDO_WINDOW_MS = 6_000;

/**
 * The feed, drawn from what it is told (UX spec S1). Free of data fetching so every state can be rendered and tested on its own:
 * loading skeletons, offline, error (never an empty list), the two empty states, and the cards with their banner.
 */
export function IdeasFeedView({
  status,
  ideas,
  previewsComingSoon,
  storeConnected,
  onRetry,
  onNotNow,
  announcement = "",
  locale,
}: {
  status: IdeasFeedStatus;
  ideas: PostIdea[];
  previewsComingSoon: boolean;
  /** false = no store is connected (the empty state then says so); true or undefined = plain empty. */
  storeConnected?: boolean;
  onRetry: () => void;
  onNotNow: (idea: PostIdea) => void;
  /** Polite live-region text ("Idea hidden."). */
  announcement?: string;
  locale?: string;
}) {
  return (
    <section aria-labelledby="studio-ideas-title" className="space-y-4">
      <h2 id="studio-ideas-title" tabIndex={-1} className="text-lg font-semibold outline-none">
        {C.sectionTitle}
      </h2>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {status === "loading" && (
        <div aria-busy="true" aria-label={C.loading} className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      )}
      {status === "offline" && <QueryError what={C.error.what} kind="offline" />}
      {status === "error" && <QueryError what={C.error.what} onRetry={onRetry} />}
      {status === "ready" && ideas.length === 0 && storeConnected === false && (
        <EmptyState
          icon={Lightbulb}
          title={C.notConnected.title}
          description={C.notConnected.description}
          action={{ label: C.notConnected.action, href: "/dashboard/integrations" }}
        />
      )}
      {status === "ready" && ideas.length === 0 && storeConnected !== false && (
        <EmptyState
          icon={Lightbulb}
          title={C.empty.title}
          description={C.empty.description}
          action={{ label: C.startFromScratch, href: STUDIO_ROUTES.new }}
        />
      )}
      {status === "ready" && ideas.length > 0 && (
        <>
          {previewsComingSoon && <p className="rounded-md bg-muted px-3 py-2 text-sm">{C.previewsOpenSoon}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {ideas.map((idea, i) => (
              <IdeaCard key={idea.id} idea={idea} index={i} onNotNow={onNotNow} locale={locale} />
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{C.footerNote}</p>
            <Button asChild variant="outline" className="h-11">
              <Link href={STUDIO_ROUTES.new}>{C.startFromScratch}</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/**
 * Studio home's feed: the ideas query plus "Not now" with undo.
 *
 * Dismiss: the card leaves at once, the dismissal is sent at once, and a toast offers Undo for {@link UNDO_WINDOW_MS}. Undo calls the api's
 * un-dismiss (it waits for the dismissal if that is still on its way) and puts the card back. A 404 means the idea is already gone: drop it
 * silently and refetch. Any other failure puts the card back and says so. Nothing is held in the page, so leaving it loses nothing.
 */
export function IdeasFeed() {
  const qc = useQueryClient();
  const ideas = usePostIdeas();
  const availability = useStudioAvailability();
  const status = ideasFeedStatus(ideas);
  const list = ideas.data?.ideas;

  // Connected stores are read only to tell "no ideas" from "no store", and only when the list is empty.
  const empty = status === "ready" && list?.length === 0;
  const { isAuthenticated, business } = useAuth();
  const stores = useQuery(commerceStoresQuery(business?._id, isAuthenticated && empty));
  const storeConnected = empty && stores.data ? stores.data.length > 0 : undefined;
  // An empty list is not "no ideas" until we know whether a store is connected: wait for that read instead of flashing the wrong words.
  const waitingForStores = empty && stores.isPending && stores.fetchStatus === "fetching";

  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const unhide = useCallback((id: string) => {
    setHidden((h) => {
      const n = new Set(h);
      n.delete(id);
      return n;
    });
  }, []);

  const removeFromCache = useCallback(
    (id: string) =>
      qc.setQueriesData<PostIdeasResponse>({ queryKey: [STUDIO_KEYS.ideas] }, (old) =>
        old ? { ...old, ideas: old.ideas.filter((i) => i.id !== id) } : old,
      ),
    [qc],
  );

  // After an Undo the card goes back where it was; the refetch that follows has the api's last word.
  const restoreToCache = useCallback(
    (idea: PostIdea, at: number) => {
      qc.setQueriesData<PostIdeasResponse>({ queryKey: [STUDIO_KEYS.ideas] }, (old) => {
        if (!old || old.ideas.some((i) => i.id === idea.id)) return old;
        const next = [...old.ideas];
        next.splice(Math.min(at, next.length), 0, idea);
        return { ...old, ideas: next };
      });
      void qc.invalidateQueries({ queryKey: [STUDIO_KEYS.ideas] });
    },
    [qc],
  );

  // The toast offering Undo for each idea, so it can be closed the moment the dismissal fails (a hovered toast outlives its window), and
  // the place each card held, so Undo puts it back there.
  const [toastIds] = useState(() => new Map<string, string | number>());
  const [places] = useState(() => new Map<string, number>());

  const dismissals = useMemo(
    () =>
      createDismissals<PostIdea>({
        dismiss: (idea) => creativeApi.dismissPostIdea(idea.id),
        undismiss: (idea) => creativeApi.undismissPostIdea(idea.id),
        isGone: isNotFound,
      }),
    [],
  );

  const closeToast = useCallback(
    (id: string) => {
      const tid = toastIds.get(id);
      toastIds.delete(id);
      if (tid !== undefined) toast.dismiss(tid);
    },
    [toastIds],
  );

  const onNotNow = useCallback(
    (idea: PostIdea) => {
      const visible = (list ?? []).filter((i) => !hidden.has(i.id));
      const at = visible.findIndex((i) => i.id === idea.id);
      const next = visible[at + 1] ?? visible[at - 1];
      places.set(idea.id, (list ?? []).findIndex((i) => i.id === idea.id));
      setHidden((h) => new Set(h).add(idea.id));
      setAnnouncement(C.ideaHidden);
      // Focus moves to the next card's primary button, so a keyboard user is not dropped at the top of the page.
      requestAnimationFrame(() => {
        const els = rootRef.current?.querySelectorAll<HTMLElement>("[data-idea-make]") ?? [];
        const target = next ? Array.from(els).find((el) => el.dataset.ideaMake === next.id) : undefined;
        // The last card has no neighbour: focus the section heading rather than let focus fall to the page.
        (target ?? rootRef.current?.querySelector<HTMLElement>("#studio-ideas-title"))?.focus();
      });
      void dismissals.hide(idea).then((outcome) => {
        if (outcome === "hidden") {
          removeFromCache(idea.id);
          return;
        }
        // Not dismissed: the card is back, and so is the answer for the merchant.
        closeToast(idea.id);
        unhide(idea.id);
        if (outcome === "gone") {
          removeFromCache(idea.id);
          void qc.invalidateQueries({ queryKey: [STUDIO_KEYS.ideas] });
        } else {
          toast.error(C.dismissFailed);
        }
      });
      const tid = toast(hiddenUntilLine(idea, ideas.data?.coolingDays ?? 14, new Date()), {
        duration: UNDO_WINDOW_MS,
        action: {
          label: C.undo,
          onClick: () => {
            toastIds.delete(idea.id);
            void dismissals.undo(idea).then((outcome) => {
              if (outcome === "restored") {
                restoreToCache(idea, places.get(idea.id) ?? 0);
                unhide(idea.id);
                setAnnouncement(C.ideaBack);
              } else if (outcome === "failed") {
                toast.error(C.undoFailed);
              }
            });
          },
        },
      });
      toastIds.set(idea.id, tid);
    },
    [hidden, list, ideas.data?.coolingDays, dismissals, qc, removeFromCache, restoreToCache, unhide, closeToast, toastIds, places],
  );

  return (
    <div ref={rootRef}>
      <IdeasFeedView
        status={waitingForStores ? "loading" : status}
        ideas={(list ?? []).filter((i) => !hidden.has(i.id))}
        previewsComingSoon={!availability.loading && capabilityState(availability, "previews") === "coming_soon"}
        storeConnected={storeConnected}
        onRetry={() => void ideas.refetch()}
        onNotNow={onNotNow}
        announcement={announcement}
      />
    </div>
  );
}
