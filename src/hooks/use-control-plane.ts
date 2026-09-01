"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getTeamMembers, type TeamMember } from "@/lib/auth";
import {
  deleteRoutingAssignment,
  getActivity,
  getMerchantContacts,
  getNotificationDomains,
  getRoutingMatrix,
  patchContactPreferences,
  putRoutingAssignment,
  registerContact,
  resendContactCode,
  revokeContact,
  verifyContact,
  type ActivityCursor,
  type ActivityPage,
  type ContactRegister,
  type MerchantContact,
  type NotificationDomain,
  type QuietHours,
  type RoutingAssignmentInput,
  type RoutingMatrix,
} from "@/lib/api/control-plane";

/**
 * The five reads and six writes behind `/dashboard/settings/whatsapp`.
 *
 * ★★EVERY MUTATION INVALIDATES THE READS IT CHANGES, EXPLICITLY, and one of
 * them invalidates a read it does not obviously touch: registering or revoking
 * a NUMBER changes what the ROUTING MATRIX means, because a cell assigned to
 * somebody with no verified number falls through to the Owner. **The matrix
 * would otherwise go on naming a person the notifications had stopped reaching.**
 *
 * 🚫★★AND NOTHING INVALIDATES THE ACTIVITY LEDGER, DELIBERATELY. It is a
 * record of what arrived over WhatsApp, and **no control on this page writes
 * to it** — registering a number changes who MAY command Peakhour tomorrow, not
 * what was refused yesterday. ⚠️A mutation that invalidated it would refetch a
 * paginated list and silently collapse it back to page one under a merchant who
 * had scrolled.
 */

export const CONTROL_PLANE_DOMAINS_KEY = "/v1/control-plane/domains";
export const CONTROL_PLANE_ROUTING_KEY = "/v1/control-plane/routing";
export const CONTROL_PLANE_CONTACTS_KEY = "/v1/control-plane/contacts";
export const CONTROL_PLANE_ACTIVITY_KEY = "/v1/control-plane/activity";
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

/**
 * §07's ledger — PR-2.5d.
 *
 * ── ⚠️★★KEYSET, SO IT IS AN INFINITE QUERY AND NOT A PAGE NUMBER ─────────
 *
 * `GET /activity` returns `nextBefore` + `nextBeforeId` and refuses one without
 * the other, because `occurredAt` is Meta's timestamp in **whole seconds**: two
 * commands in the same second share an instant, and a cursor on the instant
 * alone puts the second of them on no page at all. ★So the cursor is passed
 * back as the PAIR the api handed over — this hook never constructs one, which
 * is the only way to be sure it never constructs half of one.
 *
 * ★BUSINESS-SCOPED IN THE KEY THOUGH THE QUERY IS ORG-SCOPED. The api reads
 * `{orgId}` and narrows to the business in the same pass — the org-level rows
 * are the refusals that belong to no single business — so **the RESULT differs
 * per business** even though the filter does not, and a shared cache entry
 * would show one business's tab on another.
 *
 * ⚠️★A `staleTime` OF ZERO AND NO INTERVAL. A refusal arrives when a stranger
 * or a lapsed teammate types something, which is not a clock the page can
 * predict — so it refetches when the merchant comes back to it, and does not
 * poll a collection that is quiet for days at a time.
 */
export function useActivityLedger() {
  const { business, isAuthenticated } = useAuth();
  return useInfiniteQuery<
    ActivityPage,
    Error,
    { pages: ActivityPage[] },
    (string | null)[],
    ActivityCursor | null
  >({
    queryKey: [CONTROL_PLANE_ACTIVITY_KEY, business?._id ?? null],
    queryFn: ({ pageParam }) => getActivity(pageParam),
    initialPageParam: null,
    // ★★BOTH HALVES OR NO PAGE. `nextBefore` is null on the last page, and
    //  returning a cursor with one half filled would be a 400 from the refine
    //  the api added for exactly this — the client that persists only the
    //  instant is the bug that refine exists to make unreachable.
    getNextPageParam: (last) =>
      last.nextBefore && last.nextBeforeId
        ? { before: last.nextBefore, beforeId: last.nextBeforeId }
        : null,
    enabled: isAuthenticated && !!business?._id,
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
