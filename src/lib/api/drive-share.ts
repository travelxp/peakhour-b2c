import { api, API_BASE_URL } from "@/lib/api";

/**
 * Drive share links, the privacy half (owner decision 2026-11-04): opening a share link records the visitor's IP address and device,
 * and they are kept `retentionDays` days. Every number on screen comes from the api (`cfg_drive_settings`, which the CMS can change);
 * nothing here knows "90".
 *
 * TWO CLIENTS, because there are two kinds of caller:
 *   - the CUSTOMER's (`getSharePrivacy`, `listShareAccess`): signed in, through the shared `api` client (cookie, CSRF, 401 refresh);
 *   - the VISITOR's (`fetchSharePage`, `openSharedFile`): has no account and no session, so a plain cookie-less fetch of the PUBLIC
 *     api routes (`/v1/drive/share/:token`). Those routes answer in their own `{ success }` envelope, not the `{ ok }` one the shared
 *     client demands, which is why the shared client is not used for them.
 */

/** The number the share dialog quotes. */
export function getSharePrivacy(): Promise<{ retentionDays: number }> {
  return api.get<{ retentionDays: number }>("/v1/media/share-privacy");
}

export interface ShareAccessEntry {
  id: string;
  /** `opened`: the file was served. `wrong_password`: someone tried and was refused. */
  kind: "opened" | "wrong_password";
  /** ISO date. */
  at: string;
  browser: string;
  device: "phone" | "tablet" | "computer" | "unknown";
  /** "Chrome on a phone". */
  deviceLabel: string;
  /** The visitor's address while it is kept, else null. */
  ip: string | null;
  /** True once the address and device were removed (older than the window). */
  detailsRemoved: boolean;
}

export interface ShareAccessHistory {
  entries: ShareAccessEntry[];
  retentionDays: number;
  /** More opens than the list holds; it shows the most recent. */
  truncated: boolean;
}

/** Who opened one link and when (editor and above). */
export function listShareAccess(shareId: string): Promise<ShareAccessHistory> {
  return api.get<ShareAccessHistory>(`/v1/media/shares/${encodeURIComponent(shareId)}/access`);
}

// ── The visitor's side ───────────────────────────────────────

export type SharePageState =
  | { kind: "ready"; passwordRequired: boolean; retentionDays: number }
  /** Unknown, revoked, expired or deleted-file link: one answer. */
  | { kind: "gone" }
  | { kind: "error" };

export type OpenResult =
  | { kind: "opened"; url: string; name: string; retentionDays: number }
  | { kind: "password"; wrong: boolean; retentionDays: number }
  | { kind: "locked"; retentionDays: number }
  | { kind: "gone" }
  | { kind: "error" };

const sharePath = (token: string) => `${API_BASE_URL}/v1/drive/share/${encodeURIComponent(token)}`;
const asNumber = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);

/**
 * Load the link WITHOUT opening it: the api records nothing and serves nothing for this GET. The page shows the notice from what comes
 * back, and only a press of "Open file" sends the POST that records the visit.
 */
export async function fetchSharePage(token: string, doFetch: typeof fetch = fetch): Promise<SharePageState> {
  try {
    const res = await doFetch(sharePath(token), { credentials: "omit", headers: { Accept: "application/json" } });
    if (res.status === 404 || res.status === 410) return { kind: "gone" };
    const body = (await res.json().catch(() => null)) as { success?: boolean; data?: { passwordRequired?: unknown; retentionDays?: unknown } } | null;
    const days = asNumber(body?.data?.retentionDays);
    // No number, no notice: a page that cannot say how long it keeps your address does not open the file.
    if (!res.ok || body?.success !== true || days === null) return { kind: "error" };
    return { kind: "ready", passwordRequired: body.data?.passwordRequired === true, retentionDays: days };
  } catch {
    return { kind: "error" };
  }
}

/** Open the file: the api records the visitor's IP address and device here, and answers with a fresh signed URL. */
export async function openSharedFile(token: string, password?: string, doFetch: typeof fetch = fetch): Promise<OpenResult> {
  try {
    const res = await doFetch(sharePath(token), {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(password ? { password } : {}),
    });
    if (res.status === 404 || res.status === 410) return { kind: "gone" };
    const body = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: { url?: unknown; name?: unknown; retentionDays?: unknown };
      error?: { code?: string };
      passwordRequired?: boolean;
      retentionDays?: unknown;
    } | null;
    if (res.ok && body?.success === true && typeof body.data?.url === "string") {
      return { kind: "opened", url: body.data.url, name: typeof body.data.name === "string" ? body.data.name : "your file", retentionDays: asNumber(body.data.retentionDays) ?? 0 };
    }
    const days = asNumber(body?.retentionDays) ?? 0;
    if (res.status === 401 && body?.passwordRequired) return { kind: "password", wrong: body.error?.code === "PASSWORD_WRONG", retentionDays: days };
    if (res.status === 429) return { kind: "locked", retentionDays: days };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
