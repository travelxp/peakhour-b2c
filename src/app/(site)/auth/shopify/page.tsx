import { ShopifyHandoff } from "./_components/shopify-handoff";

/**
 * /auth/shopify#t=<token>&next=<path>
 *
 * Where "Open Peakhour Dashboard" lands a merchant who has ALREADY completed one
 * email sign-in from this Shopify store. The embedded app asked the api for a
 * link; the api found a mapping for this Shopify staff user and minted a
 * single-use, minutes-lived token instead of sending them to type an address
 * they have typed before.
 *
 * The token arrives in the FRAGMENT and is never forwarded from there — a
 * fragment is not sent to a server, which keeps a bearer-equivalent secret out
 * of the edge log, any WAF, and browser history. That also means this page
 * cannot be server-rendered meaningfully; the component reads the hash through
 * useSyncExternalStore, whose server snapshot is null, so the pre-hydration
 * paint is the loading state rather than a verdict it has no way to reach.
 *
 * No Suspense boundary: nothing here reads useSearchParams.
 */
export default function ShopifyHandoffPage() {
  return <ShopifyHandoff />;
}
