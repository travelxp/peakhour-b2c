"use client";

import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerifiedNumbers } from "@/components/control-plane/verified-numbers";
import { RoutingMatrix } from "@/components/control-plane/routing-matrix";
import { memberLabel } from "@/lib/control-plane";
import {
  useMerchantContacts,
  useNotificationDomains,
  useOrgMembers,
  useRoutingMatrix,
} from "@/hooks/use-control-plane";

/**
 * `/dashboard/settings/whatsapp` — §02 of the interface specification, PR-1.6b.
 *
 * ── ★★THREE QUESTIONS THE PLATFORM COULD NOT PREVIOUSLY ANSWER ───────────
 *
 * Who at this business may command Peakhour, which of them hears about what,
 * and how they want to be spoken to.
 *
 * ⚠️★★THIS IS FLOW A AND IT IS NOT THE OTHER WHATSAPP IN THIS DASHBOARD.
 * `/dashboard/content/whatsapp` is Flow B — the merchant messaging their own
 * shoppers, from the merchant's own WABA. **This page is Peakhour messaging the
 * merchant, from Peakhour's number**, and the whole point of the control plane
 * is that the two never mix. The one place they meet on this page is the
 * `whatsapp` CHANNEL row in the matrix, which is labelled "(your customers)"
 * for exactly that reason.
 *
 * ── 🚫★★WHAT §02 DRAWS THAT THIS PAGE DELIBERATELY DOES NOT ──────────────
 *
 * ★**The "we message you from +91 …" headline.** The number is
 * environment-specific — it is the platform org's WABA, keyed by
 * `PEAKHOUR_PLATFORM_ORG_ID` — and **nothing exposes it to b2c**. Hard-coding
 * it would be the hard-coded-domains mistake in a different costume, wrong in
 * every environment but one. ⚠️And it would be wrong in production too, for
 * now: **before M3 and PR-2.3 Peakhour cannot send from that number at all**,
 * so copy promising messages from it would be describing something that cannot
 * happen. It belongs with 2.3, and it needs an api sibling to expose the sender
 * when it lands.
 *
 * ★**The "send yourself a test message" button.** It needs an approved UTILITY
 * template on the platform plane — a mongodb sibling that does not exist — plus
 * M3. Every send would return `NOT_DELIVERED`, for every merchant. **Shipping a
 * button that can only fail is worse than shipping none.**
 *
 * ★**The `?tab=activity` ledger (§07).** PR-2.5 owns it, and it owns a WRITE
 * rather than a surface: the refusal event is a bare `console.log` in
 * `webhooks/meta.ts`, nothing is persisted, and its payload has no `msg.from` —
 * so **the masked number §07 draws has no source at all.** A second tab today
 * would be an empty room with a sign on the door.
 */

function LoadingState() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading WhatsApp settings">
      <div className="h-24 rounded-lg bg-muted animate-pulse" />
      <div className="h-64 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}

export default function WhatsAppSettingsPage() {
  const { user, orgs, org, business } = useAuth();
  // ★THE CANONICAL DERIVATION, the same three lines the Team page and
  //  `team-section` both use. Role lives on `OrgSummary`, not on `AuthOrg`.
  const currentRole = orgs.find((o) => o._id === org?._id)?.role || "viewer";
  const isAdmin = currentRole === "admin" || currentRole === "owner";

  const domains = useNotificationDomains();
  const matrix = useRoutingMatrix();
  const contacts = useMerchantContacts();
  const members = useOrgMembers();

  // ★★THE SIGNED-IN USER'S OWN ID, from the session rather than inferred from
  //  the member list. It decides which pending row gets a code box: confirming
  //  a number is the contact's own action, and offering the box on a
  //  teammate's row would be offering a control that answers 403 every time.
  const currentUserId = user?._id ?? null;

  const owner = members.data?.find((m) => m.isOwner) ?? null;
  const ownerLabel = owner ? `the Owner, ${memberLabel(owner)}` : "the Owner";

  const header = (
    <PageHeader
      title="Peakhour on WhatsApp"
      description="Who at this business can tell Peakhour what to do, and who hears about what."
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/settings">
            <ArrowLeft className="size-4" aria-hidden />
            Settings
          </Link>
        </Button>
      }
    />
  );

  // ⚠️★★THE MATRIX NEEDS A BUSINESS AND THE REGISTRY DOES NOT — the api draws
  //  that line and this page keeps it. `plt_routing.businessId` is REQUIRED, so
  //  a matrix without one is not a smaller matrix, it is an unanswerable
  //  question; `cfg_notification_domains` is global and resolves either way.
  if (!business?._id) {
    return (
      <PageShell width="narrow">
        {header}
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Choose a business first</h2>
            </CardTitle>
            <CardDescription>
              Numbers and routing belong to one business, so Peakhour knows
              which store an instruction is about.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageShell>
    );
  }

  const isLoading =
    domains.isLoading ||
    matrix.isLoading ||
    contacts.isLoading ||
    members.isLoading;

  const error = domains.error || matrix.error || contacts.error || members.error;

  return (
    <PageShell width="narrow">
      {header}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-4" aria-hidden />
            <h2 className="text-base font-semibold">
              How Peakhour talks to you
            </h2>
          </CardTitle>
          <CardDescription>
            Reply to Peakhour in any language to approve work, ask questions or
            change a setting. <strong>Nothing you say here reaches your
            customers</strong> — this is between you and Peakhour.
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoading && <LoadingState />}

      {!isLoading && error && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive"
        >
          Could not load your WhatsApp settings. Reload the page to try again.
        </div>
      )}

      {!isLoading && !error && (
        <>
          <VerifiedNumbers
            contacts={contacts.data ?? []}
            members={members.data ?? []}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
          />
          <RoutingMatrix
            domains={domains.data ?? []}
            matrix={
              matrix.data ?? { byDomain: [], byChannel: [], malformed: [] }
            }
            contacts={contacts.data ?? []}
            members={members.data ?? []}
            isAdmin={isAdmin}
            ownerLabel={ownerLabel}
          />
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">
              {/* ★AN EDITOR SEES THE WHOLE PAGE AND EDITS THEIR OWN
                  PREFERENCES. Registering a number and assigning a cell are
                  Owner/Admin; the language they read and the hours they will
                  not take a message are theirs. */}
              Only Owners and Admins can register numbers or change who hears
              about what. You can still set how Peakhour writes to your own
              number.
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}
