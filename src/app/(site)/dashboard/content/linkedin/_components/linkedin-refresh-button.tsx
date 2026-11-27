"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { reconnectHref, LINKEDIN_CONTENT_PROVIDER } from "@/lib/integrations-connect";
import { linkedInContentApi } from "@/lib/api/linkedin-content";

/**
 * Every query the LinkedIn post sync writes behind â€” one list, so a page that is
 * added later cannot be left showing yesterday's numbers.
 *
 *  - `linkedin-feed`          the Library: posts and their engagement totals.
 *  - `linkedin-interactions`  the Feed: individual comments, the reply queue and its counts.
 *
 * â˜…BOTH, ALWAYS. The sync writes `soc_linkedin_posts` AND `soc_linkedin_interactions`
 * in one run. A Refresh that re-read only the Library's key left the Feed on its
 * previous rows â€” the post synced on one tab and not the other.
 */
export const LINKEDIN_SYNCED_QUERY_KEYS = [["linkedin-feed"], ["linkedin-interactions"]] as const;

/**
 * "Refresh from LinkedIn" â€” one button for every LinkedIn page.
 *
 * Queues the post sync for this business (`POST /v1/linkedin/content/sync`, which
 * holds a five-minute floor because LinkedIn's quota is the application's), then
 * re-reads every synced query now and again at 20s and 60s: the job takes a few
 * seconds to a minute, and one early re-read would look like nothing happened.
 * The delayed re-reads are cancelled on unmount.
 */
export function LinkedInRefreshButton({ className = "" }: { className?: string }) {
  const queryClient = useQueryClient();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const refresh = useMutation({
    mutationFn: () => linkedInContentApi.syncNow(),
    onSuccess: () => {
      toast.success("Refreshing from LinkedIn", {
        description: "New comments and numbers will show here in about a minute.",
      });
      const reread = () => {
        for (const queryKey of LINKEDIN_SYNCED_QUERY_KEYS) {
          void queryClient.invalidateQueries({ queryKey: [...queryKey] });
        }
      };
      reread();
      clearTimers();
      timers.current = [setTimeout(reread, 20_000), setTimeout(reread, 60_000)];
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "SYNC_TOO_SOON") {
        toast.info("Already refreshed a moment ago", {
          description: "Give it a few minutes, then try again.",
        });
      } else if (err instanceof ApiError && err.code === "NOT_CONNECTED") {
        toast.error("LinkedIn isn't connected", {
          description: "Reconnect it to refresh your posts.",
          action: {
            label: "Reconnect",
            onClick: () => {
              window.location.href = reconnectHref("/dashboard/content/linkedin", LINKEDIN_CONTENT_PROVIDER);
            },
          },
        });
      } else {
        toast.error("Couldn't refresh LinkedIn", { description: "Try again in a moment." });
      }
    },
  });

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={`h-7 gap-1.5 px-2.5 text-xs ${className}`.trim()}
      onClick={() => refresh.mutate()}
      disabled={refresh.isPending}
    >
      <RefreshCw
        className={`size-3.5 ${refresh.isPending ? "animate-spin motion-reduce:animate-none" : ""}`}
      />
      {refresh.isPending ? "Refreshingâ€¦" : "Refresh"}
    </Button>
  );
}
