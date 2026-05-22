"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/hooks/use-locale";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Plug,
  ArrowRight,
  Building2,
  Wallet,
  Shield,
  Tags,
  CheckCircle2,
  Pencil,
  X,
  Check,
  Plus,
  CalendarDays,
  Globe2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OrgDetails {
  _id: string;
  name: string;
  slug: string;
  businessCategory?: string;
  businessType?: string;
  websiteUrl?: string;
  adPlatforms?: {
    linkedin?: {
      connected?: boolean;
      adAccountName?: string;
      linkedInProfileName?: string;
      connectedAt?: string;
    };
  };
  budget?: {
    monthly?: number;
    dailyCap?: number;
    currency?: string;
  };
  guardrails?: {
    maxDailySpend?: number;
    maxCAC?: number;
    minAIScore?: number;
  };
  billing?: {
    plan?: string;
  };
  taxonomy?: {
    sectors?: string[];
    generatedAt?: string;
    seasonalEvents?: SeasonalEvent[];
  } | null;
  location?: {
    country?: string;
  } | null;
  onboarding?: {
    completed?: boolean;
  };
  createdAt?: string;
}

interface SeasonalEvent {
  name: string;
  /** 1..12 */
  month: number;
  relevance?: string;
  /** Year (YYYY) → ISO date (YYYY-MM-DD). Set by the seed for moving
   *  holidays; read-only in v0 of this UI. Display only. */
  dates?: Record<string, string>;
}

