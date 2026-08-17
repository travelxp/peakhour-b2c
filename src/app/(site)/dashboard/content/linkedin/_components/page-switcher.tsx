"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { removeLinkedInPageScopedQueries } from "@/lib/linkedin-cache";
import type { LinkedInIdentity } from "@/lib/api/linkedin-content";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

/**
 * Which Company Page the whole product is currently answering about.
 *
 * ★NOT A FILTER, AND THE DIFFERENCE MATTERS. A filter is something you apply to
 * a view; this changes what every Content and Growth surface means — the
 * Library archive, the Feed queue, the Audience pulse, the Boost shortlist, the
 * campaign list and the Lead Gen Forms all re-scope together. It sits in the
 * hub header rather than inside a tab for that reason: a control that lived on
 * one tab would imply it only governed that tab.
 *
 * ★AND IT IS DELIBERATELY SINGLE-SELECT. A multi-select defaulting to
 * "everything" is what the product had before — every Page merged into one
 * answer, with no way to tell which row belonged to which brand. Re-introducing
 * it as a filter would recreate that the first time somebody left it on its
 * default.
 */
export function PageSwitcher({ identity }: { identity: LinkedInIdentity | undefined }) {
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState<string | null>(null);

  const pages = identity?.pages ?? [];

  // ★A SINGLE PAGE IS NOT A CHOICE — render the name, not a control.
  // Offering a dropdown with one item asks a question that has one answer, and
  // makes the header look like something is configurable when nothing is.
  if (pages.length === 0) return null;

  // ★`activePageId` ABSENT (not null) MEANS THE API DOES NOT SCOPE YET.
  // Production runs behind master, and a switcher that wrote `activeResourceId`
  // against a deploy where nothing reads it would silently do nothing — the
  // user would pick a Page, watch the panels not change, and report the bug
  // again. Show the Page, without the affordance, until the field arrives.
  const scopingLive = identity !== undefined && identity.activePageId !== undefined;
  const activeId = identity?.activePageId ?? null;
  const active = pages.find((p) => p.id === activeId) ?? null;

  if (pages.length === 1 || !scopingLive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Building2 className="size-4 shrink-0" />
        {active?.name ?? pages[0].name}
      </span>
    );
  }

  async function switchTo(pageId: string) {
    if (pageId === activeId) return;
    setSwitching(pageId);
    try {
      await api.patch("/v1/integrations/linkedin_content/capabilities", {
        capability: "pages",
        // The per-Page enabled set is owned by the Manage-Pages dialog. This
        // control changes WHICH enabled Page is active and nothing else, so it
        // re-asserts `enabled: true` rather than toggling anything off.
        enabled: true,
        activeResourceId: pageId,
      });
      // ★Content AND Growth, and REMOVED rather than invalidated — a mounted
      // panel goes on rendering cached rows through an invalidation, so the
      // seconds after the switch would show the previous brand under the new
      // Page name. See linkedin-cache.ts.
      removeLinkedInPageScopedQueries(queryClient);
    } catch (err) {
      // ★Matched on the TYPED code, not on the message text. `ApiError` carries
      // `code` for exactly this; a `message.includes(...)` test passes only
      // while the server's prose happens to contain the identifier, and starts
      // silently falling through to the generic copy the day somebody rewords
      // it. Never the raw error either — "PAGE_NOT_ENABLED" tells a user
      // nothing they can act on.
      toast.error(
        err instanceof ApiError && err.code === "PAGE_NOT_ENABLED"
          ? "That Page is no longer enabled for this workspace. Re-enable it under Integrations."
          : "Couldn't switch Page. Try again in a moment.",
      );
    } finally {
      setSwitching(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={switching !== null}>
          {switching ? (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          ) : (
            <Building2 className="size-4 shrink-0" />
          )}
          <span className="max-w-[16rem] truncate">{active?.name ?? "Choose a Page"}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Everything below is scoped to this Page
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pages.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => void switchTo(p.id)}
            className="justify-between gap-2"
          >
            <span className="truncate">{p.name}</span>
            {p.id === activeId ? <Check className="size-4 shrink-0" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
