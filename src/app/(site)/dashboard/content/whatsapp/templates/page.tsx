"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageShell } from "@/components/dashboard/page-shell";
import {
  addLanguageProblem,
  groupByName,
  unanimousStatus,
  type TemplateGroup,
} from "./_components/template-groups";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types (mirror /v1/meta/whatsapp/studio responses) ───────────────────────
type TemplateStatus = "draft" | "submitted" | "approved" | "rejected" | "paused" | "disabled";
type Category = "MARKETING" | "UTILITY" | "AUTHENTICATION";
interface WAButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}
interface Components {
  header?: { format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"; text?: string };
  body: { text: string };
  footer?: { text: string };
  buttons?: WAButton[];
}
interface BizTemplate {
  _id: string;
  name: string;
  language: string;
  category: Category;
  status: TemplateStatus;
  quality?: string;
  components?: Components;
  rejectionReason?: string;
  attempts?: number;
  updatedAt?: string;
}
interface LintIssue { severity: "error" | "warning"; field: string; message: string }

interface Editor {
  id?: string;
  name: string;
  language: string;
  category: Category;
  components: Components;
}

const STUDIO = "/v1/meta/whatsapp/studio";
const EMPTY_EDITOR: Editor = {
  name: "",
  language: "en",
  category: "UTILITY",
  components: { body: { text: "" } },
};

const STATUS_VARIANT: Record<TemplateStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  submitted: { label: "In review", className: "bg-warning/15 text-warning-on-tint" },
  approved: { label: "Approved", className: "bg-success/15 text-success-on-tint" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive-on-tint" },
  paused: { label: "Paused", className: "bg-warning/15 text-warning-on-tint" },
  disabled: { label: "Disabled", className: "bg-muted text-muted-foreground" },
};

// ── ★★THE PINNED WARNINGS THIS PAGE HAS RAISED — MODULE STATE, NOT COMPONENT
//    STATE ──────────────────────────────────────────────────────────────────
//
// 🚫★★A `duration: Infinity` TOAST OUTLIVES THE COMPONENT THAT RAISED IT. The
//  `Toaster` lives in the site layout, so these survive a route change — while
//  refs inside the page do not. Navigating away and back reset the bookkeeping
//  and left the warning on screen with nothing tracking it: a later clean
//  resubmit no longer retired it, and a later business switch no longer
//  dismissed it. The tracking has to have the same lifetime as the thing it
//  tracks, which is the page load.
//
// ★KEYED BY TEMPLATE, VALUED BY THE TOAST'S OWN ID — the two differ because
//  each raising gets a fresh toast id, which is what stops a dismissal of the
//  old one landing on the new one.
const pinnedNotices = new Map<string, string>();
let noticeSeq = 0;
/** The business those warnings belong to, so a SWITCH is distinguishable. */
let noticeBusiness: string | undefined;

/** Retire every pinned warning this page raised, and forget them. */
function dismissPinnedNotices() {
  for (const id of pinnedNotices.values()) toast.dismiss(id);
  pinnedNotices.clear();
}

// ⏸★★AND THE RETIREMENT ONLY RUNS WHILE THIS PAGE IS MOUNTED, which is a
//  residual rather than an oversight. The `Toaster` is in the `(site)` layout
//  and never unmounts, so switching business — or signing out — from ANOTHER
//  route leaves a pinned warning naming a template that is not in the list any
//  more.
//
// 🚫★★DRIVING IT FROM THE AUTH PROVIDER IS NOT THE ANSWER: it would put one
//  page's toast bookkeeping into the thing every page depends on, and the next
//  page with a pinned toast would add a second entry to it.
//
// ⏸★THE ANSWER IS THAT A FACT THIS DURABLE DOES NOT BELONG IN A TOAST AT ALL.
//  It is a property of the ROW — Meta holds a category this template's record
//  disagrees with — and the api already reports it per submit as
//  `categoryApplied`. Surfacing it on the card retires the pinned toast, the
//  bookkeeping and this residual together. ★The toast has a close button in the
//  meantime.

function StatusBadge({ status }: { status: TemplateStatus }) {
  const v = STATUS_VARIANT[status] ?? STATUS_VARIANT.draft;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.className}`}>{v.label}</span>;
}

// Live WhatsApp bubble preview.
function WhatsAppPreview({ components }: { components: Components }) {
  const { header, body, footer, buttons } = components;
  return (
    <div className="rounded-xl bg-[#e5ddd5] p-4">
      <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#dcf8c6] p-3 text-sm text-foreground shadow-sm">
        {header?.text && <p className="mb-1 font-semibold">{header.text}</p>}
        <p className="whitespace-pre-wrap">{body.text || <span className="text-muted-foreground">Your message body…</span>}</p>
        {footer?.text && <p className="mt-1 text-xs text-muted-foreground">{footer.text}</p>}
      </div>
      {!!buttons?.length && (
        <div className="mt-2 space-y-1">
          {buttons.map((b, i) => (
            <div key={i} className="rounded-lg bg-white/90 py-2 text-center text-sm font-medium text-[#00a5f4] shadow-sm">
              {b.text || "Button"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WhatsAppTemplatesPage() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const [editor, setEditor] = useState<Editor>(EMPTY_EDITOR);
  const [goal, setGoal] = useState("");
  const [issues, setIssues] = useState<LintIssue[] | null>(null);
  // ★THE api's OWN SENTENCE IS KEPT, not a copy of it. It names Meta's status
  //  and what replacing the template costs, and a second wording here would be
  //  a second place for that reasoning to drift from the code that knows it.
  //
  // 🚫★★AND THE MESSAGE OUTLIVES THE `open` FLAG, WHICH IS NOT A TIDINESS
  //  CHOICE. `AlertDialogContent` stays mounted through its exit animation, so
  //  clearing the two together blanked the sentence and reflowed the dialog
  //  around an orphaned title for the whole fade. ★What is a question about a
  //  specific moment is whether the dialog is OPEN — the text is just what it
  //  last said, and nothing acts on it.
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  // ★★WHETHER THE DIALOG WAS ANSWERED OR DISMISSED, which its `open` flag
  //  cannot say: Radix closes it the same way for the confirm, for Cancel and
  //  for Escape. A dismissal needs to leave something on screen — a clicked
  //  Submit with no toast, no status change and no recoverable sentence reads
  //  as the button having done nothing at all.
  const unpublishConfirmed = useRef(false);
  const [unpublishWarning, setUnpublishWarning] = useState<{ id: string; message: string } | null>(
    null
  );

  const listKey = useMemo(() => ["wa-templates", business?._id ?? "none"], [business?._id]);
  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => api.get<{ templates: BizTemplate[] }>(`${STUDIO}/templates`),
    enabled: Boolean(business?._id),
  });
  const templates = data?.templates ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: listKey });

  // ★AND THEY ARE RETIRED WHEN THE BUSINESS CHANGES. `switchBusiness` clears
  //  the query cache without remounting this page, so a never-expiring warning
  //  would otherwise sit beside another business's list describing a template
  //  that is not in it. ★Only the ids this page raised — `toast.dismiss()` with
  //  no argument would take down everybody else's toasts too.
  //
  // 🚫★★AND IT IS THE EFFECT BODY COMPARING THE PREVIOUS ID, NOT A CLEANUP. A
  //  cleanup also runs on UNMOUNT, so navigating to any other dashboard page
  //  dismissed the warning — and the `Toaster` lives in the site layout
  //  precisely so toasts survive a route change. The thing that invalidates
  //  this warning is a different business, not a different page.
  useEffect(() => {
    if (noticeBusiness !== business?._id) {
      dismissPinnedNotices();
      noticeBusiness = business?._id;
    }
  }, [business?._id]);

  // ★THE NAME OF THE ROW THE REFUSAL WAS ABOUT — read from the list rather
  //  than from the editor, which may have moved on while the 409 travelled.
  const unpublishTemplateName = unpublishWarning
    ? templates.find((t) => t._id === unpublishWarning.id)?.name
    : undefined;

  const suggest = useMutation({
    mutationFn: () => api.post<{ suggestion: Editor & { rationale?: string } }>(`${STUDIO}/templates/suggest`, { goal, language: editor.language }),
    onSuccess: (r) => {
      const s = r.suggestion;
      setEditor({ name: s.name, language: s.language, category: s.category, components: s.components });
      setIssues(null);
      toast.success("Drafted a template — review and refine it below.");
    },
    onError: (e: Error) => toast.error(e?.message || "Couldn't draft a template"),
  });

  const lint = useMutation({
    mutationFn: () => api.post<{ ok: boolean; issues: LintIssue[] }>(`${STUDIO}/templates/policy-lint`, { category: editor.category, components: editor.components }),
    onSuccess: (r) => {
      setIssues(r.issues);
      if (r.ok && r.issues.length === 0) toast.success("Looks compliant — ready to submit.");
    },
    onError: (e: Error) => toast.error(e?.message || "Couldn't lint the template"),
  });

  const saveDraft = useMutation({
    mutationFn: () =>
      api.post<{ template: BizTemplate }>(`${STUDIO}/templates/draft`, {
        id: editor.id,
        name: editor.name,
        language: editor.language,
        category: editor.category,
        components: editor.components,
      }),
    onSuccess: (r) => {
      setEditor((e) => ({ ...e, id: r.template._id }));
      toast.success("Draft saved.");
      refresh();
    },
    onError: (e: Error) => toast.error(e?.message || "Couldn't save the draft"),
  });

  // ── ★★THE SUBMIT ANSWER CARRIES MORE THAN A TEMPLATE NOW ──────────────────
  //
  // ★`notice` IS THE ONLY WAY A MERCHANT LEARNS THEIR CATEGORY CHANGE DID NOT
  //  LAND. The api sends it when Meta took the wording and not the category —
  //  our row then records a category Meta does not hold, and the webhook
  //  reports status and quality, never category. Toasting the generic success
  //  line over it is how that fact reaches nobody.
  const submit = useMutation({
    mutationFn: ({
      id,
      confirmReplaceApproved,
    }: {
      id: string;
      // ★★THE BUSINESS THE SUBMIT WAS STARTED UNDER, carried so `onSuccess` can
      //  refuse to pin a warning about it over somebody else's list.
      //  `switchBusiness` cancels QUERIES, not mutations, and the switcher is
      //  not gated on `submit.isPending` — so a late answer can arrive after
      //  the effect has already re-attributed the pinned set to business B.
      businessId?: string;
      confirmReplaceApproved?: boolean;
    }) =>
      api.post<{ template: BizTemplate; notice?: string }>(
        `${STUDIO}/templates/${id}/submit`,
        confirmReplaceApproved ? { confirmReplaceApproved: true } : undefined
      ),
    onSuccess: (r, vars) => {
      // ★AND AN ANSWER FOR A BUSINESS WE HAVE LEFT PINS NOTHING. Its warning
      //  would name a row that is not in the list on screen — the very state
      //  the business-switch retirement exists to prevent, arriving after it.
      // ★★AND IT COMPARES THE LIVE `business`, NOT THE MODULE VARIABLE THE
      //  PINNED-NOTICE EFFECT MAINTAINS. That one is updated by an effect, so
      //  it lags the switch — and this callback already closes over the current
      //  render's props. The variable's job is retiring toasts; deciding
      //  whether an in-flight answer still applies is a different question and
      //  reading it here made the guard trail the thing it guards against.
      if (vars.businessId && vars.businessId !== business?._id) {
        refresh();
        return;
      }
      // 🚫★★AND IT DOES NOT AUTO-DISMISS. This is the only channel the fact has
      //  — nothing on the card shows it, a reload never brings it back, and the
      //  list goes on rendering the category our row stores rather than the one
      //  Meta holds. A ten-second toast for a state that outlives the session is
      //  a warning nobody who looked away ever saw. ★`duration: Infinity` is
      //  what `linkedin-ads-panel.tsx` uses for the same shape of fact: the
      //  platform did something our record does not match.
      //
      // 🚫★★AND IT NAMES ITS TEMPLATE AND REPLACES ITS OWN PREDECESSOR. Two
      //  submits that both hit this outcome pinned two identical
      //  never-expiring warnings with nothing to tell them apart — the same
      //  ambiguity the dialog's title had before it started naming the row.
      //  ★The `id` makes a resubmit REPLACE the standing warning rather than
      //  stack a second one saying the same thing about the same template.
      if (r.notice) {
        // ── 🚫★★A REPEAT NOTICE IS A NEW TOAST WITH A NEW ID ────────────────
        //
        // 🚫★★REUSING THE ID AND DISMISSING IT FIRST DESTROYS THE ONE IT IS
        //  ABOUT TO RAISE. Sonner's `dismiss` adds the id to `dismissedToasts`
        //  SYNCHRONOUSLY and publishes on a `requestAnimationFrame`, while
        //  `create` publishes immediately — so the deferred dismissal lands on
        //  the toast that has since been created under the same id, and the
        //  never-expiring warning fades after a couple of frames. That was a
        //  fix for the merge-in-place problem which broke the feature it was
        //  protecting, on the FIRST notice as well as a repeat.
        //
        // ★★SO THE PREVIOUS ONE IS RETIRED BY ITS OWN ID AND THE NEW ONE GETS A
        //  FRESH ONE. The dismissal targets a toast that is genuinely going
        //  away, the new toast animates in as a new toast, and only one warning
        //  per template is ever on screen.
        const previous = pinnedNotices.get(r.template._id);
        if (previous) toast.dismiss(previous);
        const noticeId = `wa-template-notice-${r.template._id}-${(noticeSeq += 1)}`;
        toast.warning(r.template.name, {
          description: r.notice,
          id: noticeId,
          duration: Infinity,
        });
        // ★AND IT IS REMEMBERED, so a clean resubmit and a business switch can
        //  both retire it. A pinned warning naming a row that is no longer in
        //  the list is the one piece of this page's state that does not reset.
        pinnedNotices.set(r.template._id, noticeId);
      } else {
        // 🚫★★AND A CLEAN RESUBMIT TAKES THE OLD WARNING DOWN WITH IT. The
        //  pinned notice never expires, so without this a merchant who fixed
        //  the category and resubmitted saw "Submitted to WhatsApp for review"
        //  appear ABOVE a still-pinned warning contradicting it. Dismissing by
        //  the same id is the only thing that can retire a `duration: Infinity`
        //  toast we raised ourselves.
        const standing = pinnedNotices.get(r.template._id);
        if (standing) {
          toast.dismiss(standing);
          pinnedNotices.delete(r.template._id);
        }
        toast.success("Submitted to WhatsApp for review.");
      }
      refresh();
    },
    onError: (e: Error, vars) => {
      // 🚫★★AND A LATE ANSWER FOR A BUSINESS WE HAVE LEFT OPENS NOTHING — the
      //  same guard `onSuccess` carries, for the same race. A 409 for business
      //  B arriving after a switch to C would open the confirm over C's list
      //  with the unnamed fallback title, and confirming would post B's
      //  template id under C's scope: a 404 "Template not found" immediately
      //  after a deliberate confirmation. ★The refresh still runs, because the
      //  row it wrote to is real either way.
      // ★★AND IT COMPARES THE LIVE `business`, NOT THE MODULE VARIABLE THE
      //  PINNED-NOTICE EFFECT MAINTAINS. That one is updated by an effect, so
      //  it lags the switch — and this callback already closes over the current
      //  render's props. The variable's job is retiring toasts; deciding
      //  whether an in-flight answer still applies is a different question and
      //  reading it here made the guard trail the thing it guards against.
      if (vars.businessId && vars.businessId !== business?._id) {
        refresh();
        return;
      }
      // ── 🚫★★AND A FAILED SUBMIT USUALLY *DID* CHANGE THE ROW ───────────────
      //
      // 🚫★★`refresh()` ONLY ON SUCCESS LEFT THE LIST LYING. The api's adopt
      //  409 writes `metaTemplateId` and a status, and both mutating 502s write
      //  `rejected` with a reason — so the card still read "Draft", with no
      //  rejection text and no Suggest-a-fix button, until the merchant
      //  reloaded. The row moved; only the screen did not.
      refresh();

      // ★★AND ONE 409 IS A QUESTION, NOT A FAILURE. Meta puts an edited
      //  template back into review, so submitting over an APPROVED one takes it
      //  off the air until Meta approves it again — and the api refuses once,
      //  with that cost, rather than doing it silently. Answering is the whole
      //  point of the refusal, so it opens a dialog instead of a red toast.
      //
      // 🚫★★AND A CONFIRMATION IS ANSWERED ONCE. Without reading the flag back,
      //  a confirmed submit that is STILL refused re-opens the identical
      //  dialog — no toast, no explanation, and no way out but Cancel, which
      //  looks like the button doing nothing. That is reachable during the
      //  deliberate b2c-before-api sequencing (an api that does not yet read
      //  the flag), and it is exactly the shape of dead end this whole change
      //  exists to remove. ★Asking twice is a failure, and it is shown as one.
      if (
        e instanceof ApiError &&
        e.code === "SUBMIT_WOULD_UNPUBLISH" &&
        !vars.confirmReplaceApproved
      ) {
        // ⏸★AND A MERCHANT WHO NAVIGATED AWAY MID-SUBMIT SEES NOTHING, which is
        //  not a silent failure: this refusal happens BEFORE any write, so
        //  nothing was changed, the refreshed list is already correct, and the
        //  next submit asks the same question again. A toast alongside the
        //  dialog would double-report it for everyone who stayed.
        setUnpublishWarning({ id: vars.id, message: e.message });
        // ★CLEARED AS THE QUESTION IS ASKED, not as it closes — see the
        //  `onOpenChange` handler.
        unpublishConfirmed.current = false;
        setUnpublishOpen(true);
        return;
      }
      // 🚫★★AND THE ASKED-TWICE CASE NEEDS ITS OWN COPY. The api's sentence for
      //  this code ends "Confirm to go ahead" — an instruction the guard above
      //  has just made unreachable, so replaying it tells a merchant to press a
      //  button that is gone. Reachable in exactly the b2c-before-api
      //  sequencing this change ships for.
      if (e instanceof ApiError && e.code === "SUBMIT_WOULD_UNPUBLISH") {
        toast.error(
          "We sent your confirmation but WhatsApp refused it again, so nothing was changed. Try again in a moment — or publish this version under a new name instead."
        );
        return;
      }
      toast.error(e?.message || "Submission failed");
    },
  });

  const repair = useMutation({
    mutationFn: (id: string) => api.post<{ repair: { components: Components; category: Category; explanation: string } }>(`${STUDIO}/templates/${id}/repair`),
    onSuccess: (r, id) => {
      const t = templates.find((x) => x._id === id);
      setEditor({ id, name: t?.name ?? "", language: t?.language ?? "en", category: r.repair.category, components: r.repair.components });
      setIssues(null);
      toast.success(`Suggested a fix: ${r.repair.explanation}`);
    },
    onError: (e: Error) => toast.error(e?.message || "Couldn't propose a repair"),
  });

  // ── ★★§3.5's FLOW: "ADD A LANGUAGE" IS AN ACTION, NOT A RETYPE ─────────
  //
  // ★The api has supported per-language rows all along — `POST /templates/draft`
  //  takes a `language` and refuses a duplicate on the NORMALISED pair. What was
  //  missing is the only way a merchant could reach it: retyping the name
  //  EXACTLY into a free-text box, with nothing saying the English one exists.
  //
  // ⚠️★★THE NAME IS CARRIED, NOT RE-ENTERED, because Meta keys a template by
  //  (name, language) — one typo and the merchant has made a second template
  //  rather than a second language, and nothing on this page would say so.
  const [addingTo, setAddingTo] = useState<TemplateGroup | null>(null);
  const [addLanguage, setAddLanguage] = useState("");
  const addProblem = addingTo ? addLanguageProblem(addingTo, addLanguage) : null;

  /**
   * Seed the editor with a new language of an existing template.
   *
   * ⚠️🚫★★IT COPIES THE COMPONENTS AS A STARTING POINT AND **DROPS THE `id`**.
   * Keeping the id would make the save an EDIT of the language it was copied
   * from — Meta's id names a (name, language) pair, so the merchant would
   * overwrite their English copy with a half-translated one and take it off the
   * air. ★The copy is a convenience; the identity is not copied with it.
   *
   * ★AND THE CATEGORY COMES WITH IT, because a template's category is a
   * property of what it says, not of which language it says it in — a merchant
   * translating a UTILITY notice has not written a marketing one.
   */
  function startLanguage(group: TemplateGroup, language: string) {
    const from = group.variants[0];
    setEditor({
      name: group.name,
      language: language.trim(),
      category: (from?.category as Category) ?? "UTILITY",
      components: from?.components
        ? { ...from.components, body: from.components.body ?? { text: "" } }
        : { body: { text: "" } },
    });
    setIssues(null);
    setAddingTo(null);
    setAddLanguage("");
  }

  function loadTemplate(t: BizTemplate) {
    setEditor({
      id: t._id,
      name: t.name,
      language: t.language,
      category: t.category,
      // Guard a present-but-body-less components blob (legacy/partial data) —
      // body is required by the editor + preview.
      components: { ...t.components, body: t.components?.body ?? { text: "" } },
    });
    setIssues(null);
  }

  // Any content/category edit invalidates the last policy-lint result, so the
  // submit gate (errorCount) can't act on stale issues.
  function setBody(text: string) {
    setEditor((e) => ({ ...e, components: { ...e.components, body: { text } } }));
    setIssues(null);
  }
  function setHeader(text: string) {
    setEditor((e) => ({ ...e, components: { ...e.components, header: text ? { format: "TEXT", text } : undefined } }));
    setIssues(null);
  }
  function setFooter(text: string) {
    setEditor((e) => ({ ...e, components: { ...e.components, footer: text ? { text } : undefined } }));
    setIssues(null);
  }

  const canSave = editor.name.trim().length > 0 && editor.components.body.text.trim().length > 0;
  const errorCount = issues?.filter((i) => i.severity === "error").length ?? 0;

  return (
    <PageShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Draft, check against WhatsApp policy, and submit message templates for approval — with a live preview.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Editor */}
        <div className="space-y-5">
          <Card className="space-y-3 p-4">
            <Label htmlFor="goal">Describe what you want to send</Label>
            <div className="flex gap-2">
              <Input
                id="goal"
                placeholder="e.g. Let a customer know their order has shipped, with a tracking link"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && goal.trim()) suggest.mutate(); }}
              />
              <Button onClick={() => suggest.mutate()} disabled={!goal.trim() || suggest.isPending}>
                {suggest.isPending ? "Drafting…" : "Draft with AI"}
              </Button>
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="order_shipped" value={editor.name} onChange={(e) => setEditor((x) => ({ ...x, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="language">Language</Label>
                <Input id="language" placeholder="en" value={editor.language} onChange={(e) => setEditor((x) => ({ ...x, language: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={editor.category} onValueChange={(v) => { setEditor((x) => ({ ...x, category: v as Category })); setIssues(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="header">Header (optional)</Label>
              <Input id="header" placeholder="Short title" value={editor.components.header?.text ?? ""} onChange={(e) => setHeader(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Body</Label>
              <Textarea id="body" rows={5} placeholder="Your message. Use {{1}} for variables." value={editor.components.body.text} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="footer">Footer (optional)</Label>
              <Input id="footer" placeholder="Reply STOP to opt out" value={editor.components.footer?.text ?? ""} onChange={(e) => setFooter(e.target.value)} />
            </div>

            {issues && (
              <div className="space-y-1.5">
                <Separator />
                {issues.length === 0 ? (
                  <p className="text-sm text-success-on-tint">No policy issues found.</p>
                ) : (
                  issues.map((it, i) => (
                    <p key={i} className={`text-sm ${it.severity === "error" ? "text-destructive-on-tint" : "text-warning-on-tint"}`}>
                      <span className="font-medium capitalize">{it.severity}</span> · {it.field}: {it.message}
                    </p>
                  ))
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => lint.mutate()} disabled={!canSave || lint.isPending}>
                {lint.isPending ? "Checking…" : "Check policy"}
              </Button>
              <Button variant="outline" onClick={() => saveDraft.mutate()} disabled={!canSave || saveDraft.isPending}>
                {saveDraft.isPending ? "Saving…" : "Save draft"}
              </Button>
              <Button
                onClick={async () => {
                  // Always persist the current editor state first so we submit
                  // exactly what's on screen (not the last-saved version).
                  try {
                    const r = await saveDraft.mutateAsync();
                    submit.mutate({ id: r.template._id, businessId: business?._id });
                  } catch {
                    /* saveDraft surfaces its own error toast */
                  }
                }}
                disabled={!canSave || submit.isPending || saveDraft.isPending || errorCount > 0}
                title={errorCount > 0 ? "Resolve policy errors first" : undefined}
              >
                {submit.isPending ? "Submitting…" : "Submit for approval"}
              </Button>
              {editor.id && (
                <Button variant="ghost" onClick={() => { setEditor(EMPTY_EDITOR); setIssues(null); }}>
                  New template
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Preview + list */}
        <div className="space-y-6">
          <Card className="space-y-2 p-4">
            <Label className="text-xs uppercase text-muted-foreground">Preview</Label>
            <WhatsAppPreview components={editor.components} />
          </Card>

          <Card className="p-4">
            <Label className="text-xs uppercase text-muted-foreground">Your templates</Label>
            <div className="mt-3 space-y-2">
              {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!isLoading && templates.length === 0 && (
                <p className="text-sm text-muted-foreground">No templates yet. Draft your first one on the left.</p>
              )}
              {templates.map((t) => (
                <div key={t._id} className="rounded-lg border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <button className="truncate text-left text-sm font-medium hover:underline" onClick={() => loadTemplate(t)}>
                      {t.name}
                    </button>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{t.language}</span>
                    <span>·</span>
                    <span className="capitalize">{t.category.toLowerCase()}</span>
                  </div>
                  {t.status === "rejected" && (
                    <div className="mt-1.5">
                      {t.rejectionReason && <p className="text-xs text-destructive-on-tint">{t.rejectionReason}</p>}
                      <Button size="sm" variant="outline" className="mt-1.5" onClick={() => repair.mutate(t._id)} disabled={repair.isPending}>
                        {repair.isPending ? "Fixing…" : "Suggest a fix"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── ★★THE ONE REFUSAL THAT IS A QUESTION ───────────────────────────
        *
        * ★★META PUTS AN EDITED TEMPLATE BACK INTO REVIEW, so replacing one it
        * has APPROVED takes it off the air until Meta approves it again. The
        * api refuses that submit once rather than doing it silently, and the
        * only thing that turns the refusal into an action is a confirmation —
        * so a red toast would leave the merchant with a dead end where they
        * had a choice.
        *
        * ★AND IT RENDERS THE api's SENTENCE, which names Meta's status and the
        * cost. A second wording here is a second place for that to drift.
        */}
      <AlertDialog
        open={unpublishOpen}
        onOpenChange={(open) => {
          setUnpublishOpen(open);
          // 🚫★★AND A DISMISSAL LEAVES SOMETHING ON SCREEN. Escape closes this
          //  dialog, and the error branch returned before any toast — so a
          //  merchant who pressed Submit and then Escape got nothing at all:
          //  no toast, no status change, and the api's sentence gone. The
          //  button looked broken. ★Cancel is deliberate and gets the same
          //  line, because it is the same outcome: nothing was submitted and
          //  the approved version is still live.
          // 🚫★★AND IT CANNOT TOAST TWICE. The content stays mounted and
          //  interactive through its exit fade, so a second Escape or a
          //  double-click on Cancel re-fires this with the flag still `false`.
          //  ★`unpublishOpen` is the state from THIS render, so after the first
          //  close it reads `false` — which is exactly "there is no open
          //  question to dismiss". The confirm path has had this guard; the
          //  dismissal path had not.
          if (!open && unpublishOpen && !unpublishConfirmed.current) {
            toast.info("Not submitted — the approved version is still live.");
          }
          // 🚫★★AND IT IS **NOT** RESET HERE. `AlertDialogContent` stays mounted
          //  and interactive through its exit fade — the fact this whole
          //  open/message split exists for — so Escape or a click on the still
          //  live Cancel during that fade fires this a second time with the ref
          //  already cleared, toasting "not submitted" over a confirmed submit
          //  that is in flight. It is cleared where the dialog OPENS, which is
          //  the one moment that starts a new question.
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            {/* 🚫★★AND IT NAMES THE TEMPLATE, because the editor may no longer
              * be showing it. The list buttons stay enabled through a submit
              * that makes several round trips, so a merchant who clicked
              * another row while the 409 was travelling gets a dialog saying
              * "this template" beside an editor holding a different one — and
              * the thing it is about is the row the refusal named, not what is
              * on screen. ★The name falls back to nothing rather than to the
              * editor's: an unnamed dialog is better than a wrong name. */}
            <AlertDialogTitle>
              {unpublishTemplateName
                ? `Replacing “${unpublishTemplateName}” takes a live template off the air`
                : "This will take a live template off the air"}
            </AlertDialogTitle>
            <AlertDialogDescription>{unpublishWarning?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the approved version</AlertDialogCancel>
            <AlertDialogAction
              // 🚫★★AND IT CANNOT FIRE TWICE. The content stays mounted through
              //  its exit animation — the very fact the open/message split
              //  above exists for — so an ordinary double-click sent two
              //  concurrent confirmed edits: an extra attempt spent, and a red
              //  SUBMIT_RACED_EDIT or SUBMIT_IN_REVIEW toast after a submit
              //  that had succeeded. The editor's own Submit button has had
              //  this guard all along.
              disabled={submit.isPending}
              onClick={() => {
                // ── 🚫★★AND IT DOES **NOT** SAVE FIRST, WHICH A ROUND OF
                //    REVIEW TALKED IT INTO AND THREE FINDINGS TALKED IT OUT OF ─
                //
                // ★★THE SUBMIT BUTTON SAVES BECAUSE THE MERCHANT IS STARTING
                //  SOMETHING; THIS BUTTON IS ANSWERING A QUESTION ABOUT
                //  SOMETHING THAT ALREADY HAPPENED. That submit saved the
                //  editor and sent the row, the api refused it BEFORE any
                //  write, and the question is "replace Meta's approved copy
                //  with the version you just submitted?" — which is the version
                //  already on the row. There is nothing to save.
                //
                // 🚫★★AND SAVING HERE MADE THE ANSWER ACT ON THE WRONG THINGS.
                //  It re-derived the target from live `editor` state, so a
                //  merchant who clicked another template while the 409 was in
                //  flight would force-submit THAT one with
                //  `confirmReplaceApproved` — past a guard they were never
                //  asked about. It also put an awaited call behind a Radix
                //  `Dialog.Close`, so a save that failed swallowed the
                //  confirmation with it, and it skipped the Submit button's
                //  `canSave`/`errorCount` gate on an editor that stays live.
                //
                // ★SO THE IDENTITY IS HELD FROM THE REFUSAL, the way
                //  `integrations/page.tsx`'s `pendingToggle` holds the page it
                //  asked about. ★Whatever the merchant has typed since is still
                //  unsaved on screen, exactly as it would be during any submit.
                //
                // 🚫★★AND IT DOES NOT FIRE AFTER A DISMISSAL. The content stays
                //  interactive through its exit fade, so a click landing here
                //  just after Escape or Cancel sent the destructive confirmed
                //  submit — `submit.isPending` is false and the warning is
                //  deliberately still populated — moments after the merchant
                //  was told "Not submitted".
                if (unpublishOpen && unpublishWarning) {
                  // ★MARKED BEFORE THE CLOSE FIRES, because Radix closes the
                  //  dialog for the confirm exactly as it does for Cancel and
                  //  Escape — and only this path has an answer to report.
                  unpublishConfirmed.current = true;
                  submit.mutate({
                    id: unpublishWarning.id,
                    businessId: business?._id,
                    confirmReplaceApproved: true,
                  });
                }
              }}
            >
              Replace it and submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
