import { api } from "./api";

export interface AuthUser {
  _id: string;
  email: string;
  name: string;
  role: string;
  status?: string;
}

export interface AuthOrg {
  _id: string;
  name: string;
  slug: string;
  businessType: string;
  onboarding?: { completed: boolean };
}

export interface AuthResponse {
  user: AuthUser;
  org: AuthOrg | null;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  return api.post<AuthResponse>("/v1/auth/login", { email, password });
}

export async function register(data: {
  email: string;
  password: string;
  name: string;
  orgName: string;
  businessType: string;
}): Promise<AuthResponse> {
  return api.post<AuthResponse>("/v1/auth/register", data);
}

export async function getMe(): Promise<AuthResponse> {
  return api.get<AuthResponse>("/v1/auth/me");
}

export async function refreshTokens(): Promise<{ user: AuthUser }> {
  return api.post<{ user: AuthUser }>("/v1/auth/refresh");
}

export async function logout(): Promise<void> {
  await api.post("/v1/auth/logout");
}
