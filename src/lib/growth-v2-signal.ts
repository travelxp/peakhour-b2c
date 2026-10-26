/**
 * First-run's signal step (Growth Engine v2, C3): what it says and when it lets
 * the merchant continue. Pure, so every sentence and decision is tested
 * (`growth-v2-signal.test.ts`).
 *
 * A MIRROR of `peakhour-api/src/v1/services/growth/signal-readiness.ts`. The rule
 * itself (`complete`) is the api's: this file reads it, it never recomputes it,
 * so the button and H5's confirm cannot disagree.
 */

export type SignalPlatform = "meta" | "google_ads";
export type SignalState = "ready" | "untracked_accepted" | "needed" | "needs_primary_goal" | "not_connected";

export interface PlatformSignal {
  platform: SignalPlatform;
  state: SignalState;
  chosen?: { id: string; name?: string };
}

export interface SignalReadiness {
  platforms: PlatformSignal[];
  complete: boolean;
}

export const SIGNAL_PLATFORM_LABEL: Record<SignalPlatform, string> = { meta: "Meta", google_ads: "Google Ads" };

/** What "untracked" means, said before the merchant accepts it and again beside the badge. */
export const UNTRACKED_EXPLANATION =
  "Without a signal, the platform never hears which clicks became sales. Its bidding learns from clicks alone, " +
  "and we can only show you the platform's own claim of what it delivered, not a number we can verify.";

/** The label beside an accepted "untracked" platform: the measurement badge's own word for it. */
export const UNTRACKED_BADGE_LABEL = "Not tracked";

export const SIGNAL_WHAT_IT_DOES: Record<SignalPlatform, string> = {
  meta: "Peakhour sends each attributed order to a Meta dataset, so Meta can bid toward real sales.",
  google_ads: "Peakhour adds a conversion action to your Google Ads account and reports each attributed order to it, so Google can bid toward real sales.",
};

export const SIGNAL_FOCUS_NOTE = (label: string) =>
  `Only ${label} is reported to the platforms as your goal. Orders outside it are not counted as sales for bidding.`;

/** Whether the step lets the merchant continue. The api's rule, read as given. */
export function canContinue(readiness: SignalReadiness | undefined): boolean {
  return readiness?.complete === true;
}

/** The platforms that still need a choice, in display order. */
export function platformsNeedingAChoice(readiness: SignalReadiness): SignalPlatform[] {
  return readiness.platforms.filter((p) => p.state === "needed" || p.state === "needs_primary_goal").map((p) => p.platform);
}

/** The one sentence a platform's row says about its state. */
export function signalStateSentence(p: PlatformSignal): string {
  const who = SIGNAL_PLATFORM_LABEL[p.platform];
  switch (p.state) {
    case "ready":
      return p.chosen?.name ? `${who} hears about your sales through “${p.chosen.name}”.` : `${who} hears about your sales.`;
    case "untracked_accepted":
      return `${who} runs without a signal. You accepted this.`;
    case "needs_primary_goal":
      return `“${p.chosen?.name ?? "That conversion action"}” is not a primary goal in Google Ads, so Google would not bid on it. Let Peakhour add its own, or make it primary there.`;
    case "needed":
      return `${who} has no signal yet.`;
    case "not_connected":
      return `${who} is not connected.`;
  }
}

/** Why Continue is off, or null when it is on. */
export function continueBlockedReason(readiness: SignalReadiness | undefined): string | null {
  if (!readiness) return "Checking your signal.";
  if (readiness.complete) return null;
  if (readiness.platforms.every((p) => p.state === "not_connected")) return "Connect Meta or Google Ads first.";
  const needing = platformsNeedingAChoice(readiness);
  return `Choose a signal for ${needing.map((p) => SIGNAL_PLATFORM_LABEL[p]).join(" and ")}, or accept running without one.`;
}
