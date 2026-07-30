"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatProviderName } from "@/lib/provider-names";

/**
 * Post-OAuth confirmation for any surface the connect flow can return to.
 *
 * The api's callback used to send EVERY provider to /dashboard/settings,
 * which is why reconnecting LinkedIn Ads to fix a boost ended on a
 * settings page with a green banner and no way back to the post the user
 * was boosting. `/v1/integrations/:provider/authorize?returnTo=` now
 * brings them back here instead — and the surface they land on has to say
 * the connect worked, which is this component's whole job.
 *
 * Mount it on any page passed as a `returnTo` target. It:
 *   1. toasts success (a toast, not a banner: the returning surface is
 *      the user's real destination and must not be pushed down by a
 *      dismissible strip),
 *   2. invalidates the connection-state queries so the page it returns to
 *      doesn't keep rendering its pre-connect "Connect" CTA — the stale
 *      state that invites a needless reconnect, which revokes the token
 *      we just minted (the LinkedIn reconnect loop),
 *   3. strips the params so a refresh (or a back-navigation) doesn't
 *      re-announce a connect that happened minutes ago.
 *
 * ERRORS ARE NOT HANDLED HERE. The api deliberately keeps
 * `?integration=error` on /dashboard/settings, the only surface that
 * renders the full failure copy (including the brand-mismatch "request a
 * review" affordance). If that ever changes, this is where the error
 * branch belongs.
 */
export function OAuthConnectResult() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  // A ref, not state: React 18 double-invokes effects in dev, and the
  // router.replace below is async — without this the toast fires twice.
  const announced = useRef(false);

  useEffect(() => {
    if (announced.current) return;
    if (searchParams?.get("integration") !== "connected") return;
    announced.current = true;

    const provider = searchParams.get("provider") ?? "";
    toast.success(`${formatProviderName(provider)} connected.`);

    // Same keys the settings page invalidates on connect.
    queryClient.invalidateQueries({ queryKey: ["content-hub-integrations"] });
    queryClient.invalidateQueries({ queryKey: ["linkedin-me"] });

    // Drop only OUR params — a returnTo carrying its own query (e.g.
    // /dashboard/ads?channel=linkedin) must keep it, or the page reloads
    // onto a different channel than the user left.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("integration");
    next.delete("provider");
    next.delete("select_page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, queryClient]);

  return null;
}
