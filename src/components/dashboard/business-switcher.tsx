"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

export function BusinessSwitcher() {
  const { business, businesses, switchBusiness } = useAuth();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!businesses || businesses.length <= 1) {
    // Single business — show name, no dropdown
    return business ? (
      <div className="px-4 py-1.5">
        <p className="text-xs text-muted-foreground truncate">{business.name}</p>
      </div>
    ) : null;
  }

  async function handleSwitch(bizId: string) {
    if (bizId === business?._id || switching) return;
    setSwitching(true);
    try {
      await switchBusiness(bizId);
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 rounded-md transition-colors"
      >
        <span className="truncate">{business?.name || "Select business"}</span>
        <svg
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
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
          <div className="fixed inset-0 z-10" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute left-0 right-0 z-20 mt-1 rounded-md border bg-popover p-1 shadow-md"
          >
            {businesses.map((b) => (
              <button
                key={b._id}
                role="option"
                aria-selected={b._id === business?._id}
                onClick={() => handleSwitch(b._id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-xs transition-colors",
                  b._id === business?._id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "hover:bg-accent/50"
                )}
                disabled={switching}
              >
                <span className="truncate">{b.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
