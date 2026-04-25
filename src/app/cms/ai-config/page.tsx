"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatDateTime } from "@/components/cms/ai/format";

interface ConfigRow {
  _id: string;
  useCase: string;
  displayName?: string;
  description?: string;
  modelId: string;
  fallbackModelId?: string;
  provider?: string;
  modelType?: string;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
  userPromptTemplate?: string;
  active: boolean;
  updatedAt?: string;
}

interface AuditRow {
  _id: string;
  fieldName: string;
  oldValue?: unknown;
  newValue?: unknown;
  changedAt: string;
  changedByName?: string;
}

const EMPTY_FORM: Partial<ConfigRow> = { active: true, modelType: "chat" };

export default function AiConfigPage() {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ConfigRow | null>(null);
  const [form, setForm] = useState<Partial<ConfigRow>>(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ["cms-ai-config"],
    queryFn: () => api.get<{ rows: ConfigRow[]; total: number }>("/v1/cms/ai-config"),
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<ConfigRow>) => {
      if (editing) {
        return api.put(`/v1/cms/ai-config/${editing.useCase}`, input);
      }
      return api.post(`/v1/cms/ai-config`, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cms-ai-config"] });
      setSheetOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: (useCase: string) => api.delete(`/v1/cms/ai-config/${useCase}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cms-ai-config"] }),
  });

  function open(row: ConfigRow | null) {
    setEditing(row);
    setForm(row || EMPTY_FORM);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Configuration</h2>
          <p className="text-muted-foreground mt-1">
            Per-useCase model selection + prompt templates. Edits flow through an audit log.
          </p>
        </div>
        <Button onClick={() => open(null)}>
          <Plus className="mr-2 size-4" /> New useCase
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Use case</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [0, 1, 2].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : !data?.rows?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No useCase configs yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="font-mono text-xs">{row.useCase}</TableCell>
                    <TableCell>{row.displayName || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.modelId}</TableCell>
                    <TableCell><Badge variant="outline">{row.modelType || "chat"}</Badge></TableCell>
                    <TableCell>
                      {row.active ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDateTime(row.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => open(row)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Delete useCase '${row.useCase}'?`)) {
                              remove.mutate(row.useCase);
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${editing.useCase}` : "New useCase"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Changes are audited per-field."
                : "useCase identifiers are stable keys consumed by helpers/ai.ts resolveModel()."}
            </SheetDescription>
          </SheetHeader>
          <Tabs defaultValue="form" className="mt-6">
            <TabsList>
              <TabsTrigger value="form">Configuration</TabsTrigger>
              {editing && <TabsTrigger value="audit">Audit log</TabsTrigger>}
            </TabsList>

            <TabsContent value="form" className="space-y-4 mt-4">
              <FormRow label="useCase">
                <Input
                  value={form.useCase || ""}
                  disabled={!!editing}
                  onChange={(e) => setForm({ ...form, useCase: e.target.value })}
                  placeholder="content_brief"
                />
              </FormRow>
              <FormRow label="Display name">
                <Input
                  value={form.displayName || ""}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </FormRow>
              <FormRow label="Description">
                <Textarea
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Model ID">
                  <Input
                    value={form.modelId || ""}
                    onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                    placeholder="anthropic/claude-sonnet-4.5"
                  />
                </FormRow>
                <FormRow label="Fallback model ID">
                  <Input
                    value={form.fallbackModelId || ""}
                    onChange={(e) => setForm({ ...form, fallbackModelId: e.target.value })}
                  />
                </FormRow>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Max tokens">
                  <Input
                    type="number"
                    value={form.maxOutputTokens || ""}
                    onChange={(e) => setForm({ ...form, maxOutputTokens: Number(e.target.value) || undefined })}
                  />
                </FormRow>
                <FormRow label="Temperature">
                  <Input
                    type="number"
                    step="0.1"
                    value={form.temperature ?? ""}
                    onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
                  />
                </FormRow>
                <FormRow label="topP">
                  <Input
                    type="number"
                    step="0.05"
                    value={form.topP ?? ""}
                    onChange={(e) => setForm({ ...form, topP: Number(e.target.value) })}
                  />
                </FormRow>
              </div>
              <FormRow label="System prompt (optional)">
                <Textarea
                  rows={5}
                  value={form.systemPrompt || ""}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                />
              </FormRow>
              <FormRow label="User prompt template (optional)">
                <Textarea
                  rows={5}
                  value={form.userPromptTemplate || ""}
                  onChange={(e) => setForm({ ...form, userPromptTemplate: e.target.value })}
                />
              </FormRow>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.active ?? true}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
                <Label>Active</Label>
              </div>
            </TabsContent>

            {editing && (
              <TabsContent value="audit">
                <AuditTab useCase={editing.useCase} />
              </TabsContent>
            )}
          </Tabs>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => upsert.mutate(form)}
              disabled={upsert.isPending || !form.useCase || !form.modelId}
            >
              {upsert.isPending ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function AuditTab({ useCase }: { useCase: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cms-ai-config-audit", useCase],
    queryFn: () => api.get<{ rows: AuditRow[] }>(`/v1/cms/ai-config/${useCase}/audit`),
  });
  if (isLoading) return <Skeleton className="h-24" />;
  const rows = data?.rows || [];
  if (!rows.length) return <p className="text-sm text-muted-foreground py-4">No edits yet.</p>;
  return (
    <div className="space-y-2 mt-4">
      {rows.map((r) => (
        <div key={r._id} className="rounded border p-3 text-xs">
          <div className="flex justify-between mb-1">
            <span className="font-mono">{r.fieldName}</span>
            <span className="text-muted-foreground">
              {formatDateTime(r.changedAt)}
              {r.changedByName ? ` · ${r.changedByName}` : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground">Before</p>
              <pre className="whitespace-pre-wrap break-all rounded bg-muted p-1.5">{JSON.stringify(r.oldValue, null, 2) || "—"}</pre>
            </div>
            <div>
              <p className="text-muted-foreground">After</p>
              <pre className="whitespace-pre-wrap break-all rounded bg-muted p-1.5">{JSON.stringify(r.newValue, null, 2) || "—"}</pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
