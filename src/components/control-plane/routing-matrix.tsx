"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Network } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  MerchantContact,
  NotificationDomain,
  RoutingMatrix as RoutingMatrixData,
} from "@/lib/api/control-plane";
import type { TeamMember } from "@/lib/auth";
import {
  assignmentInputFor,
  buildChannelRows,
  buildDomainRows,
  orphanedDomainRows,
  pickerOptions,
  type MatrixCell,
} from "@/lib/control-plane";
import { useAssignCell, useClearCell } from "@/hooks/use-control-plane";

/**
 * §02's routing matrix — **who hears about what**, on two axes.
 *
 * ── 🚫★★THREE COLUMNS §02 DRAWS THAT ARE NOT HERE ────────────────────────
 *
 * Each is missing for a reason PR-1.6b must not work around:
 *
 *   - **The per-cell volume ("last 30 days").** It comes from
 *     `msg_conversations` scoped to a domain, and nothing writes `plane` or
 *     `businessId` there until **PR-2.1**. ⚠️A count of zero is
 *     indistinguishable from a count nobody computed — and §02's own argument
 *     for the column is that a matrix without counts cannot tell a merchant who
 *     is handling 142 conversations. **So a column of zeroes tells them
 *     something false**, which is worse than a column that is not there.
 *   - **"Can command".** `cfg_notification_domains` carries no `commands[]` on
 *     purpose: an allowlist is an authorisation policy and a config row is
 *     editable without review. **PR-2.4 owns that map, in code, defaulting to
 *     DENY.**
 *   - **The escalation contact.** A PERSON, not a policy — nothing is watching
 *     a clock, so a control collecting one would imply a behaviour that does
 *     not exist.
 */

const NONE = "__none__";

