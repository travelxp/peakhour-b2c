"use client";

import { ExternalLink, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const person1 = {
  name: "Jack Walsh",
  firstName: "Jack",
  lastName: "Walsh",
  initials: "JW",
  email: "jack.walsh@example.com",
  username: "jackwalsh",
  role: "Product Designer",
  company: "Cartwright",
  location: "Brisbane, Australia",
  avatar: "https://cdn.shadcnblocks.com/shadcnblocks/image-set/modern/avatars/avatar1.webp",
};
const person2 = {
  name: "Ilze Pērkone",
  firstName: "Ilze",
  lastName: "Pērkone",
  initials: "MK",
  email: "iperkone@example.com",
  username: "iperkone",
  role: "Brand Director",
  company: "Kivit",
  location: "Rīga, Latvia",
  avatar: "https://cdn.shadcnblocks.com/shadcnblocks/image-set/modern/avatars/avatar2.webp",
};
const person3 = {
  name: "Vernon Desilets",
  firstName: "Vernon",
  lastName: "Desilets",
  initials: "VD",
  email: "vernod@example.com",
  username: "vernod",
  role: "Creative Director",
  company: "Soho Logix",
  location: "Paris, France",
  avatar: "https://cdn.shadcnblocks.com/shadcnblocks/image-set/modern/avatars/avatar3.webp",
};
const person4 = {
  name: "Lín Wàngshū",
  firstName: "Lín",
  lastName: "Wangshu",
  initials: "LW",
  email: "linwang4@example.com",
  username: "liwang",
  role: "Graphic Designer",
  company: "Tenxcloud",
  location: "Shanghai, China",
  avatar: "https://cdn.shadcnblocks.com/shadcnblocks/image-set/modern/avatars/avatar4.webp",
};
const person5 = {
  name: "Rajesh Bhatt",
  firstName: "Rajesh",
  lastName: "Bhatt",
  initials: "RB",
  email: "rajesh.bhatt@example.com",
  username: "rajeshbhatt",
  role: "UX Researcher",
  company: "Mindtree",
  location: "Mumbai, India",
  avatar: "https://cdn.shadcnblocks.com/shadcnblocks/image-set/modern/avatars/avatar5.webp",
};
const person6 = {
  name: "Jessica Cannon",
  firstName: "Jessica",
  lastName: "Cannon",
  initials: "JC",
  email: "jessica.cannon@example.com",
  username: "jessicacannon",
  role: "Data Analyst",
  company: "Fidelity Investments",
  location: "Boston, USA",
  avatar: "https://cdn.shadcnblocks.com/shadcnblocks/image-set/modern/avatars/avatar6.webp",
};

interface IntegrationItem {
  image: string;
  title: string;
  description: string;
  status: "active" | "inactive" | "error";
  connectedBy?: {
    name: string;
    avatar: string;
  };
  lastActivity?: string;
  className?: string;
}

interface SettingsIntegrations9Props {
  className?: string;
  heading?: string;
  subHeading?: string;
  integrations?: IntegrationItem[];
}

const SettingsIntegrations9 = ({
  className,
  heading = "Connected Integrations",
  subHeading = "Manage your active integrations and their permissions.",
  integrations: initialIntegrations = [
    {
      image:
        "https://cdn.shadcnblocks.com/shadcnblocks/block/logos/slack-icon.svg",
      title: "Slack",
      description: "Workspace notifications and alerts",
      status: "active",
      connectedBy: {
        name: person1.name,
        avatar: person1.avatar,
      },
      lastActivity: "Active now",
    },
    {
      image:
        "https://cdn.shadcnblocks.com/shadcnblocks/block/logos/google-icon.svg",
      title: "Google Drive",
      description: "File sync and backup",
      status: "active",
      connectedBy: {
        name: person2.name,
        avatar: person2.avatar,
      },
      lastActivity: "Synced 5 min ago",
    },
    {
      image:
        "https://cdn.shadcnblocks.com/shadcnblocks/block/logos/github-icon.svg",
      title: "GitHub",
      description: "Repository webhooks",
      status: "active",
      connectedBy: {
        name: person3.name,
        avatar: person3.avatar,
      },
      lastActivity: "Last commit 2h ago",
      className: "dark:invert",
    },
    {
      image:
        "https://cdn.shadcnblocks.com/shadcnblocks/block/logos/notion-icon.svg",
      title: "Notion",
      description: "Documentation sync",
      status: "error",
      connectedBy: {
        name: person4.name,
        avatar: person4.avatar,
      },
      lastActivity: "Sync failed",
      className: "dark:invert",
    },
    {
      image:
        "https://cdn.shadcnblocks.com/shadcnblocks/block/logos/figma-icon.svg",
      title: "Figma",
      description: "Design file imports",
      status: "inactive",
      connectedBy: {
        name: person5.name,
        avatar: person5.avatar,
      },
      lastActivity: "Paused",
    },
    {
      image:
        "https://cdn.shadcnblocks.com/shadcnblocks/block/logos/stripe-icon.svg",
      title: "Stripe",
      description: "Payment processing",
      status: "active",
      connectedBy: {
        name: person6.name,
        avatar: person6.avatar,
      },
      lastActivity: "12 transactions today",
    },
  ],
}: SettingsIntegrations9Props) => {
  const [integrations, setIntegrations] = useState(initialIntegrations);

  const handleRemove = (title: string) => {
    setIntegrations((prev) => prev.filter((i) => i.title !== title));
  };

  const getStatusBadge = (status: IntegrationItem["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Active
          </Badge>
        );
      case "inactive":
        return <Badge variant="secondary">Paused</Badge>;
      case "error":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Error
          </Badge>
        );
    }
  };

  return (
    <section className={cn("py-32", className)}>
      <div className="container max-w-4xl">
        <div className="mb-8 flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
            <p className="text-muted-foreground">{subHeading}</p>
          </div>
          <Button>Add Integration</Button>
        </div>

        <div className="space-y-4">
          {integrations.map((integration) => (
            <div
              key={integration.title}
              className="group rounded-xl border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
                  {/* eslint-disable-next-line @next/next/no-img-element -- vendored block: provider logos are small remote images */}
                  <img
                    src={integration.image}
                    alt={integration.title}
                    className={cn("size-8", integration.className)}
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{integration.title}</h3>
                        {getStatusBadge(integration.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {integration.description}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <ExternalLink className="mr-2 size-4" />
                          Open settings
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <RefreshCw className="mr-2 size-4" />
                          Reconnect
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleRemove(integration.title)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {integration.connectedBy && (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-5">
                          <AvatarImage src={integration.connectedBy.avatar} />
                          <AvatarFallback>
                            {integration.connectedBy.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span>Connected by {integration.connectedBy.name}</span>
                      </div>
                    )}
                    {integration.lastActivity && (
                      <>
                        <span>•</span>
                        <span>{integration.lastActivity}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {integrations.length === 0 && (
          <div className="rounded-xl border border-dashed py-12 text-center">
            <p className="text-muted-foreground">
              No integrations connected yet.
            </p>
            <Button className="mt-4">Browse Integrations</Button>
          </div>
        )}
      </div>
    </section>
  );
};

export { SettingsIntegrations9 };
