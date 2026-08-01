"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastUnhandledApiError } from "@/lib/toast-errors";
import {
  audiencesApi,
  type CorrectableFieldSpec,
  type EvidenceTier,
  type ProfileSource,
} from "@/lib/api/audiences";
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
  inferred: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
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
  // The HIGHEST tier present, because that is what the claim rests on: a
  // segment the business declared AND we then measured is stated, not observed.
  const tier: EvidenceTier | undefined = sources?.some((s) => s.tier === "stated")
    ? "stated"
    : sources?.some((s) => s.tier === "observed")
      ? "observed"
      : sources?.some((s) => s.tier === "inferred")
        ? "inferred"
        : undefined;
  if (!tier) return null;
  const detail = sources?.find((s) => s.detail)?.detail;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TIER_CLASS[tier]}`}
      // The evidence itself, for anyone who wants to check our working.
      title={detail ? `${TIER_LABEL[tier]} — ${detail}` : TIER_LABEL[tier]}
    >
      {TIER_LABEL[tier]}
    </span>
  );
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
  onEdit?: () => void;
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
      </div>
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2"
          onClick={onEdit}
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
type Editing = { spec: CorrectableFieldSpec; value: string; list: string[] } | null;

export function AudienceProfilePanel() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);

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
      queryClient.setQueryData(["audience-profile"], {
        profile: res.profile,
        correctableFields: specs,
      });
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
      queryClient.setQueryData(["audience-profile"], {
        profile: res.profile,
        correctableFields: specs,
      });
      setEditing(null);
      toast.success("Thanks — we'll use that from now on.");
      // The audience is built from this profile, so a correction changes what
      // the next campaign would target.
      void queryClient.invalidateQueries({ queryKey: ["linkedin-managed-campaigns"] });
    },
    onError: (err) => toastUnhandledApiError(err, "save that correction"),
  });

  const startEdit = (field: string, current: string | string[]) => {
    const spec = specFor(field);
    if (!spec) return;
    setEditing({
      spec,
      value: typeof current === "string" ? current : "",
      list: Array.isArray(current) ? current : [],
    });
  };

  const submitEdit = () => {
    if (!editing) return;
    const { spec } = editing;
    if (spec.shape === "list") {
      correct.mutate([{ field: spec.field, toList: editing.list }]);
      return;
    }
    const value = editing.value.trim();
    // The server refuses a blank scalar, and it is right to — but bouncing off
    // a 400 to learn that is a worse experience than not offering it.
    if (!value) {
      toast.error("Give us something to go on, or cancel.");
      return;
    }
    correct.mutate([{ field: spec.field, to: value }]);
  };

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
  if (isError) {
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
                disabled={refresh.isPending}
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

          {/* ★CONFLICTS ARE ALWAYS VISIBLE, collapsed or not. They are the most
              interesting thing the engine found and the thing a user is most
              able to settle in one sentence. */}
          {conflicts.length > 0 && (
            <div className="mt-3 space-y-2">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.field}
                  className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-sm"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
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
                      ? () =>
                          startEdit(
                            "classification.industry",
                            profile.classification.industry?.value ?? "",
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
                      ? () =>
                          startEdit(
                            "classification.subIndustry",
                            profile.classification.subIndustry?.value ?? "",
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
                      ? () =>
                          startEdit(
                            "classification.marketType",
                            profile.classification.marketType?.value ?? "",
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
                      ? () =>
                          startEdit(
                            "classification.lifecycleStage",
                            profile.classification.lifecycleStage?.value ?? "",
                          )
                      : undefined
                  }
                />
                <ClaimRow
                  label={FIELD_LABEL["classification.regionalPresence"]!}
                  value={profile.classification.regionalPresence?.map((r) => r.value).join(", ")}
                  sources={profile.classification.regionalPresence?.[0]?.sources}
                  onEdit={
                    specFor("classification.regionalPresence")
                      ? () =>
                          startEdit(
                            "classification.regionalPresence",
                            profile.classification.regionalPresence?.map((r) => r.value).join(", ") ??
                              "",
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
              onEdit={() => startEdit("icp", profile.icp.map((i) => i.label))}
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
              onEdit={() =>
                startEdit("decisionMakers", profile.decisionMakers.map((d) => d.titleFamily))
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
              onEdit={() => startEdit("painPoints", profile.painPoints.map((p) => p.statement))}
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
              onEdit={() => startEdit("personas", profile.personas.map((p) => p.label))}
            />

            <p className="text-xs text-muted-foreground">
              Version {profile.profileVersion}
              {profile.corrections.length > 0 &&
                ` · ${profile.corrections.length} correction${profile.corrections.length === 1 ? "" : "s"} from you`}
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {editing && (
        <CardContent className="border-t pt-4">
          <CorrectionEditor
            editing={editing}
            setEditing={setEditing}
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
  onEdit: () => void;
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
            onClick={onEdit}
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
          {items.map((item) => (
            <li key={`${field}:${item.key}`} className="flex flex-wrap items-center gap-2 text-sm">
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
  onSubmit,
  pending,
}: {
  editing: NonNullable<Editing>;
  setEditing: (e: Editing) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const { spec, value, list } = editing;
  const [draft, setDraft] = useState("");
  const label = FIELD_LABEL[spec.field] ?? spec.field;
  const atItemCap = spec.maxItems !== undefined && list.length >= spec.maxItems;
  const draftTooLong = draft.trim().length > spec.maxLength;

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
        <Label className="text-sm font-medium">Correct: {label}</Label>
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)} aria-label="Cancel">
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
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Add — up to ${spec.maxLength} characters`}
                rows={2}
                className="text-sm"
              />
            ) : (
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
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
          <p className="text-xs text-muted-foreground">
            {draftTooLong
              ? `Too long — keep each one under ${spec.maxLength} characters.`
              : atItemCap
                ? `That's the maximum of ${spec.maxItems}.`
                : // The clear case, said plainly: an empty list is a real answer,
                  // not a way of cancelling.
                  "Remove everything and save to tell us none of these apply."}
          </p>
        </div>
      ) : spec.values ? (
        <Select
          value={value}
          onValueChange={(v) => setEditing({ ...editing, value: v })}
        >
          <SelectTrigger>
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
            value={value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            placeholder={
              spec.csv === "iso2" ? "Two-letter country codes, e.g. IN, SG, AE" : "Your answer"
            }
            aria-invalid={value.trim().length > spec.maxLength}
          />
          {spec.csv === "iso2" && (
            <p className="text-xs text-muted-foreground">
              Country codes only{spec.maxCount ? `, up to ${spec.maxCount}` : ""} — this is what we
              target, so it decides where your budget goes.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setEditing(null)} disabled={pending}>
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={
            pending ||
            (spec.shape === "scalar" &&
              (!value.trim() || value.trim().length > spec.maxLength))
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
