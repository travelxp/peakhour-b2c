"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { savedMetaPageId } from "@/lib/integrations-meta";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MetaPageRow {
  pageId: string;
  pageName?: string;
  instagramAccountId?: string;
  instagramUsername?: string;
}

interface MetaAdAccountRow {
  id: string;
  name?: string;
  currency?: string;
  /** Meta's account_status: 1 is active. */
  status?: number;
}

/** The words for one Page's Instagram link. A linked account whose profile could not be read has no username. */
export function instagramLine(page: MetaPageRow): string {
  if (!page.instagramAccountId) return "No Instagram linked";
  return page.instagramUsername ? `Instagram @${page.instagramUsername}` : "Instagram linked";
}

/**
 * Meta accounts: the Facebook Pages Meta lists for this login, the Instagram account linked to each, the
 * ad accounts, and which Page Peakhour uses.
 *
 * ★ONE CHOICE, AND IT IS THE PAGE. Posts, the Facebook and Instagram pages, comments and the Page an ad is
 * published as all follow it (api `helpers/meta-saved-page.ts`); Instagram follows the Page's linked account.
 * Ad accounts are listed, not picked: a campaign names its ad account when it is made, so there is no single
 * stored one to change here.
 *
 * Refresh re-reads the Pages from Meta, so a Page added or an Instagram account linked since connecting shows up
 * without reconnecting.
 */
export function MetaAccountsPanel({
  extra,
  onRefresh,
  refreshing,
  onChanged,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>;
  onRefresh: () => void;
  refreshing: boolean;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const pages: MetaPageRow[] = Array.isArray(extra?.pages) ? extra.pages : [];
  const adAccounts: MetaAdAccountRow[] = Array.isArray(extra?.adAccounts) ? extra.adAccounts : [];
  const activeId = savedMetaPageId(extra);

  async function choose(pageId: string) {
    if (pageId === activeId) return;
    setSaving(true);
    try {
      await api.patch("/v1/integrations/facebook/capabilities", {
        capability: "pages",
        // This changes WHICH Page is used and nothing else: keep the Pages switch as it is.
        enabled: extra?.capabilities?.pages?.enabled !== false,
        activeResourceId: pageId,
      });
      // ★The Facebook and Instagram pages and the comments screen cache their Page lists for a minute; refetch
      // them now so a change here shows there at once.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meta-content"] }),
        queryClient.invalidateQueries({ queryKey: ["meta-comments"] }),
      ]);
      onChanged?.();
      toast.success("Peakhour will use that Page.");
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.code === "PAGE_NOT_FOUND"
          ? "That Page is no longer on your Facebook login. Refresh your Pages and try again."
          : "Couldn't change the Page. Try again in a moment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border/40 p-2" aria-label="Meta accounts">
      <div className="flex items-center justify-between gap-2">
        <p className="text-micro font-medium">Meta accounts</p>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={refreshing} className="h-6 gap-1 px-1.5 text-micro">
          <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      {pages.length === 0 ? (
        <p className="text-micro text-muted-foreground">
          No Facebook Pages found. Refresh after you are given access to one.
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="space-y-1">
            <p className="text-micro text-muted-foreground">Page Peakhour uses</p>
            {pages.length > 1 && activeId ? (
              <div className="flex items-center gap-1.5">
                <Select value={activeId} onValueChange={(v) => void choose(v)} disabled={saving}>
                  <SelectTrigger className="h-7 text-xs" aria-label="Page Peakhour uses">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((p) => (
                      <SelectItem key={p.pageId} value={p.pageId}>
                        {p.pageName || `Page ${p.pageId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {saving ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
              </div>
            ) : (
              <p className="text-xs font-medium">{pages[0]!.pageName || `Page ${pages[0]!.pageId}`}</p>
            )}
          </div>
          <ul className="space-y-0.5 text-micro text-muted-foreground" aria-label="Pages and their Instagram accounts">
            {pages.map((p) => (
              <li key={p.pageId} className="truncate">
                {p.pageName || `Page ${p.pageId}`}: {instagramLine(p)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-0.5">
        <p className="text-micro text-muted-foreground">Ad accounts</p>
        {adAccounts.length === 0 ? (
          <p className="text-micro text-muted-foreground">No ad accounts found.</p>
        ) : (
          <ul className="space-y-0.5 text-micro text-muted-foreground" aria-label="Ad accounts">
            {adAccounts.map((a) => (
              <li key={a.id} className="truncate">
                {a.name || a.id}
                {a.currency ? ` (${a.currency})` : ""}
                {a.status !== undefined && a.status !== 1 ? ", not active" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
