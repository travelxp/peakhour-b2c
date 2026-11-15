---
title: "PEAKHOUR SEO & AEO BIBLE"
subtitle: "Global information architecture, publication controls, localized SEO, page inventory and Claude Code implementation contract"
version: "1.0.0"
status: "Approved architectural baseline; proposed URLs require discovery and editorial gating"
as_of: "2026-11-15"
owner: "Peakhour Product + Growth"
canonical_artifact: "Peakhour_SEO_AEO_Bible_v1.md"
companion_inventory: "Peakhour_SEO_AEO_Page_Inventory_v1.csv"
---

# PEAKHOUR SEO & AEO BIBLE

**Version 1.0.0 | 15 November 2026 | Canonical implementation policy for Claude Code**

> **Purpose.** This file is the normative source of truth for Peakhour's public-site information architecture, SEO/AEO engineering, content ownership, multilingual publishing, page admission rules and launch validation. It is **not** evidence that every proposed page, feature, integration or comparison is live. The companion CSV is the machine-readable candidate page register. **Do not bulk-publish CSV rows.**

**Decision summary.** Peakhour is one AI business platform across the Presence, Commerce, Content, Support and Growth pillars. Industry pages, global features and business solutions belong at the site root. `/shopify` is the Shopify-specific commercial ecosystem, not the parent of Peakhour industries or other platform capabilities. WordPress/WooCommerce are separate deployment surfaces; Amazon seller functionality is a distinct P2 workstream.

**Normative language.** **MUST** = required for release; **SHOULD** = default unless explicitly documented otherwise; **MAY** = optional. **P0/P1/P2** indicate publishing priorities, not implemented status.

**Document map.** Sections 1-5 establish binding decisions, scope ownership and data contracts; Section 6 lists every proposed page; Sections 7-12 specify templates, linking, technical SEO, internationalization, AEO and comparison governance; Sections 13-17 define research, rollout, repository conventions, tests and operational controls; Sections 18-20 contain risks, Claude Code instructions and official references.

---

# 1. Governance and source-of-truth precedence

1. **This Bible** governs public IA, SEO/AEO, locale policy, templates and publishing rules; updates require a versioned PR and named Product/Growth approval.
2. **Capability registry + verified release evidence** govern what the product actually does, on which surface and in which region. Marketing copy MUST NOT override this registry.
3. **Page registry + editorial evidence** govern which URL is approved for publication. The CSV attached to this Bible is the initial **candidate list**, not the live registry.
4. **Code, Shopify listing and real integrations** are implementation facts, not automatically marketing permission. If actual capabilities conflict with this document, Claude Code MUST flag the discrepancy in its PR instead of silently misrepresenting either source.
5. **Official search engine and framework documentation** governs technical behavior when platform standards change. Reconcile changes through a versioned Bible update.

## 1.1 Required owner approvals

| Decision | Required owner | Evidence |
| --- | --- | --- |
| Publish a feature promise | Product | Tested release, platform and region support |
| Publish a comparison fact or pricing | Growth + reviewer | Source link, observed date, methodology |
| Publish legal/privacy/security copy | Legal or designated policy owner | Policy text and review date |
| Publish localized commercial page | Local reviewer + Product | Translation QA, actual market availability |
| Publish case study or performance claim | Merchant owner + Growth | Consent, measurement basis, period and source |
| Change canonical URL or redirects | Engineering + Growth | Redirect map, Search Console baseline, QA |

## 1.2 Architecture decisions locked in

- Sitewide `/industries/*` = industry demand, independent of store platforms.
- Sitewide `/features/*` = genuinely cross-platform capabilities; `/solutions/*` = platform-agnostic customer problems.
- Retain root pillar URLs `/presence`, `/commerce`, `/content`, `/support`, `/growth`.
- Retain `/shopify` as the Shopify acquisition landing page; give it Shopify-only feature, comparison, guide, solution and tool children as demand proves useful.
- Use `/wordpress`, `/woocommerce` and later `/amazon` for dedicated integration ecosystems only when supported; `/platforms` is the directory.
- `/integrations/*` documents a connector; it is distinct from an installation-focused platform landing page.
- `/compare/*` covers platform-wide competitors; `/shopify/compare/*` covers Shopify-specific comparisons. Avoid duplicate comparisons with identical intent.
- English URLs remain unprefixed; future locales use prefixes. Preserve existing URLs wherever possible.
- All production pages are emitted from a stable `pageId` + canonical route resolver, not manually assembled URL strings scattered across components.

# 2. Live-site baseline and evidence limitations

**Snapshot reviewed 15 Nov 2026.** Public homepage identifies one AI team across selling, support, content, growth and Google visibility, references Shopify, WordPress, WhatsApp, Google Business Profile, LinkedIn, X and Beehiiv, and presents a launch-partner program. The pricing page describes five pillars, a Peaks wallet and multiple integrations, with varying launch-stage labels. Public access to `/shopify` could not be reliably retrieved through the browsing source on the review date. Therefore the Shopify capability list below incorporates previous stakeholder descriptions as **proposed / verification-required**, not as a current live-functionality certification.

**Pre-implementation audit MUST resolve:** exact canonical hostname (`www.peakhour.ai` currently serves public pages and bare domain redirects); current route behaviors and unexpected homepage fallbacks; Shopify public page reachability; production sitemap and robots availability; actual five-pillar landing-page content; consistent pricing across Shopify and general pricing; current app installation URL; implemented language support and permissions; real approval/undo behavior.

**Never infer shipping status from a mock storefront, pricing card, design spec or past conversation.** Store proof must come from verified end-to-end behavior, release notes, tests or an approved product evidence record.

# 3. Platform model and content ownership

## 3.1 Five pillars

| Pillar | Commercial ownership | Default canonical hub |
| --- | --- | --- |
| Presence | Google Business Profile, local presence, listings, reviews | `/presence` |
| Commerce | Shopping assistance, catalogue-powered merchandising, conversion | `/commerce` |
| Content | Brand-aware blogs, social, newsletters and product content | `/content` |
| Support | Conversation workflows, WhatsApp and customer support | `/support` |
| Growth | Campaign planning, paid media, audiences and acquisition | `/growth` |

A feature may use multiple pillars; record **one primary owner** and optional secondary pillars. No pillar should claim cross-platform support that has not been verified.

## 3.2 Scope decision tree

1. Is the visitor asking **what Peakhour does in general**? → `/features/slug` or the pillar page.
2. Is the visitor asking **what business result to achieve**? → `/solutions/slug`.
3. Is the visitor asking **how this works in a particular industry**? → `/industries/slug`.
4. Is the visitor asking **how this works on Shopify/WordPress/WooCommerce/Amazon**? → platform-specific page, if implementation differs materially.
5. Is the visitor asking **what external service is connected**? → `/integrations/slug`.
6. Is the visitor comparing products? → `/compare/competitor` if broad; `/shopify/compare/competitor` if Shopify-specific.
7. Is the intent informational, calculative or evidentiary? → `/guides`, `/tools` or `/case-studies` respectively.

