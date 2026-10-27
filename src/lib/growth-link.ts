import { ApiError } from "@/lib/api";

/**
 * The confirmation link's page (row H5): what each refusal says, and what counts as a code.
 *
 * ★A CODE IS SIX DIGITS AND NOTHING ELSE. The api refuses anything else, so the box strips spaces (a code is often copied from
 * WhatsApp with one) and the button stays off until six digits are in it.
 * ★A DEAD LINK TELLS THE PERSON WHERE TO GET A NEW ONE, because the links live 24 hours and a plan can be sent again.
 */

export const CODE_LENGTH = 6;

/** What was typed, reduced to digits and capped at six: a pasted "123 456" is a good code. */
export function cleanCode(typed: string): string {
  return typed.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

export const codeIsComplete = (typed: string): boolean => cleanCode(typed).length === CODE_LENGTH;

/** Codes at which the link itself is finished, so the page stops offering to try again. */
const DEAD: ReadonlySet<string> = new Set(["LINK_INVALID", "LINK_EXPIRED", "LINK_USED", "OTP_LOCKED"]);

const SENTENCE: Record<string, string> = {
  LINK_INVALID: "This link is not valid. Open the latest message we sent you on WhatsApp, or send your plan again from Growth.",
  LINK_EXPIRED: "This link has expired. Links last 24 hours; send your plan again from Growth to get a new one.",
  LINK_USED: "This link was already used. If your plan is running, you are done.",
  OTP_NOT_SENT: "Ask for a code first.",
  OTP_COOLDOWN: "A code was just sent. Wait a minute before asking again.",
  OTP_EXPIRED: "That code has expired. Ask for a new one.",
  OTP_WRONG: "That code is not right. Check the latest message and try again.",
  OTP_LOCKED: "Too many wrong codes on this link. Send your plan again from Growth to get a new link.",
  OTP_DELIVERY_FAILED: "We could not send the code on WhatsApp. Try again shortly.",
  NO_VERIFIED_CONTACT: "That number is no longer verified. Verify your WhatsApp number in Settings, then send your plan again.",
  SIGNAL_NOT_READY: "The conversion signal is no longer set up. Finish that in Growth, then send your plan again.",
  ALREADY_ACTIVE: "This business already has a plan running, so this link has nothing to start.",
  ACTIVATION_FAILED: "We could not switch the plan on. Nothing changed. Ask for a new code and try again.",
  BUSINESS_GONE: "That business no longer exists.",
};

export function linkErrorMessage(err: unknown): string {
  if (err instanceof ApiError && SENTENCE[err.code]) return SENTENCE[err.code]!;
  return "Something went wrong on our side. Try again in a moment.";
}

/** True when the failure ends the link (the page then offers no retry). */
export function linkIsDead(err: unknown): boolean {
  return err instanceof ApiError && DEAD.has(err.code);
}
