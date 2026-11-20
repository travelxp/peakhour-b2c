/**
 * Which X ad accounts the Ads page shows, and which one it opens on (MR-G3). The business's choice comes from the api with the
 * list (`GET /v1/x/ads/ad-accounts` answers `enabledIds` and `defaultId` from `businessAdAccounts`, as Meta's and Google's
 * do), so nothing here re-derives it in the browser.
 */
import type { XAdAccount } from "./api/x-ads";

export interface XAdsAccountChoice {
  /** The accounts this business enabled, in the login's order: the ones Peakhour may run new spend in. */
  enabled: XAdAccount[];
  /** "Other accounts on your X login": listed, not enabled. Pause-only. */
  others: XAdAccount[];
  /** The account the page is on. */
  selectedId: string | null;
  /** The selected account is enabled (full controls); false is the pause-only view. */
  selectedEnabled: boolean;
  /** The account to preselect when `?account=` is absent: the default, else the first enabled one. UI selection only, never saved. */
  preselectId: string | null;
  /** Two or more enabled and no default (the stored default left the login): say "Pick a default in Connected accounts." */
  needsDefault: boolean;
}

/**
 * ★STOPPING SPEND IS NEVER CUT OFF. Every listed account stays reachable: the enabled ones first, then the others in a
 * pause-only view, and with NOTHING enabled the page still shows the login's accounts (pause-only) rather than hiding the
 * campaigns that may be running. `requested` (`?account=`) opens any LISTED account; whether it gets controls is `selectedEnabled`.
 */
export function xAdsAccountChoice(
  accounts: readonly XAdAccount[],
  enabledIds: readonly string[],
  defaultId: string | null | undefined,
  requested: string | null,
): XAdsAccountChoice {
  const idSet = new Set(enabledIds);
  const enabled = accounts.filter((a) => idSet.has(a.id));
  const others = accounts.filter((a) => !idSet.has(a.id));
  const def = defaultId && enabled.some((a) => a.id === defaultId) ? defaultId : null;
  const preselectId = def ?? enabled[0]?.id ?? null;
  const selectedId = requested && accounts.some((a) => a.id === requested) ? requested : (preselectId ?? accounts[0]?.id ?? null);
  return {
    enabled,
    others,
    selectedId,
    selectedEnabled: selectedId !== null && idSet.has(selectedId),
    preselectId,
    needsDefault: enabled.length > 1 && def === null,
  };
}
