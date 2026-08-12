"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastUnhandledApiError } from "@/lib/toast-errors";
import {
  audiencesApi,
  type CorrectableFieldSpec,
  type EvidenceTier,
  type ProfileSource,
} from "@/lib/api/audiences";
import {
  correctionBlockedReason,
  correctionIsNoop,
  dedupeLabels,
  highestTier,
  mergeSources,
  topSource,
} from "@/lib/audience-profile-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AlertTriangle, ChevronDown, Pencil, RefreshCw, X } from "lucide-react";

/**
 * "Here's what we understand about your business" — the Audience Engine's
 * first user-facing surface, and the one that makes Phase 1 testable.
 *
 * WHY IT LOOKS LIKE THIS. The engine's whole claim is that it reads a business
 * before it proposes an audience. A panel that showed a tidy summary would be
 * indistinguishable from a black box guessing; what makes it a strategist is
 * that every line says WHERE it came from and can be told it is wrong. So:
 *
 *   - EVERY claim carries its evidence tier — a human typed it / we measured it
 *     / the model judged it — because the difference between those is the
 *     difference between confidence and a guess, and the user is the only one
 *     who can settle it.
 *   - CONFLICTS ARE SURFACED FIRST, not resolved. A business that says it sells
 *     to enterprises while its content addresses freelancers is the most
 *     interesting thing the engine noticed. Flattening it into one answer is
 *     the one thing this panel must never do.
 *   - `classified: false` says the deeper read is UNAVAILABLE. An empty ICP
 *     because the model call failed is not the finding "you have no ICP", and
 *     rendering the two the same way is how absence gets read as fact.
 *
 * ★THE CORRECTABLE FIELDS COME FROM THE SERVER. `correctableFields` carries the
 * field, its shape (one value vs a list), its length cap and any closed
 * vocabulary. Hardcoding that list here is how a client comes to offer a
 * control the server refuses — a dead control the user operates and nothing
 * happens — which is the exact failure mode this engine keeps finding in
 * itself.
 */

const TIER_LABEL: Record<EvidenceTier, string> = {
  stated: "You told us",
  observed: "We measured",
  inferred: "We inferred",
};

const TIER_CLASS: Record<EvidenceTier, string> = {
  stated: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  observed: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  inferred: "border-warning/40 bg-warning/10 text-warning-on-tint",
};

/** Human labels for the server's field ids. Anything the server sends that is
 *  not here still renders — under its raw id — because a missing label must
 *  never hide a control the server offers. */
const FIELD_LABEL: Record<string, string> = {
  "classification.industry": "Industry",
  "classification.subIndustry": "Sub-industry",
  "classification.marketType": "Who pays",
  "classification.lifecycleStage": "Stage",
  "classification.regionalPresence": "Where you operate",
  icp: "Who buys from you",
  personas: "The people inside them",
  painPoints: "Problems you solve",
  decisionMakers: "Who signs",
};

const MARKET_TYPE_LABEL: Record<string, string> = {
  b2b: "Businesses (B2B)",
  b2c: "People (B2C)",
  b2b2c: "Both — you serve people, businesses pay (B2B2C)",
  unknown: "Not sure yet",
};