function CellRow({
  cell,
  members,
  fallbackLabel,
  canEdit,
  busy,
  onAssign,
  onClear,
}: {
  cell: MatrixCell;
  members: TeamMember[];
  fallbackLabel: string;
  canEdit: boolean;
  /** ★★A WRITE ON THIS CELL IS IN FLIGHT. Until the refetch lands the select
   *  still shows the OLD value, so a second click fires an overlapping `PUT`
   *  on the same cell — two upserts racing the unique index, which is the
   *  exact collision the api's E11000 retry exists to survive. **Not causing
   *  it is better than surviving it.** */
  busy: boolean;
  onAssign: (cell: MatrixCell, userId: string) => void;
  onClear: (cell: MatrixCell) => void;
}) {
  // ★★THE CURRENT ASSIGNEE IS ALWAYS AN OPTION, EVEN IF THEY HAVE LEFT. A
  //  `Select` whose value is absent from its options renders BLANK — so an
  //  Admin would see an empty control on a cell that IS assigned, while the
  //  read-only branch beside it shows the name. Blank reads as "not
  //  assigned", the opposite of what is stored.
  const options = pickerOptions(members, cell.assignment);
  return (
    <div className="flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0">
      <div className="min-w-40 flex-1">
        <p className="text-sm font-medium">{cell.label}</p>
        {cell.description && (
          <p className="text-xs text-muted-foreground">{cell.description}</p>
        )}
        {!cell.assignment && (
          // ★★AN UNASSIGNED CELL NAMES WHAT IT FALLS THROUGH TO, rather than
          //  showing a person who was never chosen. §02 calls this "Inherited"
          //  on the channel axis and spells out the Owner on the domain axis —
          //  it is a real routing decision the merchant may not know they have
          //  made.
          <p className="text-xs text-muted-foreground">
            Not assigned — goes to {fallbackLabel}
          </p>
        )}
        {cell.assigneeUnverified && (
          // ⚠️★★THIS CELL ROUTES TO THE OWNER WHATEVER IT SAYS. The resolver
          //  requires a verified number, so an assignment to somebody who has
          //  not confirmed one is a live row that delivers nowhere. Showing
          //  only the name would tell the merchant something false.
          <p className="text-xs text-warning-on-tint flex items-center gap-1">
            <AlertTriangle className="size-3" aria-hidden />
            Their number is not confirmed yet, so this still goes to the Owner.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {canEdit ? (
          <Select
            value={cell.assignment?.assignee.userId ?? NONE}
            disabled={busy}
            onValueChange={(v) =>
              v === NONE ? onClear(cell) : onAssign(cell, v)
            }
          >
            <SelectTrigger
              className="w-56"
              aria-label={`Who hears about ${cell.label}`}
            >
              <SelectValue placeholder="Not assigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not assigned</SelectItem>
              {options.map((o) => (
                <SelectItem key={o.userId} value={o.userId}>
                  {o.label}
                  {o.isMember ? "" : " — no longer on the team"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">
            {cell.assigneeLabel ?? "Not assigned"}
          </span>
        )}
      </div>
    </div>
  );
}

export function RoutingMatrix({
  domains,
  matrix,
  contacts,
  members,
  isAdmin,
  ownerLabel,
}: {
  domains: NotificationDomain[];
  matrix: RoutingMatrixData;
  contacts: MerchantContact[];
  members: TeamMember[];
  isAdmin: boolean;
  ownerLabel: string;
}) {
  const assign = useAssignCell();
  const clear = useClearCell();
  // ★PER CELL, not one flag for the table: assigning Support must not freeze
  //  the Ads row, and a shared flag would make the matrix feel broken every
  //  time anybody changed anything.
  const [busyCell, setBusyCell] = useState<string | null>(null);

  const people = members;
  const domainRows = buildDomainRows(domains, matrix.byDomain, contacts);
  const orphans = orphanedDomainRows(domains, matrix.byDomain, contacts);
  const channelRows = buildChannelRows(matrix.byChannel, contacts);

  const say = (err: unknown, fallback: string) =>
    toast.error(err instanceof ApiError ? err.message : fallback);

  async function onAssign(cell: MatrixCell, userId: string) {
    if (busyCell) return;
    setBusyCell(cell.id);
    try {
      await assign.mutateAsync(assignmentInputFor(cell, userId));
      toast.success(`${cell.label} now goes to the person you chose.`);
    } catch (err) {
      // ★RAW `message`: the api's refusals here are written for this screen —
      //  `NOT_A_MEMBER`, `UNKNOWN_DOMAIN`, `DOMAIN_DEPRECATED` and the 409 that
      //  says retrying will not clear it. Substituting our own copy would lose
      //  the half of the sentence that says what to do.
      say(err, "Could not save that assignment.");
    } finally {
      // ★`finally`, so a refusal does not leave the row locked. The commonest
      //  failure here is one the merchant can fix and retry immediately.
      setBusyCell(null);
    }
  }

  async function onClear(cell: MatrixCell) {
    if (!cell.assignment || busyCell) return;
    setBusyCell(cell.id);
    try {
      await clear.mutateAsync(cell.assignment.id);
      toast.success(`${cell.label} falls back to the Owner again.`);
    } catch (err) {
      say(err, "Could not clear that assignment.");
    } finally {
      setBusyCell(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="size-4" aria-hidden />
          <h2 className="text-base font-semibold">Who hears about what</h2>
        </CardTitle>
        <CardDescription>
          Falls back to the Owner when nobody is assigned. A channel assignment
          overrides the domain owner for that channel only.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <section>
          <h3 className="text-sm font-medium pb-1">By domain</h3>
          {domainRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notification domains are configured on this platform yet.
            </p>
          ) : (
            domainRows.map((cell) => (
              <CellRow
                key={cell.id}
                cell={cell}
                members={people}
                fallbackLabel={ownerLabel}
                canEdit={isAdmin}
                busy={busyCell === cell.id}
                onAssign={onAssign}
                onClear={onClear}
              />
            ))
          )}
        </section>

        {orphans.length > 0 && (
          <section>
            <h3 className="text-sm font-medium pb-1 flex items-center gap-2">
              No longer offered
              <Badge variant="outline">{orphans.length}</Badge>
            </h3>
            {/* ⚠️★★A DEPRECATED DOMAIN KEEPS ROUTING. The registry stops
                offering it; the resolver never joins that registry, because
                dropping the assignment instead would silently redirect those
                notifications to the Owner. So these cells are still delivering
                mail, and hiding them would hide that from the one person who
                could clear them. ★They can be reassigned or cleared — the api
                refuses only a NEW assignment to one. */}
            <p className="text-xs text-muted-foreground pb-2">
              Peakhour no longer offers these, but they are still routing. You
              can reassign or clear them; you cannot create a new one.
            </p>
            {orphans.map((cell) => (
              <CellRow
                key={cell.id}
                cell={cell}
                members={people}
                fallbackLabel={ownerLabel}
                canEdit={isAdmin}
                busy={busyCell === cell.id}
                onAssign={onAssign}
                onClear={onClear}
              />
            ))}
          </section>
        )}

        <section>
          <h3 className="text-sm font-medium pb-1">By channel</h3>
          {channelRows.map((cell) => (
            <CellRow
              key={cell.id}
              cell={cell}
              members={people}
              fallbackLabel="the domain owner"
              canEdit={isAdmin}
              busy={busyCell === cell.id}
              onAssign={onAssign}
              onClear={onClear}
            />
          ))}
        </section>

        {matrix.malformed.length > 0 && (
          <section>
            <h3 className="text-sm font-medium pb-1 flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" aria-hidden />
              Rows that answer nothing
            </h3>
            {/* ⚠️★★DRAWN, NOT HIDDEN. "Exactly one axis" is cross-field, so
                `$jsonSchema` cannot express it and the emitted validator does
                not. The resolver makes such a row INERT — both its lookups
                exclude the other axis — so the cell behaves as unassigned while
                appearing configured. **The one thing worse than showing a
                broken row is hiding it**, because only the merchant can clear
                it. */}
            <p className="text-xs text-muted-foreground pb-2">
              These name a domain and a channel at once, or neither, so nothing
              routes to them. Clear them and set the one you meant.
            </p>
            {matrix.malformed.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-3 border-t py-3"
              >
                <div className="flex-1 min-w-40">
                  <p className="text-sm font-medium">
                    {a.domain ?? "—"} · {a.channel ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Assigned to {a.assignee.name ?? a.assignee.email ?? "a user we could not resolve"}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await clear.mutateAsync(a.id);
                        toast.success("Cleared.");
                      } catch (err) {
                        say(err, "Could not clear that row.");
                      }
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            ))}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
