/**
 * Which X ad accounts the Ads page shows (MR-G3). Separate from `x-ads-account.ts` (the choice's wording), which
 * `ad-account-choice.ts` imports: this one imports `ad-account-choice.ts`, so keeping them apart avoids a cycle.
 */
import { savedAdAccounts } from "./ad-account-choice";
import type { XAdAccount } from "./api/x-ads";

/**
 * The X ad accounts the Ads page shows: the live list limited to the ones this business enabled (a login lists every
 * business it reaches), in the live order, with the account to open on.
 *
 * ★THE DEFAULT IS PRESELECTED, NEVER THE FIRST LISTED. `requested` (`?account=`) is honoured only for an ENABLED id: a
 * pasted link to another business's account falls back to the default instead of opening it.
 * Fed the LIVE list rather than the stored one, as the api sees it once the list is refreshed.
 */
export function xAdsAccountChoice(
  live: readonly XAdAccount[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any> | undefined,
  requested: string | null,
): { enabled: XAdAccount[]; selectedId: string | null; defaultId: string | null } {
  const saved = savedAdAccounts("x_ads", { ...(extra ?? {}), adAccounts: live });
  const enabled = live.filter((a) => saved.enabledIds.includes(a.id));
  const defaultId = saved.defaultId && enabled.some((a) => a.id === saved.defaultId) ? saved.defaultId : null;
  const selectedId = requested && enabled.some((a) => a.id === requested) ? requested : defaultId;
  return { enabled, selectedId, defaultId };
}
