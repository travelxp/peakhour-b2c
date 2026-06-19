import { NextResponse, type NextRequest } from "next/server";
import { b2cAccessCookieName, b2cRefreshCookieName } from "@/lib/auth-cookies";

const isDev = process.env.NODE_ENV !== "production";

const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/** The embedded Shopify surface must be iframeable by Shopify admin and load
 *  App Bridge from Shopify's CDN — so those routes get a distinct CSP. Every
 *  other route keeps `frame-ancestors 'none'`. */
function isShopifyEmbeddedPath(pathname: string): boolean {
  return pathname === "/shopify/embedded" || pathname.startsWith("/shopify/embedded/");
}

/** The whole /shopify/** surface (embedded + connect) shares one root layout
 *  that loads App Bridge from cdn.shopify.com synchronously in <head>
 *  (App Store requirement 2.2.3) — so script/connect allowances for the
 *  Shopify CDN apply to all of it. Only the embedded subtree is iframed by
 *  Shopify admin, so frame-ancestors stays keyed on isShopifyEmbeddedPath. */
function isShopifyPath(pathname: string): boolean {
  return pathname === "/shopify" || pathname.startsWith("/shopify/");
}

/** Shopify iframes the embedded app at the app's `application_url`, which has
 *  NO path (it's the bare b2c host) — so a fresh open / refresh / search-launch
 *  lands the iframe on `/?host=…&embedded=1`, i.e. the marketing root. That
 *  root carries `frame-ancestors 'none'` (+ vercel.json `X-Frame-Options:
 *  DENY`), so Shopify admin shows "refused to connect" on every open that
 *  isn't a live in-app client navigation. The embedded UI actually lives under
 *  /shopify/embedded, so detect this entry load (Shopify always passes `host`
 *  + `embedded`) and rewrite it onto the embedded surface with the embedded
 *  CSP — preserving the query so App Bridge can still read `host`. Live in-app
 *  paths (already under /shopify) reload directly and need no rewrite. */
function isShopifyEmbeddedEntry(req: NextRequest): boolean {
  const { pathname, searchParams } = req.nextUrl;
  if (isShopifyPath(pathname)) return false;
  return searchParams.has("host") && searchParams.has("embedded");
}

/**
 * Build the per-request CSP + the request headers that carry the nonce (so
 * Next.js can stamp it onto framework `<script>` tags for 'strict-dynamic').
 * Only needed for full-document requests — prefetch/rsc/server-action requests
 * deliberately get no nonce/CSP (it can break RSC streaming). `forceEmbedded`
 * applies the embedded (iframeable + Shopify-CDN) CSP to a request whose path
 * isn't under /shopify — used for the rewritten embedded entry load.
 */
