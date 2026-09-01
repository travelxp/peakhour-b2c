"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerifiedNumbers } from "@/components/control-plane/verified-numbers";
import { RoutingMatrix } from "@/components/control-plane/routing-matrix";
import { ActivityLedger } from "@/components/control-plane/activity-ledger";
import {
  memberLabel,
  WHATSAPP_ACTIVITY_TAB,
  WHATSAPP_SETTINGS_TAB,
  WHATSAPP_TAB_PARAM,
} from "@/lib/control-plane";
import {
  useMerchantContacts,
  useNotificationDomains,
  useOrgMembers,
  useRoutingMatrix,
} from "@/hooks/use-control-plane";

/**
 * `/dashboard/settings/whatsapp` — §02 and §07 of the interface specification.
 *
 * ── ★★THREE QUESTIONS THE PLATFORM COULD NOT PREVIOUSLY ANSWER ───────────
 *
 * Who at this business may command Peakhour, which of them hears about what,
 * and how they want to be spoken to. ✅**PR-2.5d adds the fourth** — what
 * Peakhour actually did about it, on §07's second tab.
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
 * ── ✅★★AND WHAT §07 NOW DRAWS, WITH ONE ROW IT CANNOT ───────────────────
 *
 * PR-1.6b left the ledger out because *"the refusal event is a bare
 * `console.log` … so the masked number §07 draws has no source at all"*. ✅That
 * is paid: `plt_activity` (migration 282) is the collection, api#1195 the
 * writer, api#1197 the read. **The tab is no longer an empty room.**
 *
 * ⏸🚫★★EXCEPT FOR §07's FOURTH ROW, WHICH IS A STRANGER AND IS NEVER WRITTEN.
 * A number with no contact row anywhere resolves no org, and `recordActivity`
 * declines the write rather than create a document `by_org_recent` cannot find
 * and neither erase filter can remove. ★So that row is probing **Peakhour**,
 * not a merchant, and belongs on a platform-level surface that does not exist —
 * see `components/control-plane/activity-ledger.tsx` for what reaches this page
 * instead, and why the mask still matters.
 */
export default function WhatsAppSettingsPage() {
  // ⚠️★`useSearchParams` BAILS THE ROUTE OUT OF STATIC RENDERING WITHOUT A
  //  SUSPENSE BOUNDARY, and the fallback carries the header so hydration does
  //  not shift the page down. Same shape as `dashboard/ads`.
  return (
    <Suspense fallback={<PageShell width="narrow">{header()}</PageShell>}>
      <WhatsAppSettings />
    </Suspense>
  );
}

