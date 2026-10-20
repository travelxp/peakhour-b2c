"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWaReply, useWaStudioTemplates } from "@/hooks/use-wa-conversations";
import { listFetchState, showsSkeleton } from "@/lib/list-fetch-state";
import {
  attemptFor,
  mintIdempotencyKey,
  needsResendConfirm,
  pickableTemplates,
  replyErrorCopy,
  replySignature,
  replySuccessNote,
  templatePreview,
  templateValueProblem,
  textProblem,
  REPLY_TEXT_MAX,
  type Attempt,
  type ComposerMode,
  type ReplyErrorCopy,
  type ReplyPayload,
} from "@/lib/wa-inbox-reply";

/**
 * WA T4: the box under a WhatsApp thread that a team member replies from.
 *
 * ★★MARKUP ONLY. What it offers, which key a send goes out under and what each
 * refusal says are `lib/wa-inbox-reply.ts`'s, tested there: this repo's vitest
 * runs without a DOM, so a rule in here is a rule nothing asserts.
 *
 * ★THE DRAFT, THE KEY AND THE LAST ERROR OUTLIVE THE COMPONENT (`memory`, held
 * by the page per thread). Switching to another conversation or tab unmounts
 * this box; without the memory, coming back after "we can't tell whether this
 * arrived" showed an empty box, no warning, and a fresh key for the same words.
 */

export interface ComposerMemory {
  text: string;
  attempt: Attempt | null;
  error: ReplyErrorCopy | null;
  note: string | null;
  templateId: string | null;
  header: string[];
  body: string[];
}

const EMPTY: ComposerMemory = {
  text: "",
  attempt: null,
  error: null,
  note: null,
  templateId: null,
  header: [],
  body: [],
};

