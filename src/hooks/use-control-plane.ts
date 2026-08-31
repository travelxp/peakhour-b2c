"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getTeamMembers, type TeamMember } from "@/lib/auth";
import {
  deleteRoutingAssignment,
  getMerchantContacts,
  getNotificationDomains,
  getRoutingMatrix,
  patchContactPreferences,
  putRoutingAssignment,
  registerContact,
  resendContactCode,
  revokeContact,
  verifyContact,
  type ContactRegister,
  type MerchantContact,
  type NotificationDomain,
  type QuietHours,
  type RoutingAssignmentInput,
  type RoutingMatrix,
} from "@/lib/api/control-plane";

/**
 * The four reads and six writes behind `/dashboard/settings/whatsapp`.
 *
 * ★★EVERY MUTATION INVALIDATES THE READS IT CHANGES, EXPLICITLY, and one of
 * them invalidates a read it does not obviously touch: registering or revoking
 * a NUMBER changes what the ROUTING MATRIX means, because a cell assigned to
 * somebody with no verified number falls through to the Owner. **The matrix
 * would otherwise go on naming a person the notifications had stopped reaching.**
 */

export const CONTROL_PLANE_DOMAINS_KEY = "/v1/control-plane/domains";
export const CONTROL_PLANE_ROUTING_KEY = "/v1/control-plane/routing";
export const CONTROL_PLANE_CONTACTS_KEY = "/v1/control-plane/contacts";
export const CONTROL_PLANE_MEMBERS_KEY = "/v1/auth/team/members";

/**
 * The domain registry.
 *
 * ★NOT GATED ON A BUSINESS, because the api is not: `cfg_notification_domains`
 * is global — no `orgId`, no `businessId` — so this resolves for an org that
 * has not made a business yet, and §02 can draw its first table before then.
 *
 * ★A LONG `staleTime`: ops seeding a domain is a rare event and needs no
 * deploy, so the page should pick one up on the next visit rather than poll for
 * it. 🚫`Infinity` would mean a seeded domain never appeared without a reload.
 */
export function useNotificationDomains() {
  const { isAuthenticated } = useAuth();
  return useQuery<NotificationDomain[]>({
    queryKey: [CONTROL_PLANE_DOMAINS_KEY],
    queryFn: getNotificationDomains,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

/** The matrix for the CURRENT business — `requireBusiness()` on the api, so
 *  this waits for one rather than sending a request that answers 403. */
export function useRoutingMatrix() {
  const { business, isAuthenticated } = useAuth();
  return useQuery<RoutingMatrix>({
    queryKey: [CONTROL_PLANE_ROUTING_KEY, business?._id ?? null],
    queryFn: getRoutingMatrix,
    enabled: isAuthenticated && !!business?._id,
    staleTime: 30_000,
  });
}

export function useMerchantContacts() {
  const { business, isAuthenticated } = useAuth();
  return useQuery<MerchantContact[]>({
    queryKey: [CONTROL_PLANE_CONTACTS_KEY, business?._id ?? null],
    queryFn: getMerchantContacts,
    enabled: isAuthenticated && !!business?._id,
    // ★SHORTER THAN THE OTHERS, because a pending row is a clock: somebody is
    //  waiting for a teammate to enter a code, and the row's status changes
    //  from another device.
    staleTime: 10_000,
  });
}

/** Every org member — the assignee picker, and the name and role beside each
 *  number. ★Behind `requireAuth + requireOrg` with NO role gate, so an Editor
 *  looking at this page sees the same list. */
export function useOrgMembers() {
  const { org, isAuthenticated } = useAuth();
  return useQuery<TeamMember[]>({
    queryKey: [CONTROL_PLANE_MEMBERS_KEY, org?._id ?? null],
    queryFn: async () => (await getTeamMembers()).members,
    enabled: isAuthenticated && !!org?._id,
    staleTime: 60_000,
  });
}

/** ★★THE ONE HOOK THAT KNOWS WHAT DEPENDS ON WHAT. Kept in a single place so a
 *  new mutation cannot forget half of it. */
function useControlPlaneInvalidation() {
  const qc = useQueryClient();
  return {
    routing: () =>
      void qc.invalidateQueries({ queryKey: [CONTROL_PLANE_ROUTING_KEY] }),
    /** ⚠️Contacts AND routing: a number's status decides whether a cell
     *  actually reaches the person it names. */
    contacts: () => {
      void qc.invalidateQueries({ queryKey: [CONTROL_PLANE_CONTACTS_KEY] });
      void qc.invalidateQueries({ queryKey: [CONTROL_PLANE_ROUTING_KEY] });
    },
  };
}

export function useAssignCell() {
  const invalidate = useControlPlaneInvalidation();
  return useMutation({
    mutationFn: (input: RoutingAssignmentInput) => putRoutingAssignment(input),
    onSuccess: invalidate.routing,
  });
}

export function useClearCell() {
  const invalidate = useControlPlaneInvalidation();
  return useMutation({
    mutationFn: (id: string) => deleteRoutingAssignment(id),
    onSuccess: invalidate.routing,
  });
}

export function useRegisterContact() {
  const invalidate = useControlPlaneInvalidation();
  return useMutation({
    mutationFn: (input: { waId: string; userId?: string }) =>
      registerContact(input),
    onSuccess: invalidate.contacts,
  });
}

export function useResendCode() {
  const invalidate = useControlPlaneInvalidation();
  return useMutation({
    mutationFn: (id: string) => resendContactCode(id),
    onSuccess: invalidate.contacts,
  });
}

/** ⚠️★★THE CONTACT'S OWN ACTION. An Owner submitting somebody else's code gets
 *  403 `NOT_YOUR_NUMBER` — the row asserts `waId → userId`, and an
 *  authenticated submit is what proves both halves. */
export function useVerifyContact() {
  const invalidate = useControlPlaneInvalidation();
  return useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      verifyContact(id, code),
    onSuccess: invalidate.contacts,
  });
}

export function useRevokeContact() {
  const invalidate = useControlPlaneInvalidation();
  return useMutation({
    mutationFn: (id: string) => revokeContact(id),
    onSuccess: invalidate.contacts,
  });
}

export function useUpdatePreferences() {
  const invalidate = useControlPlaneInvalidation();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: {
        locale?: string | null;
        register?: ContactRegister | null;
        quietHours?: QuietHours | null;
      };
    }) => patchContactPreferences(id, patch),
    // ★Preferences do not change routing — only a number's STATUS does — but
    //  the shared invalidator is used anyway rather than a narrower one, so a
    //  later field that DOES affect delivery cannot be added here and quietly
    //  leave the matrix stale.
    onSuccess: invalidate.contacts,
  });
}
