"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExtraPanel, type PanelContext } from "@/components/presence/edit/extra-panel";
import {
  actionLabel,
  buildPostValue,
  charsLeft,
  deleteNote,
  emptyPostDraft,
  KIND_LABEL,
  pendingForPost,
  pendingNote,
  postControls,
  postDraftOf,
  postStateWords,
  type PostDraft,
  type PostItem,
  type PostsResponse,
} from "@/lib/presence-extras";

const TONE = { good: "text-success-on-tint", neutral: "text-muted-foreground", bad: "text-destructive" } as const;

function PostForm({
  decl,
  initial,
  op,
  busy,
  onSubmit,
  onCancel,
}: {
  decl: PostsResponse["declaration"];
  initial: PostDraft;
  op: { op: "create" } | { op: "update"; ref: string };
  busy: boolean;
  onSubmit: (value: unknown) => Promise<{ ok: boolean; message: string }>;
  onCancel: () => void;
}) {
  const [d, setD] = useState<PostDraft>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const editing = op.op === "update";
  const set = (patch: Partial<PostDraft>) => setD((x) => ({ ...x, ...patch }));
  const dated = d.kind === "event" || d.kind === "offer";
  const left = charsLeft(d.summary, decl.limits.summaryMaxLength);

  async function go() {
    const built = buildPostValue(d, decl, op);
    if (!built.ok) return setMessage(built.message);
    const r = await onSubmit(built.value);
    if (r.ok) onCancel();
    else setMessage(r.message);
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs" htmlFor="post-kind">
          Kind of post
        </label>
        <select id="post-kind" className="h-9 rounded-md border bg-background px-2 text-sm" value={d.kind} disabled={editing} onChange={(e) => set({ kind: e.target.value as PostDraft["kind"] })}>
          {decl.kinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        {editing && <span className="text-xs text-muted-foreground">A post cannot change kind. Delete it and post again instead.</span>}
      </div>
      <div className="space-y-1">
        <label className="text-xs" htmlFor="post-summary">
          What do you want to say?
        </label>
        <Textarea id="post-summary" rows={4} value={d.summary} onChange={(e) => set({ summary: e.target.value })} />
        <p className={`text-xs ${left < 0 ? "text-destructive" : "text-muted-foreground"}`}>
          {left < 0 ? `${-left} characters over the limit of ${decl.limits.summaryMaxLength}.` : `${left} characters left.`}
        </p>
      </div>
      {dated && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-3">
            <label className="text-xs" htmlFor="post-title">
              Title
            </label>
            <Input id="post-title" value={d.eventTitle} onChange={(e) => set({ eventTitle: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" htmlFor="post-start">
              Starts
            </label>
            <Input id="post-start" type="date" value={d.start} onChange={(e) => set({ start: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" htmlFor="post-end">
              Ends (optional)
            </label>
            <Input id="post-end" type="date" value={d.end} onChange={(e) => set({ end: e.target.value })} />
          </div>
        </div>
      )}
      {d.kind === "offer" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs" htmlFor="post-code">
              Coupon code (optional)
            </label>
            <Input id="post-code" value={d.offerCode} onChange={(e) => set({ offerCode: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" htmlFor="post-redeem">
              Redeem link (optional)
            </label>
            <Input id="post-redeem" value={d.redeemUrl} onChange={(e) => set({ redeemUrl: e.target.value })} placeholder="https://" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs" htmlFor="post-terms">
              Terms (optional)
            </label>
            <Input id="post-terms" value={d.terms} onChange={(e) => set({ terms: e.target.value })} />
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs" htmlFor="post-action">
            Button (optional)
          </label>
          <select id="post-action" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={d.actionType} onChange={(e) => set({ actionType: e.target.value, ...(e.target.value === decl.actionWithoutUrl ? { actionUrl: "" } : {}) })}>
            <option value="">No button</option>
            {decl.actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </div>
        {d.actionType && d.actionType !== decl.actionWithoutUrl && (
          <div className="space-y-1">
            <label className="text-xs" htmlFor="post-url">
              Button web address
            </label>
            <Input id="post-url" value={d.actionUrl} onChange={(e) => set({ actionUrl: e.target.value })} placeholder="https://" />
          </div>
        )}
        {d.actionType && d.actionType === decl.actionWithoutUrl && <p className="self-end text-xs text-muted-foreground">This button calls your listing&apos;s phone number.</p>}
      </div>
      {message && (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void go()}>
          {busy ? "Preparing..." : "Review change"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PostsBody({ ctx }: { ctx: PanelContext<PostsResponse> }) {
  const { data, label, access, busy, submit, changes, network, can } = ctx;
  const [form, setForm] = useState<{ op: "create" } | { op: "update"; ref: string; item: PostItem } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ ref: string; message: string } | null>(null);

  async function send(value: unknown) {
    setNotice(null);
    const r = await submit(value);
    if (r.ok) setNotice(r.message);
    return r;
  }

  async function remove(ref: string) {
    setRowError(null);
    const r = await send({ op: "delete", ref });
    if (!r.ok) setRowError({ ref, message: r.message });
  }

  return (
    <>
      {!data.complete && (
        <p className="text-xs text-warning-on-tint">We could not read every one of your posts from {label} just now, so this list may be missing some. You can still write a new post.</p>
      )}
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      {access.mode === "edit" && !form && (
        <Button size="sm" className="w-fit" disabled={busy} onClick={() => { setForm({ op: "create" }); setNotice(null); }}>
          Write a post
        </Button>
      )}
      {access.mode === "view" && <p className="text-xs text-muted-foreground">{access.why}</p>}
      {form?.op === "create" && <PostForm decl={data.declaration} initial={emptyPostDraft()} op={{ op: "create" }} busy={busy} onSubmit={send} onCancel={() => setForm(null)} />}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">On your listing</h3>
        {data.items.length === 0 ? (
          <p className="text-xs text-muted-foreground">You have no posts on {label} yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.items.map((p) => {
              const pending = pendingForPost(changes, network, p.ref);
              const ctl = postControls(access, data.declaration, pending);
              const words = postStateWords(p.state, label);
              return (
                <li key={p.ref} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{KIND_LABEL[p.kind]}</Badge>
                    <span className={`text-xs ${TONE[words.tone]}`}>{words.text}</span>
                    {p.hasPhoto && <span className="text-xs text-muted-foreground">Has a photo (shown on {label}, not changed here)</span>}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">{p.summary}</p>
                  {p.event && (
                    <p className="text-xs text-muted-foreground">
                      {p.event.title}: {p.event.start}
                      {p.event.end ? ` to ${p.event.end}` : ""}
                    </p>
                  )}
                  {p.action && <p className="text-xs text-muted-foreground">Button: {actionLabel(p.action.type)}</p>}
                  {pending && <p className="text-xs text-muted-foreground">{pendingNote(pending.status, can)}</p>}
                  {form?.op === "update" && form.ref === p.ref ? (
                    <PostForm decl={data.declaration} initial={postDraftOf(p)} op={{ op: "update", ref: p.ref }} busy={busy} onSubmit={send} onCancel={() => setForm(null)} />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ctl.edit && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => { setForm({ op: "update", ref: p.ref, item: p }); setNotice(null); }}>
                          Edit
                        </Button>
                      )}
                      {ctl.remove && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void remove(p.ref)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  )}
                  {ctl.remove && <p className="text-xs text-muted-foreground">{deleteNote(data.declaration, label)}</p>}
                  {rowError?.ref === p.ref && (
                    <p role="alert" className="text-xs text-destructive">
                      {rowError.message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * Your posts: write one, edit or delete one that is on your listing. MARKUP ONLY (`lib/presence-extras.ts` holds the rules and words).
 * Drawn only for a network that declares posts. A post is written by a person and approved by one; nothing is sent until it is approved.
 */
export function PostsCard({ location, network }: { location?: string | undefined; network?: string | undefined }) {
  return (
    <ExtraPanel<PostsResponse> field="posts" location={location} network={network} title="Your posts" blurb="Write a post, or change or delete one that is on your listing." what="posts" itemCount={(d) => d.items.length}>
      {(ctx) => <PostsBody ctx={ctx} />}
    </ExtraPanel>
  );
}
