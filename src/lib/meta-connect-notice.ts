/**
 * What a Meta connect still owes, from the api callback's `?meta_notice=`
 * (api `integrations/meta-connect-notice.ts`).
 *
 * ★A STORED TOKEN IS NOT A WORKING INSTAGRAM. The callback used to land every
 * Meta connect on "Meta connected", including ones that stored no Facebook
 * Page. The Instagram card connects only through a Page with an Instagram
 * professional account linked, so the merchant saw a success toast beside a
 * card still on "Connect" and nothing saying why. These say what to do next.
 */

export type MetaConnectNotice = "read_failed" | "no_pages" | "no_instagram";

const MESSAGES: Record<MetaConnectNotice, string> = {
  // A Meta read failed: the empty answer may not be the truth, so it is never
  // put to the merchant as something they did wrong.
  read_failed:
    "Meta is connected, but Peakhour could not read your Facebook Pages just now. Wait a minute, then use Refresh on the Instagram card.",
  no_pages:
    "Meta is connected, but it did not give Peakhour access to any Facebook Page. Connect again and, on Meta's screen, make sure the Page your Instagram account is linked to is selected.",
  no_instagram:
    "Your Facebook Page is connected, but it has no Instagram professional account linked. Link one to the Page in Meta Business Suite, then connect Instagram again.",
};

export function parseMetaConnectNotice(value: string | null | undefined): MetaConnectNotice | undefined {
  return value === "read_failed" || value === "no_pages" || value === "no_instagram" ? value : undefined;
}

/** The merchant-facing next step for a notice, or null for none. */
export function metaConnectNoticeMessage(value: string | null | undefined): string | null {
  const notice = parseMetaConnectNotice(value);
  return notice ? MESSAGES[notice] : null;
}
