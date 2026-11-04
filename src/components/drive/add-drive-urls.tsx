"use client";

import { Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrivePicker } from "@/components/drive/drive-picker";

/**
 * "Add from Drive" beside a box that takes one public https:// address per line (a Google ad's logos and images). It opens the Drive
 * picker and appends the chosen files' public addresses to the box, skipping any already there. Private files are greyed out by the
 * picker: an ad platform fetches the address, so it needs a public one.
 */
export function appendUrls(current: string, urls: string[]): string {
  const have = new Set(current.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  const add = urls.filter((u) => !have.has(u));
  if (add.length === 0) return current;
  const base = current.replace(/\s+$/, "");
  return (base ? `${base}\n` : "") + add.join("\n");
}

export function AddDriveUrls({ value, onChange, label, max }: { value: string; onChange: (next: string) => void; label: string; max?: number }) {
  return (
    <DrivePicker
      kinds={["image"]}
      addLabel="Add to ad"
      maxSelection={max}
      onSelect={(assets) => onChange(appendUrls(value, assets.map((a) => a.url)))}
      trigger={
        <Button type="button" variant="outline" size="sm" className="gap-1.5" aria-label={`Add ${label} from Drive`}>
          <ImageIcon className="size-3.5" aria-hidden /> Add from Drive
        </Button>
      }
    />
  );
}
