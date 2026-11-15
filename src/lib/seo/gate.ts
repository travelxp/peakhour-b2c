import { SEO9_PAGES } from "./pages-seo9";
import { PILLAR_ORDER } from "@/lib/pillars";
import { isAppRoute } from "@/lib/route-theme";

/*
 * The coming-soon gate's two lists, in one module so the middleware (which
 * enforces the gate) and the sitemap (which must list only what the gate lets
 * through) read the SAME data and cannot drift.
 *
 * PUBLIC_PATHS moved here from middleware.ts unchanged: every exemption and
 * every comment is as it was.
 */

// Pages that stay PUBLICLY reachable even while the coming-soon gate is on.
// Three reasons: (1) legal/compliance pages — Meta, Google, X, LinkedIn etc.
// fetch these URLs to validate app/developer onboarding, and they must
// resolve to the real document (not the teaser) before launch; (2) the
// pre-launch /launch-partner capture, linked from the coming-soon CTAs;
// (3) /auth (and /auth/verify) — the invite-only sign-in entry for approved
// launch partners (e.g. quests.travel). The page itself reveals nothing
// sensitive; the magic-link endpoint only sends a real link to ops-approved
// emails (see peakhour-api auth/magic-link.ts), so exposing the form is safe.
// (4) /pricing (hub + /pricing/teams) — the plans are a public
// marketing asset; prospects and launch partners evaluate them pre-launch, and
// the CTAs already resolve to "Join the waitlist" while signups aren't open
// (see signupCta + the pricing pages). It surfaces no gated data.
// This is a plain allowlist entry on the already-running middleware — it
// adds NO new edge function (the middleware runs on every request for the
// CSP nonce regardless).
// (5) /shopify/connect, /claim and /reconnect — the pages a merchant is SENT to
// from inside another platform, with no Peakhour session, mid-flow. /shopify/connect
// is where peakhour-api lands a failed install or reconnect; /claim/{shopify,
// wordpress} is where the embedded app's BLOCKING claim gate sends a
// cold-installed store to be adopted, carrying a one-shot token in the URL.
// With the gate on and neither exempt, a cold App Store install dead-ends on
// the teaser holding a token it can no longer spend, and the store stays stuck
// — while /shopify/connect cheerfully advises the merchant to go and do exactly
// that. b2c#384 removed the first exemption along with the embedded app; the
// second was never added. /reconnect/wordpress is the same shape from the other
// platform: the WP plugin renders it as its "Approve on Peakhour.ai" button
// (wp-bridge.ts returns it as `reconnect_url`), and the gate would leave a
// reinstalled site permanently unable to approve its pairing code — sessionBypass
// does not help, since it is scoped to /dashboard, /onboarding and /cms.
//
// (6) /growth/confirm — the page behind the signed link in the `growth_mandate_confirm_v1`
// WhatsApp message (https://peakhour.ai/growth/confirm/{token}). The owner opens it from
// WhatsApp, often with no Peakhour session on that device, and confirms with the one-time
// code sent to their verified number. With the gate on it would rewrite to the teaser and a
// mandate could never be confirmed. Only this prefix: `/growth` itself is a marketing page.
//
// That is the whole set: enumerating every B2C_URL/DASHBOARD_URL the API hands
// out gives /auth, /claim/*, /reconnect/wordpress, /shopify/connect and
// /dashboard/*. These are the pages whose entire job is to work for someone who
// has never heard of us.
export const PUBLIC_PATHS = [
  "/privacy-policy",
  "/terms",
  "/cookie-policy",
  "/data-deletion",
  "/launch-partner",
  "/auth",
  "/pricing",
  // ★★`/peaks` RIDES WITH `/pricing`, BECAUSE THE HEADER NOW OFFERS BOTH AND
  // A NAV WHOSE LINKS DISAGREE ABOUT WHETHER THE SITE IS LIVE IS WORSE THAN
  // ONE THAT HIDES BOTH. `/pricing` is on this list so a prospect can
  // evaluate us before launch; Peaks is the currency every price on that page
  // is quoted in, so a visitor who clicks Pricing, reads "500 Peaks", clicks
  // Peaks and lands on the teaser has been stopped exactly where the
  // allowlist exists to let them through.
  "/peaks",
  // The "Peakhour for Shopify" page. A visitor reaches it from the App Store
  // listing and from /pricing, before there is any account to sign in to.
  "/shopify",
  "/shopify/connect",
  "/claim",
  "/reconnect",
  "/growth/confirm",
  // (7) /share, where a Drive share link lands. The person opening it has no Peakhour account and is reached from an email or a
  // message; with the gate on it would show the teaser and the file could never be opened. Only this prefix: it holds nothing but
  // the share page, which says what opening the link records before it serves the file.
  "/share",
];

