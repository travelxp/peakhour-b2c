"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { createSource } from "../api";
import {
  FETCH_FREQUENCY_LABEL,
  SOURCE_TYPE_LABEL,
  type FetchFrequency,
  type SourceType,
} from "../types";

/**
 * Add Source drawer — Day-1 manual-add form. The plan calls for three
 * input modes (manual, bulk paste with auto-detect, OPML import); this
 * implementation ships the manual path. Bulk + OPML are tracked in the
 * follow-up issue and add new tabs to this same drawer rather than a
 * new component, so the call-site (`/dashboard/content/sources` FAB)
 * doesn't change.
 *
 * The form deliberately uses controlled state instead of react-hook-form
 * — four fields, no nested objects yet. Keeping the dep tree shallow
 * lets the bulk-add tab share state via the same hook when it ships.
 */

const SOURCE_TYPES: SourceType[] = [
  "website",
  "rss",
  "newsletter",
  "x_handle",
  "instagram_handle",
  "youtube_channel",
  "podcast",
  "uploaded_doc",
];

const FETCH_FREQUENCIES: FetchFrequency[] = ["hourly", "daily", "weekly", "manual"];

export function AddSourceDrawer() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SourceType>("website");
  const [identifier, setIdentifier] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fetchFrequency, setFetchFrequency] = useState<FetchFrequency>("daily");

  const queryClient = useQueryClient();

  function reset() {
    setType("website");
    setIdentifier("");
    setDisplayName("");
    setFetchFrequency("daily");
  }

  // Mutation takes the snapshot of trimmed values explicitly via a
  // `variables` arg so the success toast and any error context read
  // the values that were submitted, not whatever the input fields
  // happen to contain when the response arrives. (Inputs aren't
  // disabled while pending — only the buttons are — so a slow
  // network + a user who keeps typing would otherwise have the toast
  // echo the newer text.)
  interface CreateVars {
    type: SourceType;
    identifier: string;
    displayName: string;
    fetchFrequency: FetchFrequency;
  }
  const mutation = useMutation({
    mutationFn: (vars: CreateVars) => createSource(vars),
    onSuccess: (_data, vars) => {
      // Reach all status filters so the new row appears in whichever
      // tab the user is on (always lands `active`, but the per-status
      // counts on every tab also need to refresh).
      queryClient.invalidateQueries({ queryKey: ["trusted-sources"] });
      toast.success(`${vars.displayName || "Source"} added`);
      setOpen(false);
      // Reset after the close animation so the form doesn't visibly
      // clear while the sheet is fading out (~300ms).
      setTimeout(reset, 350);
    },
    onError: (err) => {
      // The backend's POST returns 409 with a copy-friendly message
      // ("Source already exists for this business at <identifier>") —
      // surface it verbatim instead of the generic "create failed".
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Could not add source");
      }
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedIdentifier = identifier.trim();
    const trimmedName = displayName.trim();
    if (!trimmedIdentifier || !trimmedName) {
      toast.error("Identifier and name are required");
      return;
    }
    mutation.mutate({
      type,
      identifier: trimmedIdentifier,
      displayName: trimmedName,
      fetchFrequency,
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" />
          Add source
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a trusted source</SheetTitle>
          <SheetDescription>
            Sources ground every brief, idea, and post in your brand&apos;s voice. Active sources are picked up by the next 15-minute fetch.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5 overflow-auto px-4">
          <div className="grid gap-2">
            <Label htmlFor="source-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as SourceType)}>
              <SelectTrigger id="source-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SOURCE_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="source-identifier">
              {type === "x_handle" || type === "instagram_handle"
                ? "Handle (e.g. @example)"
                : type === "uploaded_doc"
                  ? "Document key"
                  : "URL"}
            </Label>
            <Input
              id="source-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={
                type === "rss"
                  ? "https://example.com/feed.xml"
                  : type === "x_handle"
                    ? "@example"
                    : "https://example.com"
              }
              autoComplete="off"
              autoFocus
              required
            />
            <p className="text-xs text-muted-foreground">
              Stored normalised — handles lowercase, URLs preserve path case.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="source-name">Display name</Label>
            <Input
              id="source-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What you'd call this source in the team chat"
              maxLength={256}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="source-frequency">Fetch frequency</Label>
            <Select
              value={fetchFrequency}
              onValueChange={(v) => setFetchFrequency(v as FetchFrequency)}
            >
              <SelectTrigger id="source-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FETCH_FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FETCH_FREQUENCY_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Daily is right for almost everything; pick weekly for slow-moving sites and manual for archival material.
            </p>
          </div>
        </form>

        <SheetFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Adding…
              </>
            ) : (
              "Add source"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
