"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
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
  UserPlus,
  MoreVertical,
  Shield,
  ShieldCheck,
  Pencil,
  Eye,
  Crown,
  Trash2,
  Mail,
  Clock,
  X,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/hooks/use-locale";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-warning/15 text-warning-on-tint",
  admin: "bg-state-info/15 text-state-info-on-tint",
  editor: "bg-success/15 text-success-on-tint",
  viewer: "bg-muted text-foreground",
};

const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown,
  admin: ShieldCheck,
  editor: Pencil,
  viewer: Eye,
};

export default function TeamPage() {
  const { orgs, org } = useAuth();
  const { formatDate } = useLocale();
  const currentRole = orgs.find((o) => o._id === org?._id)?.role || "viewer";
  const isOwner = currentRole === "owner";
  const isAdmin = currentRole === "admin" || isOwner;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        getTeamMembers(),
        isAdmin ? getPendingInvites() : Promise.resolve({ invites: [] }),
      ]);
      setMembers(membersRes.members);
      setInvites(invitesRes.invites);
    } catch {
      setError("Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const res = await inviteTeamMember(inviteEmail.trim(), inviteRole);
      setSuccess(res.message);
      setInviteEmail("");
      setInviteOpen(false);
      await loadData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (email: string) => {
    try {
      await revokeInvite(email);
      await loadData();
      setSuccess("Invitation revoked");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateMemberRole(userId, newRole);
      await loadData();
      setSuccess("Role updated");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeMember(userId);
      await loadData();
      setSuccess("Member removed");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  if (loading) {
    return (
      <PageShell width="narrow">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      {/* This was the only `text-xl` page title in settings — its siblings run
          `text-2xl` in two weights and two of them have no <h1> at all —
          so PageHeader settles it. The back-link keeps its place as the
          header's leading slot. `narrow` matches settings/billing; it costs
          the role grid below ~30px per column, which it can afford. */}
      <PageHeader
        icon={
          <Link
            href="/dashboard/settings"
            aria-label="Back to settings"
            className="rounded-md p-1.5 transition hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
        title="Team & Permissions"
        description={`${members.length} member${members.length !== 1 ? "s" : ""} in ${org?.name || "your organization"}`}
        actions={
          isAdmin && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite team member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Email address
                    </label>
                    <Input
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Role
                    </label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Admin — full access, manage settings
                          </div>
                        </SelectItem>
                        <SelectItem value="editor">
                          <div className="flex items-center gap-2">
                            <Pencil className="h-3.5 w-3.5" />
                            Editor — create and edit content
                          </div>
                        </SelectItem>
                        <SelectItem value="viewer">
                          <div className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5" />
                            Viewer — read-only access
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="w-full"
                  >
                    {inviting ? "Sending..." : "Send invitation"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive-on-tint text-sm">
          <X className="h-4 w-4 shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-destructive hover:text-destructive-on-tint"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-success/10 text-success-on-tint text-sm">
          {success}
        </div>
      )}

      {/* Members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Members
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {members.map((m) => {
              const RoleIcon = ROLE_ICONS[m.role] || Eye;
              return (
                <div
                  key={m.userId}
                  className="flex items-center gap-4 px-6 py-3.5"
                >
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
                    {(m.name || m.email).charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {m.name || m.email}
                      </span>
                      {m.isOwner && (
                        <Crown className="h-3.5 w-3.5 text-warning shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.email}
                    </div>
                  </div>

                  {/* Role badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      ROLE_COLORS[m.role] || ROLE_COLORS.viewer
                    }`}
                  >
                    <RoleIcon className="h-3 w-3" />
                    {ROLE_LABELS[m.role] || m.role}
                  </span>

                  {/* Actions (owner only, cannot modify self/other owners) */}
                  {isOwner && !m.isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {["admin", "editor", "viewer"]
                          .filter((r) => r !== m.role)
                          .map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() =>
                                handleRoleChange(m.userId, r)
                              }
                            >
                              Change to {ROLE_LABELS[r]}
                            </DropdownMenuItem>
                          ))}
                        <ConfirmDialog
                          trigger={
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive-on-tint"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          }
                          title="Remove team member"
                          description={`Are you sure you want to remove ${m.name || m.email} from the team? They will lose access immediately.`}
                          confirmLabel="Remove"
                          variant="destructive"
                          onConfirm={() => handleRemove(m.userId)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {isAdmin && invites.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {invites.map((inv) => (
                <div
                  key={inv.email}
                  className="flex items-center gap-4 px-6 py-3.5"
                >
                  <div className="h-9 w-9 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {inv.email}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Expires{" "}
                      {formatDate(inv.expiresAt)}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      ROLE_COLORS[inv.role] || ROLE_COLORS.viewer
                    }`}
                  >
                    {ROLE_LABELS[inv.role] || inv.role}
                  </span>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive-on-tint"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    }
                    title="Revoke invitation"
                    description={`Are you sure you want to revoke the invitation for ${inv.email}?`}
                    confirmLabel="Revoke"
                    variant="destructive"
                    onConfirm={() => handleRevoke(inv.email)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role descriptions */}
      <Card className="bg-muted/30">
        <CardContent className="pt-5">
          {/* h2, not h3: PageHeader emits this page's <h1> and nothing sits
              between, so h3 skipped a level (axe `heading-order`). */}
          <h2 className="text-sm font-medium mb-3">Role permissions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
            <div>
              <div className="font-medium text-foreground mb-1 flex items-center gap-1">
                <Crown className="h-3 w-3 text-warning" /> Owner
              </div>
              Full access, billing, team management, delete org
            </div>
            <div>
              <div className="font-medium text-foreground mb-1 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-state-info" /> Admin
              </div>
              Settings, integrations, all content operations
            </div>
            <div>
              <div className="font-medium text-foreground mb-1 flex items-center gap-1">
                <Pencil className="h-3 w-3 text-success" /> Editor
              </div>
              Create, edit, publish content and campaigns
            </div>
            <div>
              <div className="font-medium text-foreground mb-1 flex items-center gap-1">
                <Eye className="h-3 w-3 text-muted-foreground" /> Viewer
              </div>
              View dashboards, content, and reports only
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
