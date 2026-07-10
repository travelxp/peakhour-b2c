"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWaConversations,
  useWaThread,
  useWaHandoff,
  type WaConversation,
} from "@/hooks/use-wa-conversations";

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

export default function InboxPage() {
  const { conversations, isLoading } = useWaConversations();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: thread, isLoading: threadLoading } = useWaThread(selected);
  const handoff = useWaHandoff();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your WhatsApp conversations. The assistant handles them autonomously — step in any time.
        </p>
      </div>

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
                <Button
                  size="sm"
                  variant="outline"
                  disabled={handoff.isPending || thread?.status === "escalated"}
                  onClick={() =>
                    handoff.mutate(selected, {
                      onSuccess: () => toast.success("Flagged for you — the assistant will hold off."),
                      onError: (e: Error) => toast.error(e?.message || "Couldn't hand off"),
                    })
                  }
                >
                  {thread?.status === "escalated" ? "With you" : handoff.isPending ? "…" : "Take over"}
                </Button>
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
    </div>
  );
}
