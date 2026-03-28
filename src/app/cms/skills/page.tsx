"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  Search,
  Shield,
  type LucideIcon,
} from "lucide-react";

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
  defaultEffectiveness: number;
  tags: string[];
  version: number;
  status: "active" | "draft" | "deprecated";
}

const AGENT_COLORS: Record<string, string> = {
  strategist: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  repurposer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  publisher: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  ad_engine: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  optimizer: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  control: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  feedback: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

const EXECUTION_BADGES: Record<string, string> = {
  ai: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300",
  code: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  hybrid: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

export default function SkillsPage() {
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cms", "skill-templates"],
    queryFn: () => api.get<SkillTemplate[]>("/v1/cms/skill-templates"),
  });

  const skills = data || [];

  const filtered = skills.filter((s) => {
    if (agentFilter !== "all" && s.agent !== agentFilter) return false;
    if (platformFilter !== "all" && s.platform !== platformFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.skillId.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const agentCounts = skills.reduce(
    (acc, s) => {
      acc[s.agent] = (acc[s.agent] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const uniqueAgents = [...new Set(skills.map((s) => s.agent))].sort();
  const uniquePlatforms = [...new Set(skills.map((s) => s.platform))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Skill Templates</h1>
        <p className="text-muted-foreground">
          {skills.length} skills across {uniqueAgents.length} agents
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {uniqueAgents.slice(0, 4).map((agent) => (
          <Card key={agent}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium capitalize">
                {agent.replace("_", " ")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agentCounts[agent]}</div>
              <p className="text-xs text-muted-foreground">skills</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {uniqueAgents.map((a) => (
              <SelectItem key={a} value={a}>
                {a.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {uniquePlatforms.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skill</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Trust</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((skill) => (
                <TableRow key={skill._id}>
                  <TableCell>
                    <Link
                      href={`/cms/skills/${skill._id}`}
                      className="hover:underline"
                    >
                      <div className="font-medium">{skill.displayName}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {skill.skillId}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={AGENT_COLORS[skill.agent] || ""}
                    >
                      {skill.agent.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{skill.platform}</TableCell>
                  <TableCell className="capitalize text-sm">
                    {skill.role.replace("_", " ")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={EXECUTION_BADGES[skill.executionType] || ""}
                    >
                      {skill.executionType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Shield className="h-3 w-3" />
                      <span className="text-sm">{skill.trustLevel}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={skill.status === "active" ? "default" : "secondary"}
                    >
                      {skill.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No skills match your filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
