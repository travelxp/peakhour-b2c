"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import {
  useWaConversations,
  useWaThread,
  useWaHandoff,
  useWaResume,
  type WaConversation,
} from "@/hooks/use-wa-conversations";
import { inboxApi, type InboxItem, type InboxPriority } from "@/lib/api/inbox";

/**
 * Inbox — ONE queue for everything inbound (D-inbox): every channel is
 * an adapter into the same list. Lanes shipped so far: WhatsApp
 * conversations (live chat) and LinkedIn lead-gen leads (G2 — scored
 * by the lead qualifier, priority-ranked, SLA clock running). New
 * channels join as adapters, never as new pages.
 */

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  resolved: { label: "Resolved", className: "bg-muted text-muted-foreground" },
  escalated: { label: "With a human", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
};

function StatusPill({ status }: { status: string }) {
  const v = STATUS_LABEL[status] ?? STATUS_LABEL.active;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${v.className}`}>{v.label}</span>;
}

function Bubble({ role, content }: { role: string; content: string }) {
  const mine = role === "assistant" || role === "merchant";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg p-2.5 text-sm ${
          mine
            ? "rounded-tr-none bg-[#dcf8c6] text-neutral-900 dark:bg-emerald-900/60 dark:text-neutral-100"
            : "rounded-tl-none bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
        }`}
      >
        {role === "merchant" && <p className="mb-0.5 text-[11px] font-medium opacity-70">You (from your phone)</p>}
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

// ── Leads lane (sup_inbox, kind: lead) ────────────────────────────────

const PRIORITY_BADGE: Record<InboxPriority, string> = {
  urgent: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  high: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  normal: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  low: "bg-muted/60 text-muted-foreground",
};

const SOURCE_LABEL: Record<string, string> = { linkedin: "LinkedIn" };

function slaLabel(item: InboxItem): string | null {
  const due = item.sla?.firstResponseDueAt;
  if (!due || item.sla?.firstRespondedAt || item.status !== "queued") return null;
  const ms = new Date(due).getTime() - Date.now();
  if (ms <= 0) return "response overdue";
  const hours = Math.round(ms / (60 * 60 * 1000));
  return hours < 1 ? "respond within the hour" : `respond within ${hours}h`;
}

