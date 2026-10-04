/**
 * Which store the commerce pages show, when a business has more than one.
 *
 * A business may hold several stores (two Shopify shops, a Shopify shop and a
 * Woo site); pricing is per business, so a second store is free. The api picks
 * the business's PRIMARY store (first connected) for any request that does not
 * name one, so with one store nothing here changes anything: no parameter is
 * sent. With two or more, every commerce request names the picked store as
 * `?merchantId=`, so the figures, the queue and the dial all describe one store
 * in that store's currency, and the second store is reachable at all.
 */

export interface CommerceStore {
  merchantId: string;
  platform: string;
  name: string;
  shopDomain: string;
  currency: string | null;
  primary: boolean;
}

/**
 * The store to show: the one saved for this business if it is still connected,
 * else the primary. `merchantId` is undefined with fewer than two stores, so a
 * single-store business sends exactly what it sent before.
 */
export function resolveActiveStore(
  stores: CommerceStore[],
  savedId: string | null | undefined,
): { store: CommerceStore | null; merchantId: string | undefined } {
  if (stores.length === 0) return { store: null, merchantId: undefined };
  const store = stores.find((s) => s.merchantId === savedId) ?? stores.find((s) => s.primary) ?? stores[0]!;
  return { store, merchantId: stores.length > 1 ? store.merchantId : undefined };
}

/** `path` with `merchantId=` added, after any query it already has. */
export function withStore(path: string, merchantId: string | undefined): string {
  if (!merchantId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}merchantId=${encodeURIComponent(merchantId)}`;
}

/** localStorage key for a business's picked store (a per-viewer convenience). */
export const storeKeyFor = (businessId: string) => `commerce:store:${businessId}`;
