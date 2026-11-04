/**
 * The merchant's monthly cap on shopper chats, on the Peaks page.
 *
 * Shoppers are the only automatic spend (work Peakhour starts itself is free), so this is the most Peaks shopper chats may use in a billing
 * month. OFF BY DEFAULT. At the cap the store's assistant stops answering shoppers, tells them the store team will help, and the chat goes
 * to the team: exactly what happens when the Peaks run out. The merchant's own AI work is neither counted nor stopped.
 * The api owns the numbers (GET and PUT /v1/dashboard/credits/shopper-cap); this file words them and checks what was typed.
 */

export interface ShopperCap {
  cap: number | null;
  used: number;
  reached: boolean;
}

export const SHOPPER_CAP_MAX = 100_000_000;
export const SHOPPER_CAP_KEY = "/v1/dashboard/credits/shopper-cap";

/** What was typed -> what to send. Empty switches the cap off. */
export function parseShopperCapInput(raw: string): { ok: true; cap: number | null } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, cap: null };
  // Only a plain number or one with proper thousands commas ("12,500"): "1 2 3" or "1,2,,3" is refused, not read as 123.
  const t = /^\d{1,3}(,\d{3})+$/.test(trimmed) ? trimmed.replace(/,/g, "") : trimmed;
  if (!/^\d+$/.test(t)) return { ok: false, message: "Enter a whole number of Peaks, like 2000, or leave it empty for no limit." };
  const n = Number(t);
  if (n < 1 || n > SHOPPER_CAP_MAX) return { ok: false, message: `Enter a number from 1 to ${SHOPPER_CAP_MAX.toLocaleString("en-US")}, or leave it empty for no limit.` };
  return { ok: true, cap: n };
}

export function shopperCapStatus(s: ShopperCap): string {
  if (s.cap === null) return "No limit. Shopper chats can use any of your Peaks.";
  const used = Math.round(s.used).toLocaleString("en-US");
  const cap = s.cap.toLocaleString("en-US");
  return s.reached
    ? `Shopper chats have used ${used} of ${cap} Peaks this month, so your store's assistant is not answering shoppers. Their messages go to your team. It starts answering again when your Peaks renew, or if you raise the limit.`
    : `Shopper chats have used ${used} of ${cap} Peaks this month. When they reach the limit, your store's assistant stops answering shoppers and their messages go to your team.`;
}
