# Claude Code: Peakhour global SEO/AEO implementation handoff

**Source of truth:** `Peakhour_SEO_AEO_Bible_v1.md` (v1.0.0, 2026-11-15).  
**Candidate page register:** `Peakhour_SEO_AEO_Page_Inventory_v1.csv` (178 ideas, **not** an approved publishing queue).  
**Human-readable counterpart:** `Peakhour_SEO_AEO_Bible_v1.docx`.

## First instruction to Claude Code

Read the entire Bible before planning routes, pages, translations or metadata. This specification governs public marketing SEO/AEO architecture, but actual product availability must be verified independently from the codebase, integrations, test results and Product-approved capability records. Never treat a candidate URL or a marketing mockup as evidence that the feature exists.

Implement in phases:

1. Audit production route inventory, existing Next.js version, Vercel rewrites, canonical hostname, `/shopify` accessibility, robots, sitemap, pricing and supported integrations. Produce a gap report; do not rewrite URLs prematurely.
2. Create typed page/capability/integration/competitor registries and validation, with explicit editorial status and evidence gating. Import CSV entries as **ideas only**.
3. Add centrally generated metadata, canonicals, language alternates, structured data, sitemap and internal-link components; add noindex/404 handling for drafts and unsupported locales.
4. Implement templates for global pillars/features/solutions/industries/integrations and the dedicated Shopify ecosystem, preserving existing public URL equity.
5. Build i18n foundations now (English unprefixed; French, German, Spanish, Spain-specific Spanish and Brazilian Portuguese later). No fake or boilerplate-translated indexable pages.
6. Add automated tests for route collisions, content/evidence gates, 200/404 behavior, canonical/hreflang reciprocals, internal links, sitemap, robots, schema consistency and redirects.
7. Submit PRs in small slices with an explicit risk list, changed URLs, screenshots and test output. Ask for Product/Growth approval before publishing sensitive or unverified claims.

## Prompts for implementation review

- Show the exact inventory of existing routes vs proposed routes, including potential collisions and old URL preservation.
- List every page marked for publication, its evidence records, approvals, unique search intent and target CTA.
- Show which marketed capabilities are confirmed live on Shopify vs web vs WordPress/WooCommerce vs planned Amazon seller integration.
- Produce a current hreflang matrix containing **only published translations**, and validate reciprocal links.
- Explain how a new shipped feature updates its pillar, industry, platform, solution and comparison pages without generating duplicate pages automatically.
- Prove that unknown URLs and unpublished locale pages return a real 404, not a soft-404 homepage.

**Do not generate all 178 candidate pages.** Build the system and release reviewed pages progressively.
