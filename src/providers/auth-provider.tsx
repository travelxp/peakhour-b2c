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
  getMe,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
} from "@/lib/auth";

interface AuthState {
  user: AuthUser | null;
  org: AuthOrg | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    orgName: string;
    businessType: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    org: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check auth on mount
  useEffect(() => {
    getMe()
      .then(({ user, org }) => {
        setState({
          user,
          org,
          isLoading: false,
          isAuthenticated: true,
        });
      })
      .catch(() => {
        setState({
          user: null,
          org: null,
          isLoading: false,
          isAuthenticated: false,
        });
      });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user, org } = await apiLogin(email, password);
      setState({ user, org, isLoading: false, isAuthenticated: true });
      router.push("/dashboard/overview");
    },
    [router]
  );

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      name: string;
      orgName: string;
      businessType: string;
    }) => {
      const { user, org } = await apiRegister(data);
      setState({ user, org, isLoading: false, isAuthenticated: true });
      router.push("/dashboard/overview");
    },
    [router]
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setState({
      user: null,
      org: null,
      isLoading: false,
      isAuthenticated: false,
    });
    router.push("/auth/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
