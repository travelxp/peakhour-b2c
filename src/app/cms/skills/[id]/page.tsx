"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Shield, Loader2 } from "lucide-react";
import Link from "next/link";

interface SkillTemplate {
  _id: string;
  skillId: string;
  displayName: string;
  description: string;
  category: string;
  agent: string;
  platform: string;
  role: string;
  trustLevel: number;
  executionType: "ai" | "code" | "hybrid";
  systemPrompt?: string;
  userPromptTemplate?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  constraints?: {
    maxOutputChars?: number;
    requiredElements?: string[];
    forbiddenPatterns?: string[];
  };
  defaultEffectiveness: number;
  tags: string[];
  triggerPhrases?: string[];
  codeHandler?: string;
  version: number;
  status: "active" | "draft" | "deprecated";
}

interface BizSkill {
  _id: string;
  businessId: string;
  skillId: string;
  businessContext?: { businessName?: string };
  effectiveness: {
    score: number;
    totalUses: number;
    accepted: number;
    rejected: number;
    edited: number;
  };
  status: string;
}

export default function SkillEditorPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: skill, isLoading } = useQuery({
    queryKey: ["cms", "skill-template", id],
    queryFn: () => api.get<SkillTemplate>(`/v1/cms/skill-templates/${id}`),
    enabled: !!id,
  });

  const { data: instances } = useQuery({
    queryKey: ["cms", "skill-instances", id],
    queryFn: () => api.get<BizSkill[]>(`/v1/cms/skill-templates/${id}/instances`),
    enabled: !!id,
  });

  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [userPromptTemplate, setUserPromptTemplate] = useState<string | null>(null);
  const [maxOutputChars, setMaxOutputChars] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Initialize form values when data loads
  const effectiveSystemPrompt = systemPrompt ?? skill?.systemPrompt ?? "";
  const effectiveUserPrompt = userPromptTemplate ?? skill?.userPromptTemplate ?? "";
  const effectiveMaxChars = maxOutputChars || String(skill?.constraints?.maxOutputChars || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      return api.put(`/v1/cms/skill-templates/${id}`, {
        systemPrompt: effectiveSystemPrompt || undefined,
        userPromptTemplate: effectiveUserPrompt || undefined,
        constraints: {
          ...skill?.constraints,
          maxOutputChars: effectiveMaxChars ? Number(effectiveMaxChars) : undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms", "skill-template", id] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!skill) {
    return <div className="text-muted-foreground">Skill not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/cms/skills">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{skill.displayName}</h1>
          <p className="text-sm text-muted-foreground font-mono">{skill.skillId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{skill.agent.replace("_", " ")}</Badge>
          <Badge variant="outline">{skill.platform}</Badge>
          <Badge variant="outline">{skill.executionType}</Badge>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Shield className="h-3 w-3" />
            Trust {skill.trustLevel}
          </div>
          <Badge variant={skill.status === "active" ? "default" : "secondary"}>
            {skill.status}
          </Badge>
        </div>
      </div>

      <p className="text-muted-foreground">{skill.description}</p>

      {/* Tags */}
      {skill.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skill.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="prompt">
        <TabsList>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="instances">
            Business Instances ({instances?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Prompt Tab */}
        <TabsContent value="prompt" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Prompt</CardTitle>
              <CardDescription>
                Instructions for the AI model. Variables: {"{{businessName}}"}, {"{{brandVoice}}"}, etc.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={effectiveSystemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                placeholder="No system prompt defined (code-only skill)"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">User Prompt Template</CardTitle>
              <CardDescription>
                Template with {"{{variable}}"} placeholders. Rendered per invocation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={effectiveUserPrompt}
                onChange={(e) => setUserPromptTemplate(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                placeholder="No user prompt template defined"
              />
            </CardContent>
          </Card>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Constraints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Max Output Characters</label>
                <Input
                  type="number"
                  value={effectiveMaxChars}
                  onChange={(e) => setMaxOutputChars(e.target.value)}
                  placeholder="No limit"
                  className="max-w-xs mt-1"
                />
              </div>
              {skill.constraints?.requiredElements?.length ? (
                <div>
                  <label className="text-sm font-medium">Required Elements</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {skill.constraints.requiredElements.map((el) => (
                      <Badge key={el} variant="outline">{el}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {skill.constraints?.forbiddenPatterns?.length ? (
                <div>
                  <label className="text-sm font-medium">Forbidden Patterns</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {skill.constraints.forbiddenPatterns.map((p) => (
                      <Badge key={p} variant="destructive">{p}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Category:</span>{" "}
                <span className="capitalize">{skill.category.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Role:</span>{" "}
                <span className="capitalize">{skill.role.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Version:</span> {skill.version}
              </div>
              <div>
                <span className="text-muted-foreground">Default Effectiveness:</span>{" "}
                {Math.round(skill.defaultEffectiveness * 100)}%
              </div>
              {skill.codeHandler && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Code Handler:</span>{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{skill.codeHandler}</code>
                </div>
              )}
              {skill.triggerPhrases?.length ? (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Trigger Phrases:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {skill.triggerPhrases.map((p) => (
                      <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schema Tab */}
        <TabsContent value="schema" className="space-y-4">
          {skill.inputSchema && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Input Schema</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-[400px]">
                  {JSON.stringify(skill.inputSchema, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
          {skill.outputSchema && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Output Schema</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-[400px]">
                  {JSON.stringify(skill.outputSchema, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
          {!skill.inputSchema && !skill.outputSchema && (
            <p className="text-muted-foreground">No schemas defined (code-only skill)</p>
          )}
        </TabsContent>

        {/* Business Instances Tab */}
        <TabsContent value="instances" className="space-y-4">
          {instances?.length ? (
            instances.map((inst) => (
              <Card key={inst._id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-1">
                    <div className="font-medium">
                      {inst.businessContext?.businessName || inst.businessId}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {inst.effectiveness.totalUses} uses |{" "}
                      {inst.effectiveness.accepted} accepted |{" "}
                      {inst.effectiveness.edited} edited |{" "}
                      {inst.effectiveness.rejected} rejected
                    </div>
                  </div>
                  <div className="w-32">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Effectiveness</span>
                      <span className="font-medium">
                        {Math.round(inst.effectiveness.score * 100)}%
                      </span>
                    </div>
                    <Progress
                      value={inst.effectiveness.score * 100}
                      className={
                        inst.effectiveness.score > 0.8
                          ? "[&>div]:bg-green-500"
                          : inst.effectiveness.score > 0.6
                            ? "[&>div]:bg-yellow-500"
                            : "[&>div]:bg-red-500"
                      }
                    />
                  </div>
                  <Badge variant={inst.status === "active" ? "default" : "secondary"}>
                    {inst.status}
                  </Badge>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-muted-foreground">
              No businesses are using this skill yet
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
