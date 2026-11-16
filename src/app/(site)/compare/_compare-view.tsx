/**
 * The global /compare/<vendor> shell mirrors the Shopify one (family compare, scope global, surface web): the same
 * renderer, which reads the brief's scope for its crumbs. notFound() unless publishable or previewable.
 */
export { renderCompare } from "../shopify/compare/_compare-view";