function EvidenceBadge({ sources }: { sources?: ProfileSource[] }) {
  const tier: EvidenceTier | undefined = highestTier(sources);
  if (!tier) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TIER_CLASS[tier]}`}
    >
      {/* The tier is carried as TEXT, not colour alone — the badge has to mean
          the same thing to a colour-blind reader and a screen reader. */}
      {TIER_LABEL[tier]}
    </span>
  );
}

/** The evidence itself, rendered rather than hidden in a `title`.
 *
 *  ★NOT A TOOLTIP. A `title` is invisible to keyboard users and to touch, and
 *  this is the panel's whole argument — "here is what we think AND why". Copy
 *  a user cannot reach is copy that does not exist. */
function EvidenceDetail({ sources }: { sources?: ProfileSource[] }) {
  // From the WINNING tier's own source. "the first source with a detail" put a
  // measurement's detail under a stated badge.
  const detail = topSource(sources)?.detail;
  if (!detail) return null;
  return <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>;
}

/** A claim and its evidence, with an edit affordance when the server says the
 *  field is correctable. */
function ClaimRow({
  label,
  value,
  sources,
  onEdit,
}: {
  label: string;
  value?: string;
  sources?: ProfileSource[];
  onEdit?: (opener: HTMLElement) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={value ? "text-sm" : "text-sm text-muted-foreground italic"}>
            {/* Absent is stated as absent. "Unknown" is a fact about our
                understanding; a blank line reads as a rendering bug. */}
            {value || "Not known yet"}
          </span>
          <EvidenceBadge sources={sources} />
        </div>
        <EvidenceDetail sources={sources} />
      </div>
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2"
          onClick={(e) => onEdit(e.currentTarget)}
          aria-label={`Correct ${label}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/** Editing state: one field at a time, so a half-finished correction can never
 *  be submitted alongside a finished one. */
type Editing = {
  spec: CorrectableFieldSpec;
  value: string;
  list: string[];
  /** What the profile said when the editor opened — so a no-op save can be
   *  refused, and so the delta the log records is one the user actually made. */
  original: { value: string; list: string[] };
  /** The profile this snapshot came from. If the underlying profile moves —
   *  a refetch on window focus, a re-read, a business switch — the snapshot is
   *  stale and saving it would write values the user never saw. */
  profileVersion: number;
} | null;

/**
 * ★MOVED OUT OF `dashboard/ads/_components` (G2). It is not an ads screen: it
 * is what the platform understands about the CUSTOMER, and Content, Support and
 * Commerce all want to read it. Burying it under Ads is why nobody has ever
 * corrected one.
 *
 * `defaultOpen` exists because on its own page there is nothing else to look
 * at, and collapsing the only content behind a click is how a surface stays
 * unread. It defaults to collapsed so that any future caller embedding this
 * beside other things gets the old behaviour; the Ads hub now renders
 * `BusinessProfileSummary` instead.
 */
