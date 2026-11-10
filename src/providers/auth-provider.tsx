"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AuthUser,
  type AuthOrg,
  type AuthBusiness,
  type OrgSummary,
  type BusinessSummary,
  type Entitlements,
  logout as apiLogout,
  switchOrg as apiSwitchOrg,
  switchBusiness as apiSwitchBusiness,
} from "@/lib/auth";
import {
  ME_KEY,
  ME_STALE_MS,
  cancelScopedQueries,
  fetchMe,
  meRefetchInterval,
  meRetryDelay,
  meShouldRetry,
  primeMe,
  removeScopedQueries,
} from "@/lib/auth-session";
import { Button } from "@/components/ui/button";

// Start /me as soon as this chunk is evaluated -- before React hydrates and
// before the QueryClient exists. fetchMe() hands the in-flight request to the
// query. No-op on the server.
primeMe();

interface AuthState {
  user: AuthUser | null;
  org: AuthOrg | null;
  orgs: OrgSummary[];
  business: AuthBusiness | null;
  businesses: BusinessSummary[];
  /** Active org's entitlements snapshot from /me. Null when unavailable
   *  — every FeatureGate treats null as locked (correct safety posture). */
  entitlements: Entitlements | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  /** The last /me attempt failed for a reason that is NOT "signed out" (5xx,
   *  timeout, offline). The last known identity, if any, is kept. */
  isUnreachable: boolean;
  /** Try /me again now (also retried automatically, with backoff). */
  retry: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  switchBusiness: (businessId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Routes that cannot render without an identity: a blocked /me must not look like a logout there. */
const GATED_PREFIXES = ["/dashboard", "/cms", "/onboarding"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    staleTime: ME_STALE_MS,
    // A paused (offline) query would sit in "loading" forever; let it fail
    // fast into the unreachable state instead.
    networkMode: "always",
    retry: meShouldRetry,
    retryDelay: meRetryDelay,
    refetchInterval: meRefetchInterval,
  });

  const data = me.data ?? null;
  const state = useMemo<AuthState>(
    () => ({
      user: data?.user ?? null,
      org: data?.org ?? null,
      orgs: data?.orgs || [],
      business: data?.business || null,
      businesses: data?.businesses || [],
      entitlements: data?.entitlements ?? null,
      isLoading: me.isPending,
      isAuthenticated: data !== null,
    }),
    [data, me.isPending]
  );
  const isUnreachable = me.isError;

  const { refetch } = me;
  const refreshUser = useCallback(async () => {
    // Errors land in the query state (isUnreachable), never thrown to callers.
    await refetch();
  }, [refetch]);
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Auto-resolve a single-business org. If the JWT cookie has no
  // businessId (or a stale one) but the user has exactly one business
  // in the active org, pin it server-side so business-scoped actions
  // (Analyse, Sync, etc.) don't dead-end on "Pick a business first."
  // Multi-business orgs are left to the user — the BusinessSwitcher
  // dropdown handles that case.
  //
  // Mirrors switchBusiness's cache management: cancel in-flight queries
  // that fired against the previous (no-business) scope, clear cached
  // empty results so the next render refetches with the new scope.
  //
  // Race-with-manual-pick is not a concern here: single-business orgs
  // (the only case this effect fires for) render the BusinessSwitcher
  // as a read-only name display — there's no dropdown to click — so
  // the user cannot race the auto-resolve.
  //
  // Latch policy: latched true on attempt; we do NOT reset on catch.
  // A deterministic 4xx (e.g. business soft-deleted between getMe and
  // switch) would otherwise re-fire on every render and storm the
  // server. switchOrg resets the latch so a freshly-switched org
  // gets a clean attempt; a logout/login cycle remounts the provider,
  // resetting the ref naturally.
  const autoResolveAttempted = useRef(false);
  useEffect(() => {
    if (autoResolveAttempted.current) return;
    if (state.isLoading || !state.isAuthenticated) return;
    if (state.business) return;
    if (state.businesses.length !== 1) return;
    autoResolveAttempted.current = true;
    let cancelled = false;
    (async () => {
      try {
        await cancelScopedQueries(queryClient);
        if (cancelled) return;
        await apiSwitchBusiness(state.businesses[0]._id);
        if (cancelled) return;
        removeScopedQueries(queryClient);
        await refreshUser();
      } catch {
        // Latched — see comment block above. Re-mount to retry.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    state.isLoading,
    state.isAuthenticated,
    state.business,
    state.businesses,
    refreshUser,
    queryClient,
  ]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort — clear local state regardless
    }
    // Drop the scoped caches and answer "signed out" in the me query itself --
    // clear() would also drop the me query its observer is still holding.
    await queryClient.cancelQueries({ queryKey: ME_KEY });
    removeScopedQueries(queryClient);
    queryClient.setQueryData(ME_KEY, null);
    // Reset the auto-resolve latch so the next login (which may share
    // this provider instance if the layout doesn't unmount) gets a
    // clean attempt. router.push("/auth") doesn't guarantee remount.
    autoResolveAttempted.current = false;
    router.push("/auth");
  }, [router, queryClient]);

  // Cache scope: most queries (jobs, content stats, integrations, …) are
  // implicitly scoped to the active org/business via the auth cookie. When
  // the user switches scope, the cached results from the previous scope
  // would otherwise leak into the new view for up to staleTime — including
  // private jobs from another business. cancelQueries() first so any
  // in-flight fetch from the OLD scope can't land post-clear and
  // re-populate the cache; then clear() drops everything; then refresh
  // pulls the new auth state which the next render's queries pick up.
  const switchOrg = useCallback(
    async (orgId: string) => {
      await cancelScopedQueries(queryClient);
      await apiSwitchOrg(orgId);
      removeScopedQueries(queryClient);
      // Reset the auto-resolve latch — the new org may be a single-
      // business org that needs its own pinning round-trip.
      autoResolveAttempted.current = false;
      await refreshUser();
    },
    [refreshUser, queryClient]
  );

  const switchBusiness = useCallback(
    async (businessId: string) => {
      await cancelScopedQueries(queryClient);
      await apiSwitchBusiness(businessId);
      removeScopedQueries(queryClient);
      // Symmetric with switchOrg: if the backend later invalidates
      // this pin and refreshUser returns business=null while the lone
      // business remains, auto-resolve should be free to recover.
      autoResolveAttempted.current = false;
      await refreshUser();
    },
    [refreshUser, queryClient]
  );

  const blocked =
    isUnreachable &&
    !state.user &&
    GATED_PREFIXES.some((p) => pathname === p || pathname?.startsWith(p + "/"));

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isUnreachable,
        retry,
        logout,
        refreshUser,
        switchOrg,
        switchBusiness,
      }}
    >
      {blocked ? (
        <div className="flex min-h-screen items-center justify-center">
          <div className="space-y-4 text-center" role="alert">
            <p className="text-sm text-muted-foreground">
              We could not reach Peakhour. Your session is fine — we are
              trying again automatically.
            </p>
            <Button onClick={retry} disabled={me.isFetching}>
              {me.isFetching ? "Retrying..." : "Retry now"}
            </Button>
          </div>
        </div>
      ) : (
        children
      )}
      {isUnreachable && state.user ? (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm shadow-md"
        >
          <span className="text-muted-foreground">
            Reconnecting to Peakhour...
          </span>
          <Button size="sm" variant="outline" onClick={retry} disabled={me.isFetching}>
            Retry
          </Button>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
