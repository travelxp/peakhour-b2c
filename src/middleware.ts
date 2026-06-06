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

/**
 * Build the per-request CSP + the request headers that carry the nonce (so
 * Next.js can stamp it onto framework `<script>` tags for 'strict-dynamic').
 * Only needed for full-document requests — prefetch/rsc/server-action requests
 * deliberately get no nonce/CSP (it can break RSC streaming).
 */
function buildCsp(req: NextRequest): { csp: string; reqHeaders: Headers } {
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
  );
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const connectSrc = [
    "connect-src 'self'",
    apiOrigin,
    "https://*.vercel-insights.com",
    "https://vitals.vercel-insights.com",
    "https://*.vercel-analytics.com",
    isDev ? "ws: wss: http://localhost:* ws://localhost:*" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Allow framing https subresources — the LinkedIn carousel preview renders
    // a PDF served from the R2 media origin in an <iframe>. Consistent with the
    // img-src `https:` allowance; `frame-ancestors 'none'` still blocks anyone
    // from framing US.
    "frame-src 'self' https:",
    connectSrc,
    "frame-ancestors 'none'",
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
  const gated =
    comingSoon &&
    pathname !== "/coming-soon" &&
    !isPublicPath &&
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
