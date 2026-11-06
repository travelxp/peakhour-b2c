"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInsights } from "@/hooks/use-insights";
import { expiredNote, searchWithTopic } from "@/lib/insights";

/**
 * "Showing conversations about: <title>" with a way to remove the filter. The title and the aged-out count come from the same Insights
 * read the tab used (already cached when the merchant came from a card); a topic the read does not name is shown without a title
 * rather than guessed at.
 */
export function TopicFilterBanner({ topic }: { topic: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const insights = useInsights();
  const item = insights.data?.items?.find((i) => i.key === topic);
  const aged = item ? expiredNote(item.evidence.expired) : null;

  function clear() {
    // the address as it is NOW, so removing the topic never undoes a tab click that has not reached `params` yet
    const current = typeof window === "undefined" ? params.toString() : window.location.search.replace(/^\?/, "");
    router.replace(`${pathname}?${searchWithTopic(current, null)}`, { scroll: false });
  }

  return (
    <div data-topic-banner className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p>
          Showing conversations about <span className="font-medium">{item ? item.title : "one topic"}</span>
        </p>
        {aged && <p className="text-xs text-muted-foreground">{aged}</p>}
      </div>
      <Button size="xs" variant="ghost" onClick={clear}>
        <X aria-hidden="true" /> Remove filter
      </Button>
    </div>
  );
}
