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

import { setQueryParam } from "@/lib/url-query";

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
    checkbox:
      "My business and TikTok accounts are based outside India, and I accept the risk.",
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

/** Shown when a flagged connect cannot show its warning; the connect never starts. */
export const ACK_UNAVAILABLE_MESSAGE =
  "We could not show the warning that must be accepted before connecting this account, so the connection was not started. Please refresh the page and try again.";

type Params = { get(name: string): string | null } | null | undefined;

/** The copy for a version, or null for a version this build has no wording for. */
export function overseasAckCopy(version: string): OverseasAckCopy | null {
  return OVERSEAS_ACK_COPY[version] ?? null;
}

/** Adds the accepted version to an `/authorize` URL, keeping its query and fragment. */
export function withOverseasAck(url: string, version: string): string {
  return setQueryParam(url, "ackOverseas", version);
}

/** True when the api sent the user back because the acknowledgement was missing. */
export function isAckRequiredRedirect(params: Params): boolean {
  return (
    params?.get("error") === ACK_REQUIRED_ERROR ||
    params?.get("msg") === ACK_REQUIRED_ERROR
  );
}

export type AckPrompt =
  { kind: "none" } | { kind: "ask"; version: string } | { kind: "unavailable" };

type Row = { provider: string; requiresAck?: RequiresAck };

/**
 * What a connect from this provider must do first. The version comes only
 * from the provider's own listing row. A flagged row whose version has no
 * wording in this build is "unavailable": never a silent connect, never a
 * dead button.
 */
export function ackPromptFor(rows: Row[], provider: string): AckPrompt {
  const required = rows.find((r) => r.provider === provider)?.requiresAck;
  if (!required) return { kind: "none" };
  return overseasAckCopy(required.version)
    ? { kind: "ask", version: required.version }
    : { kind: "unavailable" };
}

/**
 * The prompt for the api's ack-required redirect. The provider comes from the
 * redirect's `provider=` param and the version from that provider's fresh
 * listing row; nothing is guessed. A missing provider, row or version is
 * "unavailable".
 */
export function ackPromptForRedirect(
  params: Params,
  rows: Row[],
): AckPrompt & { provider?: string } {
  const provider = params?.get("provider");
  if (!provider) return { kind: "unavailable" };
  const prompt = ackPromptFor(rows, provider);
  return prompt.kind === "ask"
    ? { ...prompt, provider }
    : { kind: "unavailable" };
}

/** The query string with the redirect's own params removed; returnTo/returnFor stay. */
export function withoutAckRedirectParams(params: {
  toString(): string;
}): string {
  const next = new URLSearchParams(params.toString());
  if (next.get("error") === ACK_REQUIRED_ERROR) next.delete("error");
  if (next.get("msg") === ACK_REQUIRED_ERROR) {
    next.delete("msg");
    next.delete("integration");
  }
  next.delete("provider");
  next.delete("anchor");
  return next.toString();
}

/**
 * Settings receives `?integration=error&msg=<code>&provider=..` when the
 * api's redirect lands there; the dialog lives on Integrations, so build the
 * hop, keeping provider, returnTo and returnFor.
 */
export function integrationsAckHref(params: Params): string {
  const out = new URLSearchParams({ error: ACK_REQUIRED_ERROR });
  for (const k of ["provider", "returnTo", "returnFor"]) {
    const v = params?.get(k);
    if (v) out.set(k, v);
  }
  return `/dashboard/integrations?${out.toString()}`;
}
