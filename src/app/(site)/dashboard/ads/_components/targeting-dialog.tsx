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

/** Server-enforced bound (TargetingBody zod: max 50 per facet). */
const MAX_PER_FACET = 50;

const FACETS: Array<{
  key: TargetingFacetKey;
  facetUrn: string;
  label: string;
  placeholder: string;
  required?: boolean;
  /** Small fixed facets (seniorities, company size) list all values
   *  up front instead of forcing a guess-the-keyword typeahead. */
  listAll?: boolean;
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
    placeholder: "Filter seniorities…",
    listAll: true,
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
    placeholder: "Filter ranges…",
    listAll: true,
  },
];

/** Feature-detect editor-shaped targeting on a row (legacy rows carry
 *  a free-form object from the AI workflow instead). */
export function editorTargeting(t: ManagedCampaign["targeting"]): CampaignTargeting | null {
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
  // listAll facets fetch the full (small) entity list once and filter
  // client-side; typeahead facets search server-side from 2 chars.
  const serverQuery = facet.listAll ? "" : query;
  const active = facet.listAll || query.length >= 2;

  const results = useQuery({
    queryKey: ["linkedin-targeting-entities", facet.facetUrn, serverQuery],
    queryFn: () => linkedInAdsApi.targetingEntities(facet.facetUrn, serverQuery || undefined),
    enabled: active,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const atCap = selected.length >= MAX_PER_FACET;
  const options = useMemo(() => {
    const needle = facet.listAll ? query.toLowerCase() : "";
    return (results.data?.entities ?? [])
      .filter((e) => e.urn && !selected.includes(e.urn))
      .filter((e) => (needle ? e.name.toLowerCase().includes(needle) : true))
      .slice(0, facet.listAll ? 12 : 8);
  }, [results.data, selected, facet.listAll, query]);

  const inputId = `targeting-${facet.key}`;
  const listId = `targeting-${facet.key}-options`;
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
        placeholder={atCap ? `Limit of ${MAX_PER_FACET} reached` : facet.placeholder}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
        disabled={atCap}
        aria-required={facet.required ? true : undefined}
      />
      {/* Plain filtered list on purpose — a full APG combobox
          (aria-activedescendant + arrow-key nav) is a follow-up; a
          half-declared combobox role misleads screen readers worse
          than honest Tab-reachable buttons. Status line is the only
          live region so result sets aren't announced wholesale. */}
      {active && !atCap ? (
        <>
          <p aria-live="polite" className="sr-only">
            {results.isLoading
              ? "Searching"
              : `${options.length} result${options.length === 1 ? "" : "s"}`}
          </p>
          {results.isLoading ? (
            <p className="text-xs text-muted-foreground">Searching…</p>
          ) : results.isError ? (
            <p className="text-xs text-muted-foreground">
              Couldn&apos;t reach LinkedIn — if your LinkedIn Ads connection is
              stale, reconnect it from Integrations; otherwise try again in a
              moment.
            </p>
          ) : options.length === 0 ? (
            <p className="text-xs text-muted-foreground">No matches.</p>
          ) : (
            <ul id={listId} className="max-h-36 overflow-y-auto rounded-md border text-sm">
              {options.map((e) => (
                <li key={e.urn}>
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 text-left hover:bg-muted focus:bg-muted"
                    onClick={() => {
                      onAdd(e);
                      if (!facet.listAll) setSearch("");
                    }}
                  >
                    {e.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
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
  // Facets + labels live in ONE state object so a single updater
  // decides accept/reject atomically — two separate setStates let a
  // same-render double-click add an orphan label past the server's
  // 250-entry bound.
  const [selection, setSelection] = useState<{
    facets: TargetingFacets;
    labels: Record<string, string>;
  }>({ facets: existing?.facets ?? {}, labels: existing?.labels ?? {} });
  const { facets, labels } = selection;

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
      } else if (code === "INVALID_TRANSITION" || code === "NO_PLATFORM_ID") {
        toast.error(
          code === "NO_PLATFORM_ID"
            ? "This campaign has no LinkedIn identity to target — refresh the list."
            : "This campaign can no longer be retargeted.",
        );
        // Either way the row is stale — resync.
        queryClient.invalidateQueries({ queryKey: ["linkedin-managed-campaigns"] });
      } else if (code === "TARGETING_PERSIST_FAILED") {
        // Qualified success: LinkedIn HAS the audience; only our local
        // mirror failed. Close, resync, and pass on the server's
        // retry-is-safe guidance — leaving the dialog open would show
        // "no audience" for a campaign whose platform audience is set.
        queryClient.invalidateQueries({ queryKey: ["linkedin-managed-campaigns"] });
        onOpenChange(false);
        toast.warning(
          (err as ApiError).message ||
            "Targeting was applied on LinkedIn but couldn't be saved locally — apply again to refresh the display.",
        );
      } else if (err instanceof ApiError && err.status === 400 && err.message) {
        // Platform-rejected entity (the api deliberately 400s
        // provider_4xx here as user-fixable) — the message names it.
        toast.error(err.message);
      } else {
        toast.error("Couldn't apply targeting. Try again in a moment.");
      }
    },
  });

  const addEntity = (key: TargetingFacetKey) => (entity: TargetingEntity) => {
    setSelection((prev) => {
      const current = prev.facets[key] ?? [];
      // Dedupe + server cap guard (a rapid double-click can beat the
      // options filter's re-render). Reject = neither facet NOR label
      // changes.
      if (current.includes(entity.urn) || current.length >= MAX_PER_FACET) return prev;
      return {
        facets: { ...prev.facets, [key]: [...current, entity.urn] },
        labels: { ...prev.labels, [entity.urn]: entity.name },
      };
    });
  };
  const removeEntity = (key: TargetingFacetKey) => (urn: string) => {
    setSelection((prev) => {
      const labels = { ...prev.labels };
      delete labels[urn];
      return {
        facets: { ...prev.facets, [key]: (prev.facets[key] ?? []).filter((u) => u !== urn) },
        labels,
      };
    });
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
            facets narrow it. Applying targeting never starts spend — but it
            REPLACES the campaign&apos;s whole audience, including anything set
            directly in LinkedIn Campaign Manager.
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
          <div className="flex flex-col items-end gap-1">
            {!valid ? (
              <p className="text-[11px] text-muted-foreground">
                Pick at least one location to apply.
              </p>
            ) : null}
            <Button
              type="button"
              onClick={() => save.mutate()}
              disabled={!valid || save.isPending}
            >
              {save.isPending ? "Applying…" : "Apply targeting"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
