"use client";

import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SchedulerComposer } from "@/components/scheduler/scheduler-composer";
import type { ScheduleSourceType } from "@/lib/scheduler/types";
import { sourceTextHash } from "@/lib/scheduler/source-hash";
import { Loader2, Send, CheckCircle, ExternalLink } from "lucide-react";
import { IdeaDetail } from "./shared";

export function PublishTab({ idea, loading, onPublish, onScheduled }: { idea: IdeaDetail; loading: string | null; onPublish: () => void; onScheduled: () => void }) {
  const { formatDateTime } = useLocale();

  if (idea.publishing?.beehiivPostId) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-success" /><span className="font-medium">Published to Beehiiv</span></div>
          {idea.publishing.publishedAt && <p className="mt-1 text-sm text-muted-foreground">Published {formatDateTime(idea.publishing.publishedAt)}</p>}
          {idea.publishing.beehiivUrl && <a href={idea.publishing.beehiivUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" />View on Beehiiv</a>}
        </CardContent>
      </Card>
    );
  }

  if (!["approved", "scheduled"].includes(idea.status)) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Content must be approved before publishing.</CardContent></Card>;
  }

  const html = idea.content?.html ?? "";
  const subject = idea.content?.subject?.trim() || idea.title || "Untitled";

  if (!html) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">No content to publish yet. Generate the newsletter in the Write step first.</CardContent></Card>;
  }

  // Newsletter channel = the W8 Beehiiv publisher adapter (channel key
  // "newsletter"). It REQUIRES channelOptions.title and reads
  // channelOptions.contentHtml; payload.text is the fallback body. At
  // the scheduled tick the publish-scheduled cron creates a Beehiiv
  // DRAFT (same artefact as "Push to Beehiiv" below — Beehiiv free tier
  // has no server-side send), which the user then sends from Beehiiv.
  const hash = sourceTextHash(html);
  const schedulerSource = {
    sourceType: "idea" as ScheduleSourceType,
    sourceRef: idea._id,
    sourceTextHash: hash,
  };
  const schedulerChannels = [
    {
      channel: "newsletter",
      payload: {
        text: html,
        channelOptions: {
          title: subject,
          contentHtml: html,
          ...(idea.content?.previewText ? { previewText: idea.content.previewText } : {}),
        },
      },
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule &amp; Publish</CardTitle>
        <CardDescription>
          Schedule the newsletter to post automatically, or push it to Beehiiv as a draft now.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Schedule via the shared W8 scheduler — replaces the old
            datetime-local stamp, which never actually published. */}
        <SchedulerComposer
          key={hash}
          source={schedulerSource}
          title={subject}
          channels={schedulerChannels}
          onScheduled={onScheduled}
        />
        <div className="border-t pt-4">
          <p className="mb-3 text-sm text-muted-foreground">Or push as a draft to Beehiiv right now. You can finalize and send from your Beehiiv dashboard.</p>
          <Button onClick={onPublish} disabled={loading === "publish"}>
            {loading === "publish" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Push to Beehiiv
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
