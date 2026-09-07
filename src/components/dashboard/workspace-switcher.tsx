"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Loader2, Lock, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { PlanLimitDialog } from "@/components/upgrade/plan-limit-dialog";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

/**
 * WorkspaceSwitcher — ONE business name with a dropdown, in the sidebar header.
 *
 * ★IT REPLACES TWO CONTROLS THAT SAID ALMOST THE SAME THING. The header used to
 * stack an OrgSwitcher over a BusinessSwitcher: the org name in body text and
 * the business name in muted 12px underneath it, which for a single-business
 * customer is one identity printed twice at two weights. Worse, for the common
 * case both were read-only <div>s, so the header carried two labels and no
 * affordance at all — the thing that looked like a control was not one, and the
 * thing that was a control looked like a caption.
 *
 * ★THE BUSINESS IS THE IDENTITY, NOT THE ORG. Every surface below this point is
 * business-scoped — the library, the calendar, the inbox, the ad accounts — and
 * the org is a billing container the owner never thinks in. So the business name
 * is what is printed, and switching org is folded into the same list as
 * "another workspace" rather than being its own concept to learn.
 *
 * ★AND A PLAN COVERS ONE BUSINESS. Picking a workspace the plan does not cover
 * does NOT switch and then degrade — that would put the user inside a workspace
 * where every pillar answers "upgrade" and leave them to work out why. It opens
 * the plan dialog and leaves them where they were. `planActive === false` is the
 * only locking condition; an absent field means covered, because the field is
 * newer than some deployed b2c builds and a missing value must never wall off
 * the only workspace a customer has.
 */
export function WorkspaceSwitcher() {
  const { org, orgs, business, businesses, switchOrg, switchBusiness } = useAuth();
  const [switching, setSwitching] = useState<string | null>(null);
  const [locked, setLocked] = useState<{ name: string } | null>(null);

  // Other orgs the user belongs to, as workspaces they can move to. Their
  // businesses aren't in /me (it only returns the ACTIVE org's), so these switch
  // org and let the provider's auto-resolve pin the business on arrival.
  const otherOrgs = orgs.filter((o) => o._id !== org?._id);
  const activeName = business?.name ?? org?.name ?? "Workspace";
  const hasChoices = businesses.length > 1 || otherOrgs.length > 0;

  async function pickBusiness(id: string, name: string, planActive: boolean | undefined) {
    if (id === business?._id || switching) return;
    // `!== false`, deliberately — see the docblock.
    if (planActive === false) {
      setLocked({ name });
      return;
    }
    setSwitching(id);
    try {
      await switchBusiness(id);
    } finally {
      setSwitching(null);
    }
  }

  async function pickOrg(id: string) {
    if (id === org?._id || switching) return;
    setSwitching(id);
    try {
      await switchOrg(id);
    } finally {
      setSwitching(null);
    }
  }

  /**
   * The visual block, shared by both states.
   *
   * ★IT IS ONLY A BUTTON WHEN THERE IS SOMETHING TO PRESS. A customer with one
   * business has nothing to switch to, and rendering the control anyway — inert,
   * or disabled — is the pattern this component was written to remove: a thing
   * that looks like a control and is not one. So the single-workspace case gets
   * the identical block as plain content, with no role, no focus stop and no
   * chevron, and the dropdown case wraps it in the button.
   */
  const face = (
    <>
      <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
        {switching ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Building2 className="size-4" aria-hidden />
        )}
      </span>
      <span className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate text-sm font-semibold">{activeName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {hasChoices ? "Switch workspace" : "Your workspace"}
        </span>
      </span>
      {hasChoices && <ChevronsUpDown className="ml-auto size-4 opacity-60" aria-hidden />}
    </>
  );

  const trigger = (
    <SidebarMenuButton
      size="lg"
      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
    >
      {face}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {!hasChoices ? (
          // Same metrics as SidebarMenuButton size="lg", minus every
          // interactive affordance.
          <div className="flex h-12 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm">
            {face}
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              sideOffset={4}
              className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
            >
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Everything in Peakhour is scoped to this workspace
              </DropdownMenuLabel>
              {businesses.map((b) => {
                const isActive = b._id === business?._id;
                const isLocked = b.planActive === false;
                return (
                  <DropdownMenuItem
                    key={b._id}
                    // Radix closes the menu on select by default. A locked row
                    // must not: it opens a dialog, and closing the menu first
                    // would make the dialog appear from nowhere.
                    onSelect={(e) => {
                      if (isLocked) e.preventDefault();
                      void pickBusiness(b._id, b.name, b.planActive);
                    }}
                    className="gap-2"
                  >
                    <span className={cn("truncate", isLocked && "text-muted-foreground")}>
                      {b.name}
                    </span>
                    {isLocked ? (
                      <Lock className="ml-auto size-3.5 shrink-0 text-brand-label" aria-hidden />
                    ) : isActive ? (
                      <Check className="ml-auto size-4 shrink-0" aria-hidden />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}

              {otherOrgs.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Other workspaces
                  </DropdownMenuLabel>
                  {otherOrgs.map((o) => (
                    <DropdownMenuItem
                      key={o._id}
                      onSelect={() => void pickOrg(o._id)}
                      className="gap-2"
                    >
                      <span className="truncate">{o.name}</span>
                      <span className="ml-auto shrink-0 text-xs capitalize text-muted-foreground">
                        {o.role}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/onboarding/add-business" className="gap-2 text-muted-foreground">
                  <Plus className="size-4" aria-hidden />
                  Add a business
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarMenuItem>

      <PlanLimitDialog
        open={locked !== null}
        onOpenChange={(next) => !next && setLocked(null)}
        title={`${locked?.name ?? "That workspace"} isn't on your plan`}
        description="One Peakhour Suite plan runs one business. Add this workspace to your plan to switch into it — you'll stay where you are until you do."
        benefit="Each business gets its own content library, calendar, audiences, connected channels and reporting. Nothing is shared between them."
        ctaLabel="Add a business to my plan"
      />
    </SidebarMenu>
  );
}
