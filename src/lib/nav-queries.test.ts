import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  contentHubCatalogQuery,
  contentHubIntegrationsQuery,
  inboxReviewsQuery,
  integrationsListQuery,
  pipelineIdeasQuery,
} from "./nav-queries";
import { growthV2HomeQuery } from "./api/growth-v2";
import { commerceStoresQuery } from "@/hooks/use-commerce-stores";
import { jobsListQuery } from "@/hooks/use-jobs";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const DASH = "app/(site)/dashboard";

describe("prefetched queries keep their keys", () => {
  it("pins every key array", () => {
    expect({
      contentHubIntegrations: contentHubIntegrationsQuery.queryKey,
      contentHubCatalog: contentHubCatalogQuery.queryKey,
      pipelineIdeas: pipelineIdeasQuery.queryKey,
      inboxReviews: inboxReviewsQuery.queryKey,
      growthHome: growthV2HomeQuery("biz1").queryKey,
      growthHome90d: growthV2HomeQuery("biz1", "90d", "holdout").queryKey,
      commerceStores: commerceStoresQuery("biz1").queryKey,
      jobsRecent: jobsListQuery("recent").queryKey,
      jobsActive: jobsListQuery("active").queryKey,
      integrationsList: integrationsListQuery("org1", "biz1").queryKey,
    }).toMatchInlineSnapshot(`
      {
        "commerceStores": [
          "commerce-stores",
          "biz1",
        ],
        "contentHubCatalog": [
          "content-hub-catalog",
        ],
        "contentHubIntegrations": [
          "content-hub-integrations",
        ],
        "growthHome": [
          "growth-v2",
          "biz1",
          "home",
          "7d",
          "last_period",
        ],
        "growthHome90d": [
          "growth-v2",
          "biz1",
          "home",
          "90d",
          "holdout",
        ],
        "inboxReviews": [
          "inbox-reviews",
        ],
        "integrationsList": [
          "integrations-list",
          "org1",
          "biz1",
        ],
        "jobsActive": [
          "jobs",
          "list",
          "active",
        ],
        "jobsRecent": [
          "jobs",
          "list",
          "recent",
        ],
        "pipelineIdeas": [
          "pipeline-ideas",
        ],
      }
    `);
  });
});

describe("pages read the same objects the prefetch warms", () => {
  const cases: Array<[string, string]> = [
    [`${DASH}/content/page.tsx`, "useQuery(contentHubIntegrationsQuery)"],
    [`${DASH}/content/page.tsx`, "useQuery(contentHubCatalogQuery)"],
    [`${DASH}/strategist/page.tsx`, "useQuery(pipelineIdeasQuery)"],
    [`${DASH}/inbox/page.tsx`, "useQuery(inboxReviewsQuery)"],
    [`${DASH}/integrations/page.tsx`, "integrationsListQuery(org?._id, business?._id)"],
    ["lib/api/growth-v2.ts", "useQuery(growthV2HomeQuery(business?._id, window, compare))"],
    ["hooks/use-commerce-stores.ts", "useQuery(commerceStoresQuery(business?._id, isAuthenticated))"],
    ["hooks/use-jobs.ts", "useQuery(jobsListQuery(status))"],
  ];
  it.each(cases)("%s uses %s", (file, needle) => {
    expect(read(file)).toContain(needle);
  });
});
