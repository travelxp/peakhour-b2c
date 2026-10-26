import * as React from "react";
import {
  Archive,
  Bug,
  ChevronDown,
  Clock,
  CommandIcon,
  File,
  Inbox,
  Lightbulb,
  MailOpen,
  MessageSquare,
  PanelRight,
  Reply,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

type QueueId =
  | "inbox"
  | "unassigned"
  | "assigned"
  | "drafts"
  | "archived"
  | "spam";

type BucketId = "support" | "bugs" | "features" | "internal";

type TicketStatus = "active" | "pending" | "closed";

type Queue = {
  id: QueueId;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type Bucket = {
  id: BucketId;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type UserProfile = {
  name: string;
  email: string;
  avatar: string;
  role: string;
};

type Customer = UserProfile & {
  company: string;
  isHighValue: boolean;
};

type Message = {
  id: string;
  senderName: string;
  senderEmail: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  date: string;
  isStaff: boolean;
};

type Ticket = {
  id: string;
  queue: QueueId;
  bucket: BucketId;
  subject: string;
  preview: string;
  timestamp: string;
  read: boolean;
  customer: Customer;
  assignee?: UserProfile;
  status: TicketStatus;
  messages: Message[];
  respondingUser?: UserProfile;
  agentSummary: string[];
  followUp: string;
};

const queues: Queue[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "unassigned", label: "Unassigned", icon: MailOpen },
  { id: "assigned", label: "Assigned", icon: UserCheck },
  { id: "drafts", label: "Drafts", icon: File },
  { id: "archived", label: "Archived", icon: Archive },
  { id: "spam", label: "Spam", icon: Trash2 },
];

const buckets: Bucket[] = [
  { id: "support", label: "Support requests", icon: MessageSquare },
  { id: "bugs", label: "Bug reports", icon: Bug },
  { id: "features", label: "Feature requests", icon: Lightbulb },
  { id: "internal", label: "Internal", icon: Users },
];

const staff: UserProfile[] = [
  {
    name: person2.name,
    email: person2.email,
    avatar: person2.avatar,
    role: person2.role,
  },
  {
    name: person3.name,
    email: person3.email,
    avatar: person3.avatar,
    role: person3.role,
  },
];

const customers: Customer[] = [
  {
    name: person1.name,
    email: person1.email,
    avatar: person1.avatar,
    role: person1.role,
    company: person1.company,
    isHighValue: true,
  },
  {
    name: person4.name,
    email: person4.email,
    avatar: person4.avatar,
    role: person4.role,
    company: person4.company,
    isHighValue: false,
  },
];

const mockTickets: Ticket[] = [
  {
    id: "ticket-1",
    queue: "inbox",
    bucket: "support",
    subject: "Slack authorization keeps failing",
    preview:
      "Connecting Slack stops on an invalid OAuth token, even after a workspace restart.",
    timestamp: "6h ago",
    read: false,
    customer: customers[0],
    assignee: staff[0],
    status: "active",
    respondingUser: staff[0],
    messages: [
      {
        id: "m1",
        senderName: person1.name,
        senderEmail: person1.email,
        senderAvatar: person1.avatar,
        content: `Hi,\n\nConnecting Slack stops with "OAuth token invalid." We retried the connection and restarted the workspace.\n\nCan you help us finish the authorization?\n\nThanks,\n${person1.name}\n${person1.role}, ${person1.company}`,
        timestamp: "8:03 AM",
        date: "Aug 29",
        isStaff: false,
      },
      {
        id: "m2",
        senderName: person2.name,
        senderEmail: person2.email,
        senderAvatar: person2.avatar,
        content: `Hi ${person1.firstName},\n\nThat error usually means Slack did not grant the requested permissions. Try the connection from the correct workspace, accept every permission prompt, and retry in a private window if a cached login is in the way.\n\nTell me if the token error is still there.`,
        timestamp: "12:56 PM",
        date: "Aug 29",
        isStaff: true,
      },
    ],
    agentSummary: [
      "The customer is calm and waiting on a confirmation that the Slack connection worked.",
      `${person2.firstName} already sent the permission steps. There is no reply yet.`,
    ],
    followUp: `Hi ${person1.firstName}, just checking whether the Slack connection went through. I can jump on a short call if the token error is still showing.`,
  },
  {
    id: "ticket-2",
    queue: "unassigned",
    bucket: "support",
    subject: "Shared files disappeared overnight",
    preview:
      "Two project files uploaded yesterday are missing from the shared workspace this morning.",
    timestamp: "6h ago",
    read: false,
    customer: customers[1],
    status: "active",
    messages: [
      {
        id: "m3",
        senderName: person4.name,
        senderEmail: person4.email,
        senderAvatar: person4.avatar,
        content: `Yesterday I uploaded a set of project files. Today two of them are gone from the shared workspace.\n\nCan someone check whether they were moved or deleted?\n\n${person4.firstName}`,
        timestamp: "9:14 AM",
        date: "Aug 29",
        isStaff: false,
      },
    ],
    agentSummary: [
      "No assignee yet. The customer is asking for a restore, not a how-to.",
    ],
    followUp: `Hi ${person4.firstName}, I am checking the workspace history for those two files and will send a restore link if they are still recoverable.`,
  },
  {
    id: "ticket-3",
    queue: "inbox",
    bucket: "bugs",
    subject: "Invoice lists two extra licenses",
    preview:
      "This month's invoice shows 10 Pro licenses, but only 8 people are active.",
    timestamp: "8h ago",
    read: true,
    customer: customers[0],
    assignee: staff[1],
    status: "pending",
    messages: [
      {
        id: "m4",
        senderName: person1.name,
        senderEmail: person1.email,
        senderAvatar: person1.avatar,
        content:
          "Our invoice shows 10 Pro licenses, but we only have 8 active people. Can you review the seats before we pay?",
        timestamp: "7:40 AM",
        date: "Aug 29",
        isStaff: false,
      },
    ],
    agentSummary: [
      "Billing question. Waiting on a seat audit before the customer will pay.",
    ],
    followUp: `Hi ${person1.firstName}, the extra seats were leftover invites. I can remove them and send a corrected invoice today.`,
  },
  {
    id: "ticket-4",
    queue: "unassigned",
    bucket: "bugs",
    subject: "Password reset email never arrives",
    preview:
      "The forgot-password link says the message was sent, but nothing lands in the inbox.",
    timestamp: "12h ago",
    read: true,
    customer: customers[1],
    status: "active",
    messages: [
      {
        id: "m5",
        senderName: person4.name,
        senderEmail: person4.email,
        senderAvatar: person4.avatar,
        content:
          "I used the forgot-password link twice. The page says the email was sent, but it never arrives.",
        timestamp: "9:02 PM",
        date: "Aug 28",
        isStaff: false,
      },
    ],
    agentSummary: [
      "Likely a quarantine rule. Ask them to check spam before resetting the address.",
    ],
    followUp: `Hi ${person4.firstName}, the reset message is leaving our side. Can you check quarantine and spam for mail from this domain?`,
  },
  {
    id: "ticket-5",
    queue: "archived",
    bucket: "bugs",
    subject: "Dashboard charts stopped updating",
    preview:
      "Analytics froze yesterday around 3 PM. Every chart is stuck on the same hour.",
    timestamp: "1d ago",
    read: true,
    customer: customers[0],
    assignee: staff[0],
    status: "closed",
    messages: [
      {
        id: "m6",
        senderName: person2.name,
        senderEmail: person2.email,
        senderAvatar: person2.avatar,
        content:
          "The analytics job stalled after a deploy. It is running again, and the charts should catch up within the hour.",
        timestamp: "4:18 PM",
        date: "Aug 28",
        isStaff: true,
      },
    ],
    agentSummary: ["Closed after the analytics job was restarted."],
    followUp:
      "No follow-up unless the charts are still frozen tomorrow morning.",
  },
  {
    id: "ticket-6",
    queue: "inbox",
    bucket: "features",
    subject: "Export tickets to a spreadsheet",
    preview:
      "The support lead wants a CSV of open tickets with assignee and status.",
    timestamp: "2d ago",
    read: true,
    customer: customers[1],
    status: "pending",
    messages: [
      {
        id: "m7",
        senderName: person4.name,
        senderEmail: person4.email,
        senderAvatar: person4.avatar,
        content:
          "Can we export the open queue to a spreadsheet with assignee, status, and last reply?",
        timestamp: "11:05 AM",
        date: "Aug 27",
        isStaff: false,
      },
    ],
    agentSummary: ["Feature request. Not a breakage. Park it with product."],
    followUp: `Hi ${person4.firstName}, CSV export is on the board. I will send a note when a beta build can produce that file.`,
  },
  {
    id: "ticket-7",
    queue: "drafts",
    bucket: "internal",
    subject: "Draft: HIPAA packet for legal",
    preview: "Notes for the compliance reply. Not sent yet.",
    timestamp: "3d ago",
    read: true,
    customer: customers[0],
    assignee: staff[1],
    status: "pending",
    messages: [],
    agentSummary: [
      "Internal draft. Do not send until legal reviews the packet.",
    ],
    followUp: "Hold this reply until the compliance packet is attached.",
  },
  {
    id: "ticket-8",
    queue: "spam",
    bucket: "support",
    subject: "Unlock your workspace now",
    preview: "Unsolicited offer with a shortened link. Marked as spam.",
    timestamp: "1w ago",
    read: true,
    customer: customers[1],
    status: "closed",
    messages: [
      {
        id: "m8",
        senderName: person4.name,
        senderEmail: person4.email,
        senderAvatar: person4.avatar,
        content: "Click here to unlock a free workspace upgrade.",
        timestamp: "2:11 AM",
        date: "Aug 20",
        isStaff: false,
      },
    ],
    agentSummary: ["Spam. Leave it closed."],
    followUp: "Do not reply.",
  },
];

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function getStatusColor(status: TicketStatus) {
  if (status === "active") return "bg-emerald-500";
  if (status === "pending") return "bg-amber-500";
  return "bg-muted-foreground";
}

function ticketInView(ticket: Ticket, queue: QueueId, bucket: BucketId | null) {
  if (bucket) {
    return ticket.bucket === bucket;
  }

  return ticket.queue === queue;
}

function QueueButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-sidebar-accent",
        active && "bg-sidebar-accent font-medium",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {count}
        </Badge>
      )}
    </button>
  );
}

