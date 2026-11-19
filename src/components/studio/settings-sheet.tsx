"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSaveStudioSettings, useStudioAbilities } from "@/hooks/use-studio-flow";
import { useStudioAvailability } from "@/hooks/use-studio";
import { useWaConnection } from "@/hooks/use-wa-conversations";
import type { StudioSettings } from "@/lib/api/creative";
import type { SettingsPatch } from "@/lib/api/creative-studio";
import { formatPeaks } from "@/lib/pricing";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { parseCap } from "@/lib/studio-publish";
import { cn } from "@/lib/utils";

const T = STUDIO_COPY.settings;

function Row({ id, label, hint, checked, disabled, onChange, children }: { id: string; label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
          {hint && (
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">
              {hint}
            </p>
          )}
        </div>
        {/* A 44 px target around the small switch. */}
        <span className="flex size-11 shrink-0 items-center justify-center">
          <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} aria-describedby={hint ? `${id}-hint` : undefined} />
        </span>
      </div>
      {children}
    </div>
  );
}

export interface SettingsViewProps {
  settings: StudioSettings;
  proTools: boolean;
  /** undefined while it is being read. */
  whatsappConnected: boolean | undefined;
  /** An editor changes settings; a viewer reads them. */
  canChange: boolean;
  saving: boolean;
  onPatch: (patch: SettingsPatch) => void;
}

/**
 * The Studio settings (UX spec S19): No AI people, the monthly Studio limit (with what is used so far), Pro tools, the WhatsApp and reminder
 * switches, and Scheduled drafts as "Coming soon". Every change saves on the spot.
 */
export function SettingsView({ settings, proTools, whatsappConnected, canChange, saving, onPatch }: SettingsViewProps) {
  const cap = settings.monthlyCapPeaks;
  // "No limit" is a switch; turning it off asks for a number. The number is held here until it is valid and saved.
  const [setting, setSetting] = useState(false);
  const [text, setText] = useState(cap === null ? "" : String(cap));
  const [problem, setProblem] = useState<"invalid" | "too_big" | null>(null);
  const showInput = cap !== null || setting;
  const off = !canChange || saving;
  const saveCap = () => {
    const r = parseCap(text);
    if (!r.ok) {
      setProblem(r.reason);
      return;
    }
    setProblem(null);
    setSetting(false);
    onPatch({ monthlyCapPeaks: r.value });
  };
  return (
    <div className="space-y-5 overflow-y-auto" data-slot="studio-settings">
      {!canChange && <p className="text-sm text-muted-foreground">{T.viewer}</p>}

      <Row id="studio-set-noai" label={T.noAiPeople.label} hint={T.noAiPeople.hint} checked={settings.noAiPeople} disabled={off} onChange={(on) => onPatch({ noAiPeople: on })} />

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-medium">{T.cap.label}</h3>
          <p className="text-xs text-muted-foreground">{T.cap.hint}</p>
        </div>
        <Row
          id="studio-set-nolimit"
          label={T.cap.noLimit}
          checked={!showInput}
          disabled={off}
          onChange={(none) => {
            setProblem(null);
            if (none) {
              setSetting(false);
              setText("");
              if (cap !== null) onPatch({ monthlyCapPeaks: null });
            } else {
              setSetting(true);
            }
          }}
        />
        {showInput && (
          <div className="space-y-1">
            <Label htmlFor="studio-set-cap" className="text-xs">
              {T.cap.input}
            </Label>
            <div className="flex gap-2">
              <Input
                id="studio-set-cap"
                inputMode="numeric"
                autoComplete="off"
                value={text}
                disabled={off}
                aria-invalid={problem !== null}
                aria-describedby={problem ? "studio-set-cap-problem" : undefined}
                onChange={(e) => {
                  setText(e.target.value);
                  setProblem(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCap();
                }}
                className="h-11"
              />
              <Button type="button" className="h-11" disabled={off} onClick={saveCap}>
                {T.cap.save}
              </Button>
            </div>
            {problem && (
              <p id="studio-set-cap-problem" role="alert" className="text-xs text-destructive">
                {problem === "too_big" ? T.cap.tooBig : T.cap.invalid}
              </p>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {cap === null ? T.cap.usedNoLimit(formatPeaks(settings.usedThisMonthPeaks)) : T.cap.used(formatPeaks(settings.usedThisMonthPeaks), formatPeaks(cap))}
        </p>
      </div>

      <Row id="studio-set-pro" label={T.proTools.label} hint={T.proTools.hint} checked={proTools} disabled={off} onChange={(on) => onPatch({ proTools: on })} />

      <Row
        id="studio-set-wa"
        label={T.whatsapp.label}
        checked={settings.whatsappUpdates}
        disabled={off || (whatsappConnected !== true && !settings.whatsappUpdates)}
        onChange={(on) => onPatch({ whatsappUpdates: on })}
      >
        {whatsappConnected === false && (
          <Link href="/dashboard/settings/whatsapp" className="text-xs font-medium underline underline-offset-2">
            {T.whatsapp.connect}
          </Link>
        )}
      </Row>

      <Row id="studio-set-remind" label={T.remind.label} hint={T.remind.hint} checked={settings.remindShortlist} disabled={off} onChange={(on) => onPatch({ remindShortlist: on })} />

      <div className="flex items-center justify-between gap-3 opacity-80">
        <p className="text-sm font-medium">{T.scheduled.label}</p>
        <Badge variant="secondary">{T.scheduled.soon}</Badge>
      </div>
    </div>
  );
}

/**
 * The gear in the Studio header and its sheet. Editors and above only (a viewer cannot change settings, so the gear is not offered). Each change
 * saves at once and the answer is written back into the availability read, so every Studio screen follows.
 */
export function StudioSettingsButton({ className }: { className?: string }) {
  const { canMake } = useStudioAbilities();
  const availability = useStudioAvailability();
  const wa = useWaConnection(canMake);
  const save = useSaveStudioSettings();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  if (!canMake) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" className={cn("h-11 gap-1.5 px-3", className)}>
          <Settings aria-hidden="true" className="size-4" />
          {T.open}
        </Button>
      </SheetTrigger>
      <SheetContent side={mobile ? "bottom" : "right"} className={cn("gap-3 p-4", mobile ? "max-h-[92dvh]" : "sm:max-w-md")}>
        <SheetHeader className="p-0 text-start">
          <SheetTitle>{T.title}</SheetTitle>
          <SheetDescription>{T.description}</SheetDescription>
        </SheetHeader>
        {availability.loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            {T.loading}
          </p>
        ) : (
          <SettingsView
            // A key that follows the saved limit so the typed number and the switch start again from what the api holds.
            key={availability.settings.monthlyCapPeaks ?? "none"}
            settings={availability.settings}
            proTools={availability.proTools}
            whatsappConnected={wa.isSuccess ? wa.data.connected : wa.isError ? false : undefined}
            canChange={canMake}
            saving={save.isPending}
            onPatch={(patch) => save.mutate(patch, { onError: () => toast.error(T.saveFailed) })}
          />
        )}
        <div className="pb-[env(safe-area-inset-bottom)]">
          <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setOpen(false)}>
            {T.close}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