**Avoid pages that answer the same query with the same content.** A global industry page may link directly to `/shopify` or Shopify feature pages; do not generate `/shopify/industries/{industry}` merely to fill a matrix. A second industry/platform page requires demonstrably distinct implementation screenshots, terminology, FAQs, case studies and search demand.

## 3.3 Canonical high-level sitemap

```text
/
├── presence/ | commerce/ | content/ | support/ | growth/
├── pricing/ | peaks/ | how-it-works/ | security/
├── features/             # cross-platform capability detail
├── solutions/            # business outcome intent
├── industries/           # industry intent, independent of platform
├── for/                  # audiences, not industries
├── platforms/            # directory
├── shopify/              # Shopify ecosystem and app conversion
│   ├── features/  solutions/  compare/
│   ├── alternatives/ guides/  tools/
├── wordpress/            # future verified platform experience
├── woocommerce/          # future verified platform experience
├── amazon/               # P2; seller capabilities, not website control
├── integrations/         # third-party connectors
├── compare/              # platform-independent comparisons
├── guides/  tools/  case-studies/
└── fr/ de/ es/ es-es/ pt-br/ ... [when localized and approved]
```

# 4. URL naming, canonicals and redirects

1. Public canonical origin SHOULD remain `https://www.peakhour.ai` if live hosting confirms the current redirect pattern. Store host in central config. Do **not** blindly migrate to the bare host.
2. URLs use lowercase ASCII, hyphen-separated slugs, no query-string localization and no deployment IDs. Pick and enforce one trailing-slash policy (recommended: no trailing slash except root); 301 the other form.
3. Never relocate `/shopify` to `/platforms/shopify` or to `/en/shopify`. The directory is `/platforms`; the product landing remains `/shopify`.
4. Page IDs are immutable even when slugs change. Registry tracks `canonicalPath`, `historicPaths` and locale variants.
5. Changed URLs need permanent 301/308 redirects, validated source→destination hops and updated internal links, sitemap and canonicals.
6. Query parameters for attribution/filtering MUST NOT create uncontrolled indexable URLs. Choose canonical/robots/noindex based on what the page is; do not robots-block a URL when expecting Google to see its noindex.
7. Faceted pages and site search results are not automatically indexable. All marketing candidate pages require an explicit `indexable` and `published` state.
8. Localization URLs: English unprefixed; `/fr`, `/de`, `/es` (generic Spanish, Latin American editorial targeting), `/es-es` (Spain), `/pt-br` (Brazil). These are **web path prefixes**, not a guarantee that all corresponding translated routes exist.

# 5. Data contracts: capability registry, page registry and localization

The architecture MUST be data-driven. A page references capabilities; capabilities do not get inferred from prose. Candidate pages are never published just because a URL is present in the inventory.

## 5.1 Feature/capability schema (TypeScript contract example)

```ts
type ReleaseStatus = 'idea' | 'planned' | 'development' | 'beta' | 'live' | 'paused' | 'retired';
type Platform = 'web' | 'shopify' | 'wordpress' | 'woocommerce' | 'amazon-seller';
type Locale = 'en' | 'fr' | 'de' | 'es' | 'es-ES' | 'pt-BR';

type Capability = {
  id: string;                       // e.g. commerce.ai_shopping_assistant
  label: string;
  primaryPillar: 'presence'|'commerce'|'content'|'support'|'growth';
  secondaryPillars?: string[];
  implementation: {platform: Platform; status: ReleaseStatus;
    marketCodes: string[]; supportedLocales: Locale[];
    requirements?: string[]; limitations?: string[];
    verifiedAt?: string; evidenceUrls?: string[]}[];
  approvedClaims: {claimId: string; text: string; requiresStatus: 'beta'|'live';
    approvedBy: string; approvedAt: string; evidenceUrl: string}[];
  screenshots?: {src: string; alt: string; type:'actual'|'demo'; verifiedAt:string}[];
  updatedAt: string;
};
```

Example `commerce.ai_shopping_assistant`: record separate records for `shopify` and `woocommerce`; a live Shopify integration does **not** imply a live WooCommerce integration. A `shopify` page may mention a WooCommerce roadmap only as a clearly marked plan.

## 5.2 Page schema (minimum required fields)

```ts
type Page = {
  pageId: string;                   // immutable, e.g. shopify.compare.aisensy
  family: 'core'|'feature'|'solution'|'industry'|'platform'|'integration'|
    'compare'|'guide'|'tool'|'case-study'|'shopify-feature'|'shopify-compare'|string;
  scope: 'global'|'shopify'|'wordpress'|'woocommerce'|'amazon';
  intent: string; queryClusterId?: string;
  primaryPillar?: string; capabilityIds: string[];
  defaultPath: string; parentPageId?: string;
  localization: Record<string, {path: string; status:'draft'|'review'|'published';
    reviewer?: string; publishedAt?: string; localizedKeyword?: string}>;
  editorialStatus: 'idea'|'briefed'|'draft'|'review'|'approved'|'published'|'archived';
  indexable: boolean; canonicalPageId?: string;
  title: string; description: string; h1: string;
  primaryCTA: {label:string; href:string; kind:'trial'|'install'|'waitlist'|'contact'};
  comparisonEvidence?: {competitor:string; sourceUrl:string; observedAt:string; owner:string}[];
  evidenceIds: string[]; owner: string; lastReviewedAt: string;
  relatedPageIds: string[]; redirectsFrom?: string[];
};
```

**Publishing state machine:** `idea → briefed → draft → review → approved → published → archived`. A page MUST NOT be in sitemap or emit a search-indexable 200 response unless `published`, `indexable=true`, locale variant is published and its release/evidence gates pass. Planned/preview pages can return 404 or an approved `noindex` waitlist page; never display a functioning tool or integration that does not exist.

## 5.3 Additional registries

- `competitors`: competitor canonical name, categories, geography, product URL, pricing URL, last-verified date, feature evidence and caveats.
- `integrations`: integration owner, capability mapping, public docs, installation URL, deployment status and supported markets.
- `proof`: consent, source, sample period, sample size, methodology, uncertainty, revocation and expiry.
- `keywords`: locale/country, query, search intent, source, volume/date if known, SERP features, rank baseline, target page ID.
- `redirects`: old path, new path, reason, approving owner and verification status.

# 6. Full proposed page register — inventory and admission rules

**Inventory policy.** The companion CSV contains all proposed English canonical page candidates, with `pageId`, `path`, family, priority, gate and intent. **Do not generate pages from the CSV in bulk.** Each must have keyword research, substantive unique content, product verification (if relevant), ownership and a defined activation CTA. Localization variants are created on demand and are not multiplied into the row count.

**Inventory totals:** 178 candidate pages (P0: 35, P1: 114, P2: 29). This is an opportunity map, not a publishing commitment.

## 6.0 Curated first review queue (20 URLs; not auto-published)

