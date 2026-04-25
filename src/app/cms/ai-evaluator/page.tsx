"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Play } from "lucide-react";
import { formatDateTime } from "@/components/cms/ai/format";

interface Recommendation {
  useCase: string;
  currentModelId: string;
  candidateModelId: string;
  costDeltaPct?: number;
  latencyDeltaPct?: number;
  rationale?: string;
  applied?: boolean;
}

interface RunRow {
  _id: string;
  runAt: string;
  mode: "manual" | "scheduled";
  status: string;
  appliedCount: number;
  recommendations?: Recommendation[];
}

export default function AiEvaluatorPage() {
  const qc = useQueryClient();

  const history = useQuery({
    queryKey: ["cms-ai-evaluator-history"],
    queryFn: () => api.get<{ rows: RunRow[] }>("/v1/cms/ai-evaluator/history"),
  });

  const run = useMutation({
    mutationFn: () =>
      api.post<{ runId: string; recommendations: Recommendation[] }>(
        "/v1/cms/ai-evaluator/run",
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cms-ai-evaluator-history"] }),
  });

  const apply = useMutation({
    mutationFn: (input: { runId: string; useCase: string; candidateModelId: string }) =>
      api.post(`/v1/cms/ai-evaluator/apply`, input),
    onSuccess: () => {
      // /apply mutates cfg_ai_models — invalidate the config view too so
      // the new modelId shows up immediately on the AI Config page.
      qc.invalidateQueries({ queryKey: ["cms-ai-evaluator-history"] });
      qc.invalidateQueries({ queryKey: ["cms-ai-config"] });
    },
  });

  const latest = history.data?.rows?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Evaluator</h2>
          <p className="text-muted-foreground mt-1">
            Compares each active useCase against the model registry. Recommends cheaper or faster
            alternatives that match capabilities.
          </p>
        </div>
        <Button onClick={() => run.mutate()} disabled={run.isPending}>
          <Play className="mr-2 size-4" />
          {run.isPending ? "Running…" : "Run evaluation"}
        </Button>
      </div>

      {/* Latest recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Latest recommendations</CardTitle>
          <CardDescription>
            From the most recent run. Apply individually with a superadmin role.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {history.isLoading ? (
            <div className="p-6"><Skeleton className="h-24" /></div>
          ) : !latest?.recommendations?.length ? (
            <p className="p-6 text-sm text-muted-foreground">
              {latest ? "No recommendations from the last run." : "No runs yet — click 'Run evaluation'."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Use case</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Cost Δ</TableHead>
                  <TableHead>Latency Δ</TableHead>
                  <TableHead>Rationale</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latest.recommendations.map((r, i) => (
                  <TableRow key={`${r.useCase}-${i}`}>
                    <TableCell className="font-mono text-xs">{r.useCase}</TableCell>
                    <TableCell className="font-mono text-xs">{r.currentModelId}</TableCell>
                    <TableCell className="font-mono text-xs">{r.candidateModelId}</TableCell>
                    <TableCell className={r.costDeltaPct != null && r.costDeltaPct < 0 ? "text-emerald-700" : "text-amber-700"}>
                      {r.costDeltaPct != null ? `${r.costDeltaPct.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className={r.latencyDeltaPct != null && r.latencyDeltaPct < 0 ? "text-emerald-700" : "text-amber-700"}>
                      {r.latencyDeltaPct != null ? `${r.latencyDeltaPct.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.rationale}</TableCell>
                    <TableCell className="text-right">
                      {r.applied ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Applied</Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={apply.isPending}
                          onClick={() =>
                            apply.mutate({
                              runId: latest._id,
                              useCase: r.useCase,
                              candidateModelId: r.candidateModelId,
                            })
                          }
                        >
                          Apply
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.isLoading ? (
            <div className="p-6"><Skeleton className="h-12" /></div>
          ) : !history.data?.rows?.length ? (
            <p className="p-6 text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run at</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recommendations</TableHead>
                  <TableHead className="text-right">Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.rows.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="text-xs">{formatDateTime(r.runAt)}</TableCell>
                    <TableCell><Badge variant="outline">{r.mode}</Badge></TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="text-right">{r.recommendations?.length ?? 0}</TableCell>
                    <TableCell className="text-right">{r.appliedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
