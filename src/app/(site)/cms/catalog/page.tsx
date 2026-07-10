"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { hasCmsRole, type CmsRole } from "@/components/cms/ai/role-gate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Loader2 } from "lucide-react";

/** cfg_products doc (the fields this editor reads/writes). */
interface Product {
  _id: string;
  key: string;
  pillar: string;
  name: string;
  tagline?: string;
  description?: string;
  status: string;
  visibility?: string;
  display?: { sortOrder?: number; highlight?: boolean };
}

/** Pillar → emoji, mirroring the Shopify app card so the preview matches. */
const PILLAR_ICON: Record<string, string> = {
  commerce: "🛍️",
  content: "✍️",
  growth: "📈",
  support: "💬",
};
const PILLAR_LABEL: Record<string, string> = {
  commerce: "Commerce",
  content: "Content",
  growth: "Growth",
  support: "Support",
};

const STATUS_OPTIONS = [
  { value: "live", label: "Live" },
  { value: "beta", label: "Beta" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "in_development", label: "In development" },
  { value: "hidden", label: "Hidden" },
  { value: "archived", label: "Archived" },
];

function statusVariant(status: string): { label: string; className: string } {
  switch (status) {
    case "live":
      return { label: "Live", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" };
    case "beta":
      return { label: "Beta", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" };
    case "coming_soon":
      return { label: "Coming soon", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" };
    case "hidden":
    case "in_development":
      return { label: status === "hidden" ? "Hidden" : "In development", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
    default:
      return { label: status, className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
  }
}

const TAGLINE_MAX = 256;
const DESCRIPTION_MAX = 4096;

export default function CmsCatalogPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasCmsRole(user?.cmsRole as CmsRole, "ops");

  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", tagline: "", description: "", status: "" });

  const { data: products, isLoading } = useQuery({
    queryKey: ["cms-catalog-products"],
    queryFn: () => api.get<Product[]>("/v1/cms/products"),
  });

  const save = useMutation({
    mutationFn: ({ key, ...body }: { key: string; name: string; tagline: string; description: string; status: string }) =>
      api.patch(`/v1/cms/products/${key}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-catalog-products"] });
      toast.success("Copy saved — live for shoppers on the next load");
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err?.message || "Could not save. Please try again."),
  });

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name ?? "",
      tagline: p.tagline ?? "",
      description: p.description ?? "",
      status: p.status ?? "coming_soon",
    });
  }

  function submit() {
    if (!editing) return;
    if (!form.name.trim()) {
      toast.error("A product needs a name.");
      return;
    }
    save.mutate({
      key: editing.key,
      name: form.name.trim(),
      tagline: form.tagline.trim(),
      description: form.description.trim(),
      status: form.status,
    });
  }

  // Group by pillar for a scannable layout (matches the pricing catalog order).
  const grouped = (products ?? []).reduce<Record<string, Product[]>>((acc, p) => {
    (acc[p.pillar] ??= []).push(p);
    return acc;
  }, {});
  const pillarOrder = ["commerce", "content", "growth", "support"];
  const pillars = Object.keys(grouped).sort(
    (a, b) => (pillarOrder.indexOf(a) + 1 || 99) - (pillarOrder.indexOf(b) + 1 || 99),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Products &amp; Copy</h2>
        <p className="text-muted-foreground mt-1">
          The name, tagline, and description shoppers read on the Shopify app, the website, and the
          WordPress plugin — all from one place. Edits go live the next time a page loads; no deploy.
        </p>
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          You have read-only access. Ask an Operations admin to change product copy.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        pillars.map((pillar) => (
          <Card key={pillar}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span aria-hidden>{PILLAR_ICON[pillar] ?? "◆"}</span>
                {PILLAR_LABEL[pillar] ?? pillar}
              </CardTitle>
              <CardDescription>{grouped[pillar].length} product{grouped[pillar].length === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {grouped[pillar].map((p) => {
                const sv = statusVariant(p.status);
                return (
                  <div
                    key={p.key}
                    className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{p.name}</span>
                        <Badge variant="secondary" className={sv.className}>{sv.label}</Badge>
                        {p.display?.highlight && (
                          <Badge variant="outline" className="text-xs">Highlighted</Badge>
                        )}
                      </div>
                      {p.tagline ? (
                        <p className="text-sm font-medium text-foreground/80">{p.tagline}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">No tagline yet</p>
                      )}
                      {p.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">No description yet</p>
                      )}
                      <p className="font-mono text-xs text-muted-foreground/70">{p.key}</p>
                    </div>
                    {canEdit && (
                      <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit copy
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit copy — {editing?.name}</DialogTitle>
            <DialogDescription>
              Write for a first-time shop owner: plain words, the benefit first. This is what
              customers read before they buy.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  value={form.name}
                  maxLength={128}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="p-tagline">Tagline</Label>
                  <span className="text-xs text-muted-foreground">{form.tagline.length}/{TAGLINE_MAX}</span>
                </div>
                <Input
                  id="p-tagline"
                  value={form.tagline}
                  maxLength={TAGLINE_MAX}
                  placeholder="One short line — the hook"
                  onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="p-desc">Description</Label>
                  <span className="text-xs text-muted-foreground">{form.description.length}/{DESCRIPTION_MAX}</span>
                </div>
                <Textarea
                  id="p-desc"
                  rows={5}
                  value={form.description}
                  maxLength={DESCRIPTION_MAX}
                  placeholder="Two or three plain sentences — what it does for them"
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger id="p-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Live preview — how the card reads to a shopper. */}
            <div className="space-y-1.5">
              <Label>Preview</Label>
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-xl" aria-hidden>{PILLAR_ICON[editing?.pillar ?? ""] ?? "◆"}</span>
                  <div className="min-w-0 space-y-1">
                    <div className="font-semibold leading-tight">{form.name || "Product name"}</div>
                    {form.tagline && (
                      <div className="text-sm text-muted-foreground">{form.tagline}</div>
                    )}
                  </div>
                </div>
                {form.description && (
                  <p className="mt-3 text-sm text-foreground/80">{form.description}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Shown on Shopify, the website, and WordPress. Keep it warm and simple.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={save.isPending} className="gap-1.5">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
