import { api } from "@/lib/api";

/**
 * The page behind the signed link in `growth_mandate_confirm_v1` (Growth Engine v2, W1's routes, H5's page).
 *
 * PUBLIC: the person opening it from WhatsApp may not be signed in. The link is not a credential; the one-time code sent to
 * their verified number is. A GET only describes: only the two POSTs send or accept a code.
 */

export interface LinkDescription {
  /** The plan in one sentence. */
  plan: string;
  /** Where the code will go, masked: "ending 01". */
  sentTo: string;
  /** True once a code has been sent for this link. */
  otpSent: boolean;
  /** True when this link confirms a CHANGE to a running plan, not a first plan. */
  change: boolean;
}

export type HoldoutStart = { started: true; method: "geo" | "switchback" } | { started: false; reason: string };

export interface LinkConfirmed {
  activated: true;
  holdout: HoldoutStart;
}

const path = (token: string, rest = "") => `/v1/growth-link/mandate/${encodeURIComponent(token)}${rest}`;

export const growthLinkApi = {
  describe: (token: string) => api.get<LinkDescription>(path(token)),
  sendCode: (token: string) => api.post<{ sent: true }>(path(token, "/otp")),
  confirm: (token: string, code: string) => api.post<LinkConfirmed>(path(token, "/confirm"), { code }),
};
