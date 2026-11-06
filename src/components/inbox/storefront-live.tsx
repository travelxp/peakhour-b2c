"use client";

import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useInboxPrices, useRefreshSummary, useWaHandoff, useWaReply, useWaResume, type StorefrontThread } from "@/hooks/use-wa-conversations";
import { SuggestedReply, useComposerMemory } from "@/components/inbox/wa-composer";
import { actionError, priced } from "@/lib/inbox-customer";
import {
  STOREFRONT_REPLY_MAX,
  deliveryLine,
  emailLine,
  noteHeading,
  safeAdminUrl,
  storefrontFooter,
  storefrontReplyError,
  storefrontTextProblem,
  type StorefrontHandover,
} from "@/lib/storefront-handover";
import {
  attemptAfterError,
  attemptFor,
  clearAfterSend,
  errorAfterEdit,
  maySend,
  mintIdempotencyKey,
  needsResendConfirm,
  replySignature,
  replySuccessNote,
  statusErrorMessage,
  type ComposerStore,
} from "@/lib/wa-inbox-reply";

/**
 * SA-9: the live-reply parts of a storefront chat. MARKUP ONLY: what is offered, what each refusal says and what the delivery
 * line says are `lib/storefront-handover.ts`'s, tested there. The draft, the idempotency key and the last error live in the
 * page's `ComposerStore`, as the WhatsApp composer's do, so a send that settles after the person opened another chat still lands.
 */