export function WaComposer({
  threadId,
  mode,
  replyingAs,
  memory,
}: {
  threadId: string;
  mode: ComposerMode;
  replyingAs: string;
  memory: Map<string, ComposerMemory>;
}) {
  const [mem, setMem] = useState<ComposerMemory>(() => memory.get(threadId) ?? EMPTY);
  const reply = useWaReply(threadId);
  const templates = useWaStudioTemplates(mode.kind === "template");

  function update(patch: Partial<ComposerMemory>) {
    setMem((prev) => {
      const next = { ...prev, ...patch };
      memory.set(threadId, next);
      return next;
    });
  }

  if (mode.kind === "readonly" || mode.kind === "takeover") {
    return (
      <div className="border-t bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">{mode.reason}</p>
      </div>
    );
  }

  async function send(payload: ReplyPayload, clear: Partial<ComposerMemory>) {
    const attempt = attemptFor(mem.attempt, replySignature(payload), mintIdempotencyKey);
    update({ attempt, error: null, note: null });
    try {
      const res = await reply.mutateAsync({ payload, idempotencyKey: attempt.key });
      const note = replySuccessNote(res);
      update({ ...clear, attempt: null, error: null, note });
      if (!note) toast.success("Sent to the shopper on WhatsApp.");
    } catch (e) {
      const copy = replyErrorCopy(e);
      update({ error: copy, attempt: copy.attempt === "unknown" ? { ...attempt, unknown: true } : attempt });
      if (copy.refetchTemplates) void templates.refetch();
    }
  }

  const status = (
    <>
      {mem.error && (
        <div role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
          <p className="font-medium text-warning-on-tint">{mem.error.title}</p>
          <p className="mt-0.5 text-foreground">{mem.error.detail}</p>
        </div>
      )}
      {mem.note && <p className="text-xs text-muted-foreground">{mem.note}</p>}
    </>
  );

  if (mode.kind === "text") {
    const payload: ReplyPayload = { kind: "text", text: mem.text };
    const sig = replySignature(payload);
    const problem = textProblem(mem.text);
    const confirm = needsResendConfirm(mem.attempt, sig);
    const submit = () => {
      if (problem || reply.isPending) return;
      void send(payload, { text: "" });
    };
    return (
      <div className="space-y-2 border-t p-3">
        <p className="text-[11px] text-muted-foreground">{replyingAs}</p>
        {status}
        <Textarea
          value={mem.text}
          onChange={(e) => update({ text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Write to the shopper…"
          rows={3}
          aria-label="Reply to the shopper"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {mem.text.trim().length > REPLY_TEXT_MAX ? problem : `${mem.text.trim().length}/${REPLY_TEXT_MAX}`}
          </span>
          <Button size="sm" disabled={Boolean(problem) || reply.isPending} onClick={submit}>
            {reply.isPending ? "Sending…" : confirm ? "Send again anyway" : "Send"}
          </Button>
        </div>
      </div>
    );
  }

  // ── template mode: the window has closed ──
  const { sendable, unsendable } = pickableTemplates(templates.data?.templates);
  const state = listFetchState(templates, sendable.length);
  const picked = sendable.find((s) => s.template._id === mem.templateId) ?? null;
  const header = picked ? Array.from({ length: picked.headerCount }, (_, i) => mem.header[i] ?? "") : [];
  const body = picked ? Array.from({ length: picked.bodyCount }, (_, i) => mem.body[i] ?? "") : [];
  const valueProblem = [...header, ...body].map(templateValueProblem).find(Boolean) ?? null;
  const payload: ReplyPayload | null = picked
    ? {
        kind: "template",
        templateId: picked.template._id,
        ...(header.length || body.length
          ? { params: { ...(header.length ? { header } : {}), ...(body.length ? { body } : {}) } }
          : {}),
      }
    : null;
  const confirm = payload ? needsResendConfirm(mem.attempt, replySignature(payload)) : false;

  return (
    <div className="space-y-2 border-t p-3">
      <p className="text-xs text-muted-foreground">{mode.reason}</p>
      <p className="text-[11px] text-muted-foreground">{replyingAs}</p>
      {status}
      {showsSkeleton(state) && <Skeleton className="h-9 w-full" />}
      {state === "paused" && (
        <p className="text-xs text-muted-foreground">Waiting for a connection — your templates will load when you&apos;re back online.</p>
      )}
      {state === "error" && (
        <p className="text-xs text-muted-foreground">
          Couldn&apos;t load your templates.{" "}
          <button className="underline underline-offset-2" onClick={() => void templates.refetch()}>
            Retry
          </button>
        </p>
      )}
      {state === "empty" && (
        <p className="text-xs text-muted-foreground">
          {unsendable > 0
            ? `None of your approved templates can be sent from the Inbox (${unsendable} use a media header, a personalised link, named values or a verification code). `
            : "You have no approved templates yet. "}
          <Link href="/dashboard/content/whatsapp/templates" className="underline underline-offset-2">
            Open Template Studio
          </Link>
        </p>
      )}
      {sendable.length > 0 && (
        <>
          <Select
            value={mem.templateId ?? undefined}
            onValueChange={(v) => update({ templateId: v, header: [], body: [], error: null, note: null })}
          >
            <SelectTrigger className="w-full" aria-label="Approved template">
              <SelectValue placeholder="Pick an approved template" />
            </SelectTrigger>
            <SelectContent>
              {sendable.map(({ template: t }) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name} · {t.language} · {t.category === "MARKETING" ? "marketing" : "utility"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {unsendable > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {unsendable} approved template{unsendable === 1 ? "" : "s"} can&apos;t be sent from the Inbox and {unsendable === 1 ? "isn't" : "aren't"} listed.
            </p>
          )}
        </>
      )}
      {picked && (
        <div className="space-y-2">
          {picked.template.category === "MARKETING" && (
            <p className="text-[11px] text-muted-foreground">
              A marketing template is only sent to a shopper who agreed to marketing messages.
            </p>
          )}
          {header.map((v, i) => (
            <Input
              key={`h${i}`}
              value={v}
              aria-label={`Header value {{${i + 1}}}`}
              placeholder={`Header {{${i + 1}}}`}
              onChange={(e) => {
                const next = [...header];
                next[i] = e.target.value;
                update({ header: next });
              }}
            />
          ))}
          {body.map((v, i) => (
            <Input
              key={`b${i}`}
              value={v}
              aria-label={`Body value {{${i + 1}}}`}
              placeholder={`Body {{${i + 1}}}`}
              onChange={(e) => {
                const next = [...body];
                next[i] = e.target.value;
                update({ body: next });
              }}
            />
          ))}
          <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
            {templatePreview(picked.template, header, body)}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">{valueProblem ?? ""}</span>
            <Button
              size="sm"
              disabled={Boolean(valueProblem) || reply.isPending || !payload}
              onClick={() => payload && void send(payload, { templateId: null, header: [], body: [] })}
            >
              {reply.isPending ? "Sending…" : confirm ? "Send again anyway" : "Send template"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
