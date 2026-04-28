"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  type AuthUser,
  type AuthOrg,
  type AuthBusiness,
  type OrgSummary,
  type BusinessSummary,
  getMe,
  logout as apiLogout,
  switchOrg as apiSwitchOrg,
  switchBusiness as apiSwitchBusiness,
} from "@/lib/auth";

interface AuthState {
  user: AuthUser | null;
  org: AuthOrg | null;
  orgs: OrgSummary[];
  business: AuthBusiness | null;
  businesses: BusinessSummary[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  switchBusiness: (businessId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    org: null,
    orgs: [],
    business: null,
    businesses: [],
    isLoading: true,
    isAuthenticated: false,
  });

  const refreshUser = useCallback(async () => {
    try {
      const { user, org, orgs, business, businesses } = await getMe();
      setState({
        user,
        org,
        orgs: orgs || [],
        business: business || null,
        businesses: businesses || [],
        isLoading: false,
        isAuthenticated: true,
      });
    } catch {
      setState({
        user: null,
        org: null,
        orgs: [],
        business: null,
        businesses: [],
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  // Check auth on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bootstrap auth from server cookie on mount; setState inside refreshUser is required to populate context
    refreshUser();
  }, [refreshUser]);

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
    (async () => {
      try {
        await queryClient.cancelQueries();
        await apiSwitchBusiness(state.businesses[0]._id);
        queryClient.clear();
        await refreshUser();
      } catch {
        // Latched — see comment block above. Re-mount to retry.
      }
    })();
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
    queryClient.clear();
    setState({
      user: null,
      org: null,
      orgs: [],
      business: null,
      businesses: [],
      isLoading: false,
      isAuthenticated: false,
    });
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
      await queryClient.cancelQueries();
      await apiSwitchOrg(orgId);
      queryClient.clear();
      // Reset the auto-resolve latch — the new org may be a single-
      // business org that needs its own pinning round-trip.
      autoResolveAttempted.current = false;
      await refreshUser();
    },
    [refreshUser, queryClient]
  );

  const switchBusiness = useCallback(
    async (businessId: string) => {
      await queryClient.cancelQueries();
      await apiSwitchBusiness(businessId);
      queryClient.clear();
      await refreshUser();
    },
    [refreshUser, queryClient]
  );

  return (
    <AuthContext.Provider
      value={{ ...state, logout, refreshUser, switchOrg, switchBusiness }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
