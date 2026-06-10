declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

/**
 * Waits for App Bridge to attach `window.shopify` (CDN async), then fetches
 * a fresh session token. Used by every embedded route to authenticate calls
 * to /v1/shopify/embedded/* — iframes can't use cookie-based auth.
 */
export async function getSessionToken(timeoutMs = 6000): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (window.shopify?.idToken) {
      try {
        return await window.shopify.idToken();
      } catch {
        // Token fetch failed (bridge not ready or transient error) — keep polling
        // rather than returning null immediately; only give up at deadline.
      }
    }
    await new Promise<void>((r) => setTimeout(r, 100));
  }
  return null;
}
