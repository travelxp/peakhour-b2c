"use client";

/**
 * "Also post this to Google" — the Local Post panel inside the scheduler.
 *
 * ★★THE POINT OF S5·4 IS THE WORD "ALSO". A promotion goes to social and to the
 * merchant's Google listing in ONE action, from the composer they were already
 * in, rather than as a second errand on a different screen. So this is an
 * add-on to the existing schedule step, not a channel picker of its own.
 *
 * ★★AND IT IS OFF BY DEFAULT, WHICH IS NOT A UI PREFERENCE. Everything else
 * this composer schedules is a post in a feed. This one lands on the merchant's
 * Maps and Search listing — the page their CUSTOMERS read, and for many local
 * businesses the most-seen thing they own. A toggle that started on would mean
 * somebody's first scheduled tweet also went to their storefront because they
 * did not read a checkbox.
 *
 * ★THE BODY IS SEPARATE FROM THE SOCIAL POST'S. It is seeded from it, because
 * that is nearly always what the merchant wants and retyping is the fastest way
 * to make the feature unused — but a listing post is read by someone deciding
 * where to go now, and a hashtag-heavy caption is wrong there. Editing it here
 * changes nothing about the social channels.
 *
 * Validation mirrors `lib/local-post.ts`, which mirrors the api's rules. What
 * the panel adds is WHERE the message goes: under the field it is about, while
 * the merchant can still fix it. A refusal on the api side is terminal.
 */

import { useId } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  LISTING_ACTION_TYPES,
  LISTING_ACTION_WITHOUT_URL,
  LISTING_SUMMARY_MAX,
  LISTING_TOPIC_TYPES,
  listingProblems,
  type ListingActionType,
  type ListingDraft,
  type ListingField,
  type ListingTopicType,
} from "@/lib/local-post";

export interface LocalPostOptionsProps {
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  draft: ListingDraft;
  onDraftChange: (next: ListingDraft) => void;
  /** Shown instead of the form when the merchant has no location picked. */
  locationMissing?: boolean;
  className?: string;
}

