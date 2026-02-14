"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Draft {
  _id: string;
  title: string;
  source: string;
  status: string;
  publishedAt: string;
  autoTags?: {
    sectors?: string[];
    companies?: string[];
    contentType?: string;
    sentiment?: string;
    adPotentialScore?: number;
    topKeywords?: string[];
  };
  beehiivMeta?: {
    webUrl?: string;
    thumbnailUrl?: string;
  };
}

interface GapAnalysis {
  sectorCoverage: { _id: string; count: number; avgWeight: number }[];
  audienceCoverage: { _id: string; count: number; avgRelevance: number }[];
  highPotentialUnused: {
    newsletterId: string;
    newsletterTitle: string;
    adPotential: { score: number };
  }[];
}

function AdScoreBadge({ score }: { score?: number }) {
  if (!score) return <Badge variant="outline">Untagged</Badge>;
  if (score >= 8) return <Badge className="bg-green-600">Ad Score: {score}</Badge>;
  if (score >= 5) return <Badge className="bg-yellow-600">Ad Score: {score}</Badge>;
  return <Badge variant="secondary">Ad Score: {score}</Badge>;
}

export default function ContentPage() {
  const { data: library, isLoading } = useQuery({
    queryKey: ["content-library"],
    queryFn: () =>
      api.get<Draft[]>("/v1/content/library", { limit: "50" }),
  });

  const { data: gaps } = useQuery({
    queryKey: ["content-gaps"],
    queryFn: () => api.get<GapAnalysis>("/v1/content/gaps"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Content Intelligence</h2>
        <p className="text-muted-foreground">
          Your newsletters, automatically tagged and analyzed for ad potential
        </p>
      </div>

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="gaps">Content Gaps</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading content...</p>
          ) : !library?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No content synced yet. Connect your Beehiiv account in
                  Settings to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sectors</TableHead>
                    <TableHead>Ad Score</TableHead>
                    <TableHead>Published</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {library.map((draft) => (
                    <TableRow key={draft._id}>
                      <TableCell className="font-medium">
                        {draft.beehiivMeta?.webUrl ? (
                          <a
                            href={draft.beehiivMeta.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {draft.title}
                          </a>
                        ) : (
                          draft.title
                        )}
                      </TableCell>
                      <TableCell>
                        {draft.autoTags?.contentType ? (
                          <Badge variant="outline">
                            {draft.autoTags.contentType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {draft.autoTags?.sectors?.slice(0, 2).map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {s}
                            </Badge>
                          )) || (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <AdScoreBadge score={draft.autoTags?.adPotentialScore} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {draft.publishedAt
                          ? new Date(draft.publishedAt).toLocaleDateString()
                          : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="gaps" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sector Coverage</CardTitle>
                <CardDescription>
                  Topics you cover most and least
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!gaps?.sectorCoverage?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No tag data yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {gaps.sectorCoverage.map((s) => (
                      <div
                        key={s._id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{s._id}</span>
                        <Badge variant="outline">{s.count} articles</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Audience Coverage</CardTitle>
                <CardDescription>
                  Segments you reach most and least
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!gaps?.audienceCoverage?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No tag data yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {gaps.audienceCoverage.map((a) => (
                      <div
                        key={a._id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{a._id}</span>
                        <Badge variant="outline">{a.count} articles</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                High Ad-Potential Content
              </CardTitle>
              <CardDescription>
                Content scoring 7+ that could become great ads
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!gaps?.highPotentialUnused?.length ? (
                <p className="text-sm text-muted-foreground">
                  No high-potential content found yet
                </p>
              ) : (
                <div className="space-y-2">
                  {gaps.highPotentialUnused.map((item) => (
                    <div
                      key={item.newsletterId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate max-w-md">
                        {item.newsletterTitle}
                      </span>
                      <Badge className="bg-green-600">
                        Score: {item.adPotential.score}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
