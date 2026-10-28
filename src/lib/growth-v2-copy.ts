/**
 * The merchant-facing name of the Growth council (owner decision, 2026-10-28): "Peakhour Summit", never "Growth Council",
 * "council", "Strategist", "Critic" or "Chair". Its four seats read The case for, The case against, Safety checks and Final call.
 * The code keeps `council` as its name; only copy changes (growth-v2-copy.test.ts reads every growth screen for the old words).
 *
 * The trademark sign goes on the badge or title and on the FIRST mention on a screen; every later mention is plain. Never the
 * registered sign. (WhatsApp bodies are plain text and say plain "Peakhour Summit".)
 */
export const SUMMIT = "Peakhour Summit";
export const SUMMIT_TM = "Peakhour Summit\u2122";

/** Put the trademark sign on the first "Peakhour Summit" in a text (a text that already has one is left as it is). */
export function withSummitTm(text: string): string {
  // A text that already carries the sign is left exactly as it is: skipping its marked first mention would mark a LATER one.
  if (text.includes(SUMMIT_TM)) return text;
  return text.replace(SUMMIT, () => SUMMIT_TM);
}
