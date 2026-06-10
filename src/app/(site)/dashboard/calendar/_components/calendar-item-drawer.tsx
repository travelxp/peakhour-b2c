"use client";

/**
 * Per-item drawer for /dashboard/calendar. Opens when the user clicks
 * a chip in CalendarView. Shows:
 *   - Title row: channel icon + display name + status badge
 *   - When + where badge (resolved local time + audience timezone)
 *   - Payload preview (text snippet, hashtags, media count)
 *   - Smart-time audit (which tier picked the time + conflicts)
 *   - Attempts log (per-attempt outcome + errorCode + retry timeline)
 *   - Action buttons (cancel + refresh-stale)
 *
 * Stateless presentational; parent owns the mutations.
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Image,
  RotateCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChannelIconCompact } from "@/components/ui/channel-icon";
import { cn } from "@/lib/utils";
import {
  channelDisplayName,
  formatRelative,
  formatScheduleLabel,
  formatTimeLabel,
  statusTone,
} from "@/lib/scheduler/format";
import type { ScheduledItemDto } from "@/lib/scheduler/types";

const STATUS_ICON = {
  published: CheckCircle2,
  queued: Clock,
  awaiting_retry: RotateCw,
  ready: Clock,
  in_flight: RotateCw,
  failed: XCircle,
  cancelled: XCircle,
  skipped: XCircle,
  needs_action: AlertTriangle,
} as const;

export interface CalendarItemDrawerProps {
  item: ScheduledItemDto;
  onCancel?: () => void;
  /** Reserved for the next-PR source-hash sync. Currently unused —
   *  the refresh button is disabled until the live source-hash fetch
   *  lands. Keeping the prop on the public shape so the parent can
   *  wire it once the API is ready. */
  onRefreshStale?: (newSourceTextHash: string) => void;
}