const MONTH_SHORT_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsLoading() {
  return (
    <div className="flex justify-center py-12" role="status" aria-label="Loading settings">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

function SettingsContent() {
  const { org } = useAuth();
  const { formatCurrency } = useLocale();
  const searchParams = useSearchParams();
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkedInJustConnected, setLinkedInJustConnected] = useState(false);

  // Edit state
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editSectors, setEditSectors] = useState<string[]>([]);
  const [editCountry, setEditCountry] = useState("");

  // Seasonal events edit state — kept independent of the Business
  // Details card so an owner can edit one without touching the other.
  const [editingSeasonal, setEditingSeasonal] = useState(false);
  const [savingSeasonal, setSavingSeasonal] = useState(false);
  const [editSeasonalEvents, setEditSeasonalEvents] = useState<SeasonalEvent[]>([]);

  async function handleSaveBusinessDetails() {
    setSaving(true);
    setError("");
    try {
      const updates: Record<string, unknown> = {};
      if (editName && editName !== orgDetails?.name) updates.name = editName;
      if (editType !== (orgDetails?.businessType || "")) updates.businessType = editType;
      if (editUrl !== (orgDetails?.websiteUrl || "")) updates.websiteUrl = editUrl;
      if (JSON.stringify(editSectors) !== JSON.stringify(orgDetails?.taxonomy?.sectors || [])) {
        updates.taxonomy = { sectors: editSectors };
      }
      // Country drives onboarding's seasonal-pack lookup. Sending only
      // when changed avoids overwriting with the same value (the api
      // upper-cases before persistence, so a same-value send is a no-op
      // but still bumps updatedAt).
      const currentCountry = (orgDetails?.location?.country || "").toUpperCase();
      const nextCountry = editCountry.trim().toUpperCase();
      if (nextCountry && nextCountry !== currentCountry) {
        updates.countryCode = nextCountry;
      }

      if (Object.keys(updates).length === 0) {
        setEditingBusiness(false);
        return;
      }

      await api.put("/v1/dashboard/org", updates);
      const updated = await api.get<OrgDetails>("/v1/dashboard/org");
      setOrgDetails(updated);
      setEditingBusiness(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSeasonalEvents() {
    setSavingSeasonal(true);
    setError("");
    try {
      // Strip empty rows the owner left blank; preserve their existing
      // `dates` map (seed-driven for moving holidays, read-only in v0).
      const cleaned = editSeasonalEvents
        .map((e) => ({
          name: e.name.trim(),
          month: e.month,
          ...(e.relevance && e.relevance.trim()
            ? { relevance: e.relevance.trim() }
            : {}),
          ...(e.dates && Object.keys(e.dates).length > 0
            ? { dates: e.dates }
            : {}),
        }))
        .filter((e) => e.name.length > 0);

      await api.put("/v1/dashboard/org", {
        taxonomy: { seasonalEvents: cleaned },
      });
      const updated = await api.get<OrgDetails>("/v1/dashboard/org");
      setOrgDetails(updated);
      setEditingSeasonal(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to save seasonal events. Please try again.");
    } finally {
      setSavingSeasonal(false);
    }
  }

  useEffect(() => {
    if (searchParams?.get("linkedin") === "connected" || searchParams?.get("integration") === "connected") {
      setLinkedInJustConnected(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!org?._id) return;
    setLoading(true);
    setError("");
    api
      .get<OrgDetails>("/v1/dashboard/org")
      .then(setOrgDetails)
      .catch(() => setError("Failed to load settings. Please try again."))
      .finally(() => setLoading(false));
  }, [org?._id]);

  if (loading) {
    return <SettingsLoading />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">General</h2>
        <p className="text-muted-foreground mt-1">
          Business details, budget, and connected accounts
        </p>
      </div>

      {linkedInJustConnected && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          LinkedIn account connected successfully!
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="max-w-3xl space-y-6">
        {/* Business Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Business Details</CardTitle>
              </div>
              {!editingBusiness ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => {
                    setEditingBusiness(true);
                    setEditName(orgDetails?.name || "");
                    setEditType(orgDetails?.businessType || "");
                    setEditUrl(orgDetails?.websiteUrl || "");
                    setEditSectors(orgDetails?.taxonomy?.sectors || []);
                    setEditCountry(orgDetails?.location?.country || "");
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingBusiness(false)}>
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                  <Button size="sm" className="gap-1.5" disabled={saving} onClick={handleSaveBusinessDetails}>
                    <Check className="h-3.5 w-3.5" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
            <CardDescription>Your business information used by the AI engine</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingBusiness ? (
              <>
                <EditRow label="Business name" value={editName} onChange={setEditName} />
                <SettingRow label="Slug" value={orgDetails?.slug} />
                <SettingRow label="Category" value={orgDetails?.businessCategory} />
                <EditRow label="Type" value={editType} onChange={setEditType} />
                <EditRow label="Website" value={editUrl} onChange={setEditUrl} type="url" />
                <EditRow
                  label="Country (ISO-2)"
                  value={editCountry}
                  onChange={(v) => setEditCountry(v.toUpperCase())}
                />
                <SettingRow
                  label="Plan"
                  value={
                    <Badge variant="outline" className="capitalize">
                      {orgDetails?.billing?.plan || "free"}
                    </Badge>
                  }
                />
                <EditableSectors sectors={editSectors} onChange={setEditSectors} />
              </>
            ) : (
              <>
                <SettingRow label="Business name" value={orgDetails?.name} />
                <SettingRow label="Slug" value={orgDetails?.slug} />
                <SettingRow label="Category" value={orgDetails?.businessCategory} />
                <SettingRow label="Type" value={orgDetails?.businessType} />
                <SettingRow label="Website" value={orgDetails?.websiteUrl} />
                <SettingRow
                  label="Country"
                  value={
                    orgDetails?.location?.country ? (
                      <span className="flex items-center gap-1.5">
                        <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono">{orgDetails.location.country}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Not set — seasonal events will be limited until you pick a country
                      </span>
                    )
                  }
                />
                <SettingRow
                  label="Plan"
                  value={
                    <Badge variant="outline" className="capitalize">
                      {orgDetails?.billing?.plan || "free"}
                    </Badge>
                  }
                />
                {orgDetails?.taxonomy?.sectors && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tags className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">AI-discovered sectors</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {orgDetails.taxonomy.sectors.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Seasonal Events */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Seasonal Events</CardTitle>
              </div>
              {!editingSeasonal ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => {
                    setEditingSeasonal(true);
                    setEditSeasonalEvents(orgDetails?.taxonomy?.seasonalEvents || []);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingSeasonal(false)}
                    disabled={savingSeasonal}
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveSeasonalEvents}
                    disabled={savingSeasonal}
                  >
                    <Check className="h-3.5 w-3.5" />{" "}
                    {savingSeasonal ? "Saving…" : "Save"}
                  </Button>
                </div>
              )}
            </div>
            <CardDescription>
              Cultural, national, and commercial moments the AI uses to plan
              seasonal content. Onboarding seeds these from your country&apos;s
              calendar; you can add, edit, or remove events here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {editingSeasonal ? (
              <EditableSeasonalEvents
                events={editSeasonalEvents}
                onChange={setEditSeasonalEvents}
              />
            ) : (
              <ReadOnlySeasonalEvents
                events={orgDetails?.taxonomy?.seasonalEvents || []}
              />
            )}
          </CardContent>
        </Card>

        {/* Budget & Guardrails */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Budget & Guardrails</CardTitle>
            </div>
            <CardDescription>Your spending limits and AI safety controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orgDetails?.budget ? (
              <>
                <SettingRow
                  label="Monthly budget"
                  value={orgDetails.budget.monthly != null ? formatCurrency(orgDetails.budget.monthly) : "--"}
                />
                <SettingRow
                  label="Daily cap"
                  value={orgDetails.budget.dailyCap != null ? formatCurrency(orgDetails.budget.dailyCap) : "--"}
                />
                {orgDetails.guardrails && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-1.5 pt-1">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Guardrails</p>
                    </div>
                    <SettingRow
                      label="Max cost per customer"
                      value={
                        orgDetails.guardrails.maxCAC != null
                          ? `${orgDetails.budget.currency ?? "USD"} ${orgDetails.guardrails.maxCAC}`
                          : "--"
                      }
                    />
                    <SettingRow
                      label="Min AI quality score"
                      value={
                        orgDetails.guardrails.minAIScore != null
                          ? `${orgDetails.guardrails.minAIScore}/10`
                          : "--"
                      }
                    />
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No budget configured yet. Set your budget in the onboarding flow.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Connected Accounts link */}
        <Link href="/dashboard/integrations" className="block group">
          <Card className="border-primary/20 bg-linear-to-r from-primary/5 to-primary/10 transition-shadow group-hover:shadow-md">
            <CardContent className="flex items-center justify-between py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Plug className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Connected Accounts</p>
                  <p className="text-xs text-muted-foreground">
                    Manage your ad platforms, content sources, and social accounts
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">
        {value ?? <span className="text-muted-foreground">--</span>}
      </p>
    </div>
  );
}

function EditRow({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground shrink-0">{label}</p>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="max-w-xs text-sm h-8" />
    </div>
  );
}

function EditableSectors({ sectors, onChange }: { sectors: string[]; onChange: (s: string[]) => void }) {
  const [newSector, setNewSector] = useState("");

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Tags className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">AI-discovered sectors</p>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {sectors.map((s, i) => (
          <Badge key={`${s}-${i}`} variant="secondary" className="text-xs gap-1 pr-1 cursor-pointer hover:bg-destructive/20">
            {s}
            <button type="button" onClick={() => onChange(sectors.filter((_, j) => j !== i))} className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/30">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Add a sector..."
          value={newSector}
          onChange={(e) => setNewSector(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newSector.trim()) {
              e.preventDefault();
              onChange([...sectors, newSector.trim()]);
              setNewSector("");
            }
          }}
          className="text-sm h-8 max-w-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          disabled={!newSector.trim()}
          onClick={() => { onChange([...sectors, newSector.trim()]); setNewSector(""); }}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}

function ReadOnlySeasonalEvents({ events }: { events: SeasonalEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No seasonal events yet. Click Edit to add holidays, festivals, or
        commercial moments relevant to your audience.
      </p>
    );
  }
  // Sort by month for a calendar-ish read order. Same-month events
  // preserve their declared sort order.
  const sorted = [...events].sort((a, b) => a.month - b.month);
  return (
    <div className="space-y-1.5">
      {sorted.map((e, i) => {
        const movingYears = e.dates ? Object.keys(e.dates).sort() : [];
        return (
          <div
            key={`${e.name}-${i}`}
            className="rounded-md border bg-card p-2.5 text-sm"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{e.name}</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {MONTH_SHORT_NAMES[e.month] ?? `m${e.month}`}
              </Badge>
              {movingYears.length > 0 ? (
                <Badge variant="secondary" className="text-[10px]">
                  moving · {movingYears.length}y mapped
                </Badge>
              ) : null}
            </div>
            {e.relevance ? (
              <p className="mt-1 text-xs text-muted-foreground">{e.relevance}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EditableSeasonalEvents({
  events,
  onChange,
}: {
  events: SeasonalEvent[];
  onChange: (events: SeasonalEvent[]) => void;
}) {
  function updateAt(index: number, patch: Partial<SeasonalEvent>) {
    onChange(events.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function removeAt(index: number) {
    onChange(events.filter((_, i) => i !== index));
  }
  function addBlank() {
    onChange([...events, { name: "", month: 1 }]);
  }

  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No events yet. Add your first one below.
        </p>
      ) : (
        events.map((e, i) => {
          const movingYears = e.dates ? Object.keys(e.dates).sort() : [];
          return (
            <div
              key={i}
              className="rounded-md border bg-card p-2.5 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="text"
                  value={e.name}
                  placeholder="Event name (e.g. Diwali)"
                  onChange={(ev) => updateAt(i, { name: ev.target.value })}
                  className="h-8 text-sm flex-1 min-w-48"
                />
                <Select
                  value={String(e.month)}
                  onValueChange={(v) => updateAt(i, { month: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-8 w-22">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_SHORT_NAMES.slice(1).map((label, idx) => (
                      <SelectItem key={label} value={String(idx + 1)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {movingYears.length > 0 ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {movingYears.length}y mapped
                  </Badge>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAt(i)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${e.name || "event"}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                type="text"
                value={e.relevance || ""}
                placeholder="What does this event mean for your audience? (optional)"
                onChange={(ev) => updateAt(i, { relevance: ev.target.value })}
                className="h-8 text-sm"
              />
              {movingYears.length > 0 && e.dates ? (
                // Read-only display of per-year dates for moving holidays
                // (lunar / variable). Editing per-year dates from this UI
                // is deferred to a v1 follow-up — the seed populates
                // these and most owners won't need to override.
                <div className="rounded bg-muted/30 px-2 py-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">
                    Per-year dates (read-only)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 text-[11px] font-mono">
                    {movingYears.map((year) => (
                      <div key={year} className="flex gap-1">
                        <span className="text-muted-foreground">{year}:</span>
                        <span>{e.dates![year]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={addBlank}
        className="gap-1.5"
        disabled={events.length >= 64}
      >
        <Plus className="h-3.5 w-3.5" /> Add event
      </Button>
      {events.length >= 64 ? (
        <p className="text-[10px] text-muted-foreground">
          Maximum of 64 events. Remove one to add another.
        </p>
      ) : null}
    </div>
  );
}
