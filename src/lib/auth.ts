import { api } from "./api";

export interface UserPreferences {
  dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YY ddd";
  timezone?: string;
  currency?: string;
  language?: string;
  numberFormat?: string;
  /**
   * Chosen dashboard avatar as one `<family>:<variant>` token —
   * `monogram:amber`, `character:fox`. Typed as a bare string on purpose: the
   * variant set is artwork and grows, and a union here would have to be edited
   * in lockstep with the api's regex and the collection validator's. `null`
   * clears it. Resolve it through `resolveAvatar` in @/lib/avatars, which
   * falls back to the initials monogram for anything it does not recognise.
   */
  avatar?: string | null;
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
  cmsRole?: "viewer" | "support" | "ops" | "superadmin";
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
  /**
   * Is this business covered by the org's plan? One Peakhour Suite plan
   * activates a fixed number of Businesses; the api assigns that coverage in
   * creation order and fails OPEN when no cap is configured.
   *
   * ★ABSENT MEANS COVERED, AND THAT DEFAULT IS DELIBERATE. The field is served
   * by a newer api than some deployed b2c builds talk to, and treating a
   * missing value as "locked" would put an upgrade wall in front of the only
   * workspace a customer has. Every read site therefore uses `!== false`.
   */
  planActive?: boolean;
}

export interface EntitlementLimits {
  maxPostsPerMonth?: number;
  maxAgentRunsPerDay?: number;
  maxConnectedChannels?: number;
  maxBusinesses?: number;
  maxSeats?: number;
  monthlyAdSpendCap?: number;
  maxStorageGb?: number;
  maxAiTokensPerMonth?: number;
  /** Max LinkedIn company Pages a single business can have enabled for
   *  posting. Counted against `int_connections.config.capabilities.pages.enabledResourceIds`.
   *  Omitted = unlimited. Set per business by the API's plan-cap
   *  enforcement (PATCH /v1/integrations/linkedin_content/pages). */
  maxLinkedInPagesPerBusiness?: number;
}

/**
 * Computed entitlements snapshot for the active org. Mirrors
 * peakhour-api's `ComputedEntitlements` shape (services/entitlements/
 * compute.ts). Resolves features + integrations + limits from the
 * org's plan + active add-ons.
 *
 * `features[]` keys follow the cfg_features dotted.snake_case convention
 * (e.g., "linkedin.autonomy.l3", "audience.lookalike_pipe").
 * `integrations[]` keys follow flat snake_case matching cfg_integrations.key.
 */
export interface Entitlements {
  plan: string;
  planVersion: number;
  features: string[];
  integrations: string[];
  limits: EntitlementLimits;
  country?: string;
  currency?: string;
  computedAt: string;
}

export interface MeResponse {
  user: AuthUser;
  org: AuthOrg | null;
  orgs: OrgSummary[];
  business: AuthBusiness | null;
  businesses: BusinessSummary[];
  /**
   * Active org's entitlements snapshot. Null when the user has no
   * active org (pre-onboarding) — UI should treat as "no features".
   * When the API has trouble computing (Mongo blip, missing plan
   * row), the field is null AND `entitlementsError: true` is also
   * set — gates stay locked, ops investigates via auth log.
   */
  entitlements: Entitlements | null;
  entitlementsError?: boolean;
}

export interface VerifyMagicResponse {
  user: AuthUser;
  hasOrg: boolean;
  redirectTo: string;
}

// ── Magic Link ──────────────────────────────────────────────────

/**
 * Pre-launch sign-in is invite-only. The magic-link endpoint returns an
 * `outcome` discriminator so the sign-in page can show the right card:
 *   sent       — eligible (active member or ops-approved partner); link sent.
 *   waitlisted — applied but not yet approved; tell them they're in line.
 *   not_found  — no waitlist row; point them at the launch-partner apply form.
 * `outcome` is optional for forward/backward-compat — absent is treated as
 * "sent" (the legacy always-send behavior). Restored to always-"sent" at GA.
 */
export type MagicLinkOutcome = "sent" | "waitlisted" | "not_found";

export async function sendMagicLink(
  email: string,
  opts?: {
    /** Same-origin path to return to after verify (e.g. the store-claim page). */
    returnTo?: string;
    /** Shopify claim context — admits a merchant's email through the pre-launch
     *  gate when the token is valid (server re-checks it). */
    shopifyClaim?: { store: string; token: string };
  },
): Promise<{ outcome?: MagicLinkOutcome; message: string }> {
  return api.post<{ outcome?: MagicLinkOutcome; message: string }>(
    "/v1/auth/magic-link",
    {
      email,
      ...(opts?.returnTo ? { returnTo: opts.returnTo } : {}),
      ...(opts?.shopifyClaim ? { shopifyClaim: opts.shopifyClaim } : {}),
    },
  );
}

/** The grant's response. See {@link signInWithPassword}. */
export interface TestLoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: { _id: string; email: string; name: string | null; profileCompleted: boolean };
  orgId: string;
  businessId: string | null;
  redirectTo: string;
  /** Minted alongside the session cookies, because setting them arms csrfGuard. */
  csrfToken: string;
  credential: { label: string; expiresAt: string };
}

/**
 * May this stack sign in with a password?
 *
 * ★★THE API IS ASKED, RATHER THAN THE ANSWER BEING DUPLICATED HERE. It decides
 * from `APP_ENV`, which is server-only — this app is a separate deployment and
 * knows only which API it talks to. A build-time `NEXT_PUBLIC_TEST_LOGIN`
 * mirrored the answer and could drift out of step with it, and the failure that
 * caused was silent: a correctly-deployed dev stack with no form on the page and
 * nothing anywhere saying why.
 *
 * Returns `false` on any error. A probe that cannot reach the API is not a
 * reason to render a sign-in form that will not work.
 */
export async function isPasswordSignInAvailable(): Promise<boolean> {
  try {
    const res = await api.get<{ enabled: boolean }>("/v1/auth/test-login/available");
    return res.enabled === true;
  } catch {
    return false;
  }
}

/**
 * Reviewer password sign-in — the dev-only grant.
 *
 * ★Exists because every platform that certifies us (LinkedIn, Meta, Google,
 * TikTok, Shopify) asks for a username and password a stranger can use in an
 * incognito window, and will not accept "we'll forward the magic link to you".
 *
 * ⚠️★The server refuses this outright on production. The environment decides;
 * there is no opt-in flag on either side that could change that, and nothing the
 * UI does about visibility is a boundary.
 *
 * ★A 401 here means WRONG PASSWORD, never "token expired", and the API counts
 * failed attempts against a ten-attempt lockout — which is why `api.ts` excludes
 * this path from the auto-refresh retry (`skipsAuthRetry`). A caller that
 * reimplements the request must do the same or each typo costs two attempts.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<TestLoginResult> {
  return api.post<TestLoginResult>("/v1/auth/test-login", { email, password });
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
