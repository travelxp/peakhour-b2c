"use client";

import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNotificationTips, useSetNotificationTips } from "@/hooks/use-notification-tips";
import { TIPS_ALERTS_NOTE, TIPS_DESCRIPTION, TIPS_HINT, TIPS_LABEL, TIPS_READONLY_NOTE, TIPS_TITLE, canChangeTips } from "@/lib/notification-tips";

/**
 * Settings > Preferences: the weekly listings summary and tips (PE-14). Unlike the inbox emails beside it, this is the BUSINESS's setting, not a
 * person's: the switch moves the notifications engine's one helpful-class switch, and it is the same one the opt-out link in the summary email moves.
 * An owner or an admin sees a switch that saves at once (and snaps back if the save fails); anyone else sees where it stands and who can change it.
 * Nothing is drawn until the api has answered, so a switch never shows a guess.
 */
export function HelpfulEmailsCard({ role }: { role: string | null }) {
  const { data } = useNotificationTips();
  const save = useSetNotificationTips();
  if (!data) return null;
  // the api's word wins; the role is only what is known before it answers
  const mayChange = data.canChange && canChangeTips(role);

  function change(value: boolean) {
    if (save.isPending) return;
    save.mutate(value, { onError: () => toast.error("Couldn't save that. Try again in a moment.") });
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>{TIPS_TITLE}</CardTitle>
            <CardDescription>{TIPS_DESCRIPTION}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="helpful-emails">{TIPS_LABEL}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{TIPS_HINT}</p>
          </div>
          <Switch id="helpful-emails" checked={data.enabled} disabled={!mayChange || save.isPending} onCheckedChange={change} />
        </div>
        {!mayChange && <p className="text-xs text-muted-foreground">{TIPS_READONLY_NOTE}</p>}
        <p className="text-xs text-muted-foreground">{TIPS_ALERTS_NOTE}</p>
      </CardContent>
    </Card>
  );
}
