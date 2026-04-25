"use client";

import { CornerDownLeft, MoreHorizontalIcon, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface User {
  name: string;
  email: string;
  accessLevel: string;
  status?: string;
  image?: string;
}

interface Cta {
  title: string;
  ctaText: string;
  ctaLink: string;
}

interface SettingsMembers2Props {
  heading?: string;
  subHeading?: Cta;
  users?: User[];
  className?: string;
}

const SettingsMembers2 = ({
  heading = "Workspace Members",
  subHeading = {
    title:
      "Add teammates to collaborate on projects together. Control permissions and manage access levels for each member.",
    ctaText: "View member permissions guide",
    ctaLink: "#",
  },
  users = [
    {
      name: "Sofia Martinez",
      email: "sofia.m@example.com",
      accessLevel: "Owner",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar/avatar1.jpg",
    },
    {
      name: "Alex Chen",
      email: "alex.c@example.com",
      accessLevel: "Editor",
      status: "Invite pending",
    },
    {
      name: "Jordan Blake",
      email: "jordan.b@example.com",
      accessLevel: "Viewer",
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar/avatar3.jpg",
    },
    {
      name: "Morgan Reid",
      email: "morgan.r@example.com",
      accessLevel: "Editor",
      status: "Invite pending",
    },
  ],
  className = "",
}: SettingsMembers2Props) => {
  const [searchValue, setSearchValue] = useState("");

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        user.email.toLowerCase().includes(searchValue.toLowerCase())
      );
    });
  }, [users, searchValue]);

  return (
    <section className="py-32">
      <div className="container max-w-3xl">
        <div className={cn("space-y-6", className)}>
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold tracking-tight">{heading}</h3>
            <CtaText cta={subHeading} />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative w-full max-w-56 min-w-20">
                <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search"
                  className="pl-7"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              <InviteUserForm />
            </div>

            <p className="text-xs font-semibold text-muted-foreground">
              {filteredUsers.length} members
            </p>

            <UsersList users={filteredUsers} />
          </div>
        </div>
      </div>
    </section>
  );
};

export { SettingsMembers2 };

const InviteUserForm = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Invite Member</Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0">
        <DialogTitle className="flex items-center gap-2 border-b p-4 text-sm font-medium">
          Invite Team Member
        </DialogTitle>
        <form
          autoComplete="off"
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col gap-4 bg-muted pt-4"
        >
          <div className="flex flex-col gap-4 px-4">
            <div className="space-y-1">
              <Label className="text-xs">Email address</Label>
              <Input
                placeholder="name@yourcompany.com"
                className="bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Select role</Label>
              <Select defaultValue="editor">
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="border-t bg-background px-4 py-3">
            <Button size="sm" type="submit">
              Send Invitation <CornerDownLeft />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface CtaTextProps {
  cta: Cta;
}

const CtaText = ({ cta }: CtaTextProps) => {
  return (
    <p className="text-xs text-muted-foreground sm:text-sm">
      {cta.title}{" "}
      <a href={cta.ctaLink} className="whitespace-nowrap underline">
        {cta.ctaText}
      </a>
    </p>
  );
};

interface UserCardProps {
  user: User;
}

const UserCard = ({ user }: UserCardProps) => {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2 sm:flex-2/3">
        <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-muted">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- mock data with external host; matches team-section.tsx pattern
            <img
              src={user.image}
              alt={user.name}
              className="size-full object-cover"
            />
          ) : (
            <span className="text-sm font-medium">{user.name.charAt(0)}</span>
          )}
        </div>
        <div className="text-sm font-medium">
          <p>{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-1/3">
        <Select defaultValue={user.accessLevel}>
          <SelectTrigger className="min-w-24">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Owner">Owner</SelectItem>
            <SelectItem value="Editor">Editor</SelectItem>
            <SelectItem value="Viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label="Open menu" size="icon-sm">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-fit max-w-56" align="end">
            <DropdownMenuItem>Transfer ownership</DropdownMenuItem>
            <DropdownMenuItem>Remove from team</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

interface UsersListProps {
  users: User[];
}

const UsersList = ({ users }: UsersListProps) => {
  return (
    <ul className="overflow-x-auto">
      {users.map((user, i) => {
        return (
          <li
            key={`user-card-${i}`}
            className="w-full min-w-80 shrink-0 border-b py-3 first:pt-0"
          >
            <UserCard user={user} />
          </li>
        );
      })}
    </ul>
  );
};
