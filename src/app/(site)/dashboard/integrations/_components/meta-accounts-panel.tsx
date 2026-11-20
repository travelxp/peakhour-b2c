"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { savedMetaAdAccounts, savedMetaPageId } from "@/lib/integrations-meta";
import { META_CHOOSE_AD_ACCOUNT, metaAdAccountOptionLabel, metaAdAccountStatus } from "@/lib/meta-ads-view";
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
 * The ad accounts: a business may use SEVERAL, with one default for new spend (api `helpers/meta-saved-ad-account.ts`).
 * A Meta login lists the ad accounts of EVERY business it reaches, so with two or more the merchant ticks the ones that
 * are this business's; one account needs no choice.
 *
 * Refresh re-reads the Pages from Meta, so a Page added or an Instagram account linked since connecting shows up
 * without reconnecting.
 */
export function MetaAccountsPanel({
  extra,
  onRefresh,
  refreshing,
  onChanged,
  showAdAccounts = true,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>;
  onRefresh: () => void;
  refreshing: boolean;
  onChanged?: () => void | Promise<unknown>;
  /** The ad accounts checklist lives on ONE card: here only when no Meta Ads card is live. */
  showAdAccounts?: boolean;
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

      {showAdAccounts ? <MetaAdAccountPicker extra={extra} onChanged={onChanged} /> : null}
    </div>
  );
}

/**
 * "Ad accounts Peakhour may use": a checklist of the login's ad accounts, one marked Default. On the Facebook Pages card
 * (inside the Meta accounts panel) AND on the Meta Ads card: a login that connected only for ads has no Pages card.
 *
 * ★SAVED WITH A BUTTON, NOT ON EACH TICK: a business picks its set and its default together, and the api refuses a
 * default that is not ticked. An account Meta marks disabled or closed is shown and cannot be ticked.
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
  // Unique per instance, so two pickers on one page never share an id or a radio group.
  const uid = useId();
  const adAccounts: MetaAdAccountRow[] = (Array.isArray(extra?.adAccounts) ? extra.adAccounts : []).filter(
    (a: MetaAdAccountRow) => typeof a?.id === "string" && a.id !== "",
  );
  const saved = savedMetaAdAccounts(extra);
  // The edit in progress; null shows what is saved (and follows the list behind `extra` when it reloads).
  const [draft, setDraft] = useState<{ ids: string[]; defaultId?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const ids = draft?.ids ?? saved.enabledIds;
  const defaultId = draft ? draft.defaultId : saved.defaultId;
  const dirty = draft !== null;
  // An account Meta now says is disabled or closed that is still ticked: it can be unticked but not saved until it is.
  const stillTickedBlocked = adAccounts.some((a) => ids.includes(a.id) && !!metaAdAccountStatus(a.status).blocked);
  const canSave = dirty && ids.length > 0 && !!defaultId && ids.includes(defaultId) && !stillTickedBlocked;

  function toggle(id: string) {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    // The first ticked account is the default; unticking the default hands it to the next one still ticked.
    const nextDefault = defaultId && next.includes(defaultId) ? defaultId : next[0];
    setDraft({ ids: next, defaultId: nextDefault });
  }

  async function save() {
    if (!canSave || !defaultId) return;
    setSaving(true);
    try {
      await api.patch("/v1/integrations/facebook/ad-account", { enabledIds: ids, defaultId });
      // Growth reads the enabled accounts and their campaigns from the api: refetch them now.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meta-ads-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["content-hub-integrations"] }),
        // The Growth signal step offers the enabled accounts too: it must never offer one just unticked.
        queryClient.invalidateQueries({ queryKey: ["growth-v2", "signal"] }),
      ]);
      toast.success("Peakhour will use those ad accounts.");
      await onChanged?.();
      setDraft(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.code === "AD_ACCOUNT_NOT_FOUND"
          ? "One of those ad accounts is no longer on your Meta login. Refresh and try again."
          : err instanceof ApiError && err.code === "AD_ACCOUNT_DISABLED"
            ? err.message
            : "Couldn't save the ad accounts. Try again in a moment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1" aria-label="Ad accounts">
      <p className="text-micro text-muted-foreground">Ad accounts Peakhour may use</p>
      {adAccounts.length === 0 ? (
        <p className="text-micro text-muted-foreground">No ad accounts found.</p>
      ) : adAccounts.length === 1 && saved.enabledIds.includes(adAccounts[0]!.id) ? (
        // One listed account that is already the business's: a line. A saved choice that no longer matches it falls to the
        // checklist below, so it can be enabled.
        <p className="text-xs font-medium">{metaAdAccountOptionLabel(adAccounts[0]!)}</p>
      ) : (
        <>
          <ul className="space-y-1">
            {adAccounts.map((a) => {
              const { blocked, warning } = metaAdAccountStatus(a.status);
              const ticked = ids.includes(a.id);
              return (
                <li key={a.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    id={`${uid}-ad-${a.id}`}
                    checked={ticked}
                    // A disabled or closed account cannot be ticked, but one that is already ticked can be UNticked.
                    disabled={saving || (!!blocked && !ticked)}
                    onChange={() => toggle(a.id)}
                  />
                  <label htmlFor={`${uid}-ad-${a.id}`} className="min-w-0 flex-1 truncate">
                    {metaAdAccountOptionLabel(a)}
                    {blocked ? (ticked ? `, ${blocked} on Meta, untick to save` : `, ${blocked}`) : ""}
                    {warning ? `, ${warning}` : ""}
                  </label>
                  <label className="flex shrink-0 items-center gap-1 text-micro text-muted-foreground">
                    <input
                      type="radio"
                      name={`${uid}-default-ad-account`}
                      aria-label={`Default: ${a.name || a.id}`}
                      checked={defaultId === a.id}
                      disabled={saving || !ticked || !!blocked}
                      onChange={() => setDraft({ ids, defaultId: a.id })}
                    />
                    Default
                  </label>
                </li>
              );
            })}
          </ul>
          {ids.length === 0 ? (
            <p role="status" className="text-micro text-warning-on-tint">
              {META_CHOOSE_AD_ACCOUNT}
            </p>
          ) : null}
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => void save()} disabled={!canSave || saving} className="h-7 px-2 text-xs">
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Save ad accounts
            </Button>
            {dirty && !saving ? (
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)} className="h-7 px-2 text-xs">
                Cancel
              </Button>
            ) : null}
          </div>
          <p className="text-micro text-muted-foreground">
            The default is where new campaigns go unless you pick another account when you create one.
          </p>
        </>
      )}
    </div>
  );
}