function TicketList({
  title,
  tickets,
  selectedTicketId,
  onTicketSelect,
}: {
  title: string;
  tickets: Ticket[];
  selectedTicketId: string | null;
  onTicketSelect: (ticketId: string) => void;
}) {
  return (
    <div className="flex h-full w-full shrink-0 flex-col overflow-hidden border-r bg-background md:w-72">
      <div className="flex h-14 shrink-0 items-center border-b px-4">
        <h2 className="truncate text-base font-medium">{title}</h2>
      </div>
      <ScrollArea className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]>div]:!block">
        {tickets.length > 0 ? (
          tickets.map((ticket) => {
            const isSelected = selectedTicketId === ticket.id;

            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => onTicketSelect(ticket.id)}
                className={cn(
                  "w-full border-b p-4 text-left text-sm last:border-b-0 hover:bg-muted/50",
                  !ticket.read && "bg-muted/30",
                  isSelected && "bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn("truncate", !ticket.read && "font-semibold")}
                  >
                    {ticket.subject}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {ticket.timestamp}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {ticket.preview}
                </p>
                {ticket.respondingUser && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Avatar className="size-4">
                      <AvatarImage
                        src={ticket.respondingUser.avatar}
                        alt={ticket.respondingUser.name}
                      />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(ticket.respondingUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {ticket.respondingUser.name.split(" ")[0]} is responding
                    </span>
                  </div>
                )}
              </button>
            );
          })
        ) : (
          <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Nothing in this queue.
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar className="mt-0.5 size-10 shrink-0">
          <AvatarImage src={message.senderAvatar} alt={message.senderName} />
          <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
            {getInitials(message.senderName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{message.senderName}</span>
            {message.isStaff && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                Staff
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{message.senderEmail}</p>
          <p className="text-xs text-muted-foreground">
            {message.date}, {message.timestamp}
          </p>
        </div>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {message.content}
      </p>
    </div>
  );
}

function ReplyComposer({
  recipientEmail,
  respondingUser,
}: {
  recipientEmail: string;
  respondingUser?: UserProfile;
}) {
  return (
    <div className="shrink-0 border-t px-4 py-4 lg:px-8">
      <div className="rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Reply className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm text-muted-foreground">
            {recipientEmail}
          </span>
        </div>
        <Textarea
          placeholder="Write a reply..."
          className="min-h-20 resize-none border-0 bg-transparent focus-visible:ring-0"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
          <Button variant="ghost" size="icon" className="size-8">
            <Plus className="size-4" />
          </Button>
          <div className="flex items-center gap-2">
            {respondingUser && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {respondingUser.name.split(" ")[0]} is responding
              </span>
            )}
            <Button size="sm" className="gap-1.5">
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentPanel({
  ticket,
  className,
}: {
  ticket: Ticket;
  className?: string;
}) {
  const customer = ticket.customer;

  return (
    <aside
      className={cn(
        "flex h-full w-80 shrink-0 flex-col overflow-hidden border-l bg-background",
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Sparkles className="size-4" />
        <span className="font-semibold">Inbox Agent</span>
      </div>
      <ScrollArea className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]>div]:!block">
        <div className="flex flex-col gap-6 p-4">
          <div>
            <div className="flex items-start gap-3">
              <Avatar className="size-10">
                <AvatarImage src={customer.avatar} alt={customer.name} />
                <AvatarFallback>{getInitials(customer.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium">{customer.name}</p>
                <p className="text-sm text-muted-foreground">
                  {customer.role}, {customer.company}
                </p>
              </div>
            </div>
            {customer.isHighValue && (
              <Badge
                variant="outline"
                className="mt-3 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                High value customer
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {ticket.agentSummary.map((summary) => (
              <p
                key={summary}
                className="border-l-2 border-primary/20 pl-3 text-sm leading-6 text-muted-foreground"
              >
                {summary}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Suggested follow up
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-6">
              {ticket.followUp}
            </div>
            <Button variant="outline" className="w-full gap-2">
              <Clock className="size-4" />
              Schedule follow up
            </Button>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

function Conversation({
  ticket,
  onStatusChange,
  showAgentToggle,
  agentOpen,
  onToggleAgent,
}: {
  ticket: Ticket | null;
  onStatusChange: (status: TicketStatus) => void;
  showAgentToggle: boolean;
  agentOpen: boolean;
  onToggleAgent: () => void;
}) {
  if (!ticket) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="mx-auto size-12 opacity-50" />
          <p className="mt-2 text-sm">Select a ticket to view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="flex min-w-0 items-center gap-3">
          <MessageSquare className="size-5 shrink-0" />
          <h2 className="truncate text-sm font-medium">Re: {ticket.subject}</h2>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    getStatusColor(ticket.status),
                  )}
                />
                <span className="capitalize">{ticket.status}</span>
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["active", "pending", "closed"] as TicketStatus[]).map(
                (status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => onStatusChange(status)}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        getStatusColor(status),
                      )}
                    />
                    <span className="capitalize">{status}</span>
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {showAgentToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden size-8 lg:inline-flex"
              onClick={onToggleAgent}
            >
              <PanelRight
                className={cn("size-4", agentOpen && "text-primary")}
              />
            </Button>
          )}
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6 lg:px-8">
          {ticket.messages.length > 0 ? (
            ticket.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              This draft has no messages yet.
            </p>
          )}
        </div>
      </ScrollArea>
      <ReplyComposer
        recipientEmail={ticket.customer.email}
        respondingUser={ticket.respondingUser}
      />
    </div>
  );
}

export function Inbox7({ className }: { className?: string }) {
  const [activeQueue, setActiveQueue] = React.useState<QueueId>("inbox");
  const [activeBucket, setActiveBucket] = React.useState<BucketId | null>(null);
  const [tickets, setTickets] = React.useState<Ticket[]>(mockTickets);
  const [selectedTicketId, setSelectedTicketId] = React.useState<string | null>(
    mockTickets[0]?.id ?? null,
  );
  const [isAgentOpen, setIsAgentOpen] = React.useState(true);
  const [isCommandOpen, setIsCommandOpen] = React.useState(false);
  const [isMobileConversationOpen, setIsMobileConversationOpen] =
    React.useState(false);
  const [isMobileAgentOpen, setIsMobileAgentOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsCommandOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const queueCounts = React.useMemo(() => {
    return queues.reduce(
      (result, queue) => {
        result[queue.id] = tickets.filter(
          (ticket) => !ticket.read && ticketInView(ticket, queue.id, null),
        ).length;
        return result;
      },
      {} as Record<QueueId, number>,
    );
  }, [tickets]);

  const visibleTickets = tickets.filter((ticket) =>
    ticketInView(ticket, activeQueue, activeBucket),
  );

  const selectedTicket =
    visibleTickets.find((ticket) => ticket.id === selectedTicketId) ??
    visibleTickets[0] ??
    null;

  const viewTitle = activeBucket
    ? (buckets.find((bucket) => bucket.id === activeBucket)?.label ?? "Inbox")
    : (queues.find((queue) => queue.id === activeQueue)?.label ?? "Inbox");

  const selectQueue = (queueId: QueueId) => {
    setActiveQueue(queueId);
    setActiveBucket(null);
    const next = tickets.find((ticket) => ticketInView(ticket, queueId, null));
    setSelectedTicketId(next?.id ?? null);
  };

  const selectBucket = (bucketId: BucketId) => {
    setActiveBucket(bucketId);
    const next = tickets.find((ticket) => ticket.bucket === bucketId);
    setSelectedTicketId(next?.id ?? null);
  };

  const handleTicketSelect = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setTickets((previous) =>
      previous.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, read: true } : ticket,
      ),
    );

    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsMobileConversationOpen(true);
    }
  };

  const handleStatusChange = (status: TicketStatus) => {
    if (!selectedTicket) return;

    setTickets((previous) =>
      previous.map((ticket) =>
        ticket.id === selectedTicket.id ? { ...ticket, status } : ticket,
      ),
    );
  };

  return (
    <div
      data-layout="fixed"
      className={cn(
        "flex h-svh max-h-[1200px] min-h-[600px] w-full overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center px-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-2 px-2"
              >
                <span className="truncate font-semibold">Workspace</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>Workspace settings</DropdownMenuItem>
                <DropdownMenuItem>Invite teammates</DropdownMenuItem>
                <DropdownMenuItem>Billing</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="px-2 pb-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-2"
            onClick={() => setIsCommandOpen(true)}
          >
            <Search className="size-4" />
            Search
            <kbd className="ml-auto inline-flex items-center gap-0.5 font-mono text-xs text-muted-foreground">
              <CommandIcon className="size-3" />K
            </kbd>
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1 px-2">
          <div className="flex flex-col gap-1">
            {queues.map((queue) => (
              <QueueButton
                key={queue.id}
                icon={queue.icon}
                label={queue.label}
                count={queueCounts[queue.id]}
                active={!activeBucket && activeQueue === queue.id}
                onClick={() => selectQueue(queue.id)}
              />
            ))}
          </div>
          <p className="mt-4 mb-1 px-2 text-xs font-medium text-muted-foreground">
            Buckets
          </p>
          <div className="flex flex-col gap-1">
            {buckets.map((bucket) => (
              <QueueButton
                key={bucket.id}
                icon={bucket.icon}
                label={bucket.label}
                active={activeBucket === bucket.id}
                onClick={() => selectBucket(bucket.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Inbox className="size-4" />
                {viewTitle}
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {queues.map((queue) => (
                <DropdownMenuItem
                  key={queue.id}
                  onClick={() => selectQueue(queue.id)}
                >
                  <queue.icon />
                  {queue.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setIsCommandOpen(true)}
          >
            <Search className="size-4" />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 w-full md:hidden">
            <TicketList
              title={viewTitle}
              tickets={visibleTickets}
              selectedTicketId={selectedTicket?.id ?? null}
              onTicketSelect={handleTicketSelect}
            />
          </div>
          <div className="hidden min-h-0 min-w-0 flex-1 md:flex">
            <TicketList
              title={viewTitle}
              tickets={visibleTickets}
              selectedTicketId={selectedTicket?.id ?? null}
              onTicketSelect={handleTicketSelect}
            />
            <Conversation
              ticket={selectedTicket}
              onStatusChange={handleStatusChange}
              showAgentToggle
              agentOpen={isAgentOpen}
              onToggleAgent={() => setIsAgentOpen((open) => !open)}
            />
            {isAgentOpen && selectedTicket && (
              <div className="hidden lg:flex">
                <AgentPanel ticket={selectedTicket} />
              </div>
            )}
          </div>
        </div>
      </div>

      <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
        <CommandInput placeholder="Search tickets or jump to a queue..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Tickets">
            {tickets.map((ticket) => (
              <CommandItem
                key={ticket.id}
                onSelect={() => {
                  selectQueue(ticket.queue);
                  setSelectedTicketId(ticket.id);
                  setIsCommandOpen(false);
                }}
              >
                <MessageSquare />
                <span className="truncate">{ticket.subject}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Customers">
            {customers.map((customer) => (
              <CommandItem key={customer.email}>
                <User />
                <span>{customer.name}</span>
                <span className="text-xs text-muted-foreground">
                  {customer.company}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Queues">
            {queues.map((queue) => (
              <CommandItem
                key={queue.id}
                onSelect={() => {
                  selectQueue(queue.id);
                  setIsCommandOpen(false);
                }}
              >
                <queue.icon />
                {queue.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Drawer
        open={isMobileConversationOpen}
        onOpenChange={setIsMobileConversationOpen}
      >
        <DrawerContent className="h-[90vh] overflow-hidden md:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Conversation</DrawerTitle>
          </DrawerHeader>
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex justify-end px-4 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setIsMobileAgentOpen(true)}
              >
                <Sparkles className="size-4" />
                Agent
              </Button>
            </div>
            <Conversation
              ticket={selectedTicket}
              onStatusChange={handleStatusChange}
              showAgentToggle={false}
              agentOpen={false}
              onToggleAgent={() => {}}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={isMobileAgentOpen} onOpenChange={setIsMobileAgentOpen}>
        <DrawerContent className="h-[85vh] overflow-hidden md:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Inbox Agent</DrawerTitle>
          </DrawerHeader>
          {selectedTicket ? (
            <AgentPanel ticket={selectedTicket} className="w-full border-l-0" />
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
