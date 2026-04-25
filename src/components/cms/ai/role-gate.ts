/**
 * Mirror of the CMS role hierarchy in peakhour-api/middleware/requireCmsRole.ts.
 * Use to gate buttons + actions client-side so viewers don't click into 403s.
 * Server-side enforcement is the source of truth — this is UX only.
 */

const TIER: Record<string, number> = {
  superadmin: 40,
  ops: 30,
  support: 20,
  viewer: 10,
};

export type CmsRole = "viewer" | "support" | "ops" | "superadmin" | undefined;

export function hasCmsRole(role: CmsRole, required: keyof typeof TIER): boolean {
  return (TIER[role || ""] ?? 0) >= (TIER[required] ?? 100);
}
