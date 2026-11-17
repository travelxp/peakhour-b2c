import type { PageApproval } from "./approvals-format";

export type { PageApproval } from "./approvals-format";

/*
 * Page approvals: who signed off which exact content of which page.
 *
 * A page that makes claims is published only while an approval here carries the page's CURRENT contentHash
 * (src/lib/seo/review-manifest.ts computes it; docs/seo/review-manifest.json lists it). Change the page's copy or its
 * claims and the hash moves, the approval no longer matches, and the page needs a new approval.
 *
 * ★ MACHINE-EDITED. The CMS approval screen (peakhour-api, /v1/cms/site-reviews) appends a row by text edit and opens a
 *   PR. Keep one object per line, in the format of approvals-format.ts, between the two marker lines, sorted by pageId.
 *   A later row for a pageId replaces the earlier one: the api removes the old line.
 * ★ source "placeholder" rows record the pages that were already published when approvals began (owner sign-off by
 *   capability record, 2026-11-15). They are honest placeholders, not a review of today's copy; the CMS lists them under
 *   its "placeholder" tab until each gets a real "cms" row.
 */

export const PAGE_APPROVALS: readonly PageApproval[] = [
  // approvals:begin
  { pageId: "commerce", contentHash: "sha256:16f01632a5455756652b5ecf97a848e00ce9c04f619d94b181f8e40fd985df41", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "contact", contentHash: "sha256:7d80b860a091f48754609a7e845956705b55e06506430dd36dc8dfc1a99cb7e4", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "content", contentHash: "sha256:3e4b472c09d69e216c8eb27a2345fb3f77bbdc1a6937e5eca06f7693bce11afd", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "feature.peakhour.summit", contentHash: "sha256:3696a4809be0b36fdc5a46edb1facb59a136e5968ba0a0c47bd3649c8cd3b98c", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "features.brand.voice", contentHash: "sha256:01f0bb84506f257795c4143b84e3258e6ccdcf2960527faab8486c731ebdcd64", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "features.google.business.profile.management", contentHash: "sha256:06c9b20a4b6bc950f667a9bc84e8897f90b6c40e1804929e0f9e61f2adc3fcf8", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "features.index", contentHash: "sha256:726d086bf2e9c6408ba699c60d88da09234902b5c05e99a5915d3164b158ff67", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "features.local.listing.health", contentHash: "sha256:4e491d3eaed5a350524ec803e42af05141b97353f18798f587af13793c3b0518", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "features.review.management", contentHash: "sha256:f4d5cfed5be477bcd91a9bd484bbe9370b99d659df51b746b2b3fd3d5fd629d8", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "features.social.media.content", contentHash: "sha256:376ca1ae851c2d376de4717c3ed6bdef9f8e7bb895b42df38469040ce88157ef", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "growth", contentHash: "sha256:caf383726e8eddebb67e42423f6ffb8f96673b3ff9133ff4c548b0e31d1966ec", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "home", contentHash: "sha256:8ea59b2041d4f541244fda1b6124b5a8195fff03a70e9d9332ecf9008f7cda34", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "how.it.works", contentHash: "sha256:e3c21e960d62e56d00cc40ded4ae90b3a51f9ca96963e478f16aefc891990a3b", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "integrations.beehiiv", contentHash: "sha256:22ead43827f2fa79fd78af8b3743aa5370834e789ab166dd60ed1c7a17d89235", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "integrations.facebook", contentHash: "sha256:5c3424c72577fc2a14050b93815dbb286e203a3b24bc7b462639c25a008d0583", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "integrations.google.business.profile", contentHash: "sha256:72ecc0f641d8fe35eec5a6f59b66b49282cd40138ef0670a8e7cde3aed48626e", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "integrations.index", contentHash: "sha256:f58312d4bf6bcae062249c515e7616e36bbf9d5544b70b6273750416a4be6a10", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "integrations.instagram", contentHash: "sha256:c860c9b4c99f5eb67fe7f84a64f9a6251e13d425b9d11541556e2ff5124ebf31", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "integrations.linkedin", contentHash: "sha256:8e428815fdee54671a2b126e4c2aff45dd6c9b26cef0f2be0799f8164ac61a5a", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "integrations.meta.ads", contentHash: "sha256:4fc5509a27dee027664548c4244c4e63ec1acb2fe4f69ee481676c9d63e3bf4e", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "integrations.whatsapp", contentHash: "sha256:220be56da6aa9e1e9d001d90924dc8ac19c784f372505bf925e755334af0b4c7", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "integrations.x", contentHash: "sha256:53ca00ed35eda2794e2b105232cb3c8b06e73758c1b41453645f1b7d9b1a84ef", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "integrations.x.ads", contentHash: "sha256:fbed5033cbc60e5ec25a17834cc75c6072482ac4691ce126441d04e17fffad12", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "launch.partner", contentHash: "sha256:990ee45e32f69e2e8d1714a4d3cbb360017d91d6b95917d10aa0cfe68f278b09", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "legal.cookies", contentHash: "sha256:701e07c5f41d5c6c5299c54c3f7e30aa24d6f41b2119715b9abd48a30dc29c18", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "legal.data.deletion", contentHash: "sha256:6ab9b62e35f88a012230dc3c8f407bb6c674c249c589c9570c2ecf6f3d768a79", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "legal.privacy", contentHash: "sha256:013fac6ef2d1a2ccf1630c679fcbd1585ff5b14c9cb1ce51c953b63a4c27f775", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "legal.terms", contentHash: "sha256:2e63e835d63150fdd550774852bd84e382dd6fef5d4c4f83ae23420a8d495a3a", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "peaks", contentHash: "sha256:ec910c6dcc51022721ffe20bc5f1266f74ff80762c8cb6ff499af5497ab28092", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "presence", contentHash: "sha256:519c0ac229edaad39a1da0f317befa0ca2c163ebd2b7076fe8596b522a6b80c2", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "pricing", contentHash: "sha256:adb1094335585d05d2603780ac2837bcd682fc15fda05d3ae271a874d9d4f842", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "pricing.teams", contentHash: "sha256:4dad2e536b8b521b82f2d90003e0253d9c5c5a8862fee9fafcf90352390411d1", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify", contentHash: "sha256:a1d7d87413ad2f4fd6f93f896100559c758f66fd92f6260b80fcf573696702af", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features", contentHash: "sha256:558ca2d7faea98dc6e18d24e80800641617070b95053beff8fd2b4cee2d57dac", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.ai.blog.generator", contentHash: "sha256:665f592722f2d22bdf44556b0dd2bc8494c5b0258ad75112b6d283debfe2218f", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.ai.growth.campaigns", contentHash: "sha256:a6462af9645740d0e6b094141216d1ed99b567ed214aef07a1d9a9086828d6d6", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.ai.product.descriptions", contentHash: "sha256:fc1018d39fbc422b3f246a8b9acc6aafc6b21affba49df3a8f005c83a090712a", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.ai.seo", contentHash: "sha256:309e125b033b8f87df821abcfe516403f5193acd2802880bd4c1e59691b07e00", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.ai.shopping.assistant", contentHash: "sha256:50e4ce3c2a0f6a6aa2a3331fbcbd863e2b4050551c8afa2d36f90e715dcb4846", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.automatic.markdowns", contentHash: "sha256:d02b3ccedb0d79821182612c0cd9f3bca2a14bcfead95affc85da35cd1682056", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.bundles", contentHash: "sha256:f04a176f01344ea23ce0bffa390b91fc861e9360b90d9648a1924094a10ae5f5", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.cart.upsells", contentHash: "sha256:fb8cdb4ab3e7a4f51995da12a5f1103b922617e24add15b4e44efa25c8ade9b9", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.customer.conversation.insights", contentHash: "sha256:ccea3cf99e5fb8fd3cac3f41e8be9767b15ab12538af0c99fdfc85afc505e1bd", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.frequently.bought.together", contentHash: "sha256:35218d3401a3746db0be426e954cceb3621d19de128135ce09749502fc613c6b", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.inventory.alerts", contentHash: "sha256:7eefec73c87a5e88d00ff3b230cb2c580a4b92d2a63f6a0c1187f151514a4794", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.merchandising.ab.testing", contentHash: "sha256:d68c5db24766b59aa5cab5ad1e4bcfeb94030af1be44045ed6dfa15ed57f28c7", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.product.finder", contentHash: "sha256:1868ff253eebfc3bc8fb4e2da2c570cede475cba6921fdb03e992db415acf12b", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.product.recommendations", contentHash: "sha256:64295b5093f2abcd077094b0d6b53b7b436bdf1735d7cf594d918bc439a7060d", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.seo.audit", contentHash: "sha256:95e517773cc0ea1b4bc1a7b72e5e003df188116c5f4edc0df2b269f54748eea4", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.whatsapp.ai.shopping", contentHash: "sha256:8058ed3f8e70c0042ec0a00da096c7f2f59643046634f71b473bc111911cfd37", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "shopify.features.whatsapp.cod.confirmation", contentHash: "sha256:9f6a639aeb0d054916ba36dcfef0648bda52439653e3e707ebb6d5333041d361", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "support", contentHash: "sha256:2f2b92bec60060bf0b3d2951aeb0ae2f1f0750427d072db35c400b15a269595d", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  { pageId: "trust.data.processing", contentHash: "sha256:df3c389f72989d2c04771038f5784429115c35d6e651886f9a517c948120910c", reviewer: "owner", approvedAt: "2026-11-15", source: "placeholder" },
  // approvals:end
];
