"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  type AuthUser,
  type AuthOrg,
  type OrgSummary,
  getMe,
  logout as apiLogout,
  switchOrg as apiSwitchOrg,
} from "@/lib/auth";

interface AuthState {
  user: AuthUser | null;
  org: AuthOrg | null;
  orgs: OrgSummary[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    org: null,
    orgs: [],
    isLoading: true,
    isAuthenticated: false,
  });

  const refreshUser = useCallback(async () => {
    try {
      const { user, org, orgs } = await getMe();
      setState({
        user,
        org,
        orgs: orgs || [],
        isLoading: false,
        isAuthenticated: true,
      });
    } catch {
      setState({
        user: null,
        org: null,
        orgs: [],
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  // Check auth on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({
      user: null,
      org: null,
      orgs: [],
      isLoading: false,
      isAuthenticated: false,
    });
    router.push("/auth");
  }, [router]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      const { org } = await apiSwitchOrg(orgId);
      setState((prev) => ({ ...prev, org: org as AuthOrg }));
      router.refresh();
    },
    [router]
  );

  return (
    <AuthContext.Provider
      value={{ ...state, logout, refreshUser, switchOrg }}
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
