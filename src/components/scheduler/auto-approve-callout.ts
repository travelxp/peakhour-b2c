/**
 * When the composer tells a merchant that auto-approve is not theirs, and in
 * what words.
 *
 * ★ONLY ON LOADED DATA THAT SAYS SO (review R1). `autoApproveAuthorized`
 * falls back to false while the entitlements query has no data: a failed
 * fetch, or one react-query v5 has PAUSED offline (its `isLoading` stays
 * false). Saying "not included" then is a claim about the merchant's plan
 * that nothing backs. So the callout needs `autoApprove === false` on data
 * that arrived, as the bundles banner already does.
 *
 * ★NOT BESIDE A FORCED-VISIBLE CHECKBOX. A staging caller passing
 * `canAutoApprove={true}` shows the control; a callout saying the feature is
 * missing would contradict it. `false` hides both.
 *
 * ★NAMES NO PLAN, AND PRESUMES NONE (owner, 2026-10-21; D19). "Growth+" is
 * not a plan, and a business may hold no plan at all, so "your plan" would
 * name something that may not exist. Which plan unlocks a feature is the
 * catalog's to say.
 */
export const AUTO_APPROVE_CALLOUT = "Auto-approve publishing isn't included for this business yet.";

export function showAutoApproveCallout(
  entitlements: { schedulerFeatures: { autoApprove: boolean } } | undefined,
  canAutoApprove: boolean | undefined,
): boolean {
  return entitlements?.schedulerFeatures.autoApprove === false && canAutoApprove === undefined;
}
