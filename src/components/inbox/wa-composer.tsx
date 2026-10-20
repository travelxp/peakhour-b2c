"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
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
import { createSharedClock, deadlineDelay } from "@/lib/shared-clock";
import {
  attemptFor,
  clearAfterSend,
  composerMode,
  maySend,
  mintIdempotencyKey,
  needsResendConfirm,
  pickableTemplates,
  replyErrorCopy,
  replySignature,
  replySuccessNote,
  replyWindow,
  templateContentProblem,
  templateListTruncated,
  templatePayload,
  templatePreview,
  templateValueProblem,
  textProblem,
  REPLY_TEXT_MAX,
  STUDIO_LIST_CAP,
  WINDOW_TICK_MS,
  type ComposerMemory,
  type ComposerStore,
  type ReplyPayload,
  type ReplyWindow,
} from "@/lib/wa-inbox-reply";

/**
 * WA T4: the box under a WhatsApp thread that a team member replies from.
 *
 * ★★MARKUP ONLY. What it offers, which key a send goes out under and what each
 * refusal says are `lib/wa-inbox-reply.ts`'s, tested there: this repo's vitest
 * runs without a DOM, so a rule in here is a rule nothing asserts.
 *
 * ★THE DRAFT, THE KEY, THE LAST ERROR AND THE IN-FLIGHT FLAG LIVE IN THE PAGE'S
 * `ComposerStore`, per thread, not in this component. Switching to another
 * conversation unmounts this box; a send that settles afterwards still writes
 * its outcome, so coming back after "we can't tell whether this arrived" shows
 * that warning, not an empty box and a fresh key for the same words.
 */

/** One thread's memory, re-rendering when it changes. */
export function useComposerMemory(store: ComposerStore, threadId: string): ComposerMemory {
  const get = useCallback(() => store.get(threadId), [store, threadId]);
  return useSyncExternalStore(store.subscribe, get, get);
}

/** ★ONE CLOCK for the badge and the composer (review R2): two `useNow`s tick
 *  at different moments, and near the deadline they disagreed. */
const WINDOW_CLOCK = createSharedClock(WINDOW_TICK_MS);

/**
 * The 24h window as the badge AND the composer read it. ★ONE HOOK AND ONE
 * CLOCK FOR BOTH, so the badge cannot say "2m left" above a composer already
 * switched to templates. The clock ticks, so both move on an idle page; it is
 * read here rather than at the top of the page, so a tick re-renders the badge
 * and the box, not the whole Inbox. ★AND IT IS REFRESHED AT THE DEADLINE
 * ITSELF (review R2), so free text is not offered for up to a tick after the
 * window closed.
 */
export function useReplyWindow(store: ComposerStore, threadId: string, endsAt: string | null | undefined): ReplyWindow {
  const now = useSyncExternalStore(WINDOW_CLOCK.subscribe, WINDOW_CLOCK.now, WINDOW_CLOCK.now);
  useEffect(() => {
    const ms = deadlineDelay(endsAt, Date.now());
    if (ms === null) return;
    const id = setTimeout(WINDOW_CLOCK.refresh, ms);
    return () => clearTimeout(id);
  }, [endsAt]);
  const { closedFor } = useComposerMemory(store, threadId);
  return replyWindow(endsAt, now, closedFor);
}

