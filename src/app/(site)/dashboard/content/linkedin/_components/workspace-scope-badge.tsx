"use client";

import { Building2, ChevronRight } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { displayBusinessName } from "@/lib/business-name";
import { PageSwitcher } from "./page-switcher";
import type { LinkedInIdentity } from "@/lib/api/linkedin-content";

/**
 * "Quests Travel › <LinkedIn Page>" — what this hub is scoped to, in one line.
 *
 * ── ★★THE ANSWER TO "SHOULD THE BUSINESS SELECTOR ALSO LIVE HERE"
 *
 * No — and this is the alternative. Two controls for one concept in one
 * viewport is the conflicting-selector failure: the user changes one, the other
 * does not move, and neither reads as authoritative. Switching business is a
 * SESSION-WIDE act — it re-scopes the library, the calendar, the inbox, the ad
 * accounts and the billing the whole product runs on — so it belongs in the
 * shell, once, where it visibly governs everything below it. A copy of it
 * inside one pillar would imply it governed only that pillar.
 *
 * ★But the complaint behind the question is real: on a page with a Page
 * dropdown in the corner, an owner with more than one workspace cannot tell at
 * a glance WHICH business's LinkedIn they are looking at. So the business is
 * NAMED here and only named — no chevron, no click target, nothing that looks
 * like it could be changed. The reader gets the fact; the control stays where
 * it belongs.
 *
 * ★AND THE HIERARCHY IS DRAWN, NOT DESCRIBED. A business CONTAINS LinkedIn
 * Pages; putting them in one breadcrumb with the separator between them is what
 * makes the dropdown unambiguously about the smaller of the two things. Two
 * unrelated chips in the same corner would not.
 */
export function WorkspaceScopeBadge({ identity }: { identity: LinkedInIdentity | undefined }) {
  const { business, org } = useAuth();
  const name = displayBusinessName(business?.name ?? org?.name);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {name && (
        <>
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="size-4 shrink-0" aria-hidden />
            {/* `title` rather than a wider column: at tablet widths the Page
                dropdown beside this is the control, and it must not be the
                thing that gets squeezed. */}
            <span className="max-w-40 truncate" title={name}>
              {name}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
        </>
      )}
      <PageSwitcher identity={identity} />
    </div>
  );
}