function header() {
  return (
    <PageHeader
      title="Peakhour on WhatsApp"
      description="Who at this business can tell Peakhour what to do, who hears about what, and what Peakhour did."
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
}

function LoadingState() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading WhatsApp settings">
      <div className="h-24 rounded-lg bg-muted animate-pulse" />
      <div className="h-64 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}

function WhatsAppSettings() {
  const { user, orgs, org, business } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // ★THE CANONICAL DERIVATION, the same three lines the Team page and
  //  `team-section` both use. Role lives on `OrgSummary`, not on `AuthOrg`.
  const currentRole = orgs.find((o) => o._id === org?._id)?.role || "viewer";
  const isAdmin = currentRole === "admin" || currentRole === "owner";

  const domains = useNotificationDomains();
  const matrix = useRoutingMatrix();
  const contacts = useMerchantContacts();
  const members = useOrgMembers();

  // ★★ONLY `activity` SWITCHES THE TAB; EVERYTHING ELSE IS THE SETTINGS ONE.
  //  This page had no tabs before 2.5d, so every link anybody has already
  //  written must land where it did — and an unrecognised `?tab=` value is a
  //  typo, not a third tab. 🚫Defaulting to the ledger for an unknown value
  //  would take a merchant following an old link to a page they did not ask for.
  const urlTab =
    params.get(WHATSAPP_TAB_PARAM) === WHATSAPP_ACTIVITY_TAB
      ? WHATSAPP_ACTIVITY_TAB
      : WHATSAPP_SETTINGS_TAB;

  // ⚠️★★THE TAB THE MERCHANT JUST CLICKED, HELD UNTIL THE URL CATCHES UP.
  //  `router.replace` commits in a transition, during which `useSearchParams`
  //  still returns the OLD params — so a `value` read only from the URL leaves
  //  the tab visibly unchanged for a beat after the click. ★`dashboard/ads`
  //  carries the same held value for the same reason.
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  // ★CLEARED DURING RENDER the moment the URL agrees, which is React's
  //  documented pattern for state derived from a changing input — a `setState`
  //  in an effect body cascades an extra render and the lint rejects it.
  //  ★Equality is the only rule needed: by the time Back is reachable the
  //  navigation has long since committed.
  if (pendingTab !== null && urlTab === pendingTab) setPendingTab(null);
  const tab = pendingTab ?? urlTab;

  // ★`replace`, NOT `push`. A tab is not a place: pushing would make Back walk
  //  a merchant through every tab they clicked before leaving the page.
  //  ★And the settings tab DROPS the parameter rather than writing
  //  `?tab=settings`, so the canonical URL is the one that has always existed.
  function selectTab(next: string) {
    setPendingTab(next);
    const q = new URLSearchParams(params.toString());
    if (next === WHATSAPP_ACTIVITY_TAB) q.set(WHATSAPP_TAB_PARAM, next);
    else q.delete(WHATSAPP_TAB_PARAM);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // ⚠️★★THE MATRIX NEEDS A BUSINESS AND THE REGISTRY DOES NOT — the api draws
  //  that line and this page keeps it. `plt_routing.businessId` is REQUIRED, so
  //  a matrix without one is not a smaller matrix, it is an unanswerable
  //  question; `cfg_notification_domains` is global and resolves either way.
  //  ★THE LEDGER IS ON THE MATRIX'S SIDE: `GET /activity` is
  //  `requireBusiness()` too, so both tabs wait for the same thing.
  if (!business?._id) {
    return (
      <PageShell width="narrow">
        {header()}
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

  // ★THE SIGNED-IN USER'S OWN ID, from the session rather than inferred from
  //  the member list. It decides which pending row gets a code box: confirming
  //  a number is the contact's own action, and offering the box on a
  //  teammate's row would be offering a control that answers 403 every time.
  const currentUserId = user?._id ?? null;

  const owner = members.data?.find((m) => m.isOwner) ?? null;
  const ownerLabel = owner ? `the Owner, ${memberLabel(owner)}` : "the Owner";

  return (
    <PageShell width="narrow">
      {header()}

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

      <Tabs
        value={tab}
        onValueChange={selectTab}
        // ⚠️★MANUAL ACTIVATION. With Radix's default "automatic", arrowing
        //  across the tab list selects on every focus move — and each selection
        //  here is a `router.replace`, so an arrow-key user would fire a
        //  navigation per keypress. Focus moves freely; Enter or Space commits.
        //  ★`dashboard/ads` sets it for exactly this reason.
        activationMode="manual"
      >
        <TabsList>
          <TabsTrigger value={WHATSAPP_SETTINGS_TAB}>
            Numbers &amp; routing
          </TabsTrigger>
          <TabsTrigger value={WHATSAPP_ACTIVITY_TAB}>Activity</TabsTrigger>
        </TabsList>

        <TabsContent value={WHATSAPP_SETTINGS_TAB} className="space-y-6">
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
        </TabsContent>

        <TabsContent value={WHATSAPP_ACTIVITY_TAB}>
          {/* ⚠️★★THE LEDGER DOES NOT WAIT ON THE OTHER TAB'S FOUR READS, and it
              must not: a matrix that 500s is not a reason to hide a record of
              refusals. ★It takes the domain REGISTRY because a row's group is a
              `cfg_notification_domains` key — the same reason `RoutingMatrix`
              takes it, and the same reason neither hard-codes the set. A
              registry that failed to load costs a display name, not the row. */}
          <ActivityLedger
            domains={domains.data ?? []}
            timeZonePreference={user?.preferences?.timezone}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
