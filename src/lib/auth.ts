import { api } from "./api";

export interface UserPreferences {
  dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YY ddd";
  timezone?: string;
  currency?: string;
  language?: string;
  numberFormat?: string;
}

export interface AuthUser {
  _id: string;
  email: string;
  name: string | null;
  status?: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  profileCompleted: boolean;
  preferences: UserPreferences | null;
  cmsUser?: boolean;
}

export interface AuthOrg {
  _id: string;
  name: string;
  slug: string;
  businessCategory?: string | null;
  businessType?: string | null;
  onboarding?: { completed: boolean };
  currency?: string | null;
}

export interface OrgSummary {
  _id: string;
  name: string;
  slug: string;
  role: string;
}

export interface AuthBusiness {
  _id: string;
  name: string;
  slug: string;
  businessCategory?: string | null;
  businessType?: string | null;
  onboarding?: { completed: boolean };
}

export interface BusinessSummary {
  _id: string;
  name: string;
  slug: string;
  businessCategory?: string | null;
}

export interface MeResponse {
  user: AuthUser;
  org: AuthOrg | null;
  orgs: OrgSummary[];
  business: AuthBusiness | null;
  businesses: BusinessSummary[];
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
  preferences?: Partial<UserPreferences>;
}): Promise<{ user: { name: string; mobile: string | null; profileCompleted: boolean; preferences: UserPreferences | null } }> {
  return api.put<{ user: { name: string; mobile: string | null; profileCompleted: boolean; preferences: UserPreferences | null } }>("/v1/auth/profile", data);
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

// ── Businesses ─────────────────────────────────────────────────

export async function getBusinesses(): Promise<BusinessSummary[]> {
  return api.get<BusinessSummary[]>("/v1/auth/businesses");
}

export async function switchBusiness(
  businessId: string
): Promise<{ _id: string; name: string }> {
  return api.post<{ _id: string; name: string }>("/v1/auth/businesses/switch", { businessId });
}

// ── Team Management ─────────────────────────────────────────

export interface TeamMember {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  lastLoginAt: string | null;
  isOwner: boolean;
}

export interface PendingInvite {
  email: string;
  role: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export async function getTeamMembers(): Promise<{ members: TeamMember[] }> {
  return api.get<{ members: TeamMember[] }>("/v1/auth/team/members");
}

export async function inviteTeamMember(
  email: string,
  role: string
): Promise<{ message: string; email: string; role: string }> {
  return api.post("/v1/auth/team/invite", { email, role });
}

export async function getPendingInvites(): Promise<{ invites: PendingInvite[] }> {
  return api.get<{ invites: PendingInvite[] }>("/v1/auth/team/pending-invites");
}

export async function revokeInvite(email: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(
    `/v1/auth/team/invite/${encodeURIComponent(email)}`
  );
}

export async function updateMemberRole(
  userId: string,
  role: string
): Promise<{ message: string }> {
  return api.put<{ message: string }>(`/v1/auth/team/members/${userId}/role`, {
    role,
  });
}

export async function removeMember(
  userId: string
): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/v1/auth/team/members/${userId}`);
}

export async function acceptInvite(
  token: string,
  email: string
): Promise<{ status: string; message: string; orgId?: string; email?: string; orgName?: string }> {
  return api.post("/v1/auth/team/accept-invite", { token, email });
}