Before Claude Code starts creating pages, Product/Growth should review the following **20 distinct high-leverage routes**. Existing pages should be audited and improved rather than recreated. New pages require all applicable release gates and the editorial process. The list balances platform narrative with early Shopify acquisition and is a **briefing queue, not a publication mandate**.

| Track | Candidate URL | Why review it early |
| --- | --- | --- |
| Platform | `/` | Unify Peakhour positioning and launch-partner CTA |
| Platform | `/pricing` | Resolve pillar/Shopify pricing narrative and conversion |
| Pillar | `/presence` | Own local visibility category and verified Presence capabilities |
| Pillar | `/commerce` | Establish cross-platform Commerce authority |
| Pillar | `/content` | Establish Content capabilities beyond Shopify |
| Pillar | `/support` | Explain channels, inbox and escalation scope |
| Pillar | `/growth` | Explain campaign actions with spending approvals |
| Shopify | `/shopify` | Primary Shopify acquisition and installation destination |
| Shopify feature | `/shopify/features/ai-shopping-assistant` | Core assistant commercial intent |
| Shopify feature | `/shopify/features/product-recommendations` | Merchandising category intent |
| Shopify feature | `/shopify/features/frequently-bought-together` | Specific AOV search intent |
| Shopify feature | `/shopify/features/whatsapp-cod-confirmation` | India/COD high-intent workflow |
| Shopify feature | `/shopify/features/manage-store-from-whatsapp` | Distinctive operator workflow |
| Shopify feature | `/shopify/features/ai-seo` | Separate Shopify organic-growth buying intent |
| Shopify feature | `/shopify/features/ai-product-descriptions` | Product-page optimization intent |
| Shopify comparison | `/shopify/compare/aisensy` | India WhatsApp alternative decision |
| Shopify comparison | `/shopify/compare/interakt` | India WhatsApp/COD decision |
| Shopify comparison | `/shopify/compare/rep-ai` | Shopping-assistant comparison |
| Global industry | `/industries/fashion-apparel` | Establish industry ownership outside `/shopify` |
| Guide | `/shopify/guides/whatsapp-cod-confirmation` | Own practical task intent and link to product |

**Conditional substitution:** if a P0 candidate is not shipped, lacks original evidence, or has little search demand, substitute a verified high-value page; do not publish a speculative claim to satisfy a page count.

## 6.1 Core (26)

**Platform and pillars**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P0 | `/` | Unified AI platform; launch partner acquisition |
| P0 | `/pricing` | Pillar pricing and Peaks pricing narrative |
| P0 | `/peaks` | AI usage currency and billing explainers |
| P0 | `/how-it-works` | Approvals, controls, audit history and workflow overview |
| P0 | `/presence` | Presence pillar overview |
| P0 | `/commerce` | Commerce pillar overview |
| P0 | `/content` | Content pillar overview |
| P0 | `/support` | Support pillar overview |
| P0 | `/growth` | Growth pillar overview |
| P0 | `/platforms` | Supported platforms directory |
| P0 | `/features` | Cross-platform features directory |
| P0 | `/solutions` | Business outcomes directory |
| P0 | `/industries` | Industries directory |
| P0 | `/integrations` | Connectors directory |
| P0 | `/guides` | Guides directory |
| P0 | `/tools` | Free tools directory |
| P0 | `/compare` | Global comparison directory |
| P0 | `/case-studies` | Customer evidence directory |

**Audience and trust**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/for/agencies` | AI operations for agencies and consultants |
| P1 | `/for/marketing-teams` | AI marketing workflows for lean teams |
| P1 | `/for/ecommerce-brands` | Unified AI workflows for ecommerce businesses |
| P1 | `/for/local-businesses` | Local presence and customer engagement |
| P1 | `/for/enterprises` | Enterprise security and governance overview |
| P1 | `/security` | Product security and data handling summary |
| P1 | `/trust/ai-controls` | Human approvals, rollback and AI governance |
| P1 | `/trust/data-processing` | Data protection and retention information |

## 6.2 Feature (30)

**Presence**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/features/google-business-profile-management` | Manage Google Business Profile from Peakhour |
| P1 | `/features/review-management` | Manage business reviews |
| P1 | `/features/local-listing-health` | Audit local business listings |
| P1 | `/features/local-search-visibility` | Local search presence insights |

**Commerce**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/features/ai-shopping-assistant` | Cross-platform AI shopping assistant |
| P1 | `/features/product-recommendations` | AI product recommendations |
| P1 | `/features/cart-upsell-cross-sell` | Cart upsell and cross-sell automation |
| P1 | `/features/whatsapp-commerce` | WhatsApp commerce experiences |
| P1 | `/features/cod-order-confirmation` | COD confirmation through WhatsApp |
| P1 | `/features/catalogue-optimization` | Product catalogue optimization |
| P1 | `/features/inventory-insights` | Inventory intelligence and actionable alerts |

**Content**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/features/ai-blog-writer` | AI-assisted blogs and website publishing |
| P1 | `/features/ai-product-descriptions` | AI product content generation |
| P1 | `/features/brand-voice` | Brand voice for content |
| P1 | `/features/social-media-content` | Social media content creation |
| P1 | `/features/newsletter-writer` | Newsletter content generation |
| P1 | `/features/content-approval-workflows` | Content review and approvals |
| P1 | `/features/seo-content-optimization` | Search-oriented content improvement |

**Support**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/features/ai-customer-support` | AI-assisted customer support |
| P1 | `/features/unified-inbox` | Multi-channel support inbox |
| P1 | `/features/whatsapp-customer-support` | WhatsApp customer support |
| P1 | `/features/conversation-insights` | Customer intent and conversation analytics |

**Growth**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/features/ai-campaign-planning` | AI-assisted marketing plans |
| P1 | `/features/google-meta-ad-management` | Google and Meta campaign operations |
| P1 | `/features/linkedin-growth` | LinkedIn growth workflows |
| P1 | `/features/audience-segmentation` | Audience and lead segmentation |
| P1 | `/features/ai-search-visibility` | AI-assisted search visibility monitoring |

**Cross-pillar**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P2 | `/features/ai-business-agent` | AI agent with controlled business actions |
| P2 | `/features/automated-workflows` | Business workflow automation |
| P2 | `/features/approval-and-undo` | AI approval and reversal controls |

## 6.3 Solution (15)

**Acquisition**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/solutions/get-found-on-google` | Increase local search discoverability |
| P1 | `/solutions/improve-seo-visibility` | Improve organic visibility |
| P1 | `/solutions/get-discovered-in-ai-search` | Increase AI search discoverability |
| P1 | `/solutions/generate-marketing-content` | Create more on-brand marketing content |
| P1 | `/solutions/automate-ad-campaigns` | Reduce manual campaign operations |

**Conversion**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/solutions/increase-ecommerce-conversion` | Improve ecommerce purchase conversion |
| P1 | `/solutions/increase-average-order-value` | Lift average order value |
| P1 | `/solutions/automate-pre-purchase-questions` | Answer pre-sale shopper questions |
| P1 | `/solutions/personalize-product-discovery` | Personalize product discovery |
| P1 | `/solutions/reduce-cod-rto` | Reduce COD-related return-to-origin exposure |

