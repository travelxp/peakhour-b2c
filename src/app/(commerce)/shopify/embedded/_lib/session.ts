// Deliberately hand-rolled minimal typing for the CDN-attached
// `window.shopify` global. The official @shopify/app-bridge-types package
// was evaluated 2026-06-11 and REJECTED: its global JSX/attribute
// augmentations conflict with React 19 typings repo-wide (hundreds of
// TS2322s across (site)). Extend this interface method-by-method
// (toast, modal, ...) as we adopt more App Bridge APIs.
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
