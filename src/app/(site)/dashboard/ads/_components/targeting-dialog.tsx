"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  linkedInAdsApi,
  type ManagedCampaign,
  type CampaignTargeting,
  type TargetingEntity,
  type TargetingFacetKey,
  type TargetingFacets,
} from "@/lib/api/linkedin-ads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, X } from "lucide-react";

/**
 * TargetingDialog — the facet-targeting editor that closes the G1
 * activation gap: pick locations (required) + optional industries /
 * seniorities / job titles / company sizes via LinkedIn's facet
 * typeahead, and apply them to the draft campaign without leaving
 * Peakhour. Applying targeting can never start spend.
 *
 * Facet URNs mirror the api's TARGETING_FACETS map; selections are
 * sent as simple per-facet URN lists and redisplayed from the row's
 * stored `targeting.facets` + `labels`.
 */

const FACETS: Array<{
  key: TargetingFacetKey;
  facetUrn: string;
  label: string;
  placeholder: string;
  required?: boolean;
}> = [
  {
    key: "locations",
    facetUrn: "urn:li:adTargetingFacet:locations",
    label: "Locations (required)",
    placeholder: "Search countries, regions, cities…",
    required: true,
  },
  {
    key: "industries",
    facetUrn: "urn:li:adTargetingFacet:industries",
    label: "Industries",
    placeholder: "Search industries…",
  },
  {
    key: "seniorities",
    facetUrn: "urn:li:adTargetingFacet:seniorities",
    label: "Seniorities",
    placeholder: "Search seniorities…",
  },
  {
    key: "titles",
    facetUrn: "urn:li:adTargetingFacet:titles",
    label: "Job titles",
    placeholder: "Search job titles…",
  },
  {
    key: "staffCountRanges",
    facetUrn: "urn:li:adTargetingFacet:staffCountRanges",
    label: "Company size",
    placeholder: "Search company-size ranges…",
  },
];

/** Feature-detect editor-shaped targeting on a row (legacy rows carry
 *  a free-form object from the AI workflow instead). */
function editorTargeting(t: ManagedCampaign["targeting"]): CampaignTargeting | null {
  if (t && typeof t === "object" && "facets" in t) return t as CampaignTargeting;
  return null;
}

/** Debounce a string value. */
function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function FacetPicker({
  facet,
  selected,
  labels,
  onAdd,
  onRemove,
}: {
  facet: (typeof FACETS)[number];
  selected: string[];
  labels: Record<string, string>;
  onAdd: (entity: TargetingEntity) => void;
  onRemove: (urn: string) => void;
}) {
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim(), 350);

  const results = useQuery({
    queryKey: ["linkedin-targeting-entities", facet.facetUrn, query],
    queryFn: () => linkedInAdsApi.targetingEntities(facet.facetUrn, query),
    enabled: query.length >= 2,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const options = useMemo(
    () =>
      (results.data?.entities ?? [])
        .filter((e) => e.urn && !selected.includes(e.urn))
        .slice(0, 8),
    [results.data, selected],
  );

  const inputId = `targeting-${facet.key}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{facet.label}</Label>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((urn) => (
            <Badge key={urn} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
              {labels[urn] ?? urn}
              <button
                type="button"
                aria-label={`Remove ${labels[urn] ?? urn}`}
                className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                onClick={() => onRemove(urn)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Input
        id={inputId}
        value={search}
        placeholder={facet.placeholder}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
      />
      {query.length >= 2 ? (
        results.isLoading ? (
          <p className="text-xs text-muted-foreground">Searching…</p>
        ) : results.isError ? (
          <p className="text-xs text-muted-foreground">
            Couldn&apos;t search LinkedIn right now — try again in a moment.
          </p>
        ) : options.length === 0 ? (
          <p className="text-xs text-muted-foreground">No matches.</p>
        ) : (
          <ul className="max-h-36 overflow-y-auto rounded-md border text-sm">
            {options.map((e) => (
              <li key={e.urn}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    onAdd(e);
                    setSearch("");
                  }}
                >
                  {e.name}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

export function TargetingDialog({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: ManagedCampaign;
}) {
  const queryClient = useQueryClient();
  const existing = editorTargeting(campaign.targeting);
  const [facets, setFacets] = useState<TargetingFacets>(existing?.facets ?? {});
  const [labels, setLabels] = useState<Record<string, string>>(existing?.labels ?? {});

  const save = useMutation({
    mutationFn: () => linkedInAdsApi.setTargeting(campaign._id, facets, labels),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linkedin-managed-campaigns"] });
      onOpenChange(false);
      toast.success("Audience targeting applied.", {
        description:
          campaign.status === "active"
            ? "LinkedIn will re-review the campaign with the new audience."
            : "The draft now carries its audience — activate it when you're ready.",
      });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "NEEDS_REAUTH" || code === "NOT_CONNECTED") {
        toast.error("LinkedIn Ads needs a reconnect before updating targeting.", {
          action: {
            label: "Reconnect",
            onClick: () => { window.location.href = "/dashboard/integrations"; },
          },
        });
      } else if (code === "VALIDATION_ERROR") {
        toast.error((err as ApiError).message || "Check the targeting selection.");
      } else if (code === "RATE_LIMITED") {
        toast.error("LinkedIn is rate-limiting us — give it a minute and try again.");
      } else if (code === "INVALID_TRANSITION") {
        toast.error("This campaign can no longer be retargeted.");
      } else {
        toast.error("Couldn't apply targeting. Try again in a moment.");
      }
    },
  });

  const addEntity = (key: TargetingFacetKey) => (entity: TargetingEntity) => {
    setFacets((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), entity.urn],
    }));
    setLabels((prev) => ({ ...prev, [entity.urn]: entity.name }));
  };
  const removeEntity = (key: TargetingFacetKey) => (urn: string) => {
    setFacets((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((u) => u !== urn),
    }));
  };

  const valid = (facets.locations?.length ?? 0) > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && save.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="size-4" />
            Audience targeting
          </DialogTitle>
          <DialogDescription>
            Who should see &ldquo;{campaign.name}&rdquo;? LinkedIn requires at
            least one location; entities within a facet broaden the audience,
            facets narrow it. Applying targeting never starts spend.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {FACETS.map((f) => (
            <FacetPicker
              key={f.key}
              facet={f}
              selected={facets[f.key] ?? []}
              labels={labels}
              onAdd={addEntity(f.key)}
              onRemove={removeEntity(f.key)}
            />
          ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={!valid || save.isPending}
            title={valid ? undefined : "Pick at least one location"}
          >
            {save.isPending ? "Applying…" : "Apply targeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
