"use client";

import { useId, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { savedMetaAdAccounts, savedMetaPageId } from "@/lib/integrations-meta";
import { META_CHOOSE_AD_ACCOUNT, metaAdAccountIdLine, metaAdAccountStatus } from "@/lib/meta-ads-view";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CountryPicker } from "@/components/ads/country-picker";
import {
  AD_ACCOUNT_PURPOSES,
  AD_ACCOUNT_TAGS_HELP,
  sameTags,
  savedMetaAdAccountTags,
  tagsForSave,
  withTag,
  type AdAccountPurpose,
  type AdAccountTagMap,
  type AdAccountTags,
} from "@/lib/meta-ad-account-tags";
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
  // The routing tags in progress (MR-F3); null shows what is saved. Sent only once touched, so an untouched save leaves them alone.
  const [tagDraft, setTagDraft] = useState<AdAccountTagMap | null>(null);
  const [saving, setSaving] = useState(false);
  const savedTags = useMemo(() => savedMetaAdAccountTags(extra), [extra]);
  const tags = tagDraft ?? savedTags;
  const ids = draft?.ids ?? saved.enabledIds;
  const defaultId = draft ? draft.defaultId : saved.defaultId;
  // Tags count as changed only when they differ from what is saved (ticking a purpose on and off is not a change).
  const tagsChanged = tagDraft !== null && !sameTags(tagDraft, savedTags);
  const dirty = draft !== null || tagsChanged;
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
      await api.patch("/v1/integrations/facebook/ad-account", {
        enabledIds: ids,
        defaultId,
        ...(tagsChanged && tagDraft ? { tags: tagsForSave(tagDraft, ids) } : {}),
      });
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
      setTagDraft(null);
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
        <div className="rounded-lg border border-border px-3 py-2.5">
          <AdAccountIdentity account={adAccounts[0]!} />
          <AdAccountStatusBadge status={adAccounts[0]!.status} ticked />
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {adAccounts.map((a) => {
              const { blocked } = metaAdAccountStatus(a.status);
              const ticked = ids.includes(a.id);
              // ONE expression drives the radio and the pill, so what is announced is what is shown.
              const isDefault = ticked && defaultId === a.id;
              return (
                <li
                  key={a.id}
                  className={cn(
                    "space-y-2 rounded-lg border px-3 py-2.5 transition-colors",
                    ticked ? "border-primary/40 bg-primary/5" : "border-border",
                    blocked && !ticked && "opacity-70",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={`${uid}-ad-${a.id}`}
                      className="mt-0.5 size-4 shrink-0"
                      checked={ticked}
                      // A disabled or closed account cannot be ticked, but one that is already ticked can be UNticked.
                      disabled={saving || (!!blocked && !ticked)}
                      onChange={() => toggle(a.id)}
                    />
                    <label htmlFor={`${uid}-ad-${a.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <AdAccountIdentity account={a} />
                      <AdAccountStatusBadge status={a.status} ticked={ticked} />
                    </label>
                    <label
                      className={cn(
                        // `relative` keeps the visually hidden radio inside the pill; focus and disabled are read off the input itself.
                        "relative flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs",
                        "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                        "has-[:disabled]:cursor-not-allowed has-[:disabled:not(:checked)]:opacity-50",
                        isDefault ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground",
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`${uid}-default-ad-account`}
                        checked={isDefault}
                        disabled={saving || !ticked || !!blocked}
                        onChange={() => setDraft({ ids, defaultId: a.id })}
                      />
                      {isDefault ? "Default" : "Make default"}
                      <span className="sr-only"> for {a.name || "this ad account"}</span>
                    </label>
                  </div>
                  {ticked ? (
                    <UsedFor
                      name={a.name || a.id}
                      tags={tags[a.id]}
                      disabled={saving}
                      onChange={(next) => setTagDraft({ ...tags, [a.id]: next })}
                    />
                  ) : null}
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setTagDraft(null);
                }}
                className="h-7 px-2 text-xs"
              >
                Cancel
              </Button>
            ) : null}
          </div>
          <p className="text-micro text-muted-foreground">
            The default is where new campaigns go unless you pick another account when you create one.
          </p>
          <p className="text-micro text-muted-foreground">{AD_ACCOUNT_TAGS_HELP}</p>
        </>
      )}
    </div>
  );
}

/**
 * One ad account as a merchant reads it: the name in full on its own line (wrapping, never cut off), then the full account
 * number as Meta Ads Manager shows it, and the billing currency.
 */
function AdAccountIdentity({ account }: { account: MetaAdAccountRow }) {
  return (
    <span className="block min-w-0">
      <span className="block break-words text-sm font-medium leading-snug text-foreground">{account.name || "Ad account"}</span>
      {/* A separator for anything that reads the label as one string (a screen reader's accessible name). */}
      <span className="sr-only">, </span>
      <span className="mt-0.5 block break-words font-mono text-xs tabular-nums text-muted-foreground">{metaAdAccountIdLine(account)}</span>
    </span>
  );
}

/** Meta's word for an account that is not simply active, as a badge under its identity; nothing when it is active. */
function AdAccountStatusBadge({ status, ticked }: { status: number | undefined; ticked: boolean }) {
  const { blocked, warning } = metaAdAccountStatus(status);
  if (!blocked && !warning) return null;
  return (
    <span
      className={cn(
        "mt-1 inline-block rounded-md border px-1.5 py-0.5 text-micro",
        blocked ? "border-destructive/30 bg-destructive/10 text-destructive-on-tint" : "border-warning/30 bg-warning/10 text-warning-on-tint",
      )}
    >
      <span className="sr-only">, </span>
      {blocked ? `${blocked === "disabled" ? "Disabled" : "Closed"} on Meta${ticked ? ", untick to save" : ""}` : warning!.charAt(0).toUpperCase() + warning!.slice(1)}
    </span>
  );
}

/**
 * "Used for" under one enabled ad account (MR-F3): the markets and purposes Peakhour may route an automated
 * campaign to it for. (No Collections picker: no launch input carries collection ids yet, so such a tag could never match.
 * The api keeps the support, and stored collection tags pass through a save untouched.) Empty means untagged: the default account takes what no tag claims. Saved with the panel's one Save.
 */
function UsedFor({
  name,
  tags,
  disabled,
  onChange,
}: {
  name: string;
  tags: AdAccountTags | undefined;
  disabled: boolean;
  onChange: (next: AdAccountTags) => void;
}) {
  const markets = tags?.markets ?? [];
  const purposes = tags?.purposes ?? [];
  const togglePurpose = (id: AdAccountPurpose) =>
    onChange(withTag(tags, "purposes", purposes.includes(id) ? purposes.filter((p) => p !== id) : [...purposes, id]));
  return (
    <fieldset className="ml-7 space-y-2 border-t border-border/60 pt-2" aria-label={`Used for: ${name}`} disabled={disabled}>
      <p className="text-micro font-medium">Used for</p>
      <div className="space-y-0.5">
        <p className="text-micro text-muted-foreground">Markets</p>
        <CountryPicker value={markets} labelFor={name} onChange={(next) => onChange(withTag(tags, "markets", next))} />
      </div>
      <div className="space-y-0.5">
        <p className="text-micro text-muted-foreground">Purpose</p>
        <div className="flex flex-wrap gap-1" role="group" aria-label={`Purpose: ${name}`}>
          {AD_ACCOUNT_PURPOSES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={purposes.includes(p.id)}
              onClick={() => togglePurpose(p.id)}
              className="rounded-full border border-input px-2 py-0.5 text-micro aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
