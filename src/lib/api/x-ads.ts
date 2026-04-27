import { api } from "@/lib/api";

export interface XAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  approvalStatus: string;
}

export interface XFundingInstrument {
  id: string;
  type: string;
  currency: string;
  description: string;
  status: string;
}

export interface XCampaign {
  id: string;
  name: string;
  status: string;
  dailyBudgetAmountLocalMicro: number;
  totalBudgetAmountLocalMicro?: number;
  startTime?: string;
  endTime?: string;
  fundingInstrumentId: string;
}

export interface XCampaignAnalytics {
  id: string;
  impressions: number;
  engagements: number;
  clicks: number;
  spend: number;
  retweets: number;
  likes: number;
  replies: number;
}

export interface CreateCampaignInput {
  accountId: string;
  name: string;
  fundingInstrumentId: string;
  dailyBudgetAmountLocalMicro: number;
  totalBudgetAmountLocalMicro?: number;
  status?: "ACTIVE" | "PAUSED";
  startTime?: string;
  endTime?: string;
}

export const xAdsApi = {
  listAccounts: () => api.get<XAdAccount[]>("/v1/x/ads/ad-accounts"),

  listFundingInstruments: (accountId: string) =>
    api.get<XFundingInstrument[]>("/v1/x/ads/funding-instruments", { accountId }),

  listCampaigns: (accountId: string) =>
    api.get<XCampaign[]>("/v1/x/ads/campaigns", { accountId }),

  createCampaign: (input: CreateCampaignInput) =>
    api.post<XCampaign>("/v1/x/ads/campaigns", input),

  setCampaignStatus: (
    accountId: string,
    campaignId: string,
    status: "ACTIVE" | "PAUSED"
  ) =>
    api.patch<unknown>(`/v1/x/ads/campaigns/${campaignId}/status`, {
      accountId,
      status,
    }),

  analytics: (params: {
    accountId: string;
    campaignIds: string[];
    startDate: string;
    endDate: string;
  }) =>
    api.get<XCampaignAnalytics[]>("/v1/x/ads/analytics", {
      accountId: params.accountId,
      campaignIds: params.campaignIds.join(","),
      startDate: params.startDate,
      endDate: params.endDate,
    }),
};

const MICROS = 1_000_000;

export function dollarsToMicros(dollars: number): number {
  return Math.round(dollars * MICROS);
}

export function microsToDollars(micros: number): number {
  return micros / MICROS;
}
