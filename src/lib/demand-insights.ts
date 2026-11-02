/**
 * "What shoppers asked for" (Commerce -> What shoppers asked): the rules of the
 * page. The numbers and the next step of each row are the api's
 * (`GET /v1/demand-insights`); this file only decides how they are shown and
 * which links are safe to draw.
 */

export type DemandTrend = "new" | "up" | "down" | "flat";

export interface DemandTarget {
  kind: "product" | "add_product" | "products";
  adminPath: string;
  label: string;
  productTitle?: string;
}

export interface DemandItem {
  key: string;
  label: string;
  timesAsked: number;
  previous: number;
  trend: DemandTrend;
  trendPct: number | null;
  failedKind: string;
  failed: string;
  action: { kind: string; text: string };
  surfaces: string[];
  lastAskedAt: string;
  status: "open" | "closed";
  target: DemandTarget;
  closedBy?: { title: string; adminPath: string | null; asksSince: number | null };
}

export interface DemandInsights {
  windowDays: number;
  since: string;
  totalAsks: number;
  items: DemandItem[];
  shop?: string;
}

/** What the page can be showing. A failed read is its own state: it must never read as "nothing was asked". */
export type DemandState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "no-store" }
  | { kind: "ready"; data: DemandInsights };

/** A path the api built inside the Shopify admin: `/products`, `/products/new` or `/products/<digits>`. */
export const ADMIN_PATH = /^\/products(\/new|\/[0-9]+)?$/;

/** `<handle>.myshopify.com`, nothing more (no scheme, port, path or userinfo). */
export const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/**
 * The Shopify admin page for a path, or null. Built from the store's own handle and a path of the shape the api
 * builds, never from a URL in the data, and checked as https on admin.shopify.com before it is handed to an `<a>`
 * (React does not stop a `javascript:` href).
 */
export function adminUrl(shop: unknown, path: unknown): string | null {
  if (typeof shop !== "string" || !SHOP_DOMAIN.test(shop) || typeof path !== "string" || !ADMIN_PATH.test(path)) return null;
  return safeHref(`https://admin.shopify.com/store/${shop.replace(/\.myshopify\.com$/, "")}${path}`);
}

/** Only an http(s) address becomes a link. */
export function safeHref(url: string | null | undefined): string | null {
  const u = url?.trim();
  return u && /^https?:\/\//i.test(u) ? u : null;
}

/** "Asked once" / "Asked 14 times". */
export function askedLine(n: number): string {
  return n === 1 ? "Asked once" : `Asked ${n} times`;
}

const SURFACE_NAMES: Record<string, string> = { storefront: "Storefront chat", whatsapp: "WhatsApp", woocommerce: "WooCommerce" };

/** "Storefront chat, WhatsApp"; a surface this page has no name for is left out rather than shown raw. */
export function surfaceLine(surfaces: readonly string[]): string {
  return surfaces
    .map((s) => SURFACE_NAMES[s])
    .filter((s): s is string => Boolean(s))
    .join(", ");
}

/** The trend against the 30 days before; null when flat. More unmet asks is the worrying direction. */
export function trendLine(item: Pick<DemandItem, "trend" | "trendPct">): { tone: "warning" | "info" | "success"; text: string } | null {
  switch (item.trend) {
    case "new":
      return { tone: "info", text: "New this month" };
    case "up":
      return item.trendPct == null ? null : { tone: "warning", text: `Up ${item.trendPct}% on the month before` };
    case "down":
      return { tone: "success", text: `Down ${Math.abs(item.trendPct ?? 0)}% on the month before` };
    default:
      return null;
  }
}

/** The state a failed read maps to: a business with no connected store is its own state, not an error. */
export function stateOfError(err: unknown): DemandState {
  const e = err as { status?: unknown; code?: unknown } | null;
  return e && e.status === 404 && e.code === "NO_STORE" ? { kind: "no-store" } : { kind: "error" };
}

/** Whether a read answer has the shape this page draws (anything else is shown as a failed read). */
export function isInsights(v: unknown): v is DemandInsights {
  const d = v as Partial<DemandInsights> | null;
  return !!d && typeof d === "object" && Array.isArray(d.items) && typeof d.totalAsks === "number" && typeof d.windowDays === "number";
}
