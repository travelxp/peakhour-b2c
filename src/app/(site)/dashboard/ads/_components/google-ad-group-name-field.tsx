"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GoogleChannelType } from "@/lib/api/google-ads";
import { googleAdGroupNameProblem } from "@/lib/google-management-view";

/**
 * ★★G14c (RMF C.190) — the ad group's name on the create form. Search and
 * YouTube video (Demand Gen) campaigns have one ad group; Performance Max has
 * none, so the field is not shown for it (and the api refuses a name there).
 * Left empty, the ad group takes the campaign's name.
 */
export function GoogleAdGroupNameField({
  channelType,
  value,
  onChange,
  disabled,
}: {
  channelType: GoogleChannelType;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  if (channelType === "PERFORMANCE_MAX") return null;
  const problem = googleAdGroupNameProblem(value);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Ad group name (optional — the campaign&apos;s name if left empty)</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={255} disabled={disabled} />
      {problem ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
    </div>
  );
}
