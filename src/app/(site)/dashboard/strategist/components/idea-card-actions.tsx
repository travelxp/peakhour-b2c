"use client";

import { useState } from "react";
import { Star, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setIdeaStarred, deleteIdea } from "@/lib/api/content";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Reusable Star + Delete control for any pipeline idea card/header.
 *
 * - Star toggles a pin (optimistic). A starred idea is protected: the Delete
 *   button is disabled (and the API refuses with 409 as a backstop) until it's
 *   unstarred — "cannot be deleted unless unstarred".
 * - Delete asks for confirmation, then permanently removes the idea.
 *
 * Self-contained (owns its API calls + busy state); the host passes the idea
 * id/title/starred and an `onChanged` callback to refresh its own list/view.
 * Stops click propagation so it can sit on a clickable card without triggering
 * navigation.
 */
export function IdeaCardActions({
  ideaId,
  title,
  starred,
  onChanged,
  size = "sm",
}: {
  ideaId: string;
  title: string;
  starred: boolean;
  /** Called after a successful star toggle or delete so the host can refresh. */
  onChanged?: (change: { starred?: boolean; deleted?: boolean }) => void;
  size?: "sm" | "md";
}) {
  const [optimisticStarred, setOptimisticStarred] = useState(starred);
  const [busyStar, setBusyStar] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const iconCls = size === "sm" ? "size-3.5" : "size-4";

  async function toggleStar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busyStar) return;
    const next = !optimisticStarred;
    setOptimisticStarred(next);
    setBusyStar(true);
    try {
      await setIdeaStarred(ideaId, next);
      onChanged?.({ starred: next });
    } catch {
      setOptimisticStarred(!next); // revert
      toast.error("Couldn't update star");
    } finally {
      setBusyStar(false);
    }
  }

  async function confirmDelete() {
    if (busyDelete) return;
    setBusyDelete(true);
    try {
      await deleteIdea(ideaId);
      toast.success("Idea deleted");
      onChanged?.({ deleted: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete idea");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <TooltipProvider delayDuration={250}>
      {/* Stop propagation so actions never trigger the card's own onClick. */}
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleStar}
              disabled={busyStar}
              aria-pressed={optimisticStarred}
              aria-label={optimisticStarred ? "Unstar" : "Star"}
              className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-amber-500"
            >
              {busyStar ? (
                <Loader2 className={cn(iconCls, "animate-spin")} />
              ) : (
                <Star className={cn(iconCls, optimisticStarred && "fill-amber-400 text-amber-500")} />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{optimisticStarred ? "Unstar" : "Star (protect from delete)"}</TooltipContent>
        </Tooltip>

        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* span wrapper keeps the tooltip working while the button is disabled */}
              <span className="inline-flex">
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={optimisticStarred || busyDelete}
                    aria-label="Delete idea"
                    className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/50"
                  >
                    {busyDelete ? <Loader2 className={cn(iconCls, "animate-spin")} /> : <Trash2 className={iconCls} />}
                  </button>
                </AlertDialogTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent>{optimisticStarred ? "Unstar to delete" : "Delete"}</TooltipContent>
          </Tooltip>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this idea?</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{title}&rdquo; will be removed from your pipeline. We archive it (not
                destroyed) and use the signal to improve your future recommendations. Star an
                idea first if you want to keep it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