function buildCsp(
  req: NextRequest,
  forceEmbedded = false,
): { csp: string; reqHeaders: Headers } {
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
  );
  const embedded = forceEmbedded || isShopifyEmbeddedPath(req.nextUrl.pathname);
  // The rewritten embedded entry must also receive the Shopify-CDN script /
  // connect allowances (App Bridge loads from cdn.shopify.com), so treat a
  // forced-embedded request as part of the /shopify surface too.
  const shopify = forceEmbedded || isShopifyPath(req.nextUrl.pathname);

  // WhatsApp Embedded Signup: AFTER the merchant logs in, the Facebook JS SDK
  // executes a PARSER-INSERTED INLINE <script> in our page to process the
  // response. 'strict-dynamic' only auto-trusts script-API-inserted scripts (a
  // trusted script calling createElement+src) — NOT inline scripts — and we
  // can't put our nonce on a script Facebook injects, so it's CSP-blocked and
  // FB.login fails with Meta's generic "Sorry, something went wrong" page. The
  // browser's own violation report names the remedy: allow the script's hash
  // (hashes ARE honoured alongside 'strict-dynamic'). If a future Facebook
  // sdk.js revision changes this inline script, the console reports the new
  // hash — add it here. Scoped to script-src so only this exact content runs.
  const META_SDK_INLINE_HASHES = [
    "'sha256-n46vPwSWuMC0W703pBofImv82Z26xo4LXymv0E9caPk='",
  ].join(" ");
  // Shopify routes: allow App Bridge from cdn.shopify.com (loaded by the
  // (commerce) root layout on the whole /shopify/** surface). We DON'T use
  // 'strict-dynamic' here (it fights App Bridge's dynamic loads AND ignores
  // host allowances, which would block the plain CDN script); the explicit
  // cdn.shopify.com host allowance + nonce cover our scripts.
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com"
    : shopify
      ? `script-src 'self' 'nonce-${nonce}' https://cdn.shopify.com`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${META_SDK_INLINE_HASHES}`;
  const connectSrc = [
    "connect-src 'self'",
    apiOrigin,
    shopify ? "https://cdn.shopify.com" : "",
    "https://*.vercel-insights.com",
    "https://vitals.vercel-insights.com",
    "https://*.vercel-analytics.com",
    // WhatsApp Embedded Signup: the Facebook JS SDK (connect.facebook.net,
    // loaded via 'strict-dynamic') makes runtime fetch/XHR calls to
    // www.facebook.com (impression/funnel logging) and graph.facebook.com.
    // Without these, the SDK is blocked by CSP and FB.login dies with Meta's
    // generic "Sorry, something went wrong" page. The ES popup can launch from
    // /dashboard/content/whatsapp and the /dashboard/integrations modal, so the
    // allowance is global (like the Vercel hosts above). frame-src/img-src
    // already permit `https:`, covering the SDK's xd_arbiter iframe + pixels.
    "https://www.facebook.com",
    "https://graph.facebook.com",
    "https://connect.facebook.net",
    isDev ? "ws: wss: http://localhost:* ws://localhost:*" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const frameAncestors = embedded
    ? "frame-ancestors https://admin.shopify.com https://*.myshopify.com"
    : "frame-ancestors 'none'";
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Allow framing https subresources — the LinkedIn carousel preview renders
    // a PDF served from the R2 media origin in an <iframe>. Consistent with the
    // img-src `https:` allowance; `frame-ancestors 'none'` still blocks anyone
    // from framing US (except the embedded Shopify surface, above).
    "frame-src 'self' https:",
    connectSrc,
    frameAncestors,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("content-security-policy", csp);
  return { csp, reqHeaders };
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Next.js prefetch / RSC / server-action requests. The CSP nonce dance must
  // NOT touch these (it can break RSC streaming) — previously they were excluded
  // from the middleware entirely via the matcher `missing` block. We now let the
  // middleware run on them so the coming-soon gate can rewrite them too (so the
  // real app never loads — even for a crafted RSC request), but we skip the
  // nonce/CSP work for them, preserving the prior behavior.
  const h = req.headers;
  const isPassthrough =
    h.get("next-router-prefetch") !== null ||
    h.get("purpose") === "prefetch" ||
    h.get("next-action") !== null ||
    h.get("rsc") !== null;

  // ── Coming-soon gate ────────────────────────────────────────────────
  // When COMING_SOON=true (set it in Vercel's Production env), EVERY route is
  // rewritten to the standalone /coming-soon teaser — the real app never loads
  // for the public. The team bypasses with `?preview=<COMING_SOON_PREVIEW_SECRET>`
  // (sets a 1-week httpOnly cookie); `?preview=off` clears it. To preview the
  // teaser in dev, visit /coming-soon directly, or set COMING_SOON=true locally
  // and use the preview secret to get back into the app.
  const comingSoon = process.env.COMING_SOON === "true";
  const previewSecret = process.env.COMING_SOON_PREVIEW_SECRET ?? "";
  const PREVIEW_COOKIE = "ph_preview";
  const previewParam = searchParams.get("preview");
  const revokePreview = previewParam === "off";
  const grantPreview = !!previewSecret && previewParam === previewSecret;
  const hasPreviewCookie =
    !revokePreview &&
    !!previewSecret &&
    req.cookies.get(PREVIEW_COOKIE)?.value === previewSecret;
  // Pages that stay PUBLICLY reachable even while the coming-soon gate is on.
  // Three reasons: (1) legal/compliance pages — Meta, Google, X, LinkedIn etc.
  // fetch these URLs to validate app/developer onboarding, and they must
  // resolve to the real document (not the teaser) before launch; (2) the
  // pre-launch /launch-partner capture, linked from the coming-soon CTAs;
  // (3) /auth (and /auth/verify) — the invite-only sign-in entry for approved
  // launch partners (e.g. quests.travel). The page itself reveals nothing
  // sensitive; the magic-link endpoint only sends a real link to ops-approved
  // emails (see peakhour-api auth/magic-link.ts), so exposing the form is safe.
  // This is a plain allowlist entry on the already-running middleware — it
  // adds NO new edge function (the middleware runs on every request for the
  // CSP nonce regardless).
  const PUBLIC_PATHS = [
    "/privacy-policy",
    "/terms",
    "/cookie-policy",
    "/data-deletion",
    "/launch-partner",
    "/auth",
  ];
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  // Authenticated-session bypass — SCOPED TO APP ROUTES ONLY. The b2c
  // access/refresh cookies are scoped to the root domain (.peakhour.ai) and so
  // are visible here. An approved launch partner who has signed in carries
  // `refresh_token` (30d) and must be able to reach the real app — but ONLY the
  // app, not the public marketing pages. Without the route scope, a signed-in
  // user (or anyone with a stale .peakhour.ai cookie from dev) bypassed the
  // teaser on `/` too and landed on the marketing homepage instead of "coming
  // soon". So the bypass applies only under /dashboard, /onboarding, /cms; the
  // homepage and every marketing/legal route still show the teaser to EVERYONE
  // while the gate is on. Soft gate: presence ≠ validity — the app's own auth
  // guard (AuthProvider → /v1/auth/me) bounces an invalid session back to /auth.
  const APP_PREFIXES = ["/dashboard", "/onboarding", "/cms"];
  const isAppRoute = APP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const hasSession =
    !!req.cookies.get(b2cAccessCookieName())?.value ||
    !!req.cookies.get(b2cRefreshCookieName())?.value;
  const sessionBypass = hasSession && isAppRoute;
  // The embedded Shopify surface is loaded by Shopify admin (iframe) and
  // authenticates via the App Bridge session token, not our cookie — so it
  // must stay reachable even while the coming-soon gate is on. This includes
  // the entry load (root `/?host=…&embedded=1`) we rewrite onto the embedded
  // surface below — without exempting it, the coming-soon gate would rewrite
  // it to /coming-soon and the iframe would still never reach the app.
  const embeddedEntry = isShopifyEmbeddedEntry(req);
  const isShopifyEmbedded = isShopifyEmbeddedPath(pathname) || embeddedEntry;
  const gated =
    comingSoon &&
    pathname !== "/coming-soon" &&
    !isPublicPath &&
    !isShopifyEmbedded &&
    !sessionBypass &&
    !grantPreview &&
    !hasPreviewCookie;

  let res: NextResponse;
  if (gated) {
    const url = req.nextUrl.clone();
    url.pathname = "/coming-soon";
    url.search = "";
    if (isPassthrough) {
      res = NextResponse.rewrite(url);
    } else {
      // Full-document gated request → carry the nonce so the teaser HTML matches.
      const { csp, reqHeaders } = buildCsp(req);
      res = NextResponse.rewrite(url, { request: { headers: reqHeaders } });
      res.headers.set("Content-Security-Policy", csp);
    }
  } else if (embeddedEntry) {
    // Shopify framed us at the bare app root — rewrite onto the embedded
    // surface so the iframe loads the real app (frameable, App Bridge-ready)
    // instead of the un-frameable marketing root. The browser URL is unchanged
    // by the rewrite, so App Bridge still reads `host` from `/?host=…`.
    const url = req.nextUrl.clone();
    url.pathname = "/shopify/embedded";
    if (isPassthrough) {
      res = NextResponse.rewrite(url);
    } else {
      const { csp, reqHeaders } = buildCsp(req, true);
      res = NextResponse.rewrite(url, { request: { headers: reqHeaders } });
      res.headers.set("Content-Security-Policy", csp);
    }
  } else if (isPassthrough) {
    // Preserve prior behavior: middleware did not modify these requests.
    res = NextResponse.next();
  } else {
    const { csp, reqHeaders } = buildCsp(req);
    res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set("Content-Security-Policy", csp);
  }

  if (grantPreview) {
    res.cookies.set(PREVIEW_COOKIE, previewSecret, {
      httpOnly: true,
      sameSite: "lax",
      secure: !isDev,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
  } else if (revokePreview) {
    res.cookies.delete(PREVIEW_COOKIE);
  }

  return res;
}

export const config = {
  // No `missing` exclusions — the gate must see prefetch/rsc/next-action
  // requests too (so a crafted RSC request can't pull a gated route). The
  // middleware skips the nonce/CSP work for those internally.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
