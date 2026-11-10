"use client";

import { useSyncExternalStore } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAGE_INTRO_COPY, type PageIntroId } from "@/lib/page-intro-copy";
import {
  dismissPageIntro,
  isPageIntroDismissed,
  subscribePageIntro,
} from "@/lib/page-intro-store";

interface PageIntroProps {
  /** Key into PAGE_INTRO_COPY; also the dismissal key. */
  id: PageIntroId;
  className?: string;
}

/**
 * A dismissible "What is this page?" strip for pages a new merchant cannot
 * guess at. Says what the page is for and the first thing to do. Once closed
 * it stays closed on this device (localStorage, guarded; see page-intro-store).
 *
 * The server and the first client render both show it (the server snapshot is
 * "not dismissed"), so there is no hydration mismatch and no blank gap; a
 * merchant who already closed it sees it vanish on mount.
 */
export function PageIntro({ id, className }: PageIntroProps) {
  const dismissed = useSyncExternalStore(
    subscribePageIntro,
    () => isPageIntroDismissed(id),
    () => false
  );
  if (dismissed) return null;
  const copy = PAGE_INTRO_COPY[id];

  return (
    <aside
      aria-label={copy.title}
      data-page-intro={id}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm",
        className
      )}
    >
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{copy.title}</p>
        <p className="text-muted-foreground">{copy.body}</p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Start here: </span>
          {copy.next}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => dismissPageIntro(id)}
      >
        <X className="size-4" />
        <span className="sr-only">Hide this tip</span>
      </Button>
    </aside>
  );
}
