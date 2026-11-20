"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrivePicker } from "@/components/drive/drive-picker";
import { roomLeft, useMediaRule, type AdPlacement } from "@/lib/media-rules";

/**
 * The pictures of a Google ad (logos and images), chosen with the one media picker. The value is one public https:// address per line; the picker
 * appends the chosen files' addresses, skipping any already there. Private files are greyed out by the picker: an ad platform fetches the
 * address, so it needs a public one.
 */
export function appendUrls(current: string, urls: string[]): string {
  const have = new Set(current.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  const add = urls.filter((u) => !have.has(u));
  if (add.length === 0) return current;
  const base = current.replace(/\s+$/, "");
  return (base ? `${base}\n` : "") + add.join("\n");
}

/** How many addresses the box holds. */
export function lineCount(current: string): number {
  return current.split(/\r?\n/).filter((l) => l.trim()).length;
}

/** The addresses in the box, one per line, without blanks. */
export function urlsOf(current: string): string[] {
  return [...new Set(current.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
}

/** The box without one address. */
export function removeUrl(current: string, url: string): string {
  return urlsOf(current).filter((u) => u !== url).join("\n");
}

/**
 * The pictures chosen for an ad, with the picker as the ONLY way in: there is no box to type an address into. The value stays one address per
 * line (what the create call reads), but it is only ever written by the picker (Drive, Upload or Link) and by the remove buttons here.
 */
export function AddDriveUrls({ value, onChange, label, placement }: { value: string; onChange: (next: string) => void; label: string; placement: AdPlacement }) {
  // The cap is the placement's (the api's table): 4 logos chosen leaves room for 1 more, not 5.
  const rule = useMediaRule({ kind: "ad", placement });
  const max = rule.state === "ready" ? rule.rule.maxCount : undefined;
  const chosen = urlsOf(value);
  // The place changed (Performance Max logos to Demand Gen logos): what was chosen was judged against the OLD rule, so it is cleared and the
  // person is told, rather than kept as if it still fitted.
  const placed = useRef(placement);
  const [cleared, setCleared] = useState(false);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });
  useEffect(() => {
    if (placed.current === placement) return;
    placed.current = placement;
    if (urlsOf(valueRef.current).length > 0) {
      onChange("");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- says once that the choice was cleared because the place changed
      setCleared(true);
    }
  }, [placement, onChange]);
  const room = rule.state === "ready" ? roomLeft(rule.rule, chosen.length) : undefined;
  return (
    <div className="space-y-2">
      {cleared && chosen.length === 0 && (
        <p role="status" className="text-xs text-muted-foreground">
          These were cleared: this ad type has different rules for {label}. Choose them again.
        </p>
      )}
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`Chosen ${label}`}>
          {chosen.map((u) => (
            <li key={u} className="relative size-16 overflow-hidden rounded-md border bg-muted">
              {/* a public Drive address: shown as it is, never fetched through the image optimiser */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-full object-cover" />
              <button type="button" onClick={() => onChange(removeUrl(value, u))} className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow" aria-label={`Remove ${label} ${u.split("/").pop() ?? ""}`}>
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <DrivePicker
        destination={{ kind: "ad", placement }}
        attached={chosen.length}
        addLabel="Add to ad"
        onSelect={(assets) => onChange(appendUrls(value, assets.map((a) => a.url)))}
        trigger={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={room === 0}
            title={room === 0 ? `This already has the most it can hold (${max}).` : undefined}
            aria-label={`Add ${label}`}
          >
            <ImageIcon className="size-3.5" aria-hidden /> {chosen.length > 0 ? "Add more" : "Choose pictures"}
          </Button>
        }
      />
    </div>
  );
}
