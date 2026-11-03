"use client";

import { useState } from "react";
import { PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDeskSettings, useSetAiPause } from "@/hooks/use-inbox-desk";
import { actionError } from "@/lib/inbox-customer";
import { canPauseAssistant, createFlightGuard, type AiPauseCopy } from "@/lib/inbox-desk";

/**
 * Pausing the assistant for shoppers (I3a): one switch for the whole business, in the Inbox and in Autopilot beside the "Shopper chat" dial.
 *
 * ★THE WORDS ARE THE API'S (`aiPauseCopy` from `GET /v1/inbox-desk/settings`), shown as sent, so the Inbox, Autopilot and the Shopify
 * app cannot say different things. The difference from the emergency stop is in that copy and is always on screen next to the switch.
 * Only an owner or admin has the switch: it changes how every shopper is served. Everyone else reads the state.
 */
export function AiPauseView({
  copy,
  paused,
  canToggle,
  busy,
  onToggle,
  variant,
}: {
  copy: AiPauseCopy;
  paused: boolean;
  canToggle: boolean;
  busy: boolean;
  onToggle: (paused: boolean) => void;
  variant: "inbox" | "card";
}) {
  const stateLine = paused ? copy.on : copy.off;
  if (variant === "inbox" && !paused && !canToggle) return null;

  return (
    <div
      role={paused ? "status" : undefined}
      data-testid="ai-pause"
      data-paused={paused ? "true" : "false"}
      className={`rounded-lg border p-3 text-sm ${paused ? "border-warning/40 bg-warning/10" : "bg-muted/30"} ${variant === "card" ? "mt-3" : "mb-3"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <PauseCircle className={`mt-0.5 size-4 shrink-0 ${paused ? "text-warning-on-tint" : "text-muted-foreground"}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">{copy.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{stateLine}</p>
          </div>
        </div>
        {canToggle &&
          (paused && variant === "inbox" ? (
            <Button size="sm" disabled={busy} onClick={() => onToggle(false)}>
              {busy ? "Resuming…" : "Resume the assistant"}
            </Button>
          ) : (
            <Switch checked={paused} disabled={busy} aria-label={copy.title} onCheckedChange={onToggle} />
          ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{copy.notEmergencyStop}</p>
    </div>
  );
}

export function AiPauseControl({ role, variant }: { role: string | null; variant: "inbox" | "card" }) {
  const settings = useDeskSettings();
  const setPause = useSetAiPause();
  const guard = useState(createFlightGuard)[0];
  const data = settings.data;
  // nothing is claimed until the server has answered: a switch drawn "off" before that could be a lie about a paused business
  if (!data) return null;
  return (
    <AiPauseView
      copy={data.aiPauseCopy}
      paused={data.settings.aiPaused}
      canToggle={canPauseAssistant(role)}
      busy={setPause.isPending}
      variant={variant}
      onToggle={(next) =>
        void guard.run(async () => {
          try {
            await setPause.mutateAsync(next);
            toast.success(next ? "Shopper assistant paused." : "Shopper assistant resumed.");
          } catch (e) {
            toast.error(actionError(e, next ? "Pausing the assistant" : "Resuming the assistant"));
          }
        })
      }
    />
  );
}
