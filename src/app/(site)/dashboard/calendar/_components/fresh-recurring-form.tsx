"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { TimeZoneCombobox } from "@/components/ui/time-zone-combobox";
import { ChannelIconCompact } from "@/components/brand/channel-icon";
import { RecurringScheduleEditor, type RecurringRuleInput } from "@/components/scheduler/recurring-schedule-editor";
import { ApiError } from "@/lib/api";
import { scheduler } from "@/lib/scheduler/client";
import { contentHubIntegrationsQuery } from "@/lib/nav-queries";
import { browserZone } from "@/lib/time-zones";
import { useAutoWrite } from "@/components/content/auto-write-card";
import {
  FRESH_COPY,
  TOPIC_MAX,
  buildFreshRuleBody,
  freshChannelOptions,
  freshPriceLine,
  freshRuleProblems,
  freshSetup,
  type FreshChannel,
  type FreshChannelOption,
  type FreshRuleDraft,
  type Setup,
} from "@/lib/fresh-recurring";

/**
 * The form for a recurring rule that WRITES A NEW POST EACH TIME (Content Wave 2, W2-D). The merchant gives what each post is about, the channels and the rhythm; Peakhour writes
 * the post about two days ahead as a draft in Needs your OK. The price per post is the api's, in Peaks, and the note says what must be switched on first (Automatic writing with a
 * monthly limit), with a link to that card. Nothing here posts anything.
 */

/** The pure view: everything it shows comes in as props. */
export function FreshRecurringFormView(p: {
  draft: FreshRuleDraft;
  onDraft: (next: FreshRuleDraft) => void;
  channels: FreshChannelOption[];
  setup: Setup;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const { draft } = p;
  const problems = freshRuleProblems(draft);
  const price = freshPriceLine(p.setup.pricePeaks);
  const toggle = (c: FreshChannel, on: boolean) => p.onDraft({ ...draft, channels: on ? [...draft.channels, c] : draft.channels.filter((x) => x !== c) });
  return (
    <Card data-testid="fresh-recurring-form">
      <CardContent className="space-y-4 p-4">
        <div>
          <h3 className="text-sm font-medium">{FRESH_COPY.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{FRESH_COPY.intro}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fresh-name">{FRESH_COPY.nameLabel}</Label>
          <Input id="fresh-name" value={draft.name} maxLength={256} placeholder={FRESH_COPY.namePlaceholder} onChange={(e) => p.onDraft({ ...draft, name: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fresh-topic">{FRESH_COPY.topicLabel}</Label>
          <Textarea id="fresh-topic" value={draft.topic} maxLength={TOPIC_MAX} placeholder={FRESH_COPY.topicPlaceholder} onChange={(e) => p.onDraft({ ...draft, topic: e.target.value })} />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{FRESH_COPY.channelsLabel}</legend>
          {p.channels.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="fresh-no-channels">
              {FRESH_COPY.noChannels}
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {p.channels.map((c) => (
                <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={draft.channels.includes(c.value)} onCheckedChange={(v) => toggle(c.value, v === true)} aria-label={c.label} />
                  <ChannelIconCompact channel={c.value} size={16} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{FRESH_COPY.channelsNote}</p>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="fresh-zone">{FRESH_COPY.zoneLabel}</Label>
          <TimeZoneCombobox id="fresh-zone" value={draft.rule.timezone} onChange={(z) => p.onDraft({ ...draft, rule: { ...draft.rule, timezone: z } })} />
        </div>

        <RecurringScheduleEditor value={draft.rule} onChange={(rule) => p.onDraft({ ...draft, rule })} freqs={["daily", "weekly", "monthly"]} />

        <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm" data-testid="fresh-setup">
          {price && <p data-testid="fresh-price">{price}</p>}
          {p.setup.text ? (
            <p className="text-warning-on-tint" data-testid="fresh-setup-note">
              {p.setup.text}{" "}
              <Link href={FRESH_COPY.autoWriteHref} className="underline underline-offset-2">
                {FRESH_COPY.autoWriteLink}
              </Link>
            </p>
          ) : (
            <p className="text-muted-foreground">
              Each new post waits in{" "}
              <Link href={FRESH_COPY.needsOkHref} className="underline underline-offset-2">
                {FRESH_COPY.needsOkLink}
              </Link>
              . Nothing is posted until you approve it.
            </p>
          )}
        </div>

        {problems.length > 0 && draft.name + draft.topic !== "" && (
          <ul className="list-disc pl-5 text-xs text-muted-foreground" data-testid="fresh-problems">
            {problems.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        {p.error && (
          <p role="alert" className="text-sm text-destructive" data-testid="fresh-error">
            {p.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={p.onCancel} disabled={p.busy}>
            {FRESH_COPY.cancel}
          </Button>
          <Button type="button" size="sm" onClick={p.onSubmit} disabled={p.busy || problems.length > 0} data-testid="fresh-submit">
            {p.busy ? FRESH_COPY.creating : FRESH_COPY.create}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function startingRule(): RecurringRuleInput {
  return { freq: "weekly", interval: 1, weekdays: [2], localTime: "09:00", timezone: browserZone() ?? "UTC", effectiveFrom: new Date().toISOString() };
}

/** The container: reads the connections and the automatic-writing status, and creates the rule. */
export function FreshRecurringForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const integrations = useQuery(contentHubIntegrationsQuery);
  const autoWrite = useAutoWrite();
  const [picked, setPicked] = useState<FreshRuleDraft>(() => ({ name: "", topic: "", channels: [], rule: startingRule() }));
  const options = freshChannelOptions(integrations.data?.integrations);
  // A ticked channel that is no longer connected (the list refetched) is not sent: only channels still offered count.
  const draft: FreshRuleDraft = { ...picked, channels: picked.channels.filter((c) => options.some((o) => o.value === c)) };
  const create = useMutation({
    mutationFn: () => scheduler.createRecurringRule(buildFreshRuleBody(draft)),
    onSuccess: () => {
      toast.success(FRESH_COPY.created);
      void queryClient.invalidateQueries({ queryKey: ["scheduler:recurring-rules"] });
      onDone();
    },
  });
  return (
    <FreshRecurringFormView
      draft={draft}
      onDraft={(next) => {
        // the error was about the entries as they were: an edit clears it
        if (create.isError) create.reset();
        setPicked(next);
      }}
      channels={options}
      setup={freshSetup(autoWrite.data)}
      busy={create.isPending}
      error={create.isError ? (create.error instanceof ApiError && create.error.message ? create.error.message : FRESH_COPY.failed) : null}
      onSubmit={() => create.mutate()}
      onCancel={onDone}
    />
  );
}
