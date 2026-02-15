import { api } from "./api";

export interface AuthUser {
  _id: string;
  email: string;
  name: string | null;
  status?: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  profileCompleted: boolean;
}

export interface AuthOrg {
  _id: string;
  name: string;
  slug: string;
  businessCategory?: string | null;
  businessType?: string | null;
  onboarding?: { completed: boolean };
}

export interface OrgSummary {
  _id: string;
  name: string;
  slug: string;
  role: string;
}

export interface MeResponse {
  user: AuthUser;
  org: AuthOrg | null;
  orgs: OrgSummary[];
}

export interface VerifyMagicResponse {
  user: AuthUser;
  hasOrg: boolean;
  redirectTo: string;
}

// ── Magic Link ──────────────────────────────────────────────────

export async function sendMagicLink(
  email: string
): Promise<{ message: string }> {
  return api.post<{ message: string }>("/v1/auth/magic-link", { email });
}

export async function verifyMagicLink(
  token: string,
  uid: string
): Promise<VerifyMagicResponse> {
  return api.get<VerifyMagicResponse>(
    `/v1/auth/verify-magic?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`
  );
}

// ── Profile ─────────────────────────────────────────────────────

export async function updateProfile(data: {
  name: string;
  mobile?: string;
}): Promise<{ user: { name: string; mobile: string | null; profileCompleted: boolean } }> {
  return api.put<{ user: { name: string; mobile: string | null; profileCompleted: boolean } }>("/v1/auth/profile", data);
}

// ── OTP ─────────────────────────────────────────────────────────

export async function sendOtp(
  mobile: string
): Promise<{ message: string }> {
  return api.post<{ message: string }>("/v1/auth/otp/send-otp", { mobile });
}

export async function verifyOtp(
  mobile: string,
  otp: string
): Promise<{ mobileVerified: boolean }> {
  return api.post<{ mobileVerified: boolean }>("/v1/auth/otp/verify-otp", {
    mobile,
    otp,
  });
}

// ── Session ─────────────────────────────────────────────────────

export async function getMe(): Promise<MeResponse> {
  return api.get<MeResponse>("/v1/auth/me");
}

export async function refreshTokens(): Promise<{ user: AuthUser }> {
  return api.post<{ user: AuthUser }>("/v1/auth/refresh");
}

export async function logout(): Promise<void> {
  await api.post("/v1/auth/logout");
}

// ── Orgs ────────────────────────────────────────────────────────

export async function getOrgs(): Promise<{ orgs: OrgSummary[] }> {
  return api.get<{ orgs: OrgSummary[] }>("/v1/auth/orgs");
}

export async function switchOrg(
  orgId: string
): Promise<{ org: AuthOrg }> {
  return api.post<{ org: AuthOrg }>("/v1/auth/orgs/switch-org", { orgId });
}
