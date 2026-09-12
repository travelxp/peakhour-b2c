/**
 * Whether this stack can sign in with a password — resolved on the SERVER, once.
 *
 * ⚠️★SERVER-ONLY BY CONVENTION, NOT BY THE `server-only` PACKAGE, which this
 * repo does not depend on — importing it would have failed the build. The
 * module is imported by `auth/page.tsx`, an async server component, and nothing
 * else. It uses `next/fetch` caching options that are inert in a browser, so a
 * stray client import would degrade rather than break; keep it server-side
 * anyway, because the point of resolving here is to avoid a client request.
 *
 * Peakhour signs everybody in by magic link. A platform reviewer (LinkedIn,
 * Meta, Google, TikTok, Shopify) cannot receive email at our domain, so a
 * dev-only password grant exists for them. Whether it is available is decided by
 * the API from `APP_ENV`, which this app cannot read — it is a separate
 * deployment and knows only which API it talks to.
 *
 * ── ★★WHY SERVER-SIDE AND NOT A CLIENT PROBE
 *
 * A first version asked from the panel component on mount. That put a
 * credentialed request on every production `/auth` view for an answer that can
 * only ever be "false" there; it made the disclosure pop in a moment after the
 * page settled on the stacks where it IS true; and it re-fired on every remount
 * — "Use a different email" unmounts the whole form — so a transient failure
 * removed the panel until a full reload.
 *
 * `/auth` is already an async server component awaiting two API calls in
 * parallel. A third costs nothing, is cached for the whole revalidate window,
 * and the answer is known before the first byte of HTML.
 *
 * ── ★★AND A FAILURE IS LOGGED, NOT SWALLOWED
 *
 * Returning `false` on error is right — a form that will not work is worse than
 * no form. Returning it SILENTLY is what this whole change exists to stop: the
 * build-time flag it replaced failed exactly that way, and the runbook ended up
 * calling it "the condition most likely to be missed, because everything else
 * looks right". An unset `NEXT_PUBLIC_API_URL`, a cold start, a CORS
 * misconfiguration and a 5xx all land here, and on a dev stack every one of them
 * means a reviewer is looking at a page with no password form. The log is how
 * somebody finds that in under a minute instead of an afternoon.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Short: this is one boolean on the sign-in path, not a page-blocking read.
 *
 * ⚠️★IT BOUNDS THE COLD-CACHE CALL ONLY. Next strips a caller's `signal` when it
 * revalidates a stale entry in the background, so a refresh after the window has
 * no timeout of its own. That is survivable here — the stale value keeps being
 * served while it happens, so a slow API delays the NEXT answer rather than this
 * render — but the guarantee is narrower than "every call is bounded", and a
 * previous version of this comment implied otherwise.
 */
const TIMEOUT_MS = 3_000;

export async function isPasswordSignInAvailable(): Promise<boolean> {
  if (!API_URL) {
    console.warn(
      "[password-signin] NEXT_PUBLIC_API_URL is unset, so password sign-in " +
        "availability cannot be resolved. The panel will not render.",
    );
    return false;
  }
  try {
    const res = await fetch(`${API_URL}/v1/auth/test-login/available`, {
      // ★Cached for the same window as the catalog on this page. The answer
      //  changes only when a deployment's environment changes, which is a
      //  redeploy.
      next: { revalidate: 120, tags: ["password-signin-availability"] },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        `[password-signin] availability probe returned ${res.status}. The panel will not render.`,
      );
      return false;
    }
    const json = (await res.json()) as { data?: { enabled?: boolean } };
    return json.data?.enabled === true;
  } catch (err) {
    console.warn(
      `[password-signin] availability probe failed (${
        err instanceof Error ? err.message : String(err)
      }). The panel will not render.`,
    );
    return false;
  }
}
