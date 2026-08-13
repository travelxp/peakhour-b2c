"use client";

/**
 * Lead forms — the Ask, on the Ads hub.
 *
 * ★WHAT THIS SURFACE ARGUES, AND WHY IT IS NOT A FORM BUILDER. Campaign
 * Manager already gives away templates, profile prefill, thank-you CTAs and
 * hidden fields, so competing on "AI writes your form" is competing on the
 * commodity half. What it cannot do is tell an advertiser that a question is
 * not worth its drop-off, because it optimises for SUBMISSIONS and never
 * learns what became of the lead. We own the qualifier, the Inbox and the win
 * definition — so every question here carries the reason it exists, and the
 * questions the designer dropped are shown beside the ones it kept.
 *
 * Two states this panel refuses to render as success:
 *   • a form LinkedIn rejected — the campaign stays active, the budget stays
 *     committed, and nothing delivers. `serving` comes from the api so every
 *     surface says the same thing.
 *   • a live form whose leads cannot reach us because the Lead Sync permission
 *     has not been granted. "Published ✓" over that is the exact lie this
 *     whole feature was built to stop telling.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { toastUnhandledApiError } from "@/lib/toast-errors";
import { growthApi, type Ask, type AskIntent, type AskQuestion } from "@/lib/api/growth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/molecules/empty-state";
import { reconnectHref, ADS_LINKEDIN_PATH, LINKEDIN_ADS_PROVIDER } from "@/lib/integrations-connect";
import { AlertTriangle, Archive, ClipboardList, RefreshCw, Sparkles } from "lucide-react";

/** What the business is trying to start. Drives the starting question set and
 *  the recommended button — LinkedIn's own CTA enum happens to name most of
 *  these, which is a decent sign the taxonomy is the real one. */
const INTENTS: Array<{ value: AskIntent; label: string; hint: string }> = [
  { value: "demo_request", label: "Demo request", hint: "They want to see it working on their own data." },
  { value: "consultation", label: "Consultation booking", hint: "They want to talk to someone first." },
  { value: "b2b_lead", label: "Business enquiry", hint: "General enquiries you follow up by hand." },
  { value: "newsletter", label: "Newsletter signup", hint: "One field, nothing more." },
  { value: "event_registration", label: "Event registration", hint: "A webinar, workshop or launch." },
  { value: "recruitment", label: "Recruitment", hint: "Candidates applying for a role." },
  { value: "custom", label: "Something else", hint: "Describe it below and the designer works from that." },
];

const PURPOSE_LABEL: Record<AskQuestion["purpose"], string> = {
  contact: "so a human can reply",
  qualify: "the qualifier scores this",
  route: "decides who handles it",
  context: "context for the conversation",
};

/** Human sentence for LinkedIn's review verdicts. `PENDING` is deliberately
 *  absent — it is a normal state for a few hours after publishing, and naming
 *  it as a problem would cry wolf on every new form. */
/** Reconnect CTAs come back HERE, to the surface whose work they unblock. */
const RECONNECT_HREF = reconnectHref(ADS_LINKEDIN_PATH, LINKEDIN_ADS_PROVIDER);

const REVIEW_PROBLEM: Record<string, string> = {
  REJECTED: "LinkedIn rejected this form, so campaigns using it will not deliver.",
  AUTO_REJECTED: "LinkedIn's automated review rejected this form, so campaigns using it will not deliver.",
  NEEDS_REVIEW: "LinkedIn has flagged this form for manual review. It will not deliver until that clears.",
};

