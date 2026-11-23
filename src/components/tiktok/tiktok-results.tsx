"use client";

import Link from "next/link";
import { TikTokStatusList } from "@/components/tiktok/tiktok-status-list";
import { useTikTokAvailable, useTikTokItems } from "@/hooks/use-tiktok-content";
import { TIKTOK_PATH } from "@/lib/tiktok-content-view";

/**
 * TikTok posts and where each one stands, for Results. Draws nothing unless TikTok is available for this org and holds at least one post.
 * A post that TikTok has not taken yet reads "Waiting for TikTok approval", never as published.
 */
export function TikTokResults() {
  const { available } = useTikTokAvailable();
  const items = useTikTokItems(available);
  const list = items.data?.items ?? [];
  if (!available || list.length === 0) return null;
  return (
    <section aria-labelledby="results-tiktok" className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="results-tiktok" className="text-sm font-semibold">
          TikTok
        </h2>
        <Link href={TIKTOK_PATH} className="text-sm font-medium underline underline-offset-4">
          Open TikTok
        </Link>
      </div>
      <TikTokStatusList items={list} />
    </section>
  );
}