export function WaComposer({
  threadId,
  status,
  role,
  endsAt,
  replyingAs,
  store,
}: {
  threadId: string;
  status: string;
  role: string | null;
  endsAt: string | null | undefined;
  replyingAs: string;
  store: ComposerStore;
}) {
  const mem = useComposerMemory(store, threadId);
  const win = useReplyWindow(store, threadId, endsAt);
  const mode = composerMode({ status, role, window: win });
  const reply = useWaReply(threadId);
  const templates = useWaStudioTemplates(mode.kind === "template");
  const update = (patch: Parameters<ComposerStore["update"]>[1]) => store.update(threadId, patch);

  if (mode.kind === "readonly" || mode.kind === "takeover") {
    return (
      <div className="border-t bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">{mode.reason}</p>
      </div>
    );
  }

  async function send(payload: ReplyPayload) {
    const sig = replySignature(payload);
    const attempt = attemptFor(store.get(threadId).attempt, sig, mintIdempotencyKey);
    update({ attempt, error: null, note: null, pending: true });
    try {
      const res = await reply.mutateAsync({ payload, idempotencyKey: attempt.key });
      const note = replySuccessNote(res);
      update((cur) => ({ ...clearAfterSend(cur, sig), attempt: null, error: null, note, pending: false }));
      if (!note) toast.success("Sent to the shopper on WhatsApp.");
    } catch (e) {
      const copy = replyErrorCopy(e, payload.kind);
      update({
        error: copy,
        attempt: copy.attempt === "unknown" ? { ...attempt, unknown: true } : attempt,
        pending: false,
        ...(copy.closesWindow && endsAt ? { closedFor: endsAt } : {}),
      });
      if (copy.refetchTemplates) void templates.refetch();
    }
  }

  const status_ = (
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
    const problem = textProblem(mem.text);
    const confirm = needsResendConfirm(mem.attempt, replySignature(payload));
    const submit = (via: "button" | "keyboard") => {
      if (!maySend({ problem, pending: mem.pending, confirm, via })) return;
      void send(payload);
    };
    return (
      <div className="space-y-2 border-t p-3">
        <p className="text-[11px] text-muted-foreground">{replyingAs}</p>
        {status_}
        <Textarea
          value={mem.text}
          onChange={(e) => update({ text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit("keyboard");
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
          <Button size="sm" disabled={Boolean(problem) || mem.pending} onClick={() => submit("button")}>
            {mem.pending ? "Sending…" : confirm ? "Send again anyway" : "Send"}
          </Button>
        </div>
      </div>
    );
  }

  // ── template mode: the window has closed ──
  const list = templates.data?.templates;
  const { sendable, unsendable } = pickableTemplates(list);
  const state = listFetchState(templates, sendable.length);
  const truncated = templateListTruncated(list);
  const picked = sendable.find((s) => s.template._id === mem.templateId) ?? null;
  const header = picked ? Array.from({ length: picked.headerCount }, (_, i) => mem.header[i] ?? "") : [];
  const body = picked ? Array.from({ length: picked.bodyCount }, (_, i) => mem.body[i] ?? "") : [];
  const preview = picked ? templatePreview(picked.template, header, body) : "";
  const valueProblem =
    [...header, ...body].map(templateValueProblem).find(Boolean) ?? (picked ? templateContentProblem(preview) : null);
  const payload: ReplyPayload | null = picked ? templatePayload(picked.template._id, header, body) : null;
  const confirm = payload ? needsResendConfirm(mem.attempt, replySignature(payload)) : false;

  return (
    <div className="space-y-2 border-t p-3">
      <p className="text-xs text-muted-foreground">{mode.reason}</p>
      <p className="text-[11px] text-muted-foreground">{replyingAs}</p>
      {status_}
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
            ? `None of your approved templates can be sent from the Inbox (${unsendable} use a media header, a personalised link, named values, too many values or a verification code). `
            : truncated
              ? `None of your ${STUDIO_LIST_CAP} most recently updated templates is approved. `
              : "You have no approved templates yet. "}
          <Link href="/dashboard/content/whatsapp/templates" className="underline underline-offset-2">
            Open Template Studio
          </Link>
        </p>
      )}
      {sendable.length > 0 && (
        <>
          <Select
            // ★ALWAYS CONTROLLED, and only with an id that is still listed
            //  (review R2): `undefined` flipped Radix to uncontrolled after a
            //  send, and a template that left the list kept a stale trigger.
            value={picked ? picked.template._id : ""}
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
      {truncated && state !== "empty" && (
        <p className="text-[11px] text-muted-foreground">
          Only your {STUDIO_LIST_CAP} most recently updated templates are checked here; older approved ones may be missing.
        </p>
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
            {preview}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">{valueProblem ?? ""}</span>
            <Button
              size="sm"
              disabled={Boolean(valueProblem) || mem.pending || !payload}
              onClick={() => payload && void send(payload)}
            >
              {mem.pending ? "Sending…" : confirm ? "Send again anyway" : "Send template"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
