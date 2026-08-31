"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContactRegister, MerchantContact } from "@/lib/api/control-plane";
import { browserTimeZone, quietHoursPatch } from "@/lib/control-plane";
import { useUpdatePreferences } from "@/hooks/use-control-plane";

/**
 * Locale, register and quiet hours — how one person wants to be spoken to.
 *
 * ── ★★NOT AN OWNER/ADMIN CONTROL, AND THAT IS THE WHOLE ARGUMENT ─────────
 *
 * Registering a number is an assertion about somebody else's identity, so it
 * needs the role that manages the team. **The language a person reads and the
 * hours they will not take a message are assertions about themselves**, and an
 * Admin is not better placed to answer either. The api takes the contact's own
 * action plus Owner/Admin for exactly that reason — 🚫an Owner/Admin-only rule
 * would mean an Editor could not set their own quiet hours, on the page whose
 * subject is who hears what and when.
 */

/** ★A FREE FIELD, NOT A LIST. `plt_merchant_contacts.locale` is a BCP-47-ish
 *  string capped at 32, the same type and bound the shopper plane uses — a
 *  control plane that offered a different set would need a translation layer
 *  between two of our own tables. These are a starting point, not the bound. */
const LOCALE_SUGGESTIONS = [
  { value: "en-IN", label: "English (India)" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "mr", label: "Marathi" },
  { value: "bn", label: "Bengali" },
  { value: "gu", label: "Gujarati" },
];

const NONE = "__none__";

export function PreferencesDialog({
  contact,
  open,
  onOpenChange,
}: {
  contact: MerchantContact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdatePreferences();

  const [locale, setLocale] = useState(contact.locale ?? NONE);
  const [register, setRegister] = useState<string>(contact.register ?? NONE);
  const [quietOn, setQuietOn] = useState(!!contact.quietHours);
  const [start, setStart] = useState(contact.quietHours?.start ?? "22:00");
  const [end, setEnd] = useState(contact.quietHours?.end ?? "07:00");
  // ★THE BROWSER'S ZONE AS A VISIBLE DEFAULT, not a silent one. The api
  //  deliberately does not default `tz`, because an Owner in Mumbai setting
  //  quiet hours for a teammate in London would otherwise set them in the wrong
  //  day — and pre-filling has the same failure mode unless the value is on
  //  screen where somebody can correct it.
  const [tz, setTz] = useState(contact.quietHours?.tz ?? browserTimeZone());
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);

    let quietHours: { start: string; end: string; tz: string } | null = null;
    if (quietOn) {
      const parsed = quietHoursPatch({ start, end, tz });
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      quietHours = parsed.value;
    }

    try {
      await update.mutateAsync({
        id: contact.id,
        // ★★`null` CLEARS, AND THAT IS A DIFFERENT REQUEST FROM OMITTING. The
        //  api splits them into `$set` and `$unset`, so every field is sent
        //  explicitly here — a dialog that omitted a field the person had just
        //  emptied would leave the old value in place and report success.
        patch: {
          locale: locale === NONE ? null : locale,
          register: register === NONE ? null : (register as ContactRegister),
          quietHours,
        },
      });
      toast.success("Saved.");
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save those settings.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How Peakhour writes to this number</DialogTitle>
          <DialogDescription>
            Language and register are inferred from how this person writes to
            us. Setting them here overrides that.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-locale">Language</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger id="cp-locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  Infer it from how they write
                </SelectItem>
                {LOCALE_SUGGESTIONS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cp-register">Register</Label>
            <Select value={register} onValueChange={setRegister}>
              <SelectTrigger id="cp-register">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Infer it from how they write</SelectItem>
                <SelectItem value="casual">A plainer register</SelectItem>
                <SelectItem value="formal">
                  Comfortable with technical detail
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-quiet">Quiet hours</Label>
              <Switch
                id="cp-quiet"
                checked={quietOn}
                onCheckedChange={setQuietOn}
              />
            </div>
            {quietOn && (
              <div className="grid gap-3 pt-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="cp-start" className="text-xs">
                    From
                  </Label>
                  <Input
                    id="cp-start"
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cp-end" className="text-xs">
                    Until
                  </Label>
                  <Input
                    id="cp-end"
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cp-tz" className="text-xs">
                    Time zone
                  </Label>
                  <Input
                    id="cp-tz"
                    value={tz}
                    onChange={(e) => setTz(e.target.value)}
                    placeholder="Asia/Kolkata"
                  />
                </div>
              </div>
            )}
            {quietOn && (
              <p className="text-xs text-muted-foreground">
                {/* ★★THE ZONE IS SPELLED OUT because the window means nothing
                    without it — the same two times are a different instruction
                    in Mumbai and in London. */}
                Peakhour will hold non-urgent messages until the window ends,
                in {tz || "the zone you set"}.
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={update.isPending}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
