"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { META_COUNTRY_CODES, countryName } from "@/lib/meta-ads-form";

/**
 * The shared country picker: chosen countries as removable chips and one plain select to add another (the same list
 * everywhere a merchant picks countries for Meta: a new campaign, an ad set, and an ad account's "Used for" markets).
 */
export function CountryPicker({
  value,
  onChange,
  invalid,
  describedBy,
  labelFor,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
  /** Whose countries these are, when several pickers share a page ("Add a country for CMPL"). */
  labelFor?: string;
}) {
  const suffix = labelFor ? ` for ${labelFor}` : "";
  const options = useMemo(
    () =>
      [...new Set([...META_COUNTRY_CODES, ...value])].map((code) => ({
        code,
        name: countryName(code),
      })),
    [value],
  );
  const addable = options.filter((o) => !value.includes(o.code));
  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Chosen countries${suffix}`}>
          {value.map((code) => (
            <li key={code}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {countryName(code)}
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-background/60"
                  aria-label={`Remove ${countryName(code)}`}
                  onClick={() => onChange(value.filter((c) => c !== code))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {/* A plain select: one list, no search needed, and it works the same on a phone. */}
      <select
        aria-label={`Add a country${suffix}`}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value=""
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        className="h-9 w-64 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">
          {value.length ? "Add another country" : "Choose a country"}
        </option>
        {addable.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
