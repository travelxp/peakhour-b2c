"use client";

import type { Column } from "@tanstack/react-table";
import { ListFilterIcon } from "lucide-react";
import { useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FacetedFilterOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface FacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title: string;
  options: FacetedFilterOption[];
  align?: "start" | "center" | "end";
}

export function FacetedFilter<TData, TValue>({
  column,
  title,
  options,
  align = "end",
}: FacetedFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues();

  const facetCounts = useMemo(() => {
    if (!facets || !column) return null;
    const map = new Map<string, number>();
    facets.forEach((count, key) => {
      const stringKey = String(key);
      map.set(stringKey, Number(count));
      map.set(stringKey.toLowerCase(), Number(count));
    });
    return map;
  }, [facets, column]);

  const filterValue = column?.getFilterValue();
  const selectedValues = useMemo(() => {
    if (filterValue == null) return new Set<string>();
    const values = Array.isArray(filterValue)
      ? filterValue.filter(Boolean).map(String)
      : [String(filterValue)];
    return new Set(values.map((v) => v.toLowerCase()));
  }, [filterValue]);
  const selectedCount = selectedValues.size;

  const handleValueChange = useCallback(
    (value: string, checked: boolean) => {
      if (!column) return;
      const current = column.getFilterValue();
      const raw = Array.isArray(current)
        ? current.map(String)
        : current
          ? [String(current)]
          : [];
      const next = new Set(raw);
      if (checked) next.add(value);
      else next.delete(value);
      column.setFilterValue(next.size ? Array.from(next) : undefined);
    },
    [column],
  );

  const clearFilters = useCallback(() => {
    column?.setFilterValue(undefined);
  }, [column]);

  if (!column) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-2 px-3", selectedCount > 0 && "bg-primary/5")}
        >
          <ListFilterIcon className="size-4" />
          <span className="text-sm font-medium">{title}</span>
          {selectedCount > 0 && (
            <Badge
              variant="secondary"
              className="rounded-sm px-1 text-[11px] font-normal"
            >
              {selectedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto min-w-36 space-y-3"
        sideOffset={8}
      >
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            {title}
          </p>
          <div className="space-y-2">
            {options.map((option, index) => {
              const checkboxId = `${column.id ?? "filter"}-${index}`;
              const isSelected = selectedValues.has(option.value.toLowerCase());
              const OptionIcon = option.icon;
              const count =
                facetCounts?.get(option.value) ??
                facetCounts?.get(option.value.toLowerCase());

              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors",
                    isSelected ? "bg-muted" : "hover:bg-muted/70",
                  )}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      handleValueChange(option.value, Boolean(checked))
                    }
                    aria-label={`Toggle ${option.label}`}
                  />
                  <Label
                    htmlFor={checkboxId}
                    className="flex w-full items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {OptionIcon && (
                        <OptionIcon className="size-3.5 text-muted-foreground" />
                      )}
                      {option.label}
                    </span>
                    {typeof count === "number" && !Number.isNaN(count) && (
                      <span className="text-xs text-muted-foreground">
                        {count}
                      </span>
                    )}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className={cn(
            "h-8 w-full justify-center rounded-md border-dashed bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
            selectedCount === 0 && "border-muted/40 bg-muted/10 text-muted-foreground/70",
          )}
          onClick={clearFilters}
          disabled={selectedCount === 0}
        >
          Clear filters
        </Button>
      </PopoverContent>
    </Popover>
  );
}
