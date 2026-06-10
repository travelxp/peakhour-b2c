"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { updateProfile, type UserPreferences } from "@/lib/auth";
import { useLocale } from "@/hooks/use-locale";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Globe, CalendarDays, Check } from "lucide-react";

const DATE_FORMAT_OPTIONS = [
  { value: "__browser__", label: "Browser default" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2026)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-12-31)" },
  { value: "DD-MM-YY ddd", label: "DD-MM-YY ddd (31-12-26 Wed)" },
] as const;

const NUMBER_FORMAT_OPTIONS = [
  { value: "__browser__", label: "Browser default" },
  { value: "en-US", label: "1,234.56 (US)" },
  { value: "en-IN", label: "1,23,456.78 (India)" },
  { value: "en-GB", label: "1,234.56 (UK)" },
  { value: "de-DE", label: "1.234,56 (Germany)" },
  { value: "fr-FR", label: "1 234,56 (France)" },
] as const;

export default function PreferencesPage() {
  const { user, refreshUser } = useAuth();
  const { formatDate } = useLocale();
  const prefs = user?.preferences;
  const [saving, setSaving] = useState(false);
  const [dateFormat, setDateFormat] = useState(prefs?.dateFormat || "__browser__");
  const [numberFormat, setNumberFormat] = useState(prefs?.numberFormat || "__browser__");
  const [timezone, setTimezone] = useState(prefs?.timezone || "");

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Dubai"];
    }
  }, []);

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hasChanges =
    (dateFormat === "__browser__" ? undefined : dateFormat) !== prefs?.dateFormat ||
    (numberFormat === "__browser__" ? undefined : numberFormat) !== prefs?.numberFormat ||
    (timezone || undefined) !== prefs?.timezone;

  async function handleSave() {
    if (!user?.name) return;
    setSaving(true);
    try {
      await updateProfile({
        name: user.name,
        preferences: {
          dateFormat: dateFormat === "__browser__" ? undefined : dateFormat as UserPreferences["dateFormat"],
          numberFormat: numberFormat === "__browser__" ? undefined : numberFormat as UserPreferences["numberFormat"],
          timezone: timezone || undefined,
        },
      });
      await refreshUser();
      toast.success("Preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  const previewDate = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Preferences</h2>
        <p className="text-muted-foreground mt-1">
          How dates, numbers, and currencies appear across the app
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>
                Customize formatting to match your locale
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 sm:grid-cols-2 sm:items-center">
            <div>
              <Label className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                Date format
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Preview: {formatDate(previewDate)}
              </p>
            </div>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMAT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid gap-2 sm:grid-cols-2 sm:items-center">
            <div>
              <Label>Timezone</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current: {browserTimezone}
              </p>
            </div>
            <Select value={timezone || browserTimezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}{tz === browserTimezone ? " (detected)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid gap-2 sm:grid-cols-2 sm:items-center">
            <div>
              <Label>Number format</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                How numbers and currency are displayed
              </p>
            </div>
            <Select value={numberFormat} onValueChange={setNumberFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUMBER_FORMAT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasChanges && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
                {saving ? "Saving..." : <><Check className="h-3.5 w-3.5" /> Save preferences</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
