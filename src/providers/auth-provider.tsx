"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