function LeadRow({ item, onChanged }: { item: InboxItem; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const act = useMutation({
    mutationFn: (status: "in_review" | "resolved") => inboxApi.setStatus(item._id, status),
    onSuccess: (res) => {
      toast.success(res.status === "resolved" ? "Lead marked resolved." : "Marked as being handled — SLA clock noted.");
      onChanged();
    },
    onError: () => toast.error("Couldn't update the lead. Try again in a moment."),
  });

  const lead = item.lead;
  const sla = slaLabel(item);

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${PRIORITY_BADGE[item.priority]}`}>
              {item.priority}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {SOURCE_LABEL[item.source] ?? item.source}
            </Badge>
            {typeof lead?.score === "number" && (
              <Badge variant="outline" className="text-[10px]">
                score {lead.score}
                {lead.qualified ? " · qualified" : ""}
              </Badge>
            )}
            {item.status !== "queued" && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {item.status.replaceAll("_", " ")}
              </Badge>
            )}
            {sla && <span className="text-[11px] text-amber-700 dark:text-amber-300">{sla}</span>}
          </div>
          <p className="truncate text-sm font-medium">
            {item.contact?.name || item.contact?.email || item.subject || "Lead"}
            {lead?.campaignName ? (
              <span className="ml-2 font-normal text-muted-foreground">via {lead.campaignName}</span>
            ) : null}
          </p>
          {item.body && <p className="text-xs text-muted-foreground">{item.body}</p>}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? "Hide details" : "Details"}
          </button>
          {expanded && (
            <div className="space-y-1.5 rounded-md bg-muted/30 p-2 text-xs">
              {lead?.fitReasons && lead.fitReasons.length > 0 && (
                <div>
                  <p className="font-medium">Why this score</p>
                  <ul className="list-inside list-disc text-muted-foreground">
                    {lead.fitReasons.map((r, i) => (
                      <li key={`${i}-${r.slice(0, 24)}`}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lead?.riskFlags && lead.riskFlags.length > 0 && (
                <p className="text-muted-foreground">Flags: {lead.riskFlags.join(", ").replaceAll("_", " ")}</p>
              )}
              {lead?.fields && Object.keys(lead.fields).length > 0 && (
                <div>
                  <p className="font-medium">Form answers</p>
                  <dl className="text-muted-foreground">
                    {Object.entries(lead.fields).map(([k, v]) => (
                      <div key={k} className="flex gap-1">
                        <dt className="shrink-0 font-medium">{k.replaceAll("_", " ").toLowerCase()}:</dt>
                        <dd className="min-w-0 wrap-break-word">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>
        {item.status === "queued" || item.status === "in_review" ? (
          <div className="flex shrink-0 gap-1.5">
            {item.status === "queued" && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={act.isPending} onClick={() => act.mutate("in_review")}>
                I&apos;m on it
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={act.isPending} onClick={() => act.mutate("resolved")}>
              Resolve
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LeadsPane() {
  const queryClient = useQueryClient();
  const leads = useQuery({
    queryKey: ["inbox-leads"],
    queryFn: () => inboxApi.list({ kind: "lead", limit: 100 }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const onChanged = () => queryClient.invalidateQueries({ queryKey: ["inbox-leads"] });

  if (leads.isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  // A failed fetch must never masquerade as "no leads" — leads keep
  // arriving (and billing) server-side whether or not this list loads.
  if (leads.isError) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load your leads</p>
        <p className="max-w-md text-xs text-muted-foreground">
          New leads still arrive and get scored in the background. Try refreshing in a moment.
        </p>
        <Button size="sm" variant="outline" onClick={() => leads.refetch()}>
          Retry
        </Button>
      </Card>
    );
  }
  // Hot first: priority rank, then newest.
  const PRIORITY_RANK: Record<InboxPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const items = [...(leads.data?.items ?? [])].sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return b.createdAt.localeCompare(a.createdAt);
  });
  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <Sparkles className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">No leads yet</p>
        <p className="max-w-md text-xs text-muted-foreground">
          When someone submits a LinkedIn Lead Gen form on one of your campaigns, it lands here —
          scored, prioritised, and on an SLA clock. Run a lead-generation campaign from the Ads
          Manager to start the flow.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <LeadRow key={item._id} item={item} onChanged={onChanged} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function InboxPage() {
  const { conversations, isLoading } = useWaConversations();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: thread, isLoading: threadLoading } = useWaThread(selected);
  const handoff = useWaHandoff();
  const resume = useWaResume();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One queue for everything inbound — conversations and leads, whichever channel they came from.
        </p>
      </div>

      <Tabs defaultValue="conversations">
        <TabsList>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <LeadsPane />
        </TabsContent>

        <TabsContent value="conversations" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            {/* Thread list */}
            <Card className="max-h-[70vh] overflow-y-auto p-2">
              {isLoading && (
                <div className="space-y-2 p-2">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              )}
              {!isLoading && conversations.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
              )}
              {conversations.map((conv: WaConversation) => (
                <button
                  key={conv.threadId}
                  onClick={() => setSelected(conv.threadId)}
                  className={`flex w-full flex-col gap-0.5 rounded-lg p-2.5 text-left hover:bg-muted ${
                    selected === conv.threadId ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{conv.contactName || conv.waId}</span>
                    <StatusPill status={conv.status} />
                  </div>
                  <span className="truncate text-xs text-muted-foreground">{conv.preview || "…"}</span>
                </button>
              ))}
            </Card>

            {/* Thread view */}
            <Card className="flex max-h-[70vh] flex-col p-0">
              {!selected && (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                  Select a conversation to view it.
                </div>
              )}
              {selected && (
                <>
                  <div className="flex items-center justify-between border-b p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{thread?.contactName || selected.split(":").slice(2).join(":")}</p>
                      {thread && <StatusPill status={thread.status} />}
                    </div>
                    {thread?.status === "escalated" ? (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={resume.isPending}
                        onClick={() =>
                          resume.mutate(selected, {
                            onSuccess: () => toast.success("Handed back — the assistant will reply again."),
                            onError: (e: Error) => toast.error(e?.message || "Couldn't hand back"),
                          })
                        }
                      >
                        {resume.isPending ? "…" : "Return to AI"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={handoff.isPending}
                        onClick={() =>
                          handoff.mutate(selected, {
                            onSuccess: () => toast.success("Flagged for you — the assistant will hold off."),
                            onError: (e: Error) => toast.error(e?.message || "Couldn't hand off"),
                          })
                        }
                      >
                        {handoff.isPending ? "…" : "Take over"}
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto bg-[#e5ddd5] p-3 dark:bg-neutral-800">
                    {threadLoading && <Skeleton className="h-20 w-full" />}
                    {thread?.messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
                    {thread && thread.messages.length === 0 && (
                      <p className="p-4 text-center text-sm text-muted-foreground">No messages.</p>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