function ToneBadge({
  tone,
  children,
}: {
  tone: ReturnType<typeof statusTone>;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        tone === "success" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        tone === "info" &&
          "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
        tone === "warn" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        tone === "error" &&
          "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function CalendarItemDrawer({
  item,
  onCancel,
  // Currently unused — see prop JSDoc. Will be wired with the source-
  // hash sync API in a follow-up.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRefreshStale,
}: CalendarItemDrawerProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const Icon = STATUS_ICON[item.status] ?? Clock;
  const tone = statusTone(item.status);
  const attemptCount = item.attempts?.length ?? 0;
  const isTerminal =
    item.status === "published" ||
    item.status === "failed" ||
    item.status === "cancelled" ||
    item.status === "skipped";

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Title row */}
      <div className="flex items-start gap-3">
        <ChannelIconCompact channel={item.channel} size={20} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {channelDisplayName(item.channel)}
            <ToneBadge tone={tone}>
              <Icon className="h-3 w-3" />
              {item.status.replaceAll("_", " ")}
            </ToneBadge>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatScheduleLabel(item.scheduledAtUtc, item.audienceTimezone)} ·{" "}
            {formatRelative(item.scheduledAtUtc)}
          </div>
        </div>
      </div>

      {/* Stale / needs_action banner */}
      {(item.payloadStale || item.status === "needs_action") && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            {item.payloadStale ? (
              <>
                <div className="font-medium">Snapshot is stale</div>
                <p className="mt-0.5">
                  The source content was edited after this was scheduled. The
                  cron is holding the publish until you refresh.
                </p>
              </>
            ) : (
              <>
                <div className="font-medium">Needs your attention</div>
                <p className="mt-0.5">
                  The publish was paused —{" "}
                  {item.attempts?.at(-1)?.errorMessage ??
                    "check the most recent attempt for details"}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* Payload preview */}
      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">
          Content snapshot
        </div>
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="whitespace-pre-wrap wrap-break-word text-foreground">
            {item.payload.text.length > 400
              ? `${item.payload.text.slice(0, 400)}…`
              : item.payload.text}
          </p>
          {item.payload.hashtags && item.payload.hashtags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.payload.hashtags.map((h) => (
                <span
                  key={h}
                  className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  #{h}
                </span>
              ))}
            </div>
          )}
          {item.payload.mediaUrls && item.payload.mediaUrls.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image className="h-3 w-3" />
              {item.payload.mediaUrls.length} attachment
              {item.payload.mediaUrls.length === 1 ? "" : "s"}
            </div>
          )}
          {item.payload.threadParts && item.payload.threadParts.length > 0 && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              Thread · {item.payload.threadParts.length} part
              {item.payload.threadParts.length === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </div>

      {/* Smart-time audit */}
      {item.smartTime && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Smart-time engine
          </div>
          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
            <div>
              Tier:{" "}
              <code className="rounded bg-muted px-1">{item.smartTime.tier}</code>{" "}
              · Adapter{" "}
              <code className="rounded bg-muted px-1">
                {item.smartTime.adapterVersion}
              </code>{" "}
              · Engine{" "}
              <code className="rounded bg-muted px-1">
                {item.smartTime.engineVersion}
              </code>
            </div>
            {item.smartTime.conflictsResolved &&
              item.smartTime.conflictsResolved.length > 0 && (
                <div className="mt-1.5">
                  <div className="font-medium">Adjustments</div>
                  <ul className="ml-3 list-disc">
                    {item.smartTime.conflictsResolved.map((c) => (
                      <li key={c}>{c.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Attempt log */}
      {attemptCount > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Attempt log ({attemptCount})
          </div>
          <ol className="space-y-1.5">
            {(item.attempts ?? []).map((a, idx) => (
              <li
                key={`${a.startedAt}-${idx}`}
                className={cn(
                  "rounded-md border p-2 text-xs",
                  a.outcome === "success" && "border-emerald-200 bg-emerald-50/50",
                  a.outcome === "transient_error" &&
                    "border-sky-200 bg-sky-50/50",
                  a.outcome === "rate_limited" &&
                    "border-amber-200 bg-amber-50/50",
                  a.outcome === "permanent_error" &&
                    "border-rose-200 bg-rose-50/50",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium capitalize">
                    {a.outcome.replaceAll("_", " ")}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatTimeLabel(a.startedAt, item.audienceTimezone)} ·{" "}
                    {a.durationMs}ms
                  </span>
                </div>
                {a.errorCode && (
                  <div className="mt-0.5 text-muted-foreground">
                    <code className="rounded bg-background px-1">{a.errorCode}</code>
                  </div>
                )}
                {a.errorMessage && (
                  <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                    {a.errorMessage}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* External link */}
      {item.externalUrl && (
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View on {channelDisplayName(item.channel)}
        </a>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {item.payloadStale && (
          // The "Refresh snapshot" button needs to fetch the live
          // source content's hash from the source collection (the
          // server treats markStale as a no-op when the new hash
          // matches the existing one). That source-fetch API isn't
          // wired in this PR, so the button shows as disabled with a
          // tooltip-style label. The /stale path on the API stays
          // gated to the plan owner anyway, so leaving it disabled
          // also avoids the cross-user grief vector.
          <Button
            size="sm"
            variant="outline"
            disabled
            title="Source-content sync ships next — for now, recompose the post to refresh"
            onClick={() => undefined}
          >
            Refresh snapshot
          </Button>
        )}
        {!isTerminal && onCancel && (
          <>
            {!confirmCancel ? (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmCancel(true)}
              >
                Cancel publish
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    onCancel();
                    setConfirmCancel(false);
                  }}
                >
                  Confirm cancel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmCancel(false)}
                >
                  Keep it
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Item metadata footer */}
      <div className="border-t pt-3 text-[10px] text-muted-foreground">
        <div>Item id · {item._id}</div>
        <div>Plan id · {item.planId}</div>
        {item.externalId && <div>External id · {item.externalId}</div>}
      </div>
    </div>
  );
}
