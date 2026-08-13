"use client";

/**
 * Pick the lead form a lead-generation campaign captures with.
 *
 * ★IT ONLY OFFERS FORMS THAT WOULD ACTUALLY SERVE. A form LinkedIn rejected,
 * or one still sitting as a draft, produces a campaign that goes active with a
 * committed budget and delivers nothing — the creative sits behind a serving
 * hold and every local row still reads healthy. Filtering here means the
 * server's refusal (`ASK_NOT_SERVING`) is a backstop rather than the customer's
 * first hint, and the empty state names the thing to go and fix.
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { growthApi } from "@/lib/api/growth";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADS_LINKEDIN_PATH } from "@/lib/integrations-connect";

export function LeadFormPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (askId: string) => void;
}) {
  const asks = useQuery({
    queryKey: ["growth-asks"],
    queryFn: () => growthApi.listAsks(),
    staleTime: 30_000,
  });

  const usable = (asks.data?.asks ?? []).filter((a) => a.status === "published" && a.serving);

  if (asks.isLoading) {
    return (
      <div className="space-y-1.5">
        <Label>Lead form</Label>
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (asks.isError) {
    return (
      <div className="space-y-1.5">
        <Label>Lead form</Label>
        <p className="text-xs text-muted-foreground">
          We couldn&apos;t load your lead forms just now. Refresh and try again — nothing
          has been created.
        </p>
      </div>
    );
  }

  if (usable.length === 0) {
    // Two different situations, and the difference matters: nothing at all
    // versus something that exists and is not delivering. The second sends
    // them somewhere with an explanation waiting.
    const hasSomething = (asks.data?.asks ?? []).length > 0;
    return (
      <div className="space-y-1.5">
        <Label>Lead form</Label>
        <p className="text-xs text-muted-foreground">
          {hasSomething
            ? "None of your lead forms is live on LinkedIn right now."
            : "You need a lead form before you can collect enquiries from an ad."}{" "}
          <Link href={ADS_LINKEDIN_PATH} className="underline underline-offset-4">
            {hasSomething ? "Check your forms" : "Create one"}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="boost-lead-form">Lead form</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="boost-lead-form">
          <SelectValue placeholder="Choose a form" />
        </SelectTrigger>
        <SelectContent>
          {usable.map((a) => (
            <SelectItem key={a._id} value={a._id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Answers land in your Inbox, scored, with the questions named — not as a
        spreadsheet you have to go and fetch.
      </p>
    </div>
  );
}