**Operations**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/solutions/automate-customer-support` | Scale customer support operations |
| P1 | `/solutions/manage-customer-conversations` | Consolidate conversations |
| P1 | `/solutions/optimize-product-catalogue` | Improve catalogue information and searchability |
| P1 | `/solutions/reduce-manual-store-work` | Reduce repetitive store operations |
| P1 | `/solutions/manage-online-reviews` | Improve response processes for reviews |

## 6.4 Industry (13)

**Retail and ecommerce**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/industries/fashion-apparel` | AI workflows for fashion and apparel brands |
| P1 | `/industries/beauty-cosmetics` | Beauty and skincare commerce workflows |
| P1 | `/industries/electronics` | Electronics buying assistance and content |
| P1 | `/industries/home-furniture` | Home and furniture product assistance |
| P1 | `/industries/jewellery-accessories` | Jewellery and accessories ecommerce |
| P1 | `/industries/food-beverage` | Food and beverage brand workflows |
| P1 | `/industries/health-wellness` | Wellness business content and customer service |

**Services and media**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P2 | `/industries/restaurants-hospitality` | Local presence and hospitality engagement |
| P2 | `/industries/professional-services` | Local services visibility and engagement |
| P2 | `/industries/education-training` | Education marketing and enquiry workflows |
| P2 | `/industries/publishers-media` | Publisher content and growth operations |
| P2 | `/industries/real-estate` | Real estate business marketing workflows |
| P2 | `/industries/travel-experiences` | Travel brand content and customer engagement |

## 6.5 Platform (5)

**Platform hubs**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P0 | `/shopify` | Shopify app and integrated suite overview |
| P1 | `/wordpress` | WordPress plugin and content workflow overview |
| P1 | `/woocommerce` | WooCommerce commerce integration overview |
| P2 | `/amazon` | Amazon seller integration; not storefront control |
| P2 | `/bigcommerce` | BigCommerce integration, if shipped |

## 6.6 Integration (12)

**Channels and connectors**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/integrations/whatsapp` | WhatsApp Business workflows |
| P1 | `/integrations/google-business-profile` | Google Business Profile connectivity |
| P1 | `/integrations/linkedin` | LinkedIn publishing and growth |
| P1 | `/integrations/x` | X publishing integration |
| P1 | `/integrations/beehiiv` | Newsletter publishing via Beehiiv |
| P1 | `/integrations/google-ads` | Google Ads integration |
| P1 | `/integrations/meta-ads` | Meta advertising integration |
| P1 | `/integrations/google-search-console` | Google Search Console data integration |

**Additional connectors**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P2 | `/integrations/shopify` | Shopify connection reference; distinct from /shopify landing |
| P2 | `/integrations/wordpress` | WordPress connector reference |
| P2 | `/integrations/woocommerce` | WooCommerce connector reference |
| P2 | `/integrations/amazon-seller` | Amazon seller account connector |

## 6.7 Shopify Feature (21)

**Assistance**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P0 | `/shopify/features/ai-shopping-assistant` | Shopify AI shopping assistant |
| P0 | `/shopify/features/ai-chatbot` | Shopify AI chatbot |
| P0 | `/shopify/features/whatsapp-ai-shopping` | WhatsApp AI shopping for Shopify |

**Merchandising**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P0 | `/shopify/features/product-recommendations` | Shopify product recommendations |
| P0 | `/shopify/features/frequently-bought-together` | Shopify frequently bought together |
| P0 | `/shopify/features/smart-rails` | Shopify Smart Rails merchandising |

**Store operations**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P0 | `/shopify/features/whatsapp-cod-confirmation` | Shopify WhatsApp COD confirmation |
| P0 | `/shopify/features/manage-store-from-whatsapp` | Store operations and approvals through WhatsApp |

**Search and content**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P0 | `/shopify/features/ai-seo` | Shopify AI SEO automation |
| P0 | `/shopify/features/ai-product-descriptions` | Shopify product descriptions |
| P0 | `/shopify/features/seo-audit` | Shopify store SEO audit |

**Extended features**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/shopify/features/ai-blog-generator` | Blog generation within Shopify workflows |
| P1 | `/shopify/features/cart-upsells` | Shopify cart upselling |
| P1 | `/shopify/features/merchandising-ab-testing` | Shopify merchandising A/B tests |
| P1 | `/shopify/features/inventory-alerts` | Shopify inventory alerts |
| P1 | `/shopify/features/purchase-orders` | Shopify purchase order workflows |
| P1 | `/shopify/features/automatic-markdowns` | Shopify automated markdown proposals |
| P1 | `/shopify/features/ai-search-visibility` | Shopify AI search discovery monitoring |
| P1 | `/shopify/features/catalogue-health` | Shopify catalogue health |
| P1 | `/shopify/features/customer-conversation-insights` | Shopify conversation and demand insights |
| P1 | `/shopify/features/ai-growth-campaigns` | Shopify marketing campaigns via Peakhour |

## 6.8 Shopify Solution (6)

**Merchant outcomes**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/shopify/solutions/reduce-cod-rto` | Reduce COD failure for Shopify stores |
| P1 | `/shopify/solutions/increase-aov` | Raise Shopify AOV with AI recommendations |
| P1 | `/shopify/solutions/convert-more-shoppers` | Improve Shopify conversion |
| P1 | `/shopify/solutions/automate-pre-sales-support` | Automate Shopify pre-sales support |
| P1 | `/shopify/solutions/optimize-product-pages` | Optimize Shopify product pages |
| P1 | `/shopify/solutions/streamline-store-operations` | Automate Shopify store workflows |

## 6.9 Shopify Compare (15)

**WhatsApp-first competitors**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P0 | `/shopify/compare/aisensy` | Peakhour versus AiSensy for Shopify |
| P0 | `/shopify/compare/interakt` | Peakhour versus Interakt for Shopify |
| P0 | `/shopify/compare/wati` | Peakhour versus Wati for Shopify |

**AI assistant**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P0 | `/shopify/compare/gorgias` | Peakhour versus Gorgias for Shopify |
| P0 | `/shopify/compare/rep-ai` | Peakhour versus Rep AI for Shopify |

**Merchandising**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/shopify/compare/rebuy` | Peakhour versus Rebuy |
| P1 | `/shopify/compare/nosto` | Peakhour versus Nosto |
| P1 | `/shopify/compare/limespot` | Peakhour versus LimeSpot |

