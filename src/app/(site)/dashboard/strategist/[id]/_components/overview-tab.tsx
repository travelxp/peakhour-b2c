"use client";

import { useLocale } from "@/hooks/use-locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon } from "@/components/brand/channel-icon";
import { Star, StickyNote } from "lucide-react";
import { IdeaDetail } from "./shared";

export function OverviewTab({ idea }: { idea: IdeaDetail }) {
  const { formatDate, formatDateTime } = useLocale();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {[
                ["Source", idea.source],
                ["Sector", idea.sector],
                ["Audience", idea.targetAudience],
                ["Type", idea.contentType],
                ["Angle", idea.angle],
              ].map(([l, v]) =>
                v ? <div key={l as string} className="flex justify-between"><dt className="text-muted-foreground">{l}</dt><dd>{v}</dd></div> : null
              )}
              {/* Priority */}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Priority</dt>
                <dd className="flex gap-0.5">
                  {idea.priority
                    ? Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < idea.priority!
                              ? "fill-brand text-brand"
                              : "text-muted-foreground/25"
                          }`}
                        />
                      ))
                    : <span className="text-muted-foreground/50">Not set</span>
                  }
                </dd>
              </div>
              {/* Channels */}
              {idea.channels && idea.channels.length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Channels</dt>
                  <dd className="flex flex-wrap gap-2">
                    {idea.channels.map((ch) => (
                      <ChannelIcon key={ch} channel={ch} size={14} />
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {[
                ["Created", idea.createdAt ? formatDate(idea.createdAt) : null],
                ["Updated", idea.updatedAt ? formatDate(idea.updatedAt) : null],
                ["Target", idea.targetDate ? formatDate(idea.targetDate) : null],
                ["Scheduled", idea.scheduledAt ? formatDateTime(idea.scheduledAt) : null],
              ].map(([l, v]) =>
                v ? <div key={l as string} className="flex justify-between"><dt className="text-muted-foreground">{l}</dt><dd>{v}</dd></div> : null
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Tags */}
      {idea.tags && idea.tags.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Tags</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {idea.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {idea.notes
            ? <p className="text-sm whitespace-pre-wrap">{idea.notes}</p>
            : <p className="text-sm text-muted-foreground/50">No notes added.</p>
          }
        </CardContent>
      </Card>
    </div>
  );
}
