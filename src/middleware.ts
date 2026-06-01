import { NextResponse, type NextRequest } from "next/server";

const isDev = process.env.NODE_ENV !== "production";

const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "").origin;
  } catch {
    return "";
  }
})();

export function middleware(req: NextRequest) {
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
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  // Next.js extracts the nonce from this request header and stamps it onto
  // framework-injected <script> tags. Required for 'strict-dynamic' to work.
  reqHeaders.set("content-security-policy", csp);

  // ── Coming-soon gate ────────────────────────────────────────────────
  // When COMING_SOON=true (set it in Vercel's Production env), every route is
  // rewritten to the standalone /coming-soon teaser — the real app never loads
  // for the public. The team bypasses with `?preview=<COMING_SOON_PREVIEW_SECRET>`
  // (sets a session cookie); `?preview=off` clears it. To preview the teaser in
  // dev, either visit /coming-soon directly, or set COMING_SOON=true locally and
  // use the preview secret to get back into the app.
  const comingSoon = process.env.COMING_SOON === "true";
  const previewSecret = process.env.COMING_SOON_PREVIEW_SECRET ?? "";
  const PREVIEW_COOKIE = "ph_preview";
  const { pathname, searchParams } = req.nextUrl;
  const previewParam = searchParams.get("preview");
  const revokePreview = previewParam === "off";
  const grantPreview = !!previewSecret && previewParam === previewSecret;
  const hasPreviewCookie =
    !revokePreview &&
    !!previewSecret &&
    req.cookies.get(PREVIEW_COOKIE)?.value === previewSecret;

  const gated =
    comingSoon &&
    pathname !== "/coming-soon" &&
    !grantPreview &&
    !hasPreviewCookie;

  let res: NextResponse;
  if (gated) {
    const url = req.nextUrl.clone();
    url.pathname = "/coming-soon";
    url.search = "";
    res = NextResponse.rewrite(url, { request: { headers: reqHeaders } });
  } else {
    res = NextResponse.next({ request: { headers: reqHeaders } });
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

  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "next-action" },
        { type: "header", key: "rsc" },
      ],
    },
  ],
};
