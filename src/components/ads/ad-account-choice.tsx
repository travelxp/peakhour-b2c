"use client";

import { useId, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { AD_ACCOUNT_SAVE_CODES, adAccountFormat, savedAdAccounts, type AdAccountFormat, type AdAccountRow } from "@/lib/ad-account-choice";
import { adsErrorMessage } from "@/lib/ads-error-message";
import { CHOOSE_AD_ACCOUNTS } from "@/lib/ad-account-copy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CountryPicker } from "@/components/ads/country-picker";
import {
  AD_ACCOUNT_PURPOSES,
  AD_ACCOUNT_TAGS_HELP,
  sameTags,
  savedAdAccountTags,
  tagsForSave,
  withTag,
  type AdAccountPurpose,
  type AdAccountTagMap,
  type AdAccountTags,
} from "@/lib/ad-account-tags";

/**
 * "Ad accounts Peakhour may use": a checklist of the login's ad accounts, one marked Default. On the Facebook Pages card
 * (inside the Meta accounts panel) AND on the Meta Ads card: a login that connected only for ads has no Pages card. Provider-neutral
 * (MR-G0): how an account is worded and compared is `AD_ACCOUNT_FORMATS` (lib/ad-account-choice.ts); a channel joins there.
 *
 * ★SAVED WITH A BUTTON, NOT ON EACH TICK: a business picks its set and its default together, and the api refuses a
 * default that is not ticked. An account the platform marks disabled or closed is shown and cannot be ticked.
 */
interface AdAccountChoiceProps {
  /** The api provider name the choice is saved under (`PATCH /v1/integrations/:provider/ad-accounts`). */
  provider: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>;
  onChanged?: () => void | Promise<unknown>;
}

export function AdAccountChoice(props: AdAccountChoiceProps) {
  const format = adAccountFormat(props.provider);
  // A provider with no format row has no choice to make yet (the api has no listing row either): show nothing rather than
  // claim the login has no ad accounts.
  return format ? <AdAccountChoiceFor {...props} format={format} /> : null;
}

function AdAccountChoiceFor({ provider, extra, onChanged, format }: AdAccountChoiceProps & { format: AdAccountFormat }) {
  const queryClient = useQueryClient();
  // Unique per instance, so two pickers on one page never share an id or a radio group.
  const uid = useId();
  // Read once per change of the inputs, not on every keystroke in a tag picker.
  const adAccounts: AdAccountRow[] = useMemo(() => format.list(extra), [format, extra]);
  const saved = useMemo(() => savedAdAccounts(provider, extra), [provider, extra]);
  // The edit in progress; null shows what is saved (and follows the list behind `extra` when it reloads).
  const [draft, setDraft] = useState<{ ids: string[]; defaultId?: string } | null>(null);
  // The routing tags in progress (MR-F3); null shows what is saved. Sent only once touched, so an untouched save leaves them alone.
  const [tagDraft, setTagDraft] = useState<AdAccountTagMap | null>(null);
  const [saving, setSaving] = useState(false);
  const savedTags = useMemo(() => savedAdAccountTags(provider, extra), [provider, extra]);
  const tags = tagDraft ?? savedTags;
  const ids = draft?.ids ?? saved.enabledIds;
  const defaultId = draft ? draft.defaultId : saved.defaultId;
  // Tags count as changed only when they differ from what is saved (ticking a purpose on and off is not a change).
  const tagsChanged = tagDraft !== null && !sameTags(tagDraft, savedTags);
  const dirty = draft !== null || tagsChanged;
  // An account the platform now says is disabled or closed that is still ticked: it can be unticked but not saved until it is.
  const stillTickedBlocked = adAccounts.some((a) => ids.includes(a.id) && !!format.health(a).blocked);
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
      await api.patch(`/v1/integrations/${provider}/ad-accounts`, {
        enabledIds: ids,
        defaultId,
        ...(tagsChanged && tagDraft ? { tags: tagsForSave(tagDraft, ids) } : {}),
      });
      // The channel's own readers of the enabled accounts (its format row), and the integrations list: refetch them now.
      await Promise.all([format.refresh(queryClient), queryClient.invalidateQueries({ queryKey: ["content-hub-integrations"] })]);
      toast.success("Peakhour will use those ad accounts.");
      await onChanged?.();
      setDraft(null);
      setTagDraft(null);
    } catch (err) {
      // The api's own sentence for a refusal the merchant can act on (a refresh or an untick); anything else is the fallback,
      // with the request reference when there is one (the one rule every ads panel uses).
      toast.error(adsErrorMessage(err, "Couldn't save the ad accounts. Try again in a moment.", AD_ACCOUNT_SAVE_CODES));
    } finally {
      setSaving(false);
    }
  }

  // Every account the login lists cannot run ads: ticking is no way forward, so say so and point at the platform (no loop through here).
  const allBlocked = adAccounts.length > 0 && adAccounts.every((a) => !!format.health(a).blocked);
  const blockedWords = [...new Set(adAccounts.map((a) => format.health(a).blocked).filter(Boolean))].join(" / ");

  return (
    <div className="space-y-1" aria-label="Ad accounts">
      <p className="text-micro text-muted-foreground">Ad accounts Peakhour may use</p>
      {allBlocked ? (
        <p role="status" className="text-micro text-warning-on-tint">
          {adAccounts.length === 1 ? "This ad account is" : "These ad accounts are"} {blockedWords} on {format.platformName}, so{" "}
          {adAccounts.length === 1 ? "it" : "they"} can&apos;t run ads.{" "}
          {format.createAccountUrl ? (
            <a href={format.createAccountUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
              Create an ad account on {format.platformName}
            </a>
          ) : null}
        </p>
      ) : null}
      {adAccounts.length === 0 ? (
        <p className="text-micro text-muted-foreground">No ad accounts found.</p>
      ) : adAccounts.length === 1 && saved.enabledIds.includes(adAccounts[0]!.id) ? (
        // One listed account that is already the business's: a line. A saved choice that no longer matches it falls to the
        // checklist below, so it can be enabled.
        <div className="rounded-lg border border-border px-3 py-2.5">
          <AdAccountIdentity account={adAccounts[0]!} format={format} />
          <AdAccountStatusBadge account={adAccounts[0]!} format={format} ticked />
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {adAccounts.map((a) => {
              const { blocked } = format.health(a);
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
                      <AdAccountIdentity account={a} format={format} />
                      <AdAccountStatusBadge account={a} format={format} ticked={ticked} />
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
              {CHOOSE_AD_ACCOUNTS}
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
 * number as the platform shows it, and the billing currency.
 */
function AdAccountIdentity({ account, format }: { account: AdAccountRow; format: AdAccountFormat }) {
  return (
    <span className="block min-w-0">
      <span className="block break-words text-sm font-medium leading-snug text-foreground">{account.name || "Ad account"}</span>
      {/* A separator for anything that reads the label as one string (a screen reader's accessible name). */}
      <span className="sr-only">, </span>
      <span className="mt-0.5 block break-words font-mono text-xs tabular-nums text-muted-foreground">{format.idLine(account)}</span>
    </span>
  );
}

/** The platform's word for an account that is not simply active, as a badge under its identity; nothing when it is active. */
function AdAccountStatusBadge({ account, format, ticked }: { account: AdAccountRow; format: AdAccountFormat; ticked: boolean }) {
  const { blocked, warning } = format.health(account);
  if (!blocked && !warning) return null;
  return (
    <span
      className={cn(
        "mt-1 inline-block rounded-md border px-1.5 py-0.5 text-micro",
        blocked ? "border-destructive/30 bg-destructive/10 text-destructive-on-tint" : "border-warning/30 bg-warning/10 text-warning-on-tint",
      )}
    >
      <span className="sr-only">, </span>
      {blocked ? `${blocked.charAt(0).toUpperCase() + blocked.slice(1)} on ${format.platformName}${ticked ? ", untick to save" : ""}` : warning!.charAt(0).toUpperCase() + warning!.slice(1)}
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
