"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/providers/auth-provider";
import { updateProfile } from "@/lib/auth";
import { INBOX_ALERTS, INBOX_ALERTS_NOTE, alertSwitches, alertsPatch, canSeeInboxAlerts, type InboxAlertKey } from "@/lib/inbox-alerts";

/**
 * Settings > Preferences: which inbox alert emails you get (Inbox phase 1). Personal, like the rest of that page: the switches are
 * saved on YOUR profile, so a teammate's choice never changes yours. Shown to owners and admins only, because they are the only
 * people the emails go to. Each switch saves at once and reverts if the save fails.
 */
export function InboxAlertsCard({ role }: { role: string | null }) {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState<InboxAlertKey | null>(null);
  if (!canSeeInboxAlerts(role)) return null;
  const on = alertSwitches(user?.preferences?.inboxAlerts);

  async function change(key: InboxAlertKey, value: boolean) {
    if (saving) return;
    // a profile with no name cannot be saved (the api requires one): say so, rather than a switch that snaps back with no reason
    if (!user?.name) return void toast.error("Add your name to your profile first, then try again.");
    setSaving(key);
    try {
      await updateProfile({ name: user.name, preferences: { inboxAlerts: alertsPatch(user.preferences?.inboxAlerts, key, value) } });
    } catch {
      toast.error("Couldn't save that. Try again in a moment.");
      setSaving(null);
      return;
    }
    // saved. A refresh that fails only leaves the switch showing the old state until the next load: that is not "couldn't save".
    await refreshUser().catch(() => undefined);
    setSaving(null);
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Inbox emails</CardTitle>
            <CardDescription>Choose what we email you about your inbox</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {INBOX_ALERTS.map((a, i) => (
          <div key={a.key}>
            {i > 0 && <Separator className="mb-4" />}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor={`alert-${a.key}`}>{a.label}</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.hint}</p>
              </div>
              <Switch id={`alert-${a.key}`} checked={on[a.key]} disabled={saving !== null} onCheckedChange={(v) => change(a.key, v)} />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{INBOX_ALERTS_NOTE}</p>
      </CardContent>
    </Card>
  );
}