/** The reply box: text only. No attachments, templates, product or checkout buttons, and no 24-hour window. */
export function StorefrontComposer({ thread, store }: { thread: StorefrontThread; store: ComposerStore }) {
  const threadId = thread.threadId;
  const mem = useComposerMemory(store, threadId);
  const reply = useWaReply(threadId);
  const resume = useWaResume();
  const update = (patch: Parameters<ComposerStore["update"]>[1]) => store.update(threadId, patch);
  const problem = storefrontTextProblem(mem.text);
  const confirm = needsResendConfirm(mem.attempt);
  const line = deliveryLine(thread.delivery);

  async function send() {
    const text = store.get(threadId).text;
    const sig = replySignature({ kind: "text", text });
    const prev = store.get(threadId).attempt;
    const attempt = attemptFor(prev, sig, mintIdempotencyKey);
    update({ attempt, error: null, note: null, pending: true });
    try {
      const res = await reply.mutateAsync({ payload: { kind: "text", text }, idempotencyKey: attempt.key });
      const note = replySuccessNote(res);
      update((cur) => ({ ...clearAfterSend(cur, sig), attempt: null, error: null, note, pending: false }));
      if (!note) toast.success("Reply saved to the chat.");
    } catch (e) {
      const copy = storefrontReplyError(e);
      update({ error: copy, attempt: attemptAfterError(attempt, copy, prev), pending: false });
    }
  }
  const submit = (via: "button" | "keyboard") => {
    if (maySend({ problem, pending: mem.pending, confirm, via })) void send();
  };

  return (
    <div className="space-y-2 border-t p-3" data-testid="storefront-composer">
      {mem.error && (
        <div role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
          <p className="font-medium text-warning-on-tint">{mem.error.title}</p>
          <p className="mt-0.5 text-foreground">{mem.error.detail}</p>
        </div>
      )}
      {mem.note && <p className="text-xs text-muted-foreground">{mem.note}</p>}
      <Textarea
        value={mem.text}
        onChange={(e) => update((cur) => ({ text: e.target.value, error: errorAfterEdit(cur.error, cur.attempt) }))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit("keyboard");
          }
        }}
        placeholder="Write to the visitor…"
        rows={3}
        aria-label="Reply to the visitor"
      />
      {line && (
        <p className="text-[11px] text-muted-foreground" data-testid="delivery-line">
          {line}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {mem.text.trim().length > STOREFRONT_REPLY_MAX ? problem : `${mem.text.trim().length}/${STOREFRONT_REPLY_MAX}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={resume.isPending || mem.pending}
            onClick={() =>
              resume.mutate(
                { threadId, thread },
                {
                  onSuccess: () => toast.success("Handed back. The assistant will reply again."),
                  onError: (e: Error) => toast.error(statusErrorMessage(e, "hand back")),
                },
              )
            }
          >
            {resume.isPending ? "Resuming…" : "Resume the assistant"}
          </Button>
          <Button size="sm" disabled={Boolean(problem) || mem.pending} onClick={() => submit("button")}>
            {mem.pending ? "Sending…" : confirm ? "Send again anyway" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Under an assistant-held chat: the read-only note and, for an editor, a Take over button. Under a test chat or for a viewer: the note alone. */
export function StorefrontFooter({ thread, role, store }: { thread: StorefrontThread; role: string | null; store: ComposerStore }) {
  const footer = storefrontFooter({ readOnly: thread.readOnly, role, test: thread.test === true });
  const handoff = useWaHandoff();
  if (footer.kind === "composer") return <StorefrontComposer thread={thread} store={store} />;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 p-3" data-testid="storefront-footer">
      <p className="text-xs text-muted-foreground">{footer.note}</p>
      {footer.kind === "takeover" && (
        <Button
          size="sm"
          disabled={handoff.isPending}
          onClick={() =>
            handoff.mutate(thread.threadId, {
              onSuccess: () => toast.success("You have this chat. The assistant has stopped replying."),
              onError: (e: Error) => toast.error(statusErrorMessage(e, "take over")),
            })
          }
        >
          {handoff.isPending ? "Taking over…" : "Take over"}
        </Button>
      )}
    </div>
  );
}

/** The package the assistant prepared when it handed the chat over, at the top of the thread. */
export function HandoverCard({ thread, store }: { thread: StorefrontThread; store: ComposerStore }) {
  const h: StorefrontHandover | null | undefined = thread.handover;
  const prices = useInboxPrices();
  const summary = useRefreshSummary(thread.threadId);
  const mem = useComposerMemory(store, thread.threadId);
  if (!h) return null;
  const adminUrl = safeAdminUrl(h.adminUrl);
  const email = emailLine(thread.contactEmail, thread.hasContactEmail);
  const price = priced("Refresh summary", prices.data?.customerSummary);
  return (
    <section aria-label="Handed over to you" className="space-y-2 rounded-md border bg-background p-3 text-xs" data-testid="handover-card">
      <p className="text-sm font-medium">{h.reasonLabel}</p>
      {h.note && (
        <div className="space-y-1 rounded-md bg-muted/40 p-2">
          <p className="font-medium">{noteHeading(h.kind, h.orderNumber)}</p>
          <p className="whitespace-pre-wrap">{h.note}</p>
          {adminUrl && (
            <a href={adminUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
              Open the order in Shopify
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
      {!h.note && adminUrl && (
        <a href={adminUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
          Open the order in Shopify
          <ExternalLink className="size-3" />
        </a>
      )}
      {h.lastAsks.length > 0 && (
        <div>
          <p className="font-medium">What the visitor asked last</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-muted-foreground">
            {h.lastAsks.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {email && <p data-testid="handover-email">{email}</p>}
      {thread.summary?.text && (
        <div>
          <p className="font-medium">Summary</p>
          <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{thread.summary.text}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="xs"
          variant="outline"
          disabled={summary.isPending || !price.available}
          onClick={() => summary.mutate(undefined, { onError: (e) => toast.error(actionError(e, "Refreshing the summary")) })}
        >
          {summary.isPending ? "Refreshing…" : price.text}
        </Button>
      </div>
      <SuggestedReply
        threadId={thread.threadId}
        hasDraft={mem.text.trim().length > 0}
        disabled={mem.pending}
        onUse={(reply) => store.update(thread.threadId, (cur) => ({ text: reply, error: errorAfterEdit(cur.error, cur.attempt) }))}
      />
    </section>
  );
}
