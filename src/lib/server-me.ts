import { cookies, headers } from "next/headers";
import type { DehydratedState } from "@tanstack/react-query";
import { b2cAccessCookieName } from "@/lib/auth-cookies";
import { DASHBOARD_REQUEST_HEADER, fetchMeServer, meDehydratedState } from "@/lib/session-server";

/**
 * The react-query state that seeds ['me'] for a /dashboard document request, or
 * null (not a dashboard request, no access cookie, 401, slow or broken api). Null
 * means "render as before": the client fetches /me itself.
 *
 * The middleware sets the request header only for dashboard document requests
 * (and strips any client-supplied copy), so marketing pages pay nothing.
 */
export async function dashboardMeSeed(): Promise<DehydratedState | null> {
  try {
    const h = await headers();
    if (h.get(DASHBOARD_REQUEST_HEADER) !== "1") return null;
    const jar = await cookies();
    const name = b2cAccessCookieName();
    const me = await fetchMeServer({
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      accessCookieName: name,
      accessToken: jar.get(name)?.value,
    });
    return me ? meDehydratedState(me) : null;
  } catch {
    return null;
  }
}
