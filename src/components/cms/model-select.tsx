"use client";

/**
 * Reusable model-selector for the CMS AI-config surfaces.
 *
 * `ModelSelect` — single-value combobox (Command + Popover) backed by the
 * gateway model registry (GET /v1/cms/ai-models). Type to filter; pick a
 * registry model OR enter a custom slug (dated/preview models that aren't
 * in the registry yet — e.g. "anthropic/claude-sonnet-4-5-20250929").
 *
 * `ModelChainEditor` — ordered multi-provider fallback chain editor
 * (cfg_ai_models.fallbackModelIds). Add/remove/reorder; dedups; capped.
 * Each "add" row reuses ModelSelect so the same autocomplete + custom-slug
 * affordance applies.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegistryModel {
  modelId: string;
  provider?: string;
  modelType?: string;
}

/** Shared registry fetch — cached so many ModelSelects on one page hit it once. */
function useModelRegistry() {
  return useQuery({
    queryKey: ["cms-ai-models-registry"],
    queryFn: () => api.get<{ rows: RegistryModel[]; total: number }>("/v1/cms/ai-models"),
    staleTime: 5 * 60 * 1000,
  });
}

export function ModelSelect({
  value,
  onChange,
  placeholder = "Select model…",
  allowClear = false,
  id,
  disabled,
}: {
  value: string;
  onChange: (modelId: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  id?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data, isLoading } = useModelRegistry();
  const models = data?.rows ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? models.filter((m) => m.modelId.toLowerCase().includes(q)) : models;
    return list.slice(0, 50);
  }, [models, query]);

  const queryTrim = query.trim();
  // Offer the typed value as a custom slug when it isn't an exact registry hit.
  const showCustom = queryTrim.length > 0 && !models.some((m) => m.modelId === queryTrim);

  const pick = (m: string) => {
    onChange(m);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate font-mono text-xs", !value && "font-sans text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search models…" value={query} onValueChange={setQuery} />
          <CommandList>
            {isLoading && (
              <div className="p-3 text-sm text-muted-foreground">Loading models…</div>
            )}
            {!isLoading && filtered.length === 0 && !showCustom && (
              <CommandEmpty>No models found.</CommandEmpty>
            )}
            {allowClear && value && (
              <CommandItem value="__clear__" onSelect={() => pick("")}>
                <X className="mr-2 h-4 w-4" /> Clear selection
              </CommandItem>
            )}
            {showCustom && (
              <CommandItem value={`__custom__${queryTrim}`} onSelect={() => pick(queryTrim)}>
                <Plus className="mr-2 h-4 w-4" /> Use custom “{queryTrim}”
              </CommandItem>
            )}
            <CommandGroup>
              {filtered.map((m) => (
                <CommandItem key={m.modelId} value={m.modelId} onSelect={() => pick(m.modelId)}>
                  <Check className={cn("mr-2 h-4 w-4", value === m.modelId ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate font-mono text-xs">{m.modelId}</span>
                  {m.provider && (
                    <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m.provider}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ModelChainEditor({
  value,
  onChange,
  max = 4,
  disabled,
}: {
  value: string[] | undefined;
  onChange: (chain: string[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const chain = value ?? [];

  const add = (m: string) => {
    const id = m.trim();
    if (!id || chain.includes(id) || chain.length >= max) return;
    onChange([...chain, id]);
  };
  const removeAt = (i: number) => onChange(chain.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= chain.length) return;
    const next = [...chain];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {chain.length > 0 && (
        <ol className="space-y-1">
          {chain.map((m, i) => (
            <li
              key={m}
              className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1"
            >
              <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
              <span className="flex-1 truncate font-mono text-xs">{m}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={disabled || i === 0}
                onClick={() => move(i, -1)}
                aria-label="Move up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={disabled || i === chain.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                disabled={disabled}
                onClick={() => removeAt(i)}
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {chain.length < max ? (
        <ModelSelect
          value=""
          onChange={add}
          disabled={disabled}
          placeholder={`+ Add fallback ${chain.length + 1} (tried in order)…`}
        />
      ) : (
        <p className="text-xs text-muted-foreground">Chain full — {max} fallbacks max.</p>
      )}
    </div>
  );
}
