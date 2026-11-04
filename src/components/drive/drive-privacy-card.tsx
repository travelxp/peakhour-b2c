"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { getDrivePrivacy, setDrivePrivacy } from "@/lib/api/media";

/**
 * Settings: "Don't send private files to AI" (Drive row D5b). ON means Peakhour reads no Private file, so none is named or described
 * and none leaves your Drive for a model. OFF (the default) means Peakhour may read a Private file to name and describe it, sending it to
 * one named model provider and no other. Published files are described either way.
 *
 * An admin changes it; everyone else sees the state and why they cannot change it. The switch never moves ahead of the server: it shows
 * what is saved, and a refusal leaves it where it was with a sentence.
 */
export function DrivePrivacyView({ on, canChange, busy, error, onChange }: { on: boolean; canChange: boolean; busy: boolean; error: string | null; onChange: (next: boolean) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Drive privacy</CardTitle>
        <CardDescription>Private files open only with a link that expires. This says whether Peakhour may also read them to name and describe them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <label htmlFor="drive-no-ai" className="cursor-pointer">
            <span className="block text-sm font-medium">Don&apos;t send private files to AI</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {on ? "On. No private file is read by AI. Published files are still named and described." : "Off. A private file may be sent to one AI provider to name and describe it."}
            </span>
          </label>
          <Switch id="drive-no-ai" checked={on} disabled={!canChange || busy} onCheckedChange={onChange} aria-label="Don't send private files to AI" />
        </div>
        {!canChange && <p className="text-xs text-muted-foreground">Only an admin can change this.</p>}
        {error && (
          <p role="alert" className="text-xs text-destructive-on-tint">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function DrivePrivacyCard({ canChange }: { canChange: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["drive", "privacy"], queryFn: getDrivePrivacy, staleTime: 60_000 });
  const save = useMutation({
    mutationFn: (next: boolean) => setDrivePrivacy(next),
    onSuccess: (r) => {
      qc.setQueryData(["drive", "privacy"], r);
      toast.success(r.dontSendPrivateFilesToAi ? "Private files will not be sent to AI." : "Private files may be sent to AI to be named and described.");
    },
  });
  // The setting is secondary to Settings: until it has loaded (or if it cannot) the card is simply not there.
  if (!q.data) return null;
  return (
    <DrivePrivacyView
      on={q.data.dontSendPrivateFilesToAi}
      canChange={canChange}
      busy={save.isPending}
      error={save.isError ? (save.error instanceof Error && save.error.message ? save.error.message : "That could not be saved. Nothing was changed.") : null}
      onChange={(next) => save.mutate(next)}
    />
  );
}
