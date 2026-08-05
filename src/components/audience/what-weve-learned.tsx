"use client";

import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { audienceLibraryApi, type AudienceSkillLearning } from "@/lib/api/audiences";
import { useAuth } from "@/providers/auth-provider";
import { learningState } from "@/lib/audience-learning-rules";

/**
 * What the engine has learned about this business's audiences (H1).
 *
 * ★THE LOOP HAS BEEN RUNNING AND NOBODY COULD SEE IT. The weekly tuning cron
 * has distilled `whatWorks`/`whatDoesntWork` from corrections and outcomes
 * since D3, `userEdits` has recorded every hand-correction since B5, and
 * `outcome` has carried what the campaigns did — none of it rendered anywhere.
 * A customer being asked to correct our understanding, whose corrections
 * visibly go nowhere, stops correcting.
 *
 * ★AND "NOTHING YET" IS THREE DIFFERENT SENTENCES. Never set up; set up and
 * still watching; and watching with too few decided observations to say
 * anything — the extractor refuses below the api's own floor, because a pattern
 * from four edits is a hunch. Collapsing them into one empty card would tell a
 * customer the engine has learned nothing about a business it has never been
 * asked about.
 */
export function WhatWeveLearned() {
  const { business } = useAuth();
  const learning = useQuery({
    queryKey: ["audience-learning", business?._id ?? "none"],
    queryFn: () => audienceLibraryApi.getLearning(),
    retry: false,
  });

  const skills = learning.data?.skills ?? [];
  const minimum = learning.data?.minimumObservations ?? 0;
  const withLearnings = skills.filter((s) => s.learnings);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-medium">What we&apos;ve learned about your audiences</h3>
        </div>

        {learning.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full max-w-md" />
            <Skeleton className="h-3 w-full max-w-sm" />
          </div>
        ) : learning.isError ? (
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t load this just now.
          </p>
        ) : withLearnings.length === 0 ? (
          // ★THE HONEST EMPTY, AND IT SAYS WHICH EMPTY IT IS. Every skill's own
          // state is on the row below; this is the summary of them.
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Nothing yet. We learn from two things: the corrections you make to what we
              suggest, and what the campaigns running an audience actually do.
            </p>
            <ul className="space-y-1">
              {skills.map((skill) => (
                <li key={skill.skillId} className="text-xs text-muted-foreground">
                  <span className="font-medium">{skill.label}</span> —{" "}
                  {learningState(skill, minimum).text}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            {skills.map((skill) => (
              <SkillLearning key={skill.skillId} skill={skill} minimum={minimum} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkillLearning({
  skill,
  minimum,
}: {
  skill: AudienceSkillLearning;
  minimum: number;
}) {
  const state = learningState(skill, minimum);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{skill.label}</span>
        {/* ★THE SAMPLE TRAVELS WITH THE FINDING. A pattern from 4 observations
            and one from 400 read differently, and the number is the only thing
            that says which this is. */}
        <span className="text-xs text-muted-foreground">{state.text}</span>
      </div>
      {skill.learnings && (
        <ul className="space-y-0.5">
          {skill.learnings.whatWorks.map((line) => (
            <li key={`w:${line}`} className="text-xs text-muted-foreground">
              <span className="text-foreground">Works:</span> {line}
            </li>
          ))}
          {skill.learnings.whatDoesntWork.map((line) => (
            <li key={`d:${line}`} className="text-xs text-muted-foreground">
              <span className="text-foreground">Doesn&apos;t:</span> {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
