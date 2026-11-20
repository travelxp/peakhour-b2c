/**
 * AD ACCOUNT CHOICE, PROVIDER-NEUTRAL (MR-G0): how the dashboard reads a business's saved choice of ad accounts
 * (`account.extra.adAccountChoice`, the api's `config.adAccountChoice`) and how one provider words an account.
 *
 * ★A CHANNEL JOINS BY ADDING ONE ROW TO `AD_ACCOUNT_FORMATS` (the api's `adapters/ads/account-listing.ts` has the matching
 * row). The row says how an id is compared, how its id line reads, and which accounts cannot run ads. Everything else (the
 * checklist, the Default pill, "Used for") is `components/ads/ad-account-choice.tsx` and does not name a provider.
 *
 * Mirrors the api's `helpers/business-ad-accounts.ts`: the stored ids still listed; with nothing EVER saved, the only listed
 * account (one is not a choice); never the first of several; a saved choice is never widened.
 */
import type { QueryClient } from "@tanstack/react-query";
import { googleBareId, googleIdLine } from "./google-ads-accounts";
import { metaAdAccountBareId, metaAdAccountIdLine, metaAdAccountStatus } from "./meta-ads-view";

/** One ad account as the connection lists it (`account.extra.adAccounts[]`); the rest of the provider's fields ride along untouched. */
export interface AdAccountRow {
  id: string;
  name?: string;
  currency?: string;
  [field: string]: unknown;
}

export interface AdAccountFormat {
  /** What a merchant calls the platform ("Meta"). */
  platformName: string;
  /** The one spelling two spellings of an id are compared by. */
  bareId(id: string): string;
  /** The line under the name: "Account ID 123… · INR". */
  idLine(a: AdAccountRow): string;
  /** Whether the account cannot run ads (`blocked`: the word to say) or still runs but needs attention (`warning`). */
  health(a: AdAccountRow): { blocked?: string; warning?: string };
  /** The accounts the connection lists, read from where THIS channel stores them (the api's registry row owns `list` too). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list(extra: Record<string, any> | undefined): AdAccountRow[];
  /** How many accounts the business chose that the connection can no longer use (optional: only a channel that lists them apart). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unavailable?(extra: Record<string, any> | undefined): number;
  /** Whether a listed account may enable ITSELF under "one listed account, nothing ever saved" (absent: yes). The api's `autoEnable`, mirrored. */
  autoEnable?(a: AdAccountRow): boolean;
  /** Refetch the channel's OWN readers of the enabled accounts after a save (Growth must never offer one just unticked). */
  refresh(client: QueryClient): Promise<unknown>;
}

/** The save route's refusals whose api sentence is the merchant's next step (a refresh or an untick); anything else is the fallback. */
export const AD_ACCOUNT_SAVE_CODES: ReadonlySet<string> = new Set(["AD_ACCOUNT_NOT_FOUND", "AD_ACCOUNT_DISABLED", "AD_ACCOUNTS_NOT_SAVED", "DEFAULT_NOT_ENABLED"]);

export const AD_ACCOUNT_FORMATS: Record<string, AdAccountFormat> = {
  facebook: {
    platformName: "Meta",
    bareId: metaAdAccountBareId,
    idLine: metaAdAccountIdLine,
    health: (a) => metaAdAccountStatus(typeof a.status === "number" ? a.status : undefined),
    list: (extra) => listedAdAccounts(extra),
    refresh: (client) =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["meta-ads-accounts"] }),
        client.invalidateQueries({ queryKey: ["meta-ads-campaigns"] }),
        // Only the Growth signal step's META accounts (["growth-v2", "signal", scope, "meta-accounts"]), not Google's or the rest.
        client.invalidateQueries({ predicate: (q) => q.queryKey[0] === "growth-v2" && q.queryKey[1] === "signal" && q.queryKey[3] === "meta-accounts" }),
      ]),
  },
  google_ads: {
    platformName: "Google Ads",
    bareId: googleBareId,
    idLine: googleIdLine,
    // A listed account is usable (the connection lists only accounts it can use); a test account runs no real ads.
    health: (a) => (a.testAccount === true ? { warning: "test account" } : {}),
    list: (extra) => googleListedAccounts(extra),
    unavailable: (extra) => googleUnavailableCount(extra),
    // A test account runs no real ads: it is never the business's by default, only when ticked (as the api).
    autoEnable: (a) => a.testAccount !== true,
    refresh: (client) =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["google-ads-accounts"] }),
        client.invalidateQueries({ queryKey: ["google-ads-campaigns"] }),
        // Only the Growth signal step's GOOGLE accounts (["growth-v2", "signal", scope, "google-accounts"]).
        client.invalidateQueries({ predicate: (q) => q.queryKey[0] === "growth-v2" && q.queryKey[1] === "signal" && q.queryKey[3] === "google-accounts" }),
      ]),
  },
};

