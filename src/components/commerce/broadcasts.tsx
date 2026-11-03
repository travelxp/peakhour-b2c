"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import {
  useBroadcasts,
  useCancelBroadcast,
  useCreateBroadcast,
  usePreviewBroadcast,
  useSaveWaSettings,
  useWaOverview,
  useWaProducts,
  useWaTemplates,
  type BroadcastDraft,
} from "@/hooks/use-wa-marketing";
import {
  AUDIENCE_OPTIONS,
  BROADCAST_INTRO,
  FEES_NOTE,
  NOT_UNDOABLE,
  STATUS_LABEL,
  audienceSentence,
  confirmSentence,
  moneyMinor,
  notSentLine,
  readinessCopy,
  resultsLine,
  type AudienceKind,
  type Broadcast,
  type Preview,
} from "@/lib/wa-marketing";

const field = "block h-9 w-full max-w-md rounded-md border bg-background px-3 text-sm";

/**
 * Commerce -> Broadcasts (lane I3d). Compose from a marketing template Meta has approved, pick who gets it, SEE the audience
 * size and an estimated Meta cost, confirm, then watch it send. Off until the merchant switches broadcasts on.
 *
 * Journey: Review (a read, sends nothing) -> Confirm (a dialog that says how many people and that it cannot be undone) ->
 * sent throttled by the server. A group that changed while the merchant was reviewing is refused (nothing sent) and re-shown.
 */
export function BroadcastsPanel() {
  const overview = useWaOverview();
  if (overview.isPending) return <Skeleton className="h-64 w-full" />;
  if (overview.isError || !overview.data) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm text-destructive">We could not load your broadcasts. Nothing was sent.</p>
        <Button variant="outline" onClick={() => void overview.refetch()}>Try again</Button>
      </div>
    );
  }
  const d = overview.data;
  // Broadcasts need the stop to be off and WhatsApp connected; the cart reminder's template approval is not their concern.
  const banner = d.stopped ? readinessCopy("ready", true) : d.recovery.ready === "no_whatsapp" ? readinessCopy("no_whatsapp", false) : null;
  return (
    <div className="space-y-6" data-broadcasts="ready">
      <p className="text-sm text-muted-foreground">{BROADCAST_INTRO} {FEES_NOTE}</p>
      {banner && (
        <div role="status" className="rounded-lg border bg-muted/40 p-4">
          <p className="font-medium">{banner.heading}</p>
          <p className="mt-1 text-sm text-muted-foreground">{banner.body}</p>
        </div>
      )}
      <SwitchCard on={d.settings.broadcasts.enabled} />
      {d.settings.broadcasts.enabled && <Composer ratesAsOf={d.ratesAsOf} blocked={d.stopped ? "Your emergency stop is on, so a broadcast cannot be sent." : d.recovery.ready === "no_whatsapp" ? "Connect WhatsApp to send a broadcast." : null} />}
      <History currency={d.currency} />
    </div>
  );
}

function SwitchCard({ on }: { on: boolean }) {
  const save = useSaveWaSettings();
  // The value the merchant chose stays on screen until the refetch confirms it, so it does not flick back and look unsaved.
  const [chosen, setChosen] = useState<boolean | null>(null);
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-6">
        <Switch id="bc-enabled" checked={chosen ?? on} disabled={save.isPending} onCheckedChange={(v) => { setChosen(v); save.mutate({ broadcasts: { enabled: v } }, { onError: () => setChosen(null) }); }} />
        <Label htmlFor="bc-enabled">Allow broadcasts</Label>
        <span className="text-sm text-muted-foreground">Off until you turn it on. Only shoppers who opted in are ever messaged, and each can reply STOP.</span>
        {save.isError && <span role="alert" className="text-sm text-destructive">We could not save that. Nothing was changed.</span>}
      </CardContent>
    </Card>
  );
}

