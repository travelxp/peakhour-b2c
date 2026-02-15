"use client";

import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

export function OrgSwitcher() {
  const { org, orgs, switchOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (orgs.length <= 1) {
    // Single org — just show the name, no dropdown
    return (
      <div className="px-4 py-2">
        <p className="text-sm font-medium truncate">{org?.name || "No org"}</p>
      </div>
    );
  }

  async function handleSwitch(orgId: string) {
    if (orgId === org?._id || switching) return;
    setSwitching(true);
    try {
      await switchOrg(orgId);
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-accent/50 rounded-md transition-colors"
      >
        <span className="font-medium truncate">{org?.name || "Select org"}</span>
        <svg
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border bg-popover p-1 shadow-md">
            {orgs.map((o) => (
              <button
                key={o._id}
                onClick={() => handleSwitch(o._id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors",
                  o._id === org?._id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "hover:bg-accent/50"
                )}
                disabled={switching}
              >
                <span className="truncate">{o.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {o.role}
                </span>
              </button>
            ))}
            <div className="my-1 h-px bg-border" />
            <a
              href="/onboarding/add-business"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
            >
              + Add business
            </a>
          </div>
        </>
      )}
    </div>
  );
}