export function LeadFormsPanel() {
  const queryClient = useQueryClient();
  const [designOpen, setDesignOpen] = useState(false);
  const [publishing, setPublishing] = useState<Ask | null>(null);
  const [archiving, setArchiving] = useState<Ask | null>(null);
  const [editing, setEditing] = useState<Ask | null>(null);

  const asks = useQuery({
    queryKey: ["growth-asks"],
    queryFn: () => growthApi.listAsks(),
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["growth-asks"] });

  /**
   * ★WHICH ROWS ARE IN FLIGHT, not "is anything in flight".
   *
   * One shared mutation reports `isPending` in aggregate and `variables` for
   * the MOST RECENT call only, so syncing a second row re-enabled the first
   * one's button mid-request — and that disabled state is the double-fire
   * guard, not decoration.
   */
  const [syncingIds, setSyncingIds] = useState<string[]>([]);
  const sync = useMutation({
    mutationFn: (id: string) => growthApi.syncAsk(id),
    onMutate: (id: string) => {
      setSyncingIds((ids) => [...ids, id]);
    },
    onSettled: (_data, _err, id) => {
      setSyncingIds((ids) => ids.filter((x) => x !== id));
    },
    onSuccess: (res) => {
      invalidate();
      const review = res.ask.channels?.linkedin?.reviewStatus;
      if (review && REVIEW_PROBLEM[review]) toast.warning(REVIEW_PROBLEM[review]);
      else if (res.ask.serving === false) {
        // A form that is not serving for a reason outside the review codes
        // must not get a success toast beside an amber badge.
        toast.warning("LinkedIn says this form isn't live. Open it to see where it stands.");
      } else toast.success("Up to date with LinkedIn.");
    },
    onError: (err) => toastUnhandledApiError(err, "Couldn't check with LinkedIn"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <h3 className="text-base font-semibold">Lead forms</h3>
          <p className="text-sm text-muted-foreground">
            What you need to know before someone is worth a call — and no more. Every
            question here has to earn its place.
          </p>
        </div>
        <Button size="sm" onClick={() => setDesignOpen(true)}>
          <Sparkles className="mr-2 size-4" />
          New form
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {asks.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : asks.isError ? (
          <EmptyState
            icon={RefreshCw}
            title="Couldn't load your lead forms"
            description="Refresh in a moment — nothing has changed on LinkedIn."
          />
        ) : (asks.data?.asks?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No lead forms yet"
            description="A lead-generation campaign needs a form to capture with. We'll design one from what your business actually does, and drop the questions nothing downstream reads."
            action={{ label: "Design a form", onClick: () => setDesignOpen(true) }}
          />
        ) : (
          (asks.data?.asks ?? []).map((ask) => (
            <AskRow
              key={ask._id}
              ask={ask}
              onPublish={() => setPublishing(ask)}
              onArchive={() => setArchiving(ask)}
              onEdit={() => setEditing(ask)}
              onSync={() => sync.mutate(ask._id)}
              syncing={syncingIds.includes(ask._id)}
            />
          ))
        )}
      </CardContent>

      {/* ★MOUNTED PER ASK, and this is not tidiness. These dialogs hold the
          answers a customer types; rendered once for the life of the panel they
          keep that state across DIFFERENT forms, so publishing form A over
          WhatsApp and then opening form B presents A's phone number, already
          valid, one click from being written onto a form LinkedIn will then
          freeze. `key` makes each open a fresh component — the same pattern
          BoostCampaignDialog uses one directory over, which is why it has never
          had this problem. */}
      {designOpen ? (
        <DesignAskDialog open onOpenChange={setDesignOpen} onDone={invalidate} />
      ) : null}
      {publishing ? (
        <PublishAskDialog
          key={publishing._id}
          ask={publishing}
          onOpenChange={() => setPublishing(null)}
          onDone={invalidate}
        />
      ) : null}
      {archiving ? (
        <ArchiveAskDialog ask={archiving} onOpenChange={() => setArchiving(null)} onDone={invalidate} />
      ) : null}
      {editing ? (
        <EditWordingDialog
          key={editing._id}
          ask={editing}
          onOpenChange={() => setEditing(null)}
          onDone={invalidate}
        />
      ) : null}
    </Card>
  );
}

function AskRow({
  ask,
  onPublish,
  onArchive,
  onEdit,
  onSync,
  syncing,
}: {
  ask: Ask;
  onPublish: () => void;
  onArchive: () => void;
  onEdit: () => void;
  onSync: () => void;
  syncing: boolean;
}) {
  const channel = ask.channels?.linkedin;
  const review = channel?.reviewStatus;
  const delivery = channel?.leadDelivery;
  /**
   * ★TWO DIFFERENT WAYS A LIVE FORM COLLECTS NOTHING, and both have to say so
   * on the row rather than in a toast the person who published it saw once.
   * A review rejection stops the ad delivering; a missing Lead Sync grant lets
   * it deliver perfectly and drops every lead on the floor.
   */
  const problem =
    (review ? REVIEW_PROBLEM[review] : undefined) ??
    (delivery?.status === "blocked" ? delivery.reason : undefined);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{ask.name}</span>
            {ask.status === "draft" ? (
              <Badge className="bg-muted text-muted-foreground">Draft</Badge>
            ) : ask.status === "archived" ? (
              <Badge className="bg-muted/60 text-muted-foreground">Archived</Badge>
            ) : ask.serving && delivery?.status !== "blocked" ? (
              <Badge className="bg-success/15 text-success-on-tint">Live</Badge>
            ) : (
              <Badge className="bg-warning/15 text-warning-on-tint">Not delivering</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{ask.content.headline}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {ask.status === "draft" ? (
            <Button size="sm" onClick={onPublish}>
              Publish to LinkedIn
            </Button>
          ) : null}
          {ask.status !== "archived" ? (
            <Button size="sm" variant="outline" onClick={onEdit}>
              Edit wording
            </Button>
          ) : null}
          {channel ? (
            <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
              <RefreshCw className={`mr-2 size-4 ${syncing ? "animate-spin" : ""}`} />
              Check
            </Button>
          ) : null}
          {ask.status !== "archived" ? (
            <Button size="sm" variant="ghost" onClick={onArchive}>
              <Archive className="size-4" />
              <span className="sr-only">Archive</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* ★THE FAILURE THAT LOOKS HEALTHY. Without this the campaign shows
          active, the budget shows committed, and nothing is delivered. */}
      {problem ? (
        <div
          role="alert"
          className="mt-3 flex gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-on-tint" />
          <div>
            <p>{problem}</p>
            {channel?.rejectionReasons?.length ? (
              <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                {channel.rejectionReasons.map((r, i) => (
                  // Keyed by position: LinkedIn can repeat a reason, and a
                  // duplicated string would collide as a key.
                  <li key={`${i}-${r.slice(0, 32)}`}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <ul className="mt-3 space-y-1 text-sm">
        {ask.content.questions.map((q) => (
          <li key={q.key} className="flex flex-wrap items-baseline gap-x-2">
            <span>{q.prompt}</span>
            {!q.required ? <span className="text-xs text-muted-foreground">(optional)</span> : null}
            {/* The argument, made visible: a question that cannot say who reads
                its answer should not be on the form. */}
            <span className="text-xs text-muted-foreground">— {PURPOSE_LABEL[q.purpose]}: {q.whyAsked}</span>
          </li>
        ))}
      </ul>

      {ask.content.thankYou.ctaKind === "whatsapp" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          After submitting, they land in a WhatsApp conversation with you — in the same
          Inbox as everything else.
        </p>
      ) : null}
    </div>
  );
}

function DesignAskDialog({
  open,
  onOpenChange,
  onDone,
}: {
  /** Always true — the parent mounts this only while it is open. Kept on the
   *  signature so the Dialog's own open/close contract stays explicit. */
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [intent, setIntent] = useState<AskIntent>("demo_request");
  const [offer, setOffer] = useState("");
  const [followUp, setFollowUp] = useState("");

  const design = useMutation({
    mutationFn: () =>
      growthApi.designAsk({
        intent,
        ...(offer.trim() ? { offer: offer.trim() } : {}),
        ...(followUp.trim() ? { followUp: followUp.trim() } : {}),
      }),
    onSuccess: () => {
      onDone();
      onOpenChange(false);
      setOffer("");
      setFollowUp("");
      toast.success("Form drafted — read it through, then publish when you're happy.");
    },
    onError: (err) => {
      // The designer's own refusals carry a sentence worth showing verbatim —
      // NO_CONTACT_FIELD in particular tells the customer what to add to the
      // brief, which a generic message would throw away.
      if (err instanceof ApiError && err.status === 422) toast.error(err.message);
      else toastUnhandledApiError(err, "Couldn't design the form");
    },
  });

  const hint = INTENTS.find((i) => i.value === intent)?.hint;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What do you want to know?</DialogTitle>
          <DialogDescription>
            Nothing goes to LinkedIn yet. You&apos;ll see the questions and why each one
            is there before anything is published.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ask-intent">What should this form start?</Label>
            <Select value={intent} onValueChange={(v) => setIntent(v as AskIntent)}>
              <SelectTrigger id="ask-intent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTENTS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ask-offer">What are they getting? (optional)</Label>
            <Textarea
              id="ask-offer"
              rows={3}
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="The offer, the page it sits behind, what makes it worth their details."
            />
            <p className="text-xs text-muted-foreground">
              Thin detail means a shorter form, which is usually the right trade anyway.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ask-followup">How do you follow leads up? (optional)</Label>
            <Input
              id="ask-followup"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="e.g. Priya calls them within a day"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={design.isPending}>
            Cancel
          </Button>
          <Button onClick={() => design.mutate()} disabled={design.isPending}>
            {design.isPending ? "Designing…" : "Design the form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishAskDialog({
  ask,
  onOpenChange,
  onDone,
}: {
  ask: Ask;
  onOpenChange: () => void;
  onDone: () => void;
}) {
  const [useWhatsapp, setUseWhatsapp] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Hi — I just filled in your form on LinkedIn.");
  const [ctaUrl, setCtaUrl] = useState("");

  const publish = useMutation({
    mutationFn: () =>
      growthApi.publishAsk(ask._id, {
        ...(useWhatsapp ? { whatsapp: { phone: phone.trim(), message: message.trim() } } : {}),
        ...(!useWhatsapp && ctaUrl.trim() ? { ctaUrl: ctaUrl.trim() } : {}),
      }),
    onSuccess: (res) => {
      onDone();
      onOpenChange();
      // ★THE FORM BEING LIVE AND THE LEADS REACHING YOU ARE DIFFERENT FACTS,
      // and reporting the first as if it covered the second is the failure
      // this whole build exists to end.
      if (res.leadDelivery.status === "blocked" || res.leadDelivery.status === "unknown") {
        toast.warning(res.leadDelivery.reason, { duration: 12_000 });
      } else {
        toast.success("Your form is live on LinkedIn and leads will land in your Inbox.");
      }
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "PUBLISH_PERSIST_FAILED") {
        /**
         * ★THE ONE MESSAGE THAT MUST NOT BE GENERIC, and it is a 502 so it
         * would otherwise have been. The form EXISTS on LinkedIn and we lost
         * the record of it; the message carries the id support needs and, more
         * importantly, tells them not to press Publish again — which is what a
         * generic "something went wrong, try again" would invite, and would
         * mint a second form.
         */
        toast.error(err instanceof ApiError ? err.message : "", { duration: 30_000 });
        return;
      }
      if (code === "NEEDS_REAUTH") {
        toast.error("LinkedIn Ads needs reconnecting before this form can be published.", {
          action: {
            label: "Reconnect",
            onClick: () => { window.location.href = RECONNECT_HREF; },
          },
        });
        return;
      }
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) toast.error(err.message);
      else toastUnhandledApiError(err, "Couldn't publish the form");
    },
  });

  return (
    <Dialog open onOpenChange={() => onOpenChange()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish to LinkedIn</DialogTitle>
          <DialogDescription>
            {/* Not a warning about spend — publishing a form cannot spend anything.
                It is a warning about the one thing that really is irreversible. */}
            Once a form is live, LinkedIn will not let its questions be changed. The
            wording and the thank-you can still be edited; the field list cannot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {/* A visual-only "selected" state leaves a screen reader hearing two
                plain buttons with no indication which is active — on the control
                that decides where a lead is sent. */}
            <span id="ask-destination-label" className="text-sm font-medium">
              What happens after they submit?
            </span>
            <div className="flex gap-2" role="group" aria-labelledby="ask-destination-label">
              <Button
                type="button"
                size="sm"
                aria-pressed={useWhatsapp}
                variant={useWhatsapp ? "default" : "outline"}
                onClick={() => setUseWhatsapp(true)}
              >
                Open WhatsApp
              </Button>
              <Button
                type="button"
                size="sm"
                aria-pressed={!useWhatsapp}
                variant={!useWhatsapp ? "default" : "outline"}
                onClick={() => setUseWhatsapp(false)}
              >
                Send them to a page
              </Button>
            </div>
          </div>

          {useWhatsapp ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ask-phone">Your WhatsApp number</Label>
                <Input
                  id="ask-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ask-message">The message they arrive with</Label>
                <Input
                  id="ask-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The conversation lands in your Inbox beside everything else, seconds
                after they submit — instead of a row waiting for a callback.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="ask-cta">Page to send them to (optional)</Label>
              <Input
                id="ask-cta"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://…"
              />
              <p className="text-xs text-muted-foreground">
                Must start with https:// — they have just typed their details into a form.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange()} disabled={publish.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => publish.mutate()}
            disabled={publish.isPending || (useWhatsapp && phone.trim().length < 6)}
          >
            {publish.isPending ? "Publishing…" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Edit the wording.
 *
 * ★IT DOES NOT OFFER THE QUESTIONS, AND THE COPY SAYS WHY. LinkedIn freezes a
 * live form's field list, so a "change the questions" control would be a
 * button that fails — the same mistake as offering the lead_generation
 * objective before there was a form to attach. Once published, changing what
 * you ask means a new form.
 *
 * State is keyed off `ask` and reset when a different one opens: a dialog that
 * kept the previous form's headline would let a customer overwrite one form
 * with another's copy without noticing.
 */
function EditWordingDialog({
  ask,
  onOpenChange,
  onDone,
}: {
  ask: Ask;
  onOpenChange: () => void;
  onDone: () => void;
}) {
  // Initialised straight from props: the parent mounts this per Ask with a
  // `key`, so there is no previous form's state to reset away from.
  const [name, setName] = useState(ask.name);
  const [headline, setHeadline] = useState(ask.content.headline);
  const [thankYou, setThankYou] = useState(ask.content.thankYou.message);

  const edit = useMutation({
    mutationFn: () =>
      growthApi.editAsk(ask._id, {
        ...(name.trim() && name.trim() !== ask.name ? { name: name.trim() } : {}),
        ...(headline.trim() && headline.trim() !== ask.content.headline
          ? { headline: headline.trim() }
          : {}),
        ...(thankYou.trim() && thankYou.trim() !== ask.content.thankYou.message
          ? { thankYouMessage: thankYou.trim() }
          : {}),
      }),
    onSuccess: () => {
      onDone();
      onOpenChange();
      toast.success("Updated.");
    },
    onError: (err) => {
      if (err instanceof ApiError) toast.error(err.message);
      else toastUnhandledApiError(err, "Couldn't save the change");
    },
  });

  const unchanged =
    name.trim() === ask.name &&
    headline.trim() === ask.content.headline &&
    thankYou.trim() === ask.content.thankYou.message;

  return (
    <Dialog open onOpenChange={() => onOpenChange()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit wording</DialogTitle>
          <DialogDescription>
            {ask.status === "published"
              ? "This form is live, so LinkedIn only allows the wording to change. To change what you ask, create a new form — this one keeps collecting until you archive it."
              : "Nothing is live yet, so this is just tidying up before you publish."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ask-edit-name">Name (only you see this)</Label>
            <Input id="ask-edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={256} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ask-edit-headline">Headline</Label>
            <Input
              id="ask-edit-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              {headline.length}/60 — LinkedIn cuts it off after that.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ask-edit-thanks">Thank-you message</Label>
            <Textarea
              id="ask-edit-thanks"
              rows={3}
              value={thankYou}
              onChange={(e) => setThankYou(e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange()} disabled={edit.isPending}>
            Cancel
          </Button>
          <Button onClick={() => edit.mutate()} disabled={edit.isPending || unchanged}>
            {edit.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveAskDialog({
  ask,
  onOpenChange,
  onDone,
}: {
  ask: Ask;
  onOpenChange: () => void;
  onDone: () => void;
}) {
  const archive = useMutation({
    mutationFn: () => growthApi.archiveAsk(ask._id),
    onSuccess: () => {
      onDone();
      onOpenChange();
      toast.success("Form archived — it has stopped collecting.");
    },
    onError: (err) => {
      // ★AN ARCHIVE THAT FAILED MUST NOT READ AS ONE THAT WORKED. The api
      // refuses to flip the local row when LinkedIn wouldn't archive the form,
      // precisely so this message can be true.
      if (err instanceof ApiError) toast.error(err.message);
      else toastUnhandledApiError(err, "Couldn't archive the form");
    },
  });

  return (
    <AlertDialog open onOpenChange={() => onOpenChange()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop collecting with this form?</AlertDialogTitle>
          <AlertDialogDescription>
            Any campaign still using it will stop delivering. Leads already in your
            Inbox are unaffected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archive.isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={() => archive.mutate()} disabled={archive.isPending}>
            {archive.isPending ? "Archiving…" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
