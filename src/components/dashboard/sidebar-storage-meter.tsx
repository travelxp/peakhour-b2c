"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getStorageUsage } from "@/lib/api/media";
import { StorageMeter } from "@/components/drive/storage-meter";

/**
 * Always-visible storage meter in the dashboard sidebar footer (Media
 * Manager / R2 plan §7 L13). Compact; links to Drive. (The one
 * "Add space" dialog is mounted by the dashboard layout, not here: on mobile
 * this footer lives in a sheet that unmounts when closed.) Hidden
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
      href="/dashboard/drive?tab=storage"
      className="block rounded-md px-2 py-1.5 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden"
    >
      <StorageMeter usage={data} compact />
    </Link>
  );
}