**SEO**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/shopify/compare/tinyimg` | Peakhour versus TinyIMG |
| P1 | `/shopify/compare/searchpie` | Peakhour versus SearchPie |
| P1 | `/shopify/compare/seowill` | Peakhour versus SEOWILL |

**Other WhatsApp and assistants**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P2 | `/shopify/compare/zoko` | Peakhour versus Zoko |
| P2 | `/shopify/compare/tidio` | Peakhour versus Tidio |
| P2 | `/shopify/compare/manifest-ai` | Peakhour versus Manifest AI |
| P2 | `/shopify/compare/shopify-inbox` | Peakhour versus Shopify Inbox |

## 6.10 Shopify Alternatives (5)

**Shopify category alternatives**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/shopify/alternatives/whatsapp-apps` | Best Shopify WhatsApp apps |
| P1 | `/shopify/alternatives/ai-shopping-assistants` | Best Shopify shopping assistants |
| P1 | `/shopify/alternatives/product-recommendations` | Best Shopify recommendation apps |
| P1 | `/shopify/alternatives/seo-apps` | Best Shopify SEO apps |
| P1 | `/shopify/alternatives/all-in-one-growth-apps` | Best all-in-one Shopify growth apps |

## 6.11 Shopify Guide (8)

**How-to content**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/shopify/guides/whatsapp-cod-confirmation` | Set up WhatsApp COD confirmation |
| P1 | `/shopify/guides/ai-chatbot-setup` | Configure an AI shopping assistant |
| P1 | `/shopify/guides/increase-average-order-value` | Shopify AOV strategies |
| P1 | `/shopify/guides/seo-checklist` | Shopify SEO checklist |
| P1 | `/shopify/guides/product-description-seo` | Shopify product description SEO |

**Advanced guidance**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P2 | `/shopify/guides/ai-search-optimization` | AI search visibility for Shopify |
| P2 | `/shopify/guides/merchandising-experiments` | Shopify merchandising experiments |
| P2 | `/shopify/guides/inventory-automation` | Shopify inventory automations |

## 6.12 Shopify Tool (4)

**Lead generation tools**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/shopify/tools/cod-rto-calculator` | COD RTO exposure calculator |
| P1 | `/shopify/tools/upsell-revenue-calculator` | Upsell revenue scenario calculator |
| P1 | `/shopify/tools/seo-health-checker` | Shopify public site SEO checker |

**Other tools**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P2 | `/shopify/tools/ai-assistant-roi` | Shopping assistant ROI estimator |

## 6.13 Compare (6)

**Platform-wide competitor intent**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/compare/klaviyo` | Peakhour versus Klaviyo: overlapping marketing capabilities |
| P1 | `/compare/omnisend` | Peakhour versus Omnisend: marketing automation |
| P1 | `/compare/hubspot` | Peakhour versus HubSpot: appropriate overlapping workflows |
| P1 | `/compare/hootsuite` | Peakhour versus Hootsuite: content and social |
| P1 | `/compare/buffer` | Peakhour versus Buffer: content scheduling |
| P1 | `/compare/jasper` | Peakhour versus Jasper: content operations |

## 6.14 Guide (6)

**Foundational knowledge**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P1 | `/guides/ai-search-optimization` | AI search visibility best practices |
| P1 | `/guides/seo-vs-aeo` | SEO versus AEO: practical differences |
| P1 | `/guides/ai-customer-engagement` | Automate customer conversations responsibly |
| P1 | `/guides/local-seo-checklist` | Local SEO checklist for businesses |
| P1 | `/guides/brand-voice-guide` | Build a consistent brand voice |
| P1 | `/guides/multilingual-content-seo` | International and multilingual content SEO |

## 6.15 Tool (4)

**Global free tools**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P2 | `/tools/local-seo-audit` | Local presence audit tool |
| P2 | `/tools/seo-meta-preview` | SERP title and description preview |
| P2 | `/tools/utm-builder` | Campaign UTM builder |
| P2 | `/tools/roi-calculator` | AI marketing ROI scenario estimator |

## 6.16 Case Study (2)

**Verified results**

| Priority | Proposed path | Primary search / job to be done |
| --- | --- | --- |
| P2 | `/case-studies/shopify-fashion-brand` | Example Shopify fashion brand case study; only publish after real proof |
| P2 | `/case-studies/local-business-presence` | Example local business case study; proof required |

# 7. Page template system and unique-value thresholds

## 7.1 Feature page: universal and platform variant

**Cross-platform**: one clear product proposition; what is verified; supported channels/platforms; screenshot or workflow; prerequisites; inputs/outputs; approval boundaries; limitations; integration links; pricing context; FAQs grounded in actual functionality; direct CTA. **Platform variant**: installation/setup, platform-native workflow, API permission details only as supported, platform screenshots, platform-specific FAQs and CTA. A near-duplicate platform page must be merged into global and linked to `/shopify` instead.

## 7.2 Solution page

Explain the merchant problem and when it matters; alternative approaches; step-by-step Peakhour workflow; realistic examples; measurable KPI definitions; implementation prerequisites; related features; CTA. Don't say Peakhour guarantees a particular lift unless there is substantiated, applicable evidence.

## 7.3 Industry page

One industry-specific problem summary, three to five validated use cases, what pillars solve them, examples or demos, integrations supported, one relevant case study when available, risks/industry restrictions, and platform chooser. Industry pages are **global by default**. Shopify-specific variants require independent search intent and substantive unique platform evidence.

## 7.4 Comparison page (brand-safe)

Neutral above-the-fold answer; comparable buyer use cases; side-by-side dimensions tied to documented features; clear definitions of `Yes`, `Partial`, `Not documented`, `Not supported`, `Unknown`; independent links to both vendors; pricing table with date/currency/country; suitability scenarios for each provider; limitations; last checked date; author/reviewer; updated screenshots where permitted; CTA. Never invent competitor pricing, omissions, reviews, revenue claims or reviews. `Not documented` must not be represented as `No`.

## 7.5 Guide and free tool

Guide: original actionable instructions, examples, source links, reviewer, update date, problem→feature bridges, appropriate illustrations. Tool: **working** client/server logic; methodology, input validity, assumptions, caveats, privacy handling, plain text result that can be copied, contextual CTA. A design mockup labeled as a calculator MUST NOT be indexed as a working tool.

## 7.6 Evidence threshold before creating an adjacent page

Create a distinct page only if it has (a) a different primary intent or audience; (b) at least two genuinely unique substantive sections; (c) evidence/screenshot/workflow differentiation; (d) a clear internal linking destination and conversion CTA; (e) enough locale-specific relevance if localized. Otherwise prefer a section on the existing canonical page.

# 8. Internal linking policy

## 8.1 Ownership graph

```text
Homepage ↔ 5 pillar hubs ↔ cross-platform feature pages
   │                 ↘ global solutions ↔ industry pages
   ├─ /platforms ↔ /shopify ↔ Shopify feature / solution / comparison pages
   │                         ↔ Shopify guides / tools / alternatives
   ├─ /integrations ↔ relevant feature or platform
   └─ global guides / tools / case studies ↔ related features / solutions
