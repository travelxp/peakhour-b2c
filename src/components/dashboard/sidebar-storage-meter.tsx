"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getStorageUsage } from "@/lib/api/media";
import { StorageMeter } from "@/app/(site)/dashboard/media/storage-meter";

/**
 * Always-visible storage meter in the dashboard sidebar footer (Media
 * Manager / R2 plan §7 L13). Compact; links to the Media Manager. Hidden
 * when the sidebar is collapsed to icons, and renders nothing until usage
 * loads (or if it errors — the meter is secondary, never blocks the UI).
 */
export function SidebarStorageMeter() {
  const { data } = useQuery({
    queryKey: ["storage-usage"],
    queryFn: getStorageUsage,
    staleTime: 60_000,
  });

  if (!data) return null;

  return (
    <Link
      href="/dashboard/media"
      className="block rounded-md px-2 py-1.5 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden"
      aria-label="Storage usage — open Media Manager"
    >
      <StorageMeter usage={data} compact />
    </Link>
  );
}