function Composer({ ratesAsOf, blocked }: { ratesAsOf: string; blocked: string | null }) {
  const templates = useWaTemplates(true);
  const [name, setName] = useState("");
  const [tpl, setTpl] = useState("");
  const [params, setParams] = useState<string[]>([]);
  const [kind, setKind] = useState<AudienceKind>("all_opted_in");
  const [daysText, setDaysText] = useState("30");
  const [productQ, setProductQ] = useState("");
  const [productId, setProductId] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [preview, setPreview] = useState<{ draft: BroadcastDraft; value: Preview } | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const products = useWaProducts(productQ, kind === "bought_product");
  const previewM = usePreviewBroadcast();
  const createM = useCreateBroadcast();

  const list = templates.data?.templates ?? [];
  const chosen = list.find((t) => `${t.name}|${t.language}` === tpl);

  function pickTemplate(v: string) {
    setTpl(v);
    setPreview(null);
    const t = list.find((x) => `${x.name}|${x.language}` === v);
    setParams(t ? Array.from({ length: t.slots }, () => "") : []);
  }

  function draft(): BroadcastDraft | string {
    if (!name.trim()) return "Give the broadcast a name.";
    if (!chosen) return "Choose a template.";
    const audience: BroadcastDraft["audience"] =
      kind === "purchased_recent" ? { kind, days: Number(daysText) } : kind === "bought_product" ? { kind, sourceProductId: productId } : { kind };
    if (kind === "purchased_recent" && (!Number.isInteger(audience.days) || audience.days! < 1 || audience.days! > 365)) return "Choose how many days back, from 1 to 365.";
    if (kind === "bought_product" && !productId) return "Choose the product.";
    let scheduledFor: string | null = null;
    if (when === "later") {
      const d = new Date(at);
      if (!at || Number.isNaN(d.getTime())) return "Choose when to send it.";
      if (d.getTime() < Date.now()) return "Choose a time that has not passed.";
      scheduledFor = d.toISOString();
    }
    return { name: name.trim(), templateName: chosen.name, language: chosen.language, bodyParams: params, audience, scheduledFor };
  }

  async function onReview() {
    setNotice(null);
    const d = draft();
    if (typeof d === "string") return setNotice({ tone: "bad", text: `${d} Nothing was sent.` });
    try {
      setPreview({ draft: d, value: await previewM.mutateAsync(d) });
    } catch (err) {
      setPreview(null);
      setNotice({ tone: "bad", text: `${err instanceof Error ? err.message : "We could not prepare that."} Nothing was sent.` });
    }
  }

  async function onConfirm() {
    // One request at a time: the dialog closes on confirm, and a send cannot be undone.
    if (!preview || createM.isPending || blocked) return;
    // The time was checked at Review; the page may have sat open since.
    if (preview.draft.scheduledFor && new Date(preview.draft.scheduledFor).getTime() < Date.now()) {
      setNotice({ tone: "bad", text: "That time has passed. Choose a new time and review again. Nothing was sent." });
      setPreview(null);
      return;
    }
    try {
      const r = await createM.mutateAsync({ draft: preview.draft, expectedAudienceSize: preview.value.audienceSize });
      setNotice({ tone: "ok", text: r.duplicate ? "That broadcast was already set up. Nothing new was sent." : `Done. The broadcast is set up for ${r.audienceSize} ${r.audienceSize === 1 ? "shopper" : "shoppers"} and will start ${preview.draft.scheduledFor ? "at the time you chose" : "shortly"}.` });
      // The whole form starts fresh: a second review of the same template and audience would be the same broadcast.
      setPreview(null);
      setName("");
      setTpl("");
      setParams([]);
      setKind("all_opted_in");
      setDaysText("30");
      setProductQ("");
      setProductId("");
      setWhen("now");
      setAt("");
    } catch (err) {
      // A 409 (the group changed) and any other refusal both say nothing was sent; show the group again.
      setNotice({ tone: "bad", text: err instanceof Error ? err.message : "We could not set that broadcast up. Nothing was sent." });
      setPreview(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New broadcast</CardTitle>
        <CardDescription>Nothing is sent until you review and confirm.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.isPending && <Skeleton className="h-9 w-64" />}
        {templates.isError && <p role="alert" className="text-sm text-destructive">We could not read your templates from Meta just now. Try again in a moment.</p>}
        {templates.data?.error && <p role="status" className="text-sm text-muted-foreground">{templates.data.error}</p>}
        {templates.data && !templates.data.error && list.length === 0 && (
          <p className="text-sm text-muted-foreground">You have no marketing templates approved by Meta yet. Create one under WhatsApp templates, and once Meta approves it, it appears here.</p>
        )}
        <div className="space-y-1">
          <Label htmlFor="bc-name">Name (only you see it)</Label>
          <Input id="bc-name" className="max-w-md" value={name} maxLength={120} onChange={(e) => { setPreview(null); setName(e.target.value); }} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bc-template">Message</Label>
          <select id="bc-template" className={field} value={tpl} onChange={(e) => pickTemplate(e.target.value)}>
            <option value="">Choose an approved marketing template</option>
            {list.map((t) => (
              <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</option>
            ))}
          </select>
          {chosen && <p className="max-w-xl whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{chosen.body}</p>}
        </div>
        {chosen && chosen.slots > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Fill in the values. Everyone gets the same text, so do not use a name.</p>
            {params.map((p, i) => (
              <div key={i} className="space-y-1">
                <Label htmlFor={`bc-p${i}`}>{`Value for {{${i + 1}}}`}</Label>
                <Input id={`bc-p${i}`} className="max-w-md" value={p} onChange={(e) => { setPreview(null); setParams(params.map((x, j) => (j === i ? e.target.value : x))); }} />
              </div>
            ))}
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="bc-audience">Who gets it</Label>
          <select id="bc-audience" className={field} value={kind} onChange={(e) => { setKind(e.target.value as AudienceKind); setPreview(null); }}>
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.kind} value={o.kind}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{AUDIENCE_OPTIONS.find((o) => o.kind === kind)?.help}</p>
        </div>
        {kind === "purchased_recent" && (
          <div className="space-y-1">
            <Label htmlFor="bc-days">Days back</Label>
            <Input id="bc-days" className="w-28" inputMode="numeric" value={daysText} onChange={(e) => { setPreview(null); setDaysText(e.target.value); }} />
          </div>
        )}
        {kind === "bought_product" && (
          <div className="space-y-1">
            <Label htmlFor="bc-product-q">Find the product</Label>
            <Input id="bc-product-q" className="max-w-md" value={productQ} onChange={(e) => { setProductQ(e.target.value); setProductId(""); setPreview(null); }} />
            <select aria-label="Product" className={field} value={productId} onChange={(e) => { setPreview(null); setProductId(e.target.value); }}>
              <option value="">Choose a product</option>
              {(products.data ?? []).map((p) => (
                <option key={p.sourceProductId} value={p.sourceProductId}>{p.title}</option>
              ))}
            </select>
          </div>
        )}
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">When</legend>
          <label className="mr-4 text-sm"><input type="radio" name="bc-when" checked={when === "now"} onChange={() => { setWhen("now"); setPreview(null); }} /> Send now</label>
          <label className="text-sm"><input type="radio" name="bc-when" checked={when === "later"} onChange={() => { setWhen("later"); setPreview(null); }} /> Schedule</label>
          {when === "later" && <Input aria-label="Send at" type="datetime-local" className="mt-1 max-w-xs" value={at} onChange={(e) => { setAt(e.target.value); setPreview(null); }} />}
        </fieldset>
        {notice && <p role={notice.tone === "bad" ? "alert" : "status"} className={notice.tone === "bad" ? "text-sm text-destructive" : "text-sm"}>{notice.text}</p>}
        {blocked && <p role="status" className="text-sm text-muted-foreground">{blocked}</p>}
        <Button variant="outline" onClick={() => void onReview()} disabled={previewM.isPending || !!blocked}>{previewM.isPending ? "Checking…" : "Review"}</Button>
        {preview && (
          <div className="space-y-3 rounded-lg border p-4" data-broadcast-review>
            <p className="font-medium">
              Reaches {preview.value.audienceSize} {preview.value.audienceSize === 1 ? "shopper" : "shoppers"}
              {preview.value.estimate && <> · about {moneyMinor(preview.value.estimate.totalMinor, preview.value.estimate.currency)}</>}
            </p>
            <p className="text-sm text-muted-foreground">{preview.value.estimateLine} Rates as of {ratesAsOf}.</p>
            <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{preview.value.message}</p>
            {preview.value.problems.length > 0 ? (
              <ul role="alert" className="list-disc pl-5 text-sm text-destructive">
                {preview.value.problems.map((p) => (<li key={p}>{p}</li>))}
              </ul>
            ) : (
              <>
                <p className="text-sm">{NOT_UNDOABLE}</p>
                <ConfirmDialog
                  trigger={<Button disabled={createM.isPending}>{createM.isPending ? "Setting up…" : "Confirm and send"}</Button>}
                  title="Send this broadcast?"
                  description={confirmSentence(preview.value.audienceSize, preview.value.estimateLine, preview.draft.scheduledFor ? new Date(preview.draft.scheduledFor) : null)}
                  confirmLabel="Yes, send it"
                  cancelLabel="Not yet"
                  onConfirm={() => void onConfirm()}
                />
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function History({ currency }: { currency: string | null }) {
  const q = useBroadcasts();
  const cancel = useCancelBroadcast();
  if (q.isPending) return <Skeleton className="h-24 w-full" />;
  if (q.isError) {
    return (
      <div role="alert" className="space-y-2">
        <p className="text-sm text-destructive">We could not load your past broadcasts.</p>
        <Button variant="outline" onClick={() => void q.refetch()}>Try again</Button>
      </div>
    );
  }
  const rows = q.data ?? [];
  if (rows.length === 0) return <p className="text-sm text-muted-foreground" data-broadcasts="empty">No broadcasts yet. When you send one, its results appear here.</p>;
  return (
    <section aria-labelledby="bc-history" className="space-y-3">
      <h2 id="bc-history" className="text-lg font-semibold">Your broadcasts</h2>
      {cancel.isError && <p role="alert" className="text-sm text-destructive">{cancel.error instanceof Error ? cancel.error.message : "We could not cancel that."}</p>}
      {rows.map((b) => (
        <BroadcastRow key={b.id} b={b} currency={currency} busy={cancel.isPending} onCancel={() => { cancel.reset(); cancel.mutate(b.id); }} />
      ))}
    </section>
  );
}

export function BroadcastRow({ b, currency, busy = false, onCancel }: { b: Broadcast; currency: string | null; busy?: boolean; onCancel: () => void }) {
  const notSent = notSentLine(b.counts);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {b.name} <Badge variant={b.status === "cancelled" ? "outline" : "secondary"}>{STATUS_LABEL[b.status]}</Badge>
        </CardTitle>
        <CardDescription>
          {audienceSentence(b.audience)} · {b.audienceSize} {b.audienceSize === 1 ? "shopper" : "shoppers"}
          {b.status === "scheduled" ? ` · starts ${new Date(b.scheduledFor).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{b.message}</p>
        {b.status !== "cancelled" && (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {resultsLine(b.counts).map((r) => (
              <div key={r.label}>
                <dt className="text-xs text-muted-foreground">{r.label}</dt>
                <dd className="font-semibold">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {b.counts.attributedMinor > 0 && currency && <p className="text-xs text-muted-foreground">Orders placed within 7 days of the message by the people it reached: {moneyMinor(b.counts.attributedMinor, currency)}. Measured from your store&apos;s orders; it shows who bought after, not proof the message caused it.</p>}
        {notSent && <p className="text-xs text-muted-foreground">{notSent}.</p>}
        {b.canCancel ? (
          <ConfirmDialog
            trigger={<Button variant="outline" size="sm" disabled={busy}>Cancel broadcast</Button>}
            title="Cancel this broadcast?"
            description="Nothing has been sent yet. Cancelling stops it for everyone. After it starts, it cannot be cancelled."
            confirmLabel="Yes, cancel it"
            cancelLabel="Keep it"
            variant="destructive"
            onConfirm={onCancel}
          />
        ) : b.status === "sending" || b.status === "sent" ? (
          <p className="text-xs text-muted-foreground">{NOT_UNDOABLE}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