```

**Required links per published page:** a crawlable breadcrumb to parent; at least one relevant pillar/parent link; a primary relevant CTA; two or more contextual links to nearby useful pages where available; reciprocal family navigation where helpful. Global industry pages link to supported platform destinations **only** after supported status is verified. Shopify-focused comparison pages should link to Shopify home and the exact competing workflow feature—not indiscriminately to every product page. This is an editorial relevance rule, not an artificial target link count.

**Anchor examples:** `AI shopping assistant for Shopify`, `WhatsApp COD confirmation workflow`, `AI product recommendations`, `Peakhour vs AiSensy for Shopify`. Avoid generic `click here`, hidden keyword stuffing and sitewide mega-footer link farms. Navigation must be `<a href>` in rendered HTML.

## 8.2 Cannibalization governance

Use `queryClusterId` to claim one primary search intent per canonical page, plus related secondary terms. Detect overlaps in editorial review and Search Console. Merge or retarget competing pages rather than multiplying near-duplicates. Examples:

- `/features/ai-shopping-assistant` = broad cross-platform capability; `/shopify/features/ai-shopping-assistant` = Shopify-specific install/demo.
- `/industries/fashion-apparel` = industry solution; no `/shopify/industries/fashion` until unique evidence and SERP justify it.
- `/compare/klaviyo` = broad product overlap; do not create `/shopify/compare/klaviyo` with identical copy.
- `/shopify/compare/aisensy` should address both `Peakhour vs AiSensy` and `AiSensy alternative for Shopify` where intent is substantially identical.

# 9. Technical SEO contract for Next.js + Vercel

## 9.1 Infrastructure and rendering

- Render substantive SEO content in initial server HTML (static/ISR/SSR as appropriate), not exclusively after client hydration. Interactive calculators may hydrate later, but headings, explanations and internal links must be crawlable.
- Use a single metadata factory driven by `pageId`, locale and page registry: unique title, description, canonical absolute URL, Open Graph/Twitter metadata, `robots`, `alternates.languages` and `html lang`.
- Production indexable page = HTTP 200, semantic HTML, unique H1, valid self-canonical, unique metadata, visible substantive content, crawlable internal links, index permitted, included in XML sitemap.
- Unknown, draft or unpublished locale URL = real 404 or 410 as appropriate, not a homepage fallback returning 200 (`soft 404` risk).
- Use correct 301/308 redirects for legacy/renamed pages; no chains, locale loops, or cross-country auto-redirects.
- All assets have descriptive filenames/alt text; image dimensions, lazy-loading as appropriate, video transcript/captions and a text alternative when video is essential.
- Aim for good Core Web Vitals on the current field thresholds (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at p75), without using a green lab score as the only release gate.

## 9.2 Sitemaps, robots and indexability

- `robots.txt` must be available, include allowed public content and link to sitemap index; avoid blanket blocks for legitimate Googlebot. Keep admin, preview, authentication and internal API endpoints out of indexed search content.
- Sitemap index may group `core`, `pillars`, `shopify`, `features`, `solutions`, `industries`, `guides`, `tools` and locale paths for operational clarity. Each URL must be canonical, published, indexable and HTTP 200.
- Emit meaningful `<lastmod>` only for substantive content changes, not every deployment.
- Parameterized searches, campaign trackers, previews and internal admin states must be controlled intentionally; use `noindex` on crawlable pages if needed, not `Disallow` where the crawler must see `noindex`.
- Do not treat sitemap publication as a guarantee of indexing.

## 9.3 Structured data (only supported and truthful)

| Page | Allowed by relevance | Do not do |
| --- | --- | --- |
| Home / brand | `Organization`, `WebSite` | Invent endorsements or social profiles |
| Software feature/product | `SoftwareApplication` / `WebApplication` if properties satisfy guidance | Fabricate price, review counts or aggregate ratings |
| Hierarchical public pages | `BreadcrumbList` | Mark up nonexistent navigation |
| Informational articles | `Article` where appropriate | Fake author or update date |
| Videos | `VideoObject` when actual accessible video/metadata exists | Video rich-result markup without a video |
| FAQs | Semantically structured FAQs for users | Expect universal FAQ rich results from FAQPage markup |

Structured data MUST match visible content. Audit eligibility against current Google documentation before release.

## 9.4 Canonical and hreflang principles

- Use self-canonical for unique published language pages; each genuine translation should usually canonicalize to itself, not to English.
- If same-language regional versions are substantially identical, evaluate consolidation/canonical strategy on a per-URL basis; `hreflang` alone does not cure duplicate content issues.
- `hreflang` must include self and reciprocal published alternates, valid language/region codes and no unpublished URLs. Use `x-default` on appropriate fallback pages.
- `es-419` is **not** a Google-supported `hreflang` region. Use `es` for generic Spanish, `es-ES` for Spain, and country-specific valid tags (e.g. `es-MX`) if created later.
- Canonical URLs and hreflang must agree across HTML and sitemap; choose one primary hreflang representation per route to reduce drift.

# 10. Localization and market expansion

**Engineering now; localized rollout P2.** Start English-only without pre-publishing empty localized paths. The data model and route resolver must support every locale from P0. Translation is localized product marketing, not literal string substitution.

| Audience | Internal locale | URL prefix | Google hreflang | Release |
| --- | --- | --- | --- | --- |
| Global English: India, US, UK, Canada, AU, NZ | `en` | none | `en` | P0 |
| France | `fr` | `/fr` | `fr` or `fr-FR` if FR-targeted | P2 |
| Germany | `de` | `/de` | `de` or `de-DE` if DE-targeted | P2 |
| Spanish-speaking LATAM (generic) | `es` | `/es` | `es` | P2 |
| Spain | `es-ES` | `/es-es` | `es-ES` | P2 |
| Brazil | `pt-BR` | `/pt-br` | `pt-BR` | P2 |
| Mexico, later if unique offering | `es-MX` | `/es-mx` | `es-MX` | Conditional |

Use `next-intl` or equivalent locale-aware Next.js routing with **English default unprefixed** (`localePrefix: 'as-needed'`) and disabled automatic locale redirects where necessary to preserve stable public URLs; verify behavior in the actual installed Next.js version. `proxy.ts` is the convention for Next.js 16; earlier projects may use `middleware.ts`. Do not change framework versions solely to match this document.

**Translation lifecycle:** English source → locale-specific keyword research → AI-assisted draft → native reviewer → product/legal review → local screenshots, currency, CTAs and disclaimer QA → publish → generate reciprocal hreflang → monitor. Do not translate every comparison by default. Translate pages according to real local search queries, competitive products and capability availability. If a localized child page is unavailable, the language switcher can link to the nearest suitable localized ancestor **with explicit notice**, not silently pretend that an untranslated page exists.

Markets and languages are distinct: countries may share a language page, while market-specific checkout terms, privacy disclosures or availability may require deeper differentiation. Do not conflate India/US/UK with separate English-language SEO copies absent unique content.

# 11. AI search / AEO evidence strategy

**Policy:** AI search optimization starts with strong SEO, indexable helpful pages, clear factual content and verifiable sources. Google explicitly states no special markup or AI-only files are required to appear in AI Overviews/AI Mode. `llms.txt` may be considered optional machine-readable navigation for other consumers but MUST NOT be sold as a ranking lever or used to replace canonical content.

## 11.1 Answerability pattern

Each major page SHOULD give a direct factual answer in the first substantive section, then details, examples, boundaries, sources, demonstrations and further reading. Use real terminology, semantic heading hierarchy, human-readable tables when useful and stable public URLs. Write for customers first; citation-friendly content is a by-product of usefulness.

## 11.2 Entity consistency

Maintain one approved glossary for Peakhour, five pillars, Peaks, Smart Rails, store-management approvals and supported integrations. Consistent brand spelling, product descriptions, legal organization identity, official social profiles and contact links help reduce confusion across search engines. Do not publish synthetic praise, fake awards, unverifiable customer logos or invented third-party endorsements.

## 11.3 Originality strategy

Create opt-in merchant benchmark studies, documented feature walkthroughs, real product screenshots, methodology pages, interactive tools and permissioned case studies. This is more defensible than high-volume generic AI articles or automatically translated near-duplicates. Source citations must support comparative and technical claims. Store screenshot version/source in the registry so outdated UIs can be removed.

## 11.4 Measurability limitations

AI-assistant citations and impressions are not comprehensively reported in one universally reliable source. Track observable referral sources, brand and product search growth, Search Console visibility, manually audited AI-answer citations with prompt/method/date, and qualified conversion. Do not imply that every AI engine exposes exact mention/click counts or promise rankings.

# 12. Competitor, regional and evidence governance

Before generating a competitor page, create a brief with: who is being compared, merchant's decision criteria, overlap map, sources for each capability, pricing and limits, observation dates, region/currency and an editorial view of where **each** competitor fits best. Review high-traffic pages at least quarterly and when product/pricing changes are detected. If a factual claim cannot be supported, set it to `Unknown` or remove it.

**Price and benefit claims:** When Peakhour general pricing and Shopify offer differ, explicitly distinguish billing surface, partner discount, trial conditions and currency. No false annualized savings, arbitrary conversion lift or invented performance benchmarks.

**Market expansion:** France/Germany/Spain/Brazil and LATAM pages must pass local product, support, privacy, translation and billing gates. GDPR, country-specific consumer obligations and messaging consent should be reviewed by counsel; SEO copy is not a substitute for legal compliance. Do not claim WhatsApp, Google or marketplace API capabilities in all countries without verification.

**Amazon P2:** Distinguish marketplace seller workflows (catalogue, listings, ads, reports, seller support subject to platform permissions) from storefront chat/checkout control. Build `/amazon` only when partner/permission model and supported seller actions are verified.

# 13. Keyword research, prioritization and page-admission scoring

Every proposed page requires a locale-specific keyword cluster and a documented SERP review. Search volume numbers are not present in this Bible and MUST NOT be invented. Suggested research inputs: Search Console, competitive SERP analysis, approved keyword data providers and on-site/search-support queries.

Score each candidate (0-5 per dimension): qualified buyer intent 25%, Peakhour capability fit 25%, demonstrated differentiation 20%, market relevance 15%, attainable discovery opportunity 10%, evidence readiness 5%. **Hard gates override scores** (feature not verified, no unique content, misleading intent, unavailable locale, legal issue).

Use a quarterly cluster map to identify cannibalization, feature gaps and new page briefs. Don't infer product roadmap from searches: research can generate proposals, not automatically make product promises.

# 14. Phase plan — work packages for Claude Code

## P0 — architecture and December 2026 Shopify launch

**Code foundation:** (1) inventory existing routes and canonical hostname; (2) implement page/feature/locale registry; (3) add validation schemas and type checks; (4) metadata factory; (5) server-rendered templates; (6) sitemap/robots/structured data; (7) English stable routes; (8) i18n readiness; (9) redirects and 404 policy; (10) analytics instrumentation; (11) CI SEO quality gates.

**Editorial launch:** retain homepage, five pillar pages, pricing, Shopify page; select and approve approximately 8–12 genuinely verified Shopify feature/solution pages; produce 3–5 current competitor comparisons only after source review; add one working tool or guide where useful. **The inventory's P0 tag denotes evaluation priority, not permission to ship.**

**Pre-launch blockers:** pricing inconsistencies, app install URL, product proof, homepage fallback routing, noindex staging, localization architecture, sitemap/canonical tests.

## P1 — expand breadth from verified demand

Broaden cross-platform feature hubs, global industry pages (start fashion, beauty, electronics), product-specific outcomes, agencies, WordPress/WooCommerce only after verified, Shopify comparisons and tools. Use first 60–90 days of Search Console/activation data to decide which templates and topic clusters get more investment.

## P2 — global and multi-platform scale

Activate reviewed French, German, Spanish (Spain and LATAM generic), Brazilian Portuguese. Add Amazon seller integration if verified, local competitors, region-specific evidence, high-intent localized guides and benchmark datasets. No automatic cross-product of all pages × platforms × countries × languages.

# 15. Proposed repository design

```text
src/
  app/
    [locale]/...                  # optional internal locale segment, route resolver maps public URLs
    sitemap.ts / robots.ts        # or segmented sitemap generators
  components/seo/
    Breadcrumbs.tsx
    PageStructuredData.tsx
    LocaleSwitcher.tsx
    ContextualLinks.tsx
  lib/seo/
    page-registry.ts             # candidates != publishable page records
    route-resolver.ts            # immutable pageId -> locale-aware URL
    metadata.ts                  # canonical, title, robots, OG, hreflang
    sitemaps.ts
    structured-data.ts
    related-links.ts
    validators.ts
  lib/capabilities/
    registry.ts                  # platform x market x release status + evidence
  i18n/
    routing.ts
    messages/*.json
content/
  seo/pages/*.mdx                # only reviewed and approved content
  seo/briefs/*.yaml
  seo/competitors/*.yaml
  seo/evidence/*.yaml
  seo/redirects.yaml
  capabilities/*.yaml
  integrations/*.yaml
  research/keyword-clusters/*.csv
scripts/
  validate-seo.ts
  validate-hreflang.ts
  check-internal-links.ts
  check-release-claims.ts
  audit-indexable-routes.ts
```

The folder layout is a proposal; adapt to the existing repository without duplicating or replacing established infrastructure unnecessarily. Use MDX only if the existing content system benefits; structured CMS records with equal validation are acceptable. Use a stable `pageId` independent of path and translations.

## 15.1 Example page record (illustrative, not approved for launch)

```yaml
pageId: shopify.compare.aisensy
family: shopify-compare
scope: shopify
defaultPath: /shopify/compare/aisensy
queryClusterId: en-shopify-aisensy-comparison
editorialStatus: idea
indexable: false
requiredCapabilityIds:
  - commerce.ai_shopping_assistant
  - commerce.cod_order_confirmation
requires:
  - competitor_feature_verification
  - approved_peakhour_product_facts
  - current_pricing_review
  - product_owner_approval
primaryCTA:
  kind: waitlist
  href: /shopify
```

# 16. CI acceptance criteria and smoke test suite

Claude Code MUST add automated checks and include their results in each PR. The table below forms the minimum release gate.

| ID | Test | Pass criteria |
| --- | --- | --- |
| T01 | Unique page IDs/routes | No duplicate ID, canonical path or locale route |
| T02 | Publication state | Draft/unapproved/unsupported pages not indexable or in sitemap |
| T03 | Canonical origin | Exact configured host and self-canonical for published unique pages |
| T04 | Metadata | Title, description, H1, OG and locale language available and consistent |
| T05 | Crawlability | Primary HTML content and standard `<a href>` internal links server rendered |
| T06 | Redirects | Old routes permanent redirect in one hop; no loops or homepage fallback |
| T07 | 404 handling | Nonexistent public URLs return real 404, not 200 template fallback |
| T08 | Sitemap | Only live indexable 200 canonical URLs; `lastmod` reflects material updates |
| T09 | Robots | Public content not accidentally disallowed; noindex/robots conflicts detected |
| T10 | Hreflang | Published alternates only, valid locale codes, self and reciprocal links |
| T11 | Language switcher | Correct localized equivalent or explicit nearest-ancestor fallback |
| T12 | Claim gating | Shipped/available marketing claims backed by capability + evidence registry |
| T13 | Comparisons | Every measurable claim sourced and date-stamped; unknown != no |
| T14 | Structured data | Parseable JSON-LD, matches visible page, no fabricated review fields |
| T15 | Cross-linking | No broken links; page has parent and relevant conversion destination |
| T16 | Core Web Vitals | Measured; regressions flagged with thresholds/owner |
| T17 | Consent and analytics | UTM attribution preserved, consent/privacy handling audited |
| T18 | Accessibility | Semantic headings, controls, keyboard interactions, alt text |
| T19 | Locale publication | Never index machine-only or incomplete locale pages |
| T20 | Security | Preview/admin, secrets and authenticated data never exposed via SEO routes |

**Integration smoke tests:** GET `/shopify` and `/industries/fashion-apparel` only if published; inspect response HTML, canonical/OG, site navigation and CTA. Request `/fr/shopify` before French publication and ensure it does not return a false published 200. Request a random nonexistent feature URL and require 404. Inspect `/sitemap.xml` and `/robots.txt`. Test one Shopify comparison's evidence links and one language cluster's reciprocal hreflang.

# 17. Operating cadence, metrics and autonomy guardrails

**Weekly:** Search Console indexing and site issues, high-intent queries, broken links, route errors, conversion events, newly broken release claims. **Monthly:** top-20 page improvements, internal link gaps, comparison source freshness, AEO visibility observations. **Quarterly:** full topic cluster consolidation, locale expansion review, new product features, market prioritization and competitor matrix.

**Attribution:** page view → CTA click → waitlist/trial → installation/connection → verified activation → paid conversion, split by locale, pillar, platform, source and campaign. Do not confuse one SEO click with a paid merchant; count activated businesses and revenue attribution. Aggregate data in a privacy-conscious way, with consent and retention policy reviewed.

**Autonomous content agents MAY** research, create briefs, propose keywords/links, draft translated copy, report stale comparisons, and open pull requests. They MUST NOT independently change product `live` status, assert regulated/comparative claims, publish pages without approval, fabricate reviews, create fake statistics, or silently alter canonicals, robots or redirects. Editorial + Product approval is required before production publication.

# 18. Risk register and unresolved questions

| Risk / unknown | Release response |
| --- | --- |
| Shopify page unavailable to crawler at audit time | Verify production routing and indexing before link expansion |
| Pillar URLs appeared to render shared homepage during audit | Inspect route manifests, rewrites and caching; do not infer missing product functionality |
| Current pricing messages vary by surface | Align offers and distinguish pillar/subscription/Shopify promotions |
| Broad marketing language vs feature ship date | Gated capability registry and approved claims |
| Shopify vs global feature duplication | Intent map, canonical ownership and unique evidence threshold |
| Country pages that merely swap country names | Require local content and original value; otherwise skip |
| AI content at scale | Human quality checks, original evidence, no unreviewed bulk publication |
| Amazon integration restrictions | Model seller permissions and actions separately |
| New features continuously shipping | Registry-triggered reviews; marketing page remains withheld until verified |
| Localized sites without supported language UI | Product/marketing parity gate and explicit disclaimers |

# 19. Claude Code first-run instructions (copy into implementation ticket)

1. Audit repository routes, content pipeline, Next.js version, Vercel host rewrites, robots and sitemaps. **Do not overwrite functioning routes.**
2. Diff actual current site against this Bible and produce a concise `docs/seo/IMPLEMENTATION_GAPS.md` with decisions requiring Product approval.
3. Add typed capability registry and separate page publication registry. Import candidates from companion CSV **as idea/draft only**.
4. Implement metadata/route/locale builders and release-gating validators with unit tests.
5. Implement public feature, solution, industry, platform and comparison templates with semantic HTML and relevant internal linking.
6. Configure English unprefixed and future locale prefixes, preserving `/shopify`.
7. Implement sitemap/robots/schema/redirect pipeline and smoke tests, including 404/soft-404 safeguards.
8. Submit PRs in thin vertical slices. Include screenshots, route diff, indexability audit, test output and a changelog entry for each slice.
9. Do not auto-publish the inventory; generate editorial briefs, evidence gaps and implementation issues for pages that are not ready.
10. Treat this Bible as policy baseline, not permission to fabricate capabilities. Update this spec through reviewed PRs whenever an architectural decision changes.

# 20. Public reference standards and reviewed sources

The links below are live reference sources for technical behavior, **not** proof that a proposed Peakhour feature is shipped. Checked 15 Nov 2026. Consult latest versions during implementation.

1. Peakhour homepage: https://www.peakhour.ai/
2. Peakhour pricing: https://www.peakhour.ai/pricing
3. Google Search Essentials: https://developers.google.com/search/docs/essentials
4. Google SEO starter guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
5. Google localized versions / hreflang: https://developers.google.com/search/docs/specialty/international/localized-versions
6. Google multi-regional websites: https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
7. Google canonicalization: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
8. Google AI features and site owners: https://developers.google.com/search/docs/appearance/ai-features
9. Google AI optimization guide: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
10. Google spam policies: https://developers.google.com/search/docs/essentials/spam-policies
11. Google crawlable links: https://developers.google.com/search/docs/crawling-indexing/links-crawlable
12. Google software application markup: https://developers.google.com/search/docs/appearance/structured-data/software-app
13. Google breadcrumb markup: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
14. Next.js i18n guide: https://nextjs.org/docs/app/guides/internationalization
15. next-intl routing: https://next-intl.dev/docs/routing/configuration
16. next-intl proxy and locale negotiation: https://next-intl.dev/docs/routing/middleware

---

**CHANGE CONTROL** — v1.0.0 / 2026-11-15: Initial platform-first architectural baseline, page inventory, controlled Shopify acquisition ecosystem, P2 multilingual market expansion, release-gated capability claims and engineering acceptance criteria.

**Companion file:** `Peakhour_SEO_AEO_Page_Inventory_v1.csv` (candidate pages; not a ready-to-publish queue).

