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
    latestOverageRevenueUsd: number;
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
  overagePeriods: { period: string; amountUsd: number; orgCount: number; overageGb: number }[];
  recommendations: string[];
}

export function getStorageIntelligence(): Promise<StorageIntelligence> {
  return api.get<StorageIntelligence>("/v1/cms/storage-intelligence/summary");
}