export function AudienceProfilePanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState<Editing>(null);
  /** The control that opened the editor, so focus can go back to it on close.
   *  Without this the editor unmounts and focus falls to `<body>` — the
   *  keyboard user is dropped at the top of the document. */
  const openerRef = useRef<HTMLElement | null>(null);
  /** Set when the reconcile above closed an editor out from under the user. */
  const [closedByRefresh, setClosedByRefresh] = useState(false);
  const closeEditor = useCallback(() => {
    setEditing(null);
    openerRef.current?.focus();
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audience-profile"],
    queryFn: () => audiencesApi.getProfile(),
  });

  const profile = data?.profile ?? null;
  const specs = useMemo(() => data?.correctableFields ?? [], [data]);
  const specFor = (field: string) => specs.find((s) => s.field === field);

  const refresh = useMutation({
    mutationFn: () => audiencesApi.refreshProfile(),
    onSuccess: (res) => {
      // ★UPDATER FORM, so the specs come from whatever the cache already holds
      // rather than from this render's closure. If the initial GET had failed,
      // `specs` here is [] — and writing that back would leave the freshly
      // refreshed profile with no edit controls at all, which reads as "this
      // is not correctable" rather than "we lost the spec list".
      queryClient.setQueryData(
        ["audience-profile"],
        (old: { correctableFields?: CorrectableFieldSpec[] } | undefined) => ({
          profile: res.profile,
          correctableFields: old?.correctableFields ?? specs,
        }),
      );
      // A re-read replaces the profile underneath any open editor, so the
      // snapshot in it describes a profile that no longer exists. Closing is
      // the honest move — saving it would write values the user never saw.
      setEditing(null);
      toast.success(
        res.classified
          ? "Refreshed what we understand about your business."
          : // NOT presented as a success with gaps: the deeper read genuinely
            // did not happen, and saying so is the difference between "you have
            // no ICP" and "we couldn't work one out just now".
            "Refreshed the facts we can measure. The deeper read wasn't available just now — try again later.",
      );
    },
    onError: (err) => toastUnhandledApiError(err, "refresh the business profile"),
  });

  const correct = useMutation({
    mutationFn: (corrections: Parameters<typeof audiencesApi.correctProfile>[0]) =>
      audiencesApi.correctProfile(corrections),
    onSuccess: (res) => {
      queryClient.setQueryData(
        ["audience-profile"],
        (old: { correctableFields?: CorrectableFieldSpec[] } | undefined) => ({
          profile: res.profile,
          correctableFields: old?.correctableFields ?? specs,
        }),
      );
      closeEditor();
      toast.success("Thanks — we'll use that from now on.");
      // The audience is built from this profile, so a correction changes what
      // the next campaign WOULD target.
      //
      // ★THE PROPOSAL, WHICH NOTHING HAS EVER INVALIDATED. `audience-proposal`
      // is the query that literally resolves this profile into targeting, and
      // it is cached for five minutes — so correcting Industry and returning to
      // the boost dialog inside that window shows, and boosts against, the
      // pre-correction audience. That is the failure this line was written for,
      // in the one query it never named.
      //
      // ★AND NOT THE CAMPAIGN LISTS. A first cut invalidated LinkedIn's; the
      // fix after that looped over the ads hub's channel registry — which is
      // documented as "what to invalidate after a CRON fires" and is a
      // different question, so it both missed this and dragged in
      // `content-hub-integrations`, a connection list a profile correction
      // cannot change. A campaign's stored provenance records what was chosen
      // at the time and does not move when the profile does; re-fetching it
      // would be work that changes nothing.
      void queryClient.invalidateQueries({ queryKey: ["audience-proposal"] });
    },
    onError: (err) => toastUnhandledApiError(err, "save that correction"),
  });

  const startEdit = (field: string, current: string | string[], opener?: HTMLElement | null) => {
    openerRef.current = opener ?? null;
    setClosedByRefresh(false);
    const spec = specFor(field);
    if (!spec || !profile) return;
    const original = {
      value: typeof current === "string" ? current : "",
      list: Array.isArray(current) ? current : [],
    };
    setEditing({ spec, ...original, original, profileVersion: profile.profileVersion });
  };

  const submitEdit = () => {
    if (!editing) return;
    const { spec } = editing;
    // ★A NO-OP SAVE IS NOT HARMLESS. Every entry a list correction names is
    // rewritten as `stated / user_correction`, so opening the editor, changing
    // nothing and pressing Save would turn inferred claims into "You told us"
    // ones the user never made — and append a null delta to the log. The
    // server cannot tell the difference; only this can.
    if (correctionIsNoop(spec, editing.original, { value: editing.value, list: editing.list })) {
      // Said out loud. Closing silently is indistinguishable from Cancel, and
      // the list hint invites exactly this on an already-empty list — a user
      // who follows it would believe they made a statement they did not.
      toast.info("That's what we already have — nothing to save.");
      closeEditor();
      return;
    }
    // Every limit the server enforces, checked here first — with the server's
    // own numbers, which arrived in the spec. A user should never learn a
    // limit by being refused.
    const blocked = correctionBlockedReason(spec, { value: editing.value, list: editing.list });
    if (blocked) {
      toast.error(blocked);
      return;
    }
    if (spec.shape === "list") {
      // Deduped exactly as the server dedupes, so the correction log and the
      // field it produces cannot disagree.
      correct.mutate([{ field: spec.field, toList: dedupeLabels(editing.list) }]);
      return;
    }
    correct.mutate([{ field: spec.field, to: editing.value.trim() }]);
  };

  // ★THE SNAPSHOT IS RECONCILED, not trusted. react-query refetches on window
  // focus and `switchBusiness` clears the whole cache without unmounting this
  // panel, so the profile can move or vanish under an open editor. Saving then
  // writes a list the user never saw — and after a business switch, writes
  // business A's ICP onto business B, the wrong-business class of bug the
  // server is business-scoped to prevent.
  //
  // TWO DIFFERENT CHECKS, because they catch different things and only one of
  // them is the version. `!profile` is what catches the business switch — two
  // businesses are both `profileVersion: 1` far more often than not, since only
  // a re-read increments it. The version catches a re-read from another tab.
  // (A correction from another tab moves neither: PATCH does not bump the
  // version. That case is not covered, and saying so is better than implying
  // it is.)
  //
  // DURING RENDER, which is React's sanctioned "adjust state when the input
  // changes" pattern — same component, conditional, and it converges because
  // `editing` becomes null. An effect would be the obvious alternative and is
  // lint-forbidden here for good reason: it would render one frame with a stale
  // editor still on screen. The cost is that a toast cannot fire from render,
  // so the explanation is a NOTICE instead — closing silently is what the last
  // version did, and it is indistinguishable from the editor never having
  // opened.
  if (editing && (!profile || profile.profileVersion !== editing.profileVersion)) {
    setEditing(null);
    setClosedByRefresh(Boolean(profile));
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 py-4">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-full max-w-md" />
        </CardContent>
      </Card>
    );
  }

  // A failed READ is not "no profile" — offering the build button here would
  // invite a user to rebuild something that may already exist.
  // `isError && !data`: a BACKGROUND refetch failure must not throw away a
  // perfectly good cached profile. Replacing it with an error card would hide
  // the user's own data because a refresh blinked.
  if (isError && !data) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          We couldn&apos;t load what we understand about your business just now.
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <div className="text-sm font-medium">We haven&apos;t read your business yet</div>
            <p className="text-sm text-muted-foreground">
              Campaigns are targeted from what we understand about you. Build it once and every
              campaign starts with a real audience.
            </p>
          </div>
          <Button onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? "Reading…" : "Read my business"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const conflicts = profile.conflicts ?? [];
  // ★"NOTHING HERE YET" vs "WE COULDN'T WORK IT OUT" — the same empty list, two
  // completely different facts, and rendering them identically is how an
  // absence gets read as a finding. `GET /profile` does not return the refresh
  // route's `classified` flag, but the profile itself records which classifier
  // produced it, and its absence means the deeper read has never succeeded.
  const classified = Boolean(profile.skillVersions?.understand_business_for_ads);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">What we understand about your business</div>
              <p className="text-sm text-muted-foreground">
                Every campaign is targeted from this. Tell us where we&apos;re wrong.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh.mutate()}
                // Also blocked while a correction is in flight: both writers
                // $set the profile, so the loser is silently discarded.
                disabled={refresh.isPending || correct.isPending}
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />
                {refresh.isPending ? "Reading…" : "Re-read"}
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {open ? "Hide" : "Show"}
                  <ChevronDown
                    className={`ml-1.5 h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {closedByRefresh && (
            <p className="mt-3 rounded-md border border-dashed p-2.5 text-sm text-muted-foreground">
              Your business profile changed while you were editing, so we closed the editor rather
              than save something you couldn&apos;t see. Have another look.
            </p>
          )}

          {/* ★CONFLICTS ARE ALWAYS VISIBLE, collapsed or not. They are the most
              interesting thing the engine found and the thing a user is most
              able to settle in one sentence. */}
          {conflicts.length > 0 && (
            <div className="mt-3 space-y-2">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.field}
                  className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-2.5 text-sm"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-on-tint" />
                  <div>
                    <span className="font-medium">
                      {FIELD_LABEL[conflict.field] ?? conflict.field}
                    </span>
                    :{" "}
                    {conflict.note ??
                      `you told us "${conflict.statedValue}", your content says "${conflict.observedValue}".`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <CollapsibleContent>
          <CardContent className="space-y-5 border-t pt-4">
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                The business
              </h4>
              <div className="divide-y">
                <ClaimRow
                  label={FIELD_LABEL["classification.industry"]!}
                  value={profile.classification.industry?.value}
                  sources={profile.classification.industry?.sources}
                  onEdit={
                    specFor("classification.industry")
                      ? (opener) =>
                          startEdit(
                            "classification.industry",
                            profile.classification.industry?.value ?? "",
                            opener,
                          )
                      : undefined
                  }
                />
                <ClaimRow
                  label={FIELD_LABEL["classification.subIndustry"]!}
                  value={profile.classification.subIndustry?.value}
                  sources={profile.classification.subIndustry?.sources}
                  onEdit={
                    specFor("classification.subIndustry")
                      ? (opener) =>
                          startEdit(
                            "classification.subIndustry",
                            profile.classification.subIndustry?.value ?? "",
                            opener,
                          )
                      : undefined
                  }
                />
                <ClaimRow
                  label={FIELD_LABEL["classification.marketType"]!}
                  value={
                    profile.classification.marketType
                      ? (MARKET_TYPE_LABEL[profile.classification.marketType.value] ??
                        profile.classification.marketType.value)
                      : undefined
                  }
                  sources={profile.classification.marketType?.sources}
                  onEdit={
                    specFor("classification.marketType")
                      ? (opener) =>
                          startEdit(
                            "classification.marketType",
                            profile.classification.marketType?.value ?? "",
                            opener,
                          )
                      : undefined
                  }
                />
                <ClaimRow
                  label={FIELD_LABEL["classification.lifecycleStage"]!}
                  value={profile.classification.lifecycleStage?.value}
                  sources={profile.classification.lifecycleStage?.sources}
                  onEdit={
                    specFor("classification.lifecycleStage")
                      ? (opener) =>
                          startEdit(
                            "classification.lifecycleStage",
                            profile.classification.lifecycleStage?.value ?? "",
                            opener,
                          )
                      : undefined
                  }
                />
                <ClaimRow
                  label={FIELD_LABEL["classification.regionalPresence"]!}
                  value={profile.classification.regionalPresence?.map((r) => r.value).join(", ")}
                  // Every entry's evidence, not the first entry's: the line is
                  // one sentence built from many claims, and badging it from
                  // [0] calls the whole list "You told us" because one country
                  // came from the business record.
                  sources={mergeSources(
                    (profile.classification.regionalPresence ?? []).map((r) => r.sources),
                  )}
                  onEdit={
                    specFor("classification.regionalPresence")
                      ? (opener) =>
                          startEdit(
                            "classification.regionalPresence",
                            profile.classification.regionalPresence?.map((r) => r.value).join(", ") ??
                              "",
                            opener,
                          )
                      : undefined
                  }
                />
              </div>
            </section>

            <ListSection
              title={FIELD_LABEL.icp!}
              field="icp"
              spec={specFor("icp")}
              items={profile.icp.map((i) => ({
                key: i.label,
                primary: i.label,
                secondary: i.description,
                sources: i.sources,
              }))}
              onEdit={(opener) => startEdit("icp", profile.icp.map((i) => i.label), opener)}
            />

            <ListSection
              title={FIELD_LABEL.decisionMakers!}
              field="decisionMakers"
              spec={specFor("decisionMakers")}
              items={profile.decisionMakers.map((d) => ({
                key: d.titleFamily,
                primary: d.titleFamily,
                secondary: d.seniority,
                sources: d.sources,
              }))}
              onEdit={(opener) =>
                startEdit(
                  "decisionMakers",
                  profile.decisionMakers.map((d) => d.titleFamily),
                  opener,
                )
              }
            />

            <ListSection
              title={FIELD_LABEL.painPoints!}
              field="painPoints"
              spec={specFor("painPoints")}
              items={profile.painPoints.map((p) => ({
                key: p.statement,
                primary: p.statement,
                sources: p.sources,
              }))}
              onEdit={(opener) =>
                startEdit("painPoints", profile.painPoints.map((p) => p.statement), opener)
              }
            />

            <ListSection
              title={FIELD_LABEL.personas!}
              field="personas"
              spec={specFor("personas")}
              items={profile.personas.map((p) => ({
                key: p.label,
                primary: p.label,
                secondary: [p.role, p.seniority].filter(Boolean).join(" · ") || undefined,
                sources: p.sources,
              }))}
              onEdit={(opener) => startEdit("personas", profile.personas.map((p) => p.label), opener)}
            />

            {!classified && (
              <p className="rounded-md border border-dashed p-2.5 text-sm text-muted-foreground">
                These are the facts we can measure. The deeper read — who buys, who signs, what
                you solve — hasn&apos;t run for this business yet, so the lists above being empty
                doesn&apos;t mean there&apos;s nothing there. Re-read to try it.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Version {profile.profileVersion}
              {profile.corrections.length > 0 &&
                // "recent", because the server caps the log at 200 and trims
                // the oldest — a bare count would quietly stop going up.
                ` · ${profile.corrections.length} recent correction${profile.corrections.length === 1 ? "" : "s"} from you`}
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {editing && (
        <CardContent className="border-t pt-4">
          <CorrectionEditor
            key={editing.spec.field}
            editing={editing}
            setEditing={setEditing}
            onClose={closeEditor}
            onSubmit={submitEdit}
            pending={correct.isPending}
          />
        </CardContent>
      )}
    </Card>
  );
}

function ListSection({
  title,
  field,
  spec,
  items,
  onEdit,
}: {
  title: string;
  field: string;
  spec?: CorrectableFieldSpec;
  items: Array<{ key: string; primary: string; secondary?: string; sources?: ProfileSource[] }>;
  onEdit: (opener: HTMLElement) => void;
}) {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        {spec && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={(e) => onEdit(e.currentTarget)}
            aria-label={`Correct ${title}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          {/* Deliberately not "none" — we may simply not have worked it out. */}
          Nothing here yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li key={`${field}:${index}:${item.key}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span>{item.primary}</span>
              {item.secondary && (
                <span className="text-muted-foreground">— {item.secondary}</span>
              )}
              <EvidenceBadge sources={item.sources} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The correction editor. One field at a time.
 *
 * ★IT RENDERS FROM THE SPEC. Shape decides scalar-vs-list, `values` decides
 * whether it is a select, `maxLength`/`maxItems` are enforced here so the user
 * hits a disabled button rather than a 400 they will read as "my answer was
 * wrong". Every one of those came from the server, so this control cannot
 * offer something the server refuses.
 */
function CorrectionEditor({
  editing,
  setEditing,
  onClose,
  onSubmit,
  pending,
}: {
  editing: NonNullable<Editing>;
  setEditing: (e: Editing) => void;
  /** Closes AND returns focus to the control that opened it — the editor
   *  unmounts, so without this a keyboard user is dropped at `<body>`. */
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const { spec, value, list } = editing;
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const hintId = useId();
  const reasonId = useId();
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // ★FOCUS MOVES TO THE EDITOR. It renders BELOW the collapsible while focus
  // stays on the pencil that opened it, so to a keyboard or screen-reader user
  // the pencil appeared to do nothing at all. The component is keyed by field,
  // so this fires once per open rather than on every keystroke.
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);
  const label = FIELD_LABEL[spec.field] ?? spec.field;
  // Deduped, matching the rule Save uses. Counting raw entries meant Add was
  // disabled while Save was enabled on the same screen, at 21 raw / 20 unique.
  const atItemCap = spec.maxItems !== undefined && dedupeLabels(list).length >= spec.maxItems;
  const draftTooLong = draft.trim().length > spec.maxLength;
  const blockedReason = correctionBlockedReason(spec, { value, list });

  const addDraft = () => {
    const v = draft.trim();
    if (!v || draftTooLong || atItemCap) return;
    // Case-insensitive, because the server dedupes that way and a log that
    // disagrees with the field it produced teaches the engine the wrong thing.
    if (list.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    setEditing({ ...editing, list: [...list, v] });
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId} className="text-sm font-medium">
          Correct: {label}
        </Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={pending}
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {spec.shape === "list" ? (
        <div className="space-y-2">
          <ul className="flex flex-wrap gap-1.5">
            {list.map((item, i) => (
              <li key={`${item}-${i}`}>
                <Badge variant="secondary" className="gap-1 py-1 pr-1">
                  <span className="max-w-[28rem] truncate">{item}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${item}`}
                    className="rounded-sm p-0.5 hover:bg-muted"
                    onClick={() =>
                      setEditing({ ...editing, list: list.filter((_, j) => j !== i) })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            {spec.maxLength > 300 ? (
              <Textarea
                id={inputId}
                ref={firstFieldRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Add — up to ${spec.maxLength} characters`}
                aria-describedby={blockedReason ? `${hintId} ${reasonId}` : hintId}
                rows={2}
                className="text-sm"
              />
            ) : (
              <Input
                id={inputId}
                ref={firstFieldRef as React.RefObject<HTMLInputElement>}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-describedby={blockedReason ? `${hintId} ${reasonId}` : hintId}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraft();
                  }
                }}
                placeholder="Add"
              />
            )}
            <Button variant="outline" onClick={addDraft} disabled={!draft.trim() || draftTooLong || atItemCap}>
              Add
            </Button>
          </div>
          <p id={hintId} className="text-xs text-muted-foreground">
            {draftTooLong
              ? `Too long — keep each one under ${spec.maxLength} characters.`
              : atItemCap
                ? `That's the maximum of ${spec.maxItems}.`
                : list.length > 0
                  ? // The clear case, said plainly: an empty list is a real
                    // answer, not a way of cancelling.
                    "Remove everything and save to tell us none of these apply."
                  : // …and NOT offered when the list is already empty, where
                    // following it would send nothing and leave the user
                    // believing they had made a statement.
                    "Add what we've missed."}
          </p>
        </div>
      ) : spec.values ? (
        <Select value={value} onValueChange={(v) => setEditing({ ...editing, value: v })}>
          <SelectTrigger
            id={inputId}
            // The market-type editor is the one branch with no text input, so
            // without a ref here the pencil still did nothing for a keyboard
            // user — the a11y fix covered eight of the nine fields.
            ref={firstFieldRef as unknown as React.RefObject<HTMLButtonElement>}
            aria-label={`Correct ${label}`}
            aria-describedby={blockedReason ? reasonId : undefined}
          >
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {spec.values.map((v) => (
              <SelectItem key={v} value={v}>
                {MARKET_TYPE_LABEL[v] ?? v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="space-y-1">
          <Input
            id={inputId}
            ref={firstFieldRef as React.RefObject<HTMLInputElement>}
            value={value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            placeholder={
              spec.csv === "iso2" ? "Two-letter country codes, e.g. IN, SG, AE" : "Your answer"
            }
            // Every reason the value is unusable, not only the length one —
            // a malformed country list was silently valid to assistive tech.
            aria-invalid={blockedReason !== undefined}
            // Only what actually exists: the hint renders for the ISO-2 field
            // alone, and pointing at a missing id is worse than pointing at
            // nothing. The blocked reason is included because a live region's
            // INITIAL content is not announced — and a scalar editor opened on
            // an absent claim is blocked from the first frame.
            aria-describedby={
              [spec.csv === "iso2" ? hintId : null, blockedReason ? reasonId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
          />
          {spec.csv === "iso2" && (
            <p id={hintId} className="text-xs text-muted-foreground">
              Country codes only{spec.maxCount ? `, up to ${spec.maxCount}` : ""} — this is what we
              target, so it decides where your budget goes.
            </p>
          )}
        </div>
      )}

      {/* The reason is SHOWN, not only used to disable. A disabled button with
          no explanation is a dead end the user cannot reason about — and the
          numbers in it are the server's own, so this is what the server would
          have said. `aria-live` because it appears in response to typing. */}
      {blockedReason && (
        <p id={reasonId} className="text-xs text-destructive" aria-live="polite">
          {blockedReason}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={pending || blockedReason !== undefined}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
