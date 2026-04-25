"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/auth-provider";
import {
  UserPlus,
  MoreHorizontal,
  Loader2,
  Crown,
  Headset,
  Wrench,
  Eye,
} from "lucide-react";

interface CmsUser {
  _id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

const CMS_ROLES = [
  { value: "superadmin", label: "Super Admin", icon: Crown, description: "Full platform access" },
  { value: "ops", label: "Operations", icon: Wrench, description: "Model config, ad specs, platform ops" },
  { value: "support", label: "Support", icon: Headset, description: "Ticket triage, feedback review" },
  { value: "viewer", label: "Viewer", icon: Eye, description: "Read-only CMS access" },
] as const;

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  ops: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  support: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  viewer: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function CmsTeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("support");
  const isSuperAdmin = user?.cmsRole === "superadmin";

  const { data: members, isLoading } = useQuery({
    queryKey: ["cms-team"],
    queryFn: () => api.get<CmsUser[]>("/v1/cms/team"),
  });

  const addMember = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      api.post("/v1/cms/team", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-team"] });
      toast.success("Team member added");
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("support");
    },
    onError: (err: Error) => toast.error(err?.message || "Failed to add member"),
  });

  const updateMember = useMutation({
    mutationFn: ({ id, ...data }: { id: string; role?: string; status?: string }) =>
      api.patch(`/v1/cms/team/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-team"] });
      toast.success("Updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/cms/team/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-team"] });
      toast.success("Member removed");
    },
    onError: () => toast.error("Failed to remove"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">CMS Team</h2>
          <p className="text-muted-foreground mt-1">
            Manage who has access to the PeakHour admin panel
          </p>
        </div>
        {isSuperAdmin && (
          <Button className="gap-1.5" onClick={() => setShowInvite(true)}>
            <UserPlus className="size-4" />
            Add Member
          </Button>
        )}
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3">
        {CMS_ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.value} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5" />
              <span className="font-medium">{r.label}</span>
              <span>— {r.description}</span>
            </div>
          );
        })}
      </div>

      {/* Invite form */}
      {showInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add CMS Team Member</CardTitle>
            <CardDescription>The user must have an existing PeakHour account</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (inviteEmail.trim()) addMember.mutate({ email: inviteEmail.trim(), role: inviteRole });
              }}
            >
              <div className="flex-1 space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="w-40 space-y-1.5">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CMS_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={addMember.isPending}>
                {addMember.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Members table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : !members?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No CMS team members yet
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m._id}>
                    <TableCell className="font-medium">{m.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={ROLE_COLORS[m.role] || ""}>
                        {CMS_ROLES.find((r) => r.value === m.role)?.label || m.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.status === "active" ? "outline" : "destructive"}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {CMS_ROLES.filter((r) => r.value !== m.role).map((r) => (
                              <DropdownMenuItem
                                key={r.value}
                                onClick={() => updateMember.mutate({ id: m._id, role: r.value })}
                              >
                                Change to {r.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => updateMember.mutate({ id: m._id, status: m.status === "active" ? "suspended" : "active" })}
                            >
                              {m.status === "active" ? "Suspend" : "Reactivate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => removeMember.mutate(m._id)}
                            >
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
