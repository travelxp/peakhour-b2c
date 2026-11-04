import { api } from "@/lib/api";

/** CMS Storage Intelligence / P&L summary (Media Manager / R2 plan §18). CMS-only. */
export interface StorageIntelligence {
  asOf: string;
  r2CostPerGbMo: number;
  totals: {
    totalBytes: number;
    softDeletedBytes: number;
    totalGb: number;
    softDeletedGb: number;
    fileCount: number;
    orgCount: number;
  };
  pnl: {
    r2CostUsd: number;
    softDeleteCarryUsd: number;
    /** The month the pack revenue below is for: the latest CLOSED month, or the current one when none has closed yet. */
    packRevenuePeriod: string | null;
    /** True when no month has closed yet, so the figure is the current month so far (and the net understates). */
    packRevenuePartialMonth: boolean;
    /** Storage-pack revenue in that month, in Peaks (the `drive.storage_pack` charges). */
    latestPackRevenuePeaks: number;
    /** The same, at the Peak LIST price: what a customer actually pays per Peak depends on how they bought it. */
    latestPackRevenueUsdAtListPrice: number;
    peakValueUsd: number;
    netUsd: number;
  };
  sourceMix: { source: string; bytes: number; gb: number; count: number }[];
  perPlan: { plan: string; totalBytes: number; gb: number; orgCount: number; r2CostUsd: number }[];
  topConsumers: {
    orgId: string;
    name: string;
    plan: string;
    totalBytes: number;
    gb: number;
    fileCount: number;
    storageOverrideGb?: number;
  }[];
  reclaimable: { kind: string; bytes: number; gb: number; count: number }[];
  packPeriods: { period: string; peaks: number; usdAtListPrice: number; orgCount: number }[];
  recommendations: string[];
}

export function getStorageIntelligence(): Promise<StorageIntelligence> {
  return api.get<StorageIntelligence>("/v1/cms/storage-intelligence/summary");
}