/** The Google Ads accounts a connection lists (`currencyCode` read as `currency`). Mirrors the api: `blockedAdAccounts` are NOT listed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function googleListedAccounts(extra: Record<string, any> | undefined): AdAccountRow[] {
  return listedAdAccounts(extra).map((a) => ({ ...a, ...(typeof a.currencyCode === "string" && a.currencyCode !== "" ? { currency: a.currencyCode } : {}) }));
}

/**
 * Accounts the business chose (stored) that the login no longer lists: blocked since (`blockedAdAccounts`) or gone from the login. Counted
 * and never ticked, never the default. (Mirrors the api: an id the row does not list is dropped from the choice.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function googleUnavailableCount(extra: Record<string, any> | undefined): number {
  const stored = new Set<string>((Array.isArray(extra?.adAccountChoice?.enabledIds) ? extra.adAccountChoice.enabledIds : []).filter((x: unknown): x is string => typeof x === "string").map(googleBareId));
  const listed = new Set(googleListedAccounts(extra).map((a) => googleBareId(a.id)));
  return [...stored].filter((id) => !listed.has(id)).length;
}

/**
 * The accounts a business enabled, from a list answer `{ accounts, enabledIds, defaultId }`, its DEFAULT first (the others keep the
 * listed order). Provider-neutral: `bare` is the provider's id comparison (`bareIdFor(provider)`). Nothing enabled, or an answer
 * with no `enabledIds`, is none.
 */
export function enabledAccounts<T extends { id: string }>(
  data: { accounts: T[]; enabledIds?: string[]; defaultId?: string | null } | undefined,
  bare: (id: string) => string,
): T[] {
  if (!data) return [];
  const enabled = new Set((data.enabledIds ?? []).map(bare));
  const def = data.defaultId ? bare(data.defaultId) : undefined;
  return data.accounts
    .filter((a) => a.id.length > 0 && enabled.has(bare(a.id)))
    .sort((a, b) => Number(bare(b.id) === def) - Number(bare(a.id) === def));
}

/** The formatter for an api provider name, or undefined for a provider that has no ad-account choice yet (own keys only). */
export function adAccountFormat(provider: string): AdAccountFormat | undefined {
  return Object.hasOwn(AD_ACCOUNT_FORMATS, provider) ? AD_ACCOUNT_FORMATS[provider] : undefined;
}

/**
 * The ONE id comparison for a provider: its format's `bareId`, else the id as it is. The api's fallback is the same
 * (`adAccountListingForProvider(provider)?.normaliseId(id) ?? id`), so the two never disagree on whether an id matches.
 */
export function bareIdFor(provider: string): (id: string) => string {
  return adAccountFormat(provider)?.bareId ?? ((id: string) => id);
}

/** The ad accounts a connection lists, rows without a usable id dropped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listedAdAccounts(extra: Record<string, any> | undefined): AdAccountRow[] {
  return (Array.isArray(extra?.adAccounts) ? extra.adAccounts : []).filter(
    (a: { id?: unknown }) => typeof a?.id === "string" && a.id !== "",
  );
}

/**
 * The ad accounts this business may use, and its default, as the api resolves them. `extra` is the merged row's
 * `account.extra`, which carries `adAccounts` and `adAccountChoice`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function savedAdAccounts(provider: string, extra: Record<string, any> | undefined): { enabledIds: string[]; defaultId?: string } {
  const bare = bareIdFor(provider);
  const listed = adAccountFormat(provider)?.list(extra) ?? [];
  // Its own key (`config.adAccountChoice`), NOT under `capabilities`: LinkedIn keeps `capabilities.adAccounts.byPage` there.
  const stored = extra?.adAccountChoice;
  const saved = !!stored && typeof stored === "object";
  const wanted = new Set<string>(
    (Array.isArray(stored?.enabledIds) ? stored.enabledIds : []).filter((x: unknown): x is string => typeof x === "string").map(bare),
  );
  let enabled = listed.filter((a) => wanted.has(bare(a.id)));
  // One listed account enables itself only while nothing was EVER saved; a saved choice is never widened.
  if (!saved && listed.length === 1 && adAccountFormat(provider)?.autoEnable?.(listed[0]!) !== false) enabled = [listed[0]!];
  if (enabled.length === 0) return { enabledIds: [] };
  const byDefault =
    typeof stored?.defaultId === "string" ? enabled.find((a) => bare(a.id) === bare(stored.defaultId)) : undefined;
  const def = byDefault ?? (enabled.length === 1 ? enabled[0] : undefined);
  return { enabledIds: enabled.map((a) => a.id), ...(def ? { defaultId: def.id } : {}) };
}
