"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCategorySearch } from "@/hooks/use-presence-edit";
import { MIN_CATEGORY_QUERY, categoryQueryReady, errorWords, type CategoryOption } from "@/lib/presence-edit";

/**
 * Search the network's own category list as you type. The id is what a change is written with, so a category can only be PICKED, never typed.
 * Loading, empty, error and paused are each said; nothing is asked until enough is typed.
 */
export function CategoryPicker({
  listingId,
  network,
  onPick,
  exclude,
}: {
  listingId: string;
  network: string;
  onPick: (c: CategoryOption) => void;
  exclude: readonly string[];
}) {
  const [typed, setTyped] = useState("");
  const q = useCategorySearch(listingId, network, typed);
  const ready = categoryQueryReady(typed);
  const items = (q.data?.items ?? []).filter((c) => !exclude.includes(c.id));

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={`cat-${network}`}>
        Search categories
      </label>
      <Input id={`cat-${network}`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Start typing, for example bakery" autoComplete="off" />
      {!ready ? (
        <p className="text-xs text-muted-foreground">Type at least {MIN_CATEGORY_QUERY} letters. The list matches the start of a category name.</p>
      ) : q.isError ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-destructive">{errorWords(q.error)}</p>
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      ) : q.isPending ? (
        <p className="text-xs text-muted-foreground">{q.fetchStatus === "paused" ? "Waiting for a connection." : "Searching..."}</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No category starts with that. Try the first letters of the name.</p>
      ) : (
        <ul className="max-h-48 divide-y overflow-auto rounded-md border">
          {items.map((c) => (
            <li key={c.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => onPick(c)}>
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
