"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { savedMetaAdAccountId, savedMetaPageId } from "@/lib/integrations-meta";
import { META_CHOOSE_AD_ACCOUNT, metaAdAccountOptionLabel } from "@/lib/meta-ads-view";
import { Button } from "@/components/ui/button";
import { MetaMessagingSwitches } from "./meta-messaging-switches";
import { DM_STATUS_KEY } from "@/lib/meta-dm";
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
 * ★TWO CHOICES, ONE EACH. The Page: posts, the Facebook and Instagram pages, comments and the Page an ad is
 * published as all follow it (api `helpers/meta-saved-page.ts`); Instagram follows the Page's linked account.
 * The ad account: every campaign Peakhour creates, starts or edits goes to it, and Growth shows it as the active
 * one (api `helpers/meta-saved-ad-account.ts`). A Meta login lists the ad accounts of EVERY business it reaches,
 * so with two or more the merchant must choose; one account needs no choice.
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
  onChanged?: () => void | Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  // Rows without a usable id cannot be picked (a Select item may not have an empty value) and the api never saves one.
  const pages: MetaPageRow[] = (Array.isArray(extra?.pages) ? extra.pages : []).filter(
    (p: MetaPageRow) => typeof p?.pageId === "string" && p.pageId !== "",
  );
  // The pick shows at once; the integrations list behind `extra` follows when `onChanged` has reloaded it.
  const [picked, setPicked] = useState<string | null>(null);
  const activeId = picked && pages.some((p) => p.pageId === picked) ? picked : savedMetaPageId(extra);

  async function choose(pageId: string) {
    if (pageId === activeId) return;
    setSaving(true);
    setPicked(pageId);
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
        // Messenger and Instagram messages follow the Page: the switches under the picker re-read it.
        queryClient.invalidateQueries({ queryKey: DM_STATUS_KEY }),
      ]);
      toast.success("Peakhour will use that Page.");
      await onChanged?.();
    } catch (err) {
      setPicked(null);
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
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={refreshing || saving} className="h-6 gap-1 px-1.5 text-micro">
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
          {/* Not while a pick is being saved: the status still describes the old Page until it is re-read. */}
          <MetaMessagingSwitches pageId={activeId} hidden={saving} />
          <ul className="space-y-0.5 text-micro text-muted-foreground" aria-label="Pages and their Instagram accounts">
            {pages.map((p) => (
              <li key={p.pageId} className="truncate">
                {p.pageName || `Page ${p.pageId}`}: {instagramLine(p)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <MetaAdAccountPicker extra={extra} onChanged={onChanged} />
    </div>
  );
}

/**
 * The "Ad account Peakhour uses" picker. On the Facebook Pages card (inside the Meta accounts panel) AND on the Meta
 * Ads card: a login that connected only for ads has no Pages card to choose on.
 */
export function MetaAdAccountPicker({
  extra,
  onChanged,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>;
  onChanged?: () => void | Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const adAccounts: MetaAdAccountRow[] = (Array.isArray(extra?.adAccounts) ? extra.adAccounts : []).filter(
    (a: MetaAdAccountRow) => typeof a?.id === "string" && a.id !== "",
  );
  // The ad account, the same way: the pick shows at once, the list behind `extra` follows when `onChanged` reloads it.
  const [pickedAd, setPickedAd] = useState<string | null>(null);
  const [savingAd, setSavingAd] = useState(false);
  const activeAdId = pickedAd && adAccounts.some((a) => a.id === pickedAd) ? pickedAd : savedMetaAdAccountId(extra);

  async function chooseAdAccount(adAccountId: string) {
    if (adAccountId === activeAdId) return;
    setSavingAd(true);
    setPickedAd(adAccountId);
    try {
      await api.patch("/v1/integrations/facebook/ad-account", { adAccountId });
      // Growth reads the active account and its campaigns from the api: refetch them now.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meta-ads-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["content-hub-integrations"] }),
      ]);
      toast.success("Peakhour will use that ad account.");
      await onChanged?.();
    } catch (err) {
      setPickedAd(null);
      toast.error(
        err instanceof ApiError && err.code === "AD_ACCOUNT_NOT_FOUND"
          ? "That ad account is no longer on your Meta login. Refresh and try again."
          : err instanceof ApiError && err.code === "AD_ACCOUNT_NOT_ACTIVE"
            ? "That ad account is not active on Meta. Pick another."
            : "Couldn't change the ad account. Try again in a moment.",
      );
    } finally {
      setSavingAd(false);
    }
  }

  return (
    <div className="space-y-1" aria-label="Ad account">
      <p className="text-micro text-muted-foreground">Ad account Peakhour uses</p>
      {adAccounts.length === 0 ? (
        <p className="text-micro text-muted-foreground">No ad accounts found.</p>
      ) : adAccounts.length === 1 ? (
        <p className="text-xs font-medium">{metaAdAccountOptionLabel(adAccounts[0]!)}</p>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <Select value={activeAdId} onValueChange={(v) => void chooseAdAccount(v)} disabled={savingAd}>
              <SelectTrigger className="h-7 text-xs" aria-label="Ad account Peakhour uses">
                <SelectValue placeholder="Choose an ad account" />
              </SelectTrigger>
              <SelectContent>
                {adAccounts.map((a) => {
                  // An account Meta marks not active cannot run ads, and the api refuses it: shown, not pickable.
                  const inactive = a.status !== undefined && a.status !== 1;
                  return (
                    <SelectItem key={a.id} value={a.id} disabled={inactive}>
                      {metaAdAccountOptionLabel(a)}
                      {inactive ? ", not active" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {savingAd ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
          </div>
          {!activeAdId ? (
            <p role="status" className="text-micro text-warning-on-tint">
              {META_CHOOSE_AD_ACCOUNT}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