/** A path matches an allowlist entry exactly or as a prefix under it. */
export function matchesPrefix(pathname: string, entries: readonly string[]): boolean {
  return entries.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Whether the coming-soon gate is on (COMING_SOON=true): the one place the variable is read for the gate. */
export function isGateOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.COMING_SOON === "true";
}

/** True when the gate lets this path reach the real app with the gate on and no bypass. */
export function isPublicPath(pathname: string): boolean {
  return matchesPrefix(pathname, PUBLIC_PATHS);
}

/**
 * The site's public marketing paths: the explicit list "is this a real page?" is
 * answered from. The sitemap does NOT read it (SEO-6): the registry (pages.ts +
 * publish.ts) decides what is listed, and `isListedThroughGate` below applies the gate.
 *
 * Adding a marketing route means adding it here: until then, with the gate on,
 * its path returns 404 rather than the teaser.
 */
export type MarketingPath = { path: string };

export const MARKETING_PATHS: readonly MarketingPath[] = [
  { path: "/" },
  { path: "/pricing" },
  { path: "/shopify" },
  // SEO-8: the wave-1 Shopify feature pages (/shopify/* already passes the coming-soon gate).
  { path: "/shopify/features" },
  { path: "/shopify/features/ai-shopping-assistant" },
  { path: "/shopify/features/whatsapp-ai-shopping" },
  { path: "/shopify/features/product-recommendations" },
  { path: "/shopify/features/frequently-bought-together" },
  { path: "/shopify/features/whatsapp-cod-confirmation" },
  { path: "/shopify/features/ai-seo" },
  { path: "/shopify/features/ai-product-descriptions" },
  { path: "/peaks" },
  { path: "/how-it-works" },
  { path: "/contact" },
  // The SEO template kit review route (SEO-5): a real page on dev, 404 on Production, never in the sitemap (it is not in the registry).
  { path: "/seo-kit" },
  { path: "/privacy-policy" },
  { path: "/terms" },
  { path: "/cookie-policy" },
  ...PILLAR_ORDER.map((slug) => ({ path: `/${slug}` })),
  // The Agency/Enterprise page. The per-pillar pricing pages went with the
  // per-module plans (billing plan D19, P4.7).
  { path: "/pricing/teams" },
  // Public pages with no own sitemap rule: the registry decides what the sitemap lists.
  { path: "/launch-partner" },
  { path: "/data-deletion" },
  { path: "/help/data-retention" },
  // SEO-11: the entity, industry and guide pages. Published or not, a known path answers the teaser (or 404 for a draft) rather than an unknown-URL 404.
  { path: "/about" },
  { path: "/features/peakhour-summit" },
  { path: "/industries" },
  { path: "/industries/fashion-apparel" },
  { path: "/guides" },
  { path: "/shopify/guides/whatsapp-cod-confirmation" },
  { path: "/coming-soon" },
  // SEO-9: the integration and feature pages and their directories, from the registry. A page held in review 404s on its own.
  ...SEO9_PAGES.map((p) => ({ path: p.path })),
];

const MARKETING_SET = new Set(MARKETING_PATHS.map((m) => m.path));

/** What the gate does with a path it is about to rewrite. */
export type GateVerdict =
  /** The teaser, as the page itself: "/". */
  | "teaser"
  /** A real page the gate is hiding: the teaser, which is not that page, so noindex. */
  | "teaser-noindex"
  /** Matches no route: a real 404, not the teaser. */
  | "not-found";

/**
 * Decide what a GATED path (one the middleware is about to rewrite) becomes.
 * "Known" is the explicit marketing list plus the routes that really exist and
 * are gated: the signed-in app (/dashboard, /onboarding, /cms), whose own
 * guards take over for a visitor with a session, and every public-allowlist
 * prefix (a path under one of those is the real app's to answer).
 */
export function gatedVerdict(pathname: string): GateVerdict {
  // Only called for a path the middleware is about to rewrite, which never includes
  // /coming-soon (the teaser itself) or an allowlisted path.
  if (pathname === "/") return "teaser";
  if (MARKETING_SET.has(pathname) || isAppRoute(pathname)) {
    return "teaser-noindex";
  }
  return "not-found";
}

/**
 * Whether the sitemap may list this path while the gate is on: the paths the gate lets
 * through, plus "/", which serves the teaser as itself.
 */
export function isListedThroughGate(path: string): boolean {
  return path === "/" || isPublicPath(path);
}