export function LocalPostOptions({
  enabled,
  onEnabledChange,
  draft,
  onDraftChange,
  locationMissing,
  className,
}: LocalPostOptionsProps) {
  const id = useId();
  // ★PROBLEMS ARE COMPUTED ONLY WHEN THE PANEL IS ON. An off panel with an
  // incomplete draft is not an error state — it is a merchant who is not using
  // the feature, and lighting their screen red for it would be absurd.
  const problems = enabled ? listingProblems(draft) : [];
  const problemFor = (field: ListingField) => problems.find((p) => p.field === field)?.message;

  const set = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) =>
    onDraftChange({ ...draft, [key]: value });

  const needsWindow = draft.topicType === "EVENT" || draft.topicType === "OFFER";
  const windowNoun = draft.topicType === "OFFER" ? "Offer" : "Event";
  const summaryLength = draft.summary.trim().length;

  return (
    <div className={cn("rounded-lg border bg-background", className)}>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="space-y-0.5">
          <Label htmlFor={`${id}-toggle`} className="text-sm font-medium">
            Also post this to Google
          </Label>
          <p className="text-xs text-muted-foreground">
            Puts an update on your Business Profile, where people find you on Maps and Search.
          </p>
        </div>
        <Switch
          id={`${id}-toggle`}
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={locationMissing}
          aria-describedby={locationMissing ? `${id}-nolocation` : undefined}
        />
      </div>

      {/* ★A MISSING LOCATION IS NOT AN ERROR, IT IS AN UNFINISHED SETUP, and the
          publisher refuses it by name rather than guessing. Saying so here —
          with the place to fix it — beats a toggle that turns on and then fails
          tomorrow. */}
      {locationMissing && (
        <p id={`${id}-nolocation`} className="border-t px-3 py-2 text-xs text-muted-foreground">
          Pick which of your locations to post to on the{" "}
          <Link className="underline" href="/dashboard/integrations">
            Business Profile integration
          </Link>{" "}
          first.
        </p>
      )}

      {enabled && !locationMissing && (
        <div className="space-y-3 border-t p-3">
          {/* Topic type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Post type</Label>
            <div className="flex flex-wrap gap-1.5">
              {LISTING_TOPIC_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set("topicType", t.value as ListingTopicType)}
                  aria-pressed={draft.topicType === t.value}
                  title={t.blurb}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    draft.topicType === t.value
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <Field label="Post text" error={problemFor("summary")} htmlFor={`${id}-summary`}>
            <Textarea
              id={`${id}-summary`}
              value={draft.summary}
              onChange={(e) => set("summary", e.target.value)}
              rows={3}
              className="text-sm"
            />
            {/* ★THE COUNTER IS ALWAYS VISIBLE, not just once it is exceeded —
                the cap is the ceiling, and Google hides everything past roughly
                the first couple of sentences behind a "More" link anyway. */}
            <p
              className={cn(
                "mt-1 text-right text-[11px] tabular-nums",
                summaryLength > LISTING_SUMMARY_MAX
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {summaryLength} / {LISTING_SUMMARY_MAX}
            </p>
          </Field>

          {needsWindow && (
            <>
              <Field
                label={`${windowNoun} title`}
                error={problemFor("eventTitle")}
                htmlFor={`${id}-evt-title`}
              >
                <Input
                  id={`${id}-evt-title`}
                  value={draft.eventTitle}
                  onChange={(e) => set("eventTitle", e.target.value)}
                  className="text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Starts" error={problemFor("eventStartDate")} htmlFor={`${id}-evt-from`}>
                  <Input
                    id={`${id}-evt-from`}
                    type="date"
                    value={draft.eventStartDate}
                    onChange={(e) => set("eventStartDate", e.target.value)}
                    className="text-sm"
                  />
                </Field>
                <Field
                  label="Ends (optional)"
                  error={problemFor("eventEndDate")}
                  htmlFor={`${id}-evt-to`}
                >
                  <Input
                    id={`${id}-evt-to`}
                    type="date"
                    value={draft.eventEndDate}
                    onChange={(e) => set("eventEndDate", e.target.value)}
                    className="text-sm"
                  />
                </Field>
              </div>
            </>
          )}

          {draft.topicType === "OFFER" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Coupon code (optional)" htmlFor={`${id}-coupon`}>
                <Input
                  id={`${id}-coupon`}
                  value={draft.couponCode}
                  onChange={(e) => set("couponCode", e.target.value)}
                  className="text-sm"
                />
              </Field>
              <Field
                label="Redeem online (optional)"
                error={problemFor("redeemOnlineUrl")}
                htmlFor={`${id}-redeem`}
              >
                <Input
                  id={`${id}-redeem`}
                  value={draft.redeemOnlineUrl}
                  onChange={(e) => set("redeemOnlineUrl", e.target.value)}
                  placeholder="https://"
                  className="text-sm"
                />
              </Field>
            </div>
          )}

          {/* Call to action */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Button (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => set("actionType", "")}
                aria-pressed={draft.actionType === ""}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  draft.actionType === ""
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                None
              </button>
              {LISTING_ACTION_TYPES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => set("actionType", a.value as ListingActionType)}
                  aria-pressed={draft.actionType === a.value}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    draft.actionType === a.value
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
            {problemFor("actionType") && <ErrorLine>{problemFor("actionType")}</ErrorLine>}
          </div>

          {/* ★THE LINK FIELD DISAPPEARS FOR "Call", because the listing's own
              phone number is the target and there is nothing to supply. The
              rules still report a stale value rather than dropping it — the
              merchant may have typed one and then switched. */}
          {draft.actionType && draft.actionType !== LISTING_ACTION_WITHOUT_URL && (
            <Field label="Button link" error={problemFor("actionUrl")} htmlFor={`${id}-cta`}>
              <Input
                id={`${id}-cta`}
                value={draft.actionUrl}
                onChange={(e) => set("actionUrl", e.target.value)}
                placeholder="https://"
                className="text-sm"
              />
            </Field>
          )}
          {draft.actionType === LISTING_ACTION_WITHOUT_URL && problemFor("actionUrl") && (
            <ErrorLine>{problemFor("actionUrl")}</ErrorLine>
          )}

          {problemFor("media") && <ErrorLine>{problemFor("media")}</ErrorLine>}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string | undefined;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[11px] text-destructive">
      <AlertCircle className="mt-px size-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
