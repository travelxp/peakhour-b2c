"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  getTeamMembers,
  getPendingInvites,
  inviteTeamMember,
  revokeInvite,
  updateMemberRole,
  removeMember,
  type TeamMember,
  type PendingInvite,
} from "@/lib/auth";
import { useLocale } from "@/hooks/use-locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import {
  MoreHorizontal,
  Search,
  CornerDownLeft,
  Crown,
  ShieldCheck,
  Pencil,
  Eye,
  Clock,
  Trash2,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown,
  admin: ShieldCheck,
  editor: Pencil,
  viewer: Eye,
};

/**
 * Team management section — used in Settings tab and standalone team page.
 * Follows settings-members2 Pro block visual pattern.
 */
export function TeamSection() {
  const { orgs, org } = useAuth();
  const { formatDate } = useLocale();
  const currentRole = orgs.find((o) => o._id === org?._id)?.role || "viewer";
  const isOwner = currentRole === "owner";
  const isAdmin = currentRole === "admin" || isOwner;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        getTeamMembers(),
        isAdmin ? getPendingInvites() : Promise.resolve({ invites: [] }),
      ]);
      setMembers(membersRes.members);
      setInvites(invitesRes.invites);
    } catch {
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredMembers = useMemo(() => {
    if (!searchValue) return members;
    const q = searchValue.toLowerCase();
    return members.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, searchValue]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateMemberRole(userId, newRole);
      await loadData();
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeMember(userId);
      await loadData();
      toast.success("Member removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  };

  const handleRevoke = async (email: string) => {
    try {
      await revokeInvite(email);
      await loadData();
      toast.success("Invitation revoked");
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">
          Team Members
        </h3>
        <p className="text-sm text-muted-foreground">
          {members.length} member{members.length !== 1 ? "s" : ""} in{" "}
          {org?.name || "your organization"}.
          Manage access levels and invite new teammates.
        </p>
      </div>

      {/* Search + Invite */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-56 min-w-20">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            className="pl-8"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>
        {isAdmin && <InviteDialog onInvited={loadData} />}
      </div>

      <p className="text-xs font-semibold text-muted-foreground">
        {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
      </p>

      {/* Members list */}
      <ul className="overflow-x-auto">
        {filteredMembers.map((m) => (
          <li key={m.userId} className="w-full min-w-80 border-b py-3 first:pt-0">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-muted">
                  <span className="text-sm font-medium">
                    {(m.name || m.email).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{m.name || m.email}</span>
                    {m.isOwner && <Crown className="size-3.5 text-amber-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Inline role selector (owner can change others) */}
                {isOwner && !m.isOwner ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => handleRoleChange(m.userId, v)}
                  >
                    <SelectTrigger className="min-w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["admin", "editor", "viewer"].map((r) => {
                        const Icon = ROLE_ICONS[r];
                        return (
                          <SelectItem key={r} value={r}>
                            <span className="flex items-center gap-1.5">
                              <Icon className="size-3" />
                              {ROLE_LABELS[r]}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground px-2">
                    {ROLE_LABELS[m.role] || m.role}
                  </span>
                )}

                {/* Actions menu */}
                {isOwner && !m.isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon-xs" aria-label="Actions">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-fit max-w-56">
                      <ConfirmDialog
                        trigger={
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="text-red-600"
                          >
                            <Trash2 className="size-3.5 mr-2" />
                            Remove from team
                          </DropdownMenuItem>
                        }
                        title="Remove team member"
                        description={`Remove ${m.name || m.email}? They will lose access immediately.`}
                        confirmLabel="Remove"
                        variant="destructive"
                        onConfirm={() => handleRemove(m.userId)}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Pending invites */}
      {isAdmin && invites.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {invites.length} pending invitation{invites.length !== 1 ? "s" : ""}
          </p>
          <ul>
            {invites.map((inv) => (
              <li key={inv.email} className="flex items-center justify-between border-b py-3 first:pt-0">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950">
                    <Clock className="size-4 text-amber-500" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDate(inv.expiresAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[inv.role] || inv.role}
                  </span>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-red-600">
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                    title="Revoke invitation"
                    description={`Revoke the invitation for ${inv.email}?`}
                    confirmLabel="Revoke"
                    variant="destructive"
                    onConfirm={() => handleRevoke(inv.email)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Invite dialog — muted bg footer pattern from Pro block */
function InviteDialog({ onInvited }: { onInvited: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [inviting, setInviting] = useState(false);

  async function handleInvite() {
    if (!email.trim()) return;
    setInviting(true);
    try {
      await inviteTeamMember(email.trim(), role);
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      setOpen(false);
      await onInvited();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Invite Member</Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0">
        <DialogTitle className="flex items-center gap-2 border-b p-4 text-sm font-medium">
          Invite Team Member
        </DialogTitle>
        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            handleInvite();
          }}
          className="flex flex-col gap-4 bg-muted pt-4"
        >
          <div className="flex flex-col gap-4 px-4">
            <div className="space-y-1">
              <Label className="text-xs">Email address</Label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                className="bg-background"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Select role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="size-3" /> Admin
                    </span>
                  </SelectItem>
                  <SelectItem value="editor">
                    <span className="flex items-center gap-1.5">
                      <Pencil className="size-3" /> Editor
                    </span>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <span className="flex items-center gap-1.5">
                      <Eye className="size-3" /> Viewer
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="border-t bg-background px-4 py-3">
            <Button size="sm" type="submit" disabled={inviting || !email.trim()}>
              {inviting ? "Sending..." : <>Send Invitation <CornerDownLeft className="ml-1 size-3.5" /></>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
