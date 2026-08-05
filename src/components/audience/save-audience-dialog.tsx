"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { audienceLibraryApi } from "@/lib/api/audiences";

/**
 * Keep the audience you just built by hand (G4, calling F3).
 *
 * ★THE MISSING THIRD WAY AN AUDIENCE GETS INTO THE LIBRARY. Peakhour's own
 * suggestions land there; a business's historical campaigns land there; the one
 * audience the customer actually AUTHORED — by opening the targeting editor and
 * disagreeing with us — was captured as a diff on the campaign and then had
 * nowhere to live. The one they wrote themselves was the one they could not
 * reuse.
 *
 * ★OFFERED, NEVER AUTOMATIC. A library that fills up with every one-off
 * experiment is a library nobody opens, which is why the targeting editor goes
 * on saving nothing and this button exists instead.
 */
export function SaveAudienceDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const save = useMutation({
    mutationFn: () =>
      audienceLibraryApi.saveFromCampaign({
        campaignId,
        ...(name.trim() ? { name: name.trim() } : {}),
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["audience-sets"] });
      onOpenChange(false);
      setName("");
      // ★"YOU ALREADY SAVED THIS" IS A DIFFERENT SENTENCE FROM "SAVED". The api
      // returns the existing row rather than a duplicate — a person can press a
      // button twice — and claiming to have created something we did not is a
      // small lie about their own library.
      toast.success(res.alreadySaved ? "You'd already saved this one." : "Saved to your audiences.", {
        description:
          // ★AND WHAT DID NOT SURVIVE IS SAID, BECAUSE THE DIRECTION IS
          // BROADER. A facet we could not put into business language drops a
          // whole AND-block, so the saved audience reaches MORE people than the
          // campaign does — the one thing a customer must not discover by
          // spending.
          res.lost.length > 0
            ? `${res.lost.length} part${res.lost.length === 1 ? "" : "s"} of the targeting couldn't be described in plain language, so the saved audience is BROADER than this campaign: ${res.lost
                .map((l) => l.reason)
                .join("; ")}.`
            : undefined,
        duration: res.lost.length > 0 ? 12_000 : undefined,
        action: {
          label: "Open",
          onClick: () => {
            window.location.href = `/dashboard/growth/audiences/${res.set.id}`;
          },
        },
      });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "NO_TARGETING") {
        toast.error("This campaign has no targeting to save yet — set its audience first.");
        return;
      }
      if (code === "LIBRARY_FULL") {
        toast.error(err instanceof ApiError ? err.message : "Your library is full.");
        return;
      }
      toast.error("We couldn't save that audience. Nothing was changed.");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && save.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="size-4" aria-hidden="true" />
            Save this as an audience
          </DialogTitle>
          <DialogDescription>
            Keep this campaign&apos;s targeting in your{" "}
            <Link href="/dashboard/growth/audiences" className="underline">
              audience library
            </Link>{" "}
            so you can put it on another campaign — or on another channel — later. It
            changes nothing about this campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="save-audience-name">Name (optional)</Label>
          <Input
            id="save-audience-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 120))}
            maxLength={120}
            placeholder={`Audience from “${campaignName}”`}
          />
          <p className="text-xs text-muted-foreground">
            We&apos;ll name it after the campaign if you leave this empty.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save audience"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
