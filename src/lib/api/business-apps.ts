import { api, ApiError } from "@/lib/api";

/**
 * "Your apps" client, over /v1/business/apps (merchant app discovery).
 * The record is `org_businesses.apps[]`; one row per store app, unique by `appId`.
 * A rejected app is kept by the api so discovery never proposes it again.
 */

export type AppPlatform = "ios" | "android";
export type AppStatus = "pending" | "confirmed" | "rejected";

export interface BusinessApp {
  appId: string;
  platform: AppPlatform;
  storeId: string;
  bundleId?: string;
  name?: string;
  iconUrl?: string;
  storeUrl: string;
  sellerName?: string;
  sellerUrl?: string;
  source: string;
  confidence: number;
  evidence?: string;
  status: AppStatus;
  discoveredAt: string;
  confirmedAt?: string;
  lastCheckedAt?: string;
}

/** The name when the store gave one, otherwise a plain platform label. */
export function appLabel(app: Pick<BusinessApp, "name" | "platform">): string {
  const name = app.name?.trim();
  if (name) return name;
  return app.platform === "ios" ? "iPhone app" : "Android app";
}

export function platformLabel(platform: AppPlatform): string {
  return platform === "ios" ? "iPhone" : "Android";
}

/** Only a real https link is rendered as an `<a href>` or `<img src>`: both come from a third party. */
export function safeHttpsUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Plain words for the api's add-an-app errors; anything else gets a generic line, never raw error text. */
export function addAppErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "INVALID_STORE_URL") return "That isn't an App Store or Google Play app link.";
    if (err.code === "APP_EXISTS") return "That app is already on your list.";
    if (err.code === "APPS_LIMIT") return "You can list up to 50 apps. Remove one to add another.";
  }
  return "Couldn't add that app. Try again.";
}

export function splitApps(apps: BusinessApp[]) {
  return {
    confirmed: apps.filter((a) => a.status === "confirmed"),
    pending: apps.filter((a) => a.status === "pending"),
    rejected: apps.filter((a) => a.status === "rejected"),
  };
}

const BASE = "/v1/business/apps";

export async function listBusinessApps(): Promise<BusinessApp[]> {
  const r = await api.get<{ apps: BusinessApp[] }>(BASE);
  return r.apps;
}

export async function addBusinessApp(storeUrl: string): Promise<BusinessApp> {
  const r = await api.post<{ app: BusinessApp }>(BASE, { storeUrl: storeUrl.trim() });
  return r.app;
}

export async function setBusinessAppStatus(appId: string, status: "confirmed" | "rejected"): Promise<BusinessApp> {
  const r = await api.patch<{ app: BusinessApp }>(`${BASE}/${encodeURIComponent(appId)}`, { status });
  return r.app;
}

/** The api answers 204 with no body, which the envelope reader reports as PARSE_ERROR on a 204: that is success. */
export async function removeBusinessApp(appId: string): Promise<void> {
  try {
    await api.delete<unknown>(`${BASE}/${encodeURIComponent(appId)}`);
  } catch (err) {
    if (err instanceof ApiError && err.code === "PARSE_ERROR" && err.status === 204) return;
    throw err;
  }
}
