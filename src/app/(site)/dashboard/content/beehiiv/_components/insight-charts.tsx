"use client";

import { label } from "@/lib/content-labels";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Normalize a string for comparison: lowercase, strip special chars */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Check if two strings match by normalized form or substring containment */
function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function SectorHeatmap({
  data,
  allSectors,
}: {
  data: { _id: string; count: number; avgWeight: number }[];
  allSectors: string[];
}) {
  // Taxonomy is the single source of truth. Match tag data to taxonomy entries
  // using fuzzy matching (e.g., tag "aviation" matches taxonomy "Airlines & Aviation").
  // Unmatched tag data gets its own entry at the end.
  const usedTagIds = new Set<string>();

  function findTagData(taxonomyValue: string) {
    const total = { count: 0, avgWeight: 0, matched: 0 };
    for (const d of data) {
      if (fuzzyMatch(taxonomyValue, d._id)) {
        total.count += d.count;
        total.avgWeight += d.avgWeight * d.count;
        total.matched++;
        usedTagIds.add(d._id);
      }
    }
    if (total.matched === 0) return null;
    return { count: total.count, avgWeight: total.avgWeight / total.count };
  }

  const sectors = allSectors.length > 0 ? allSectors : data.map((d) => d._id);

  // Deduplicate taxonomy entries
  const seen = new Set<string>();
  const uniqueSectors = sectors.filter((s) => {
    const norm = normalize(s);
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });

  // Pre-compute tag data FIRST — this populates usedTagIds via findTagData calls
  const sectorData = uniqueSectors.map((sector) => ({
    name: sector,
    data: findTagData(sector),
  }));

  // THEN find unmatched — usedTagIds is now populated
  const unmatched = data.filter((d) => !usedTagIds.has(d._id));

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  if (sectorData.length === 0 && unmatched.length === 0) {
    return <p className="text-sm text-muted-foreground">No sectors configured or tagged yet.</p>;
  }

  // Append unmatched tag data
  for (const d of unmatched) {
    sectorData.push({ name: d._id, data: { count: d.count, avgWeight: d.avgWeight } });
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
      {sectorData.map(({ name: sector, data: d }) => {
        const count = d?.count ?? 0;
        const intensity = count > 0 ? Math.max(0.1, count / maxCount) : 0;
        const bg =
          count === 0
            ? "bg-destructive/10 border-destructive/30"
            : intensity > 0.6
              ? "bg-success/15 border-success/30"
              : intensity > 0.3
                ? "bg-warning/10 border-warning/30"
                : "bg-warning/10 border-warning/30";

        return (
          <Tooltip key={sector}>
            <TooltipTrigger asChild>
              <div
                className={`rounded-lg border p-2 text-center transition-colors ${bg}`}
              >
                <p className="text-xs font-medium leading-tight">
                  {label(undefined,sector)}
                </p>
                <p className="text-lg font-bold mt-0.5">{count}</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {label(undefined,sector)}: {count} article
                {count !== 1 ? "s" : ""}
                {d ? `, avg weight ${(d.avgWeight * 100).toFixed(0)}%` : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function AudienceBars({
  data,
  allAudiences,
}: {
  data: { _id: string; count: number; avgRelevance: number }[];
  allAudiences: string[];
}) {
  const usedTagIds = new Set<string>();

  function findTagData(taxonomyValue: string) {
    const total = { count: 0, avgRelevance: 0, matched: 0 };
    for (const d of data) {
      if (fuzzyMatch(taxonomyValue, d._id)) {
        total.count += d.count;
        total.avgRelevance += d.avgRelevance * d.count;
        total.matched++;
        usedTagIds.add(d._id);
      }
    }
    if (total.matched === 0) return null;
    return { count: total.count, avgRelevance: total.avgRelevance / total.count };
  }

  const segments = allAudiences.length > 0 ? allAudiences : data.map((d) => d._id);

  const seen = new Set<string>();
  const uniqueSegments = segments.filter((s) => {
    const norm = normalize(s);
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });

  // Pre-compute FIRST — populates usedTagIds
  const segmentData = uniqueSegments.map((seg) => ({
    name: seg,
    data: findTagData(seg),
  }));

  // THEN find unmatched
  const unmatched = data.filter((d) => !usedTagIds.has(d._id));
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  for (const d of unmatched) {
    segmentData.push({ name: d._id, data: { count: d.count, avgRelevance: d.avgRelevance } });
  }

  if (segmentData.length === 0) {
    return <p className="text-sm text-muted-foreground">No audience segments configured or tagged yet.</p>;
  }

  return (
    <div className="space-y-3">
      {segmentData.map(({ name: segment, data: d }) => {
        const count = d?.count ?? 0;
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const color =
          count === 0
            ? "bg-destructive"
            : pct > 60
              ? "bg-success"
              : pct > 30
                ? "bg-warning"
                : "bg-warning";

        return (
          <div key={segment} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                {label(undefined, segment)}
              </span>
              <span className="text-xs text-muted-foreground">
                {count} article{count !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all`}
                style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
