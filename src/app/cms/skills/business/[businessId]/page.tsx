"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle, TrendingUp, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { BusinessSkillsResponse } from "@/types/skills";
import { humanize } from "@/types/skills";

function getEffectivenessColor(score: number): string {
  if (score >= 0.8) return "[&>div]:bg-green-500";
  if (score >= 0.6) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-red-500";
}

export default function BusinessSkillsPage() {
  const params = useParams();
  const businessId = params.businessId as string;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cms", "business-skills", businessId],
    queryFn: () =>
      api.get<BusinessSkillsResponse>(`/v1/cms/skill-templates/business/${businessId}`),
    enabled: !!businessId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-3 p-6 rounded-lg border border-destructive/50 bg-destructive/5">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <div>
          <p className="font-medium">Failed to load business skills</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Business not found"}
          </p>
        </div>
      </div>
    );
  }

  const { skills, autonomyScore, business } = data;

  // Group by agent
  const byAgent = skills.reduce(
    (acc, s) => {
      if (!acc[s.agent]) acc[s.agent] = [];
      acc[s.agent].push(s);
      return acc;
    },
    {} as Record<string, typeof skills>
  );

  // Top and bottom performers
  const sorted = [...skills].sort((a, b) => b.effectiveness.score - a.effectiveness.score);
  const topSkills = sorted.slice(0, 3).filter((s) => s.effectiveness.score > 0);
  const learningSkills = sorted
    .slice(-3)
    .reverse()
    .filter((s) => s.effectiveness.totalUses > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/cms/skills" aria-label="Back to skills list">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{business.name}</h1>
          <p className="text-sm text-muted-foreground">
            {skills.length} active skills | {business.type}
          </p>
        </div>
      </div>

      {/* Autonomy Score */}
      <Card>
        <CardHeader>
          <CardTitle>Autonomy Score</CardTitle>
          <CardDescription>
            How much of the content pipeline runs without human intervention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress
                value={autonomyScore}
                className="h-4 [&>div]:bg-blue-500"
              />
            </div>
            <span className="text-3xl font-bold">{autonomyScore}%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Target: 90% | {autonomyScore >= 90 ? "Target reached" : `${90 - autonomyScore}% to go`}
          </p>
        </CardContent>
      </Card>

      {/* Top performers + Still learning */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Working well
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topSkills.length > 0 ? (
              topSkills.map((s) => (
                <div key={s._id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.effectiveness.totalUses} uses
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                    {Math.round(s.effectiveness.score * 100)}%
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-yellow-500" />
              Still learning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {learningSkills.length > 0 ? (
              learningSkills.map((s) => (
                <div key={s._id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.effectiveness.totalUses} uses
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      s.effectiveness.score >= 0.6
                        ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }
                  >
                    {Math.round(s.effectiveness.score * 100)}%
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Learnings */}
      {skills.some((s) => s.learnings?.whatWorks?.length || s.learnings?.whatDoesntWork?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Learnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {skills
              .flatMap((s) => (s.learnings?.whatWorks || []).map((w) => ({ text: w, type: "works" as const })))
              .slice(0, 5)
              .map((l, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">+</span>
                  <span>{l.text}</span>
                </div>
              ))}
            {skills
              .flatMap((s) => (s.learnings?.whatDoesntWork || []).map((w) => ({ text: w, type: "avoid" as const })))
              .slice(0, 3)
              .map((l, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">-</span>
                  <span>{l.text}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Skills by Agent */}
      <Accordion type="multiple" defaultValue={Object.keys(byAgent)}>
        {Object.entries(byAgent)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([agent, agentSkills]) => (
            <AccordionItem key={agent} value={agent}>
              <AccordionTrigger className="capitalize">
                {agent.replace(/_/g, " ")} ({agentSkills.length} skills)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {agentSkills.map((s) => (
                    <div key={s._id} className="flex items-center gap-3 py-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {s.displayName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.platform} | {s.effectiveness.totalUses} uses
                        </div>
                      </div>
                      <div className="w-24">
                        <Progress
                          value={s.effectiveness.score * 100}
                          className={`h-2 ${getEffectivenessColor(s.effectiveness.score)}`}
                        />
                      </div>
                      <span className="text-sm font-medium w-10 text-right">
                        {Math.round(s.effectiveness.score * 100)}%
                      </span>
                      <Badge
                        variant={s.status === "active" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {s.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
      </Accordion>
    </div>
  );
}
