/**
 * Acknowledgement a merchant must accept before a connect starts, for a
 * provider the api flags with `requiresAck` (owner decision 2026-11-20:
 * Indian merchants connecting TikTok).
 *
 * b2c never decides "is this merchant in India" itself. The api carries
 * `requiresAck: { version }` on the provider entry when the pinned business
 * needs the warning, and enforces the acceptance server side: the connect
 * URL must carry `ackOverseas=<version>`, otherwise the api redirects back
 * with `error=tiktok_india_ack_required`.
 *
 * Copy is keyed by version so a later TikTok content provider reuses the
 * same dialog, and a reworded warning ships under a new version (which
 * forces a fresh acceptance).
 */

export interface OverseasAckCopy {
  title: string;
  body: string[];
  checkbox: string;
  cancel: string;
  confirm: string;
}

export const OVERSEAS_ACK_COPY: Record<string, OverseasAckCopy> = {
  tiktok_india_v1: {
    title: "TikTok is banned in India",
    body: [
      "TikTok has been blocked in India since 2020. Connect it only if your business sells outside India and your TikTok account and ad account are registered and run outside India.",
      "TikTok refuses connections made from India, so you may need to connect while you are abroad, or ask your overseas team or agency to do it.",
      "You connect TikTok at your own risk. Peakhour is not responsible for any action TikTok or any authority takes on your accounts.",
    ],
    checkbox: "My business and TikTok accounts are based outside India, and I accept the risk.",
    cancel: "Cancel",
    confirm: "Connect TikTok",
  },
};

/** What the api puts on a provider entry that needs the acknowledgement. */
export interface RequiresAck {
  version: string;
}

/** The api's redirect when a connect arrived without the acknowledgement. */
export const ACK_REQUIRED_ERROR = "tiktok_india_ack_required";
/** The provider that error is about, and the version its dialog uses. */
export const ACK_REQUIRED_ERROR_PROVIDER = "tiktok_ads";
export const ACK_REQUIRED_ERROR_VERSION = "tiktok_india_v1";

/** The copy for a version, or null for a version this build has no wording for. */
export function overseasAckCopy(version: string): OverseasAckCopy | null {
  return OVERSEAS_ACK_COPY[version] ?? null;
}

/** Adds the accepted version to an `/authorize` URL that already has a query. */
export function withOverseasAck(url: string, version: string): string {
  return `${url}&ackOverseas=${encodeURIComponent(version)}`;
}

/** True when the api sent the user back because the acknowledgement was missing. */
export function isAckRequiredRedirect(
  params: { get(name: string): string | null } | null | undefined,
): boolean {
  return params?.get("error") === ACK_REQUIRED_ERROR || params?.get("msg") === ACK_REQUIRED_ERROR;
}

/**
 * The version a connect from this card must acknowledge first, or null when
 * the api did not flag it. The only source is the api's `requiresAck`.
 */
export function ackVersionToAsk(
  rows: Array<{ provider: string; requiresAck?: RequiresAck }>,
  provider: string,
): string | null {
  return rows.find((r) => r.provider === provider)?.requiresAck?.version ?? null;
}
