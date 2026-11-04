"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HardDriveUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveToDrive, type SavedToDrive, type SaveToDriveSource } from "@/lib/api/media";
import { saveFailureText, savedText } from "@/lib/drive/copy";

/**
 * Save to Drive (D8): keep a file that is not in Drive yet, from an AI image, a composer draft's picture or an Inbox attachment. One
 * button, one call; the api decides what is safe to fetch and what Drive stores. An Inbox attachment is saved Private (the toast says
 * so); a file Drive already holds is not copied (the toast says that too).
 */
export function SaveToDriveButton({
  source,
  label = "Save to Drive",
  size = "xs",
  className,
  onSaved,
}: {
  source: SaveToDriveSource;
  label?: string;
  size?: "xs" | "sm";
  className?: string;
  onSaved?: (saved: SavedToDrive) => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await saveToDrive(source);
      toast.success(savedText(r));
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ["drive"] });
      void qc.invalidateQueries({ queryKey: ["storage-usage"] });
      onSaved?.(r);
    } catch (e) {
      toast.error(saveFailureText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" size={size} variant="outline" className={`gap-1.5 ${className ?? ""}`} disabled={busy || saved} onClick={() => void run()}>
      <HardDriveUpload aria-hidden className="size-3.5" />
      {busy ? "Saving…" : saved ? "Saved to Drive" : label}
    </Button>
  );
}
