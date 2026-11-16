# Public site audit, 2026-11-16

Scope: every public page on https://dev.peakhour.ai, 69 routes (the 56 registry pages, the public routes outside the registry, the 404 and the dev-only design kit). Each was captured with Playwright at 390 and 1280 px, full page, with the visible text read from the DOM. The standards are the Daylight theme as on `/shopify` and `docs/brand/website-voice.md`. Claims were checked against `src/lib/seo/capabilities.ts` (approved 2026-11-15). This audit writes no page code; DL-1, DL-2 and DL-3 execute it.

Lanes: **DL-1** owns the global Daylight default, /pricing, /pricing/teams, /contact and the legal pages. **DL-2** owns /auth and the flow pages. **DL-3** (new) owns everything else.

## What is true across the site

1. **Two sites in one.** All 56 registry pages and `/shopify`, `/peaks`, `/coming-soon`, `/launch-partner` and the 404 render in Daylight (peach hero, orange CTA, grey bands, navy CTA band). Everything built before Daylight still renders the old theme: `/pricing`, `/pricing/teams`, `/contact`, `/auth` and its sub-pages, `/claim/*`, `/reconnect/wordpress`, `/shopify/connect`, `/share`, `/growth/confirm`, the four legal pages and `/help/data-retention`. The old signs are a cream ground, gold gradient buttons, italic serif gold accents and black panels. `/pricing` and `/auth` are the loudest.
2. **The trial contradiction (owner decision).** The announcement bar on the home page says "Try every module free for 14 days — no credit card required", and `/pricing`, `/peaks`, `/auth` and `/contact` say or imply a free trial, while every header and hero CTA says "Join the waitlist". Both cannot be true. Every rewrite that touches a trial line is held until the owner says which.
3. **The registry template is consistent but heavy.** One shared template (`src/components/marketing/seo/templates.tsx`) produces the same sections on every page. Recurring problems, each fixed once in the template or in `render.tsx`:
   - the hero status card repeats the status chips of the grid below it;
   - every capability card has a grey "Limit:" footnote, and a twelve-card page (/commerce) reads as a wall;
   - "Each feature and connection, on its own page." cards show the raw SEO title with a pipe and a site suffix ("Meta Ads integration: list and pause campaigns | Peakhour");
   - "Checked against the product on 2026-11-15" and "What it does not do" are audit language shown to readers;
   - the FAQ lead-in "Short answers, and what each one depends on." and the "Keep going." heading are filler;
   - "Join the waitlist" is the only CTA in the header of pages whose hero says "Install on Shopify".
4. **Old positioning survives in three legal documents.** `/terms`, `/privacy-policy` and `/data-deletion` still call Peakhour "an AI-powered marketing (automation) platform" that analyses content and manages LinkedIn ad campaigns. This is stale and needs legal review before the wording changes.
5. **Fake or false proof found:**
   - `/auth` shows a fake activity panel with unlabelled numbers ("Answered 34 shoppers on WhatsApp today", "3 leads in inbox", "12 conversations resolved"); two of those features are not live;
   - `/coming-soon` says "conversations in one inbox, answered by AI or by you", which is not live (`support.channel_inbox`, `support.ai_replies`), and lists WordPress under "Works with";
   - `/peaks` says "Prices shown for IN" beside dollar prices, and "Peaks need an active paid plan" beside "your free trial included";
   - `/pricing/teams` lists SLAs, a dedicated success manager, a DPA and priority support, none of which is in `capabilities.ts`.
6. **Writing.** No banned hype word and no exclamation mark survived. The dominant faults are length and abstraction: hero paragraphs of 40 to 55 words, "Built, and not switched on yet." for "Coming soon", "five modules" framing on `/`, `/about`, `/pricing` and `/how-it-works`, and slogan headings ("Own how you show up on Google"). Italic serif accents appear only on the old-theme pages.


## Pages

Priority: P0 old theme, or a false or stale claim. P1 weak writing or UX. P2 polish.

### `/`

- **Owning files:** `src/app/(site)/page.tsx`, `src/content/pages/home.ts`, `src/lib/audience-segments.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Daylight: yes (peach hero, orange CTA, grey bands). 1280: the hero card "The five modules today" is repeated as the "The five modules" grid right under it; the navy "One plan, one wallet" tile sits as a sixth card in a five-card grid; a navy panel "Everything on one plan. More power when you grow." holds three nested boxes; the integrations strip mixes Live and Coming soon in one grid. About 3,000 px on desktop and 5,400 px on a phone, eight sections before the FAQ. 390: the hero runs eleven lines before the CTA; each persona card carries a problem paragraph, a solution paragraph and chips.
- **Writing:**
  - "Still running one business across 10 different tools?" -> Run your store, content, ads and Google listing from one place. ("10" is an invented figure; lead with the outcome.)
  - "Built for businesses doing five jobs with one team." -> Who Peakhour is for.
  - "Everything on one plan. More power when you grow." -> One plan for everything Peakhour does. Pay for the AI work you use, in Peaks.
  - "has Peakhour Summit review growth decisions before you make them (D2C card)" -> In beta, Peakhour Summit reviews growth decisions before you make them. (growth.peakhour_summit is approved at beta only; the sentence omits that.)
  - "Try every module free for 14 days — no credit card required. (announcement bar)" -> Held until the owner decides whether a trial is open. The bar promises a trial while every CTA says Join the waitlist.

### `/pricing`

- **Owning files:** `src/app/(site)/pricing/page.tsx`, `src/components/marketing/pricing/*`
- **Owner lane:** DL-1
- **Priority:** P0
- **Design:** OLD THEME. Italic serif gold accent ("One plan." in italic serif amber), cream ground, gold gradient buttons and eyebrow rules, a black hero panel listing the five modules with green "Included", a gold-bordered suite card. 1280: the black panel and the suite card list the same five modules twice; the teams strip, channel strip and FAQ are stacked bands in different card styles. 390: the black panel pushes the price card about 900 px down; the "Bring Peakhour into your stack" tiles are tall with empty gaps between title and copy.
- **Writing:**
  - "Everything a business does online. One plan." -> One plan for everything Peakhour does. (the voice guide's own after; drop the italic)
  - "Join the waitlist beside "14-day free trial · no card to start" and "No card to start · one Peaks wallet · cancel anytime"" -> If signups are closed: Join the waitlist and no trial line. If a trial is open: Start the 14-day free trial. Both cannot stand (owner decision).
  - "An AI shop assistant that answers buyers from your real catalog — 24/7." -> Answers shoppers from your real catalogue, inside Shopify. (the approved claim; "24/7" is not approved and the site otherwise spells catalogue)
  - "AI content for social, blog and newsletters — drafted in your voice, on schedule." -> Drafts posts, newsletters and blog articles in your voice, and posts the ones you approve at the time you scheduled.
  - "Questions, answered simply" -> Questions about pricing
  - "Keep reading" -> Related pages

### `/pricing/teams`

- **Owning files:** `src/app/(site)/pricing/teams/page.tsx`, `src/components/marketing/pricing/*`
- **Owner lane:** DL-1
- **Priority:** P0
- **Design:** OLD THEME. Italic serif amber "at once.", cream ground, a black Enterprise card with a gold gradient button. 1280: two cards side by side with large empty cream above and below; the black card is the heaviest object and holds the least concrete content. 390: stacked cards; the black card's gold button is the loudest element.
- **Writing:**
  - "Built for many businesses at once." -> Plans for agencies and teams running many businesses.
  - "Dedicated success manager / SLAs & uptime guarantees / Security review & DPA / Priority support & onboarding" -> None of these four is in capabilities.ts. Remove, or get each approved by the owner, before the rewrite (owner decision).
  - "All five modules, fully unlocked" -> All five modules included. ("unlocked" is on the banned list)
  - "Let's talk / custom terms" -> Talk to us about Enterprise.

### `/peaks`

- **Owning files:** `src/app/(site)/peaks/page.tsx`, `src/content/pages/peaks.ts`, `src/lib/peaks.ts`
- **Owner lane:** DL-3
- **Priority:** P0
- **Design:** Daylight: yes. 1280: three explainer cards then three pack cards; the "Good to know" box is narrower than the grid above and leaves the right half empty. 390: clean; the Best value badge sits over the card border.
- **Writing:**
  - "Prices shown for IN, detected from your IP. (beside $5, $18 and $80)" -> A page that says it shows Indian prices must not show dollars. Show INR, or say "Prices in USD". Check against src/lib/peaks.ts: likely a stale or wrong claim.
  - "Peaks need an active paid Peakhour plan. (Good to know)" -> Contradicts "your free trial included" in the cards above. Say which is true.
  - "Peaks: the AI credits behind every Peakhour feature" -> Peaks pay for the AI work Peakhour does.
  - "Start free trial (hero and CTA band)" -> Same trial decision as /pricing.
  - "Included, spent when the AI works, topped up when you need more." -> Peaks come with your plan. Top up any time.

### `/how-it-works`

- **Owning files:** `src/app/(site)/how-it-works/page.tsx`, `src/content/pages/how-it-works.ts`, `src/lib/how-it-works.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template (peach-to-white hero, orange CTA, grey bands, navy CTA band). 1280: the hero side card ("Where it stands today") repeats the status chips of the card grid directly below it, so every capability is stated twice; the grid is a wall of equal-weight cards, each carrying a grey "Limit:" footnote in small type. 390: single column is clean, but the page runs 4,000 to 5,000 px and the status panel pushes the first CTA down. Seven sections; the "Six steps, in this order" cards use italic serif orange numerals (01, 02), a small old-theme remnant.
- **Writing:**
  - "One module's result can change what you do in another." -> What one part of Peakhour learns, another can use.
  - "It joins what it finds" -> Peakhour connects what it finds.
  - "You have less to manage" -> Fewer tabs to check.
  - "Once you connect, it works from what is already there." -> Peakhour starts from what you already have.

### `/commerce`

- **Owning files:** `src/app/(site)/commerce/page.tsx`, `src/content/pages/commerce.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template (peach-to-white hero, orange CTA, grey bands, navy CTA band). 1280: the hero side card ("Where it stands today") repeats the status chips of the card grid directly below it, so every capability is stated twice; the grid is a wall of equal-weight cards, each carrying a grey "Limit:" footnote in small type. 390: single column is clean, but the page runs 4,000 to 5,000 px and the status panel pushes the first CTA down. Worst case on the site: twelve capability cards each with a "Limit:" footnote, then three platform cards that repeat a limit (the assistant's "it does not place orders itself" appears again on the Shopify card). 390: about 4,700 px.
- **Writing:**
  - "Each platform has its own status." -> Where it runs: Shopify, WhatsApp, WooCommerce.
  - "Not yet: Answers use your own catalogue and policies; it does not place orders itself on the storefront. (Shopify card)" -> An assistant limit is repeated as a Shopify limit. Say "Not yet: WooCommerce." and keep the assistant limit on its own card.
  - "How it stays in your hands." -> You approve every change. (the four bullets already say it)
  - "WhatsApp Business integration for your store | Peakhour (link card)" -> WhatsApp Business. (a pipe and a site suffix leak from the SEO title)

### `/content`

- **Owning files:** `src/app/(site)/content/page.tsx`, `src/content/pages/content.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template (peach-to-white hero, orange CTA, grey bands, navy CTA band). 1280: the hero side card ("Where it stands today") repeats the status chips of the card grid directly below it, so every capability is stated twice; the grid is a wall of equal-weight cards, each carrying a grey "Limit:" footnote in small type. 390: single column is clean, but the page runs 4,000 to 5,000 px and the status panel pushes the first CTA down.
- **Writing:**
  - "Built, and not switched on yet." -> Coming soon: WordPress.
  - "Brand voice for AI content, learned from your posts (link card title)" -> Brand voice.
  - "Instagram needs an image or a carousel of 2 to 10 images; no video, reels or text-only posts. (Limit)" -> Matches social_publishing. Shorten: "Instagram posts need an image, or 2 to 10 images."

### `/growth`

- **Owning files:** `src/app/(site)/growth/page.tsx`, `src/content/pages/growth.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template (peach-to-white hero, orange CTA, grey bands, navy CTA band). 1280: the hero side card ("Where it stands today") repeats the status chips of the card grid directly below it, so every capability is stated twice; the grid is a wall of equal-weight cards, each carrying a grey "Limit:" footnote in small type. 390: single column is clean, but the page runs 4,000 to 5,000 px and the status panel pushes the first CTA down.
- **Writing:**
  - "Plan and review your ads, with your approval" -> Plan your growth, and approve every ad. (the page also covers LinkedIn growth and Peakhour Summit)
  - "Both are built. They stay off until the connections are ready for stores." -> Google Ads and LinkedIn Ads: coming soon.
  - "with a case for, a case against, safety checks and a final call" -> Matches growth.peakhour_summit (beta). Use the seat names exactly: The case for, The case against, Safety checks and Final call.
  - "Meta Ads integration: list and pause campaigns | Peakhour (link card)" -> Meta Ads. (leaked SEO title)

### `/presence`

- **Owning files:** `src/app/(site)/presence/page.tsx`, `src/content/pages/presence.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template (peach-to-white hero, orange CTA, grey bands, navy CTA band). 1280: the hero side card ("Where it stands today") repeats the status chips of the card grid directly below it, so every capability is stated twice; the grid is a wall of equal-weight cards, each carrying a grey "Limit:" footnote in small type. 390: single column is clean, but the page runs 4,000 to 5,000 px and the status panel pushes the first CTA down.
- **Writing:**
  - "Own how you show up on Google" -> Get your Google listing right. (abstract)
  - "Hero paragraph: Peakhour Presence connects your Google Business Profile so you can prepare changes to your hours, details, photos and posts, get an AI draft of every review reply, and see a score ... Google Business P..." -> Over 50 words and the Beta status is buried at the end. Lead: "Prepare changes to your Google listing, and approve each one. In beta."
  - "Limit: Nothing is sent until an admin on your team approves it; undo is a new change that needs its own approval." -> Matches gbp_management. Keep as a single "You approve every change" line.

### `/support`

- **Owning files:** `src/app/(site)/support/page.tsx`, `src/content/pages/support.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template (peach-to-white hero, orange CTA, grey bands, navy CTA band). 1280: the hero side card ("Where it stands today") repeats the status chips of the card grid directly below it, so every capability is stated twice; the grid is a wall of equal-weight cards, each carrying a grey "Limit:" footnote in small type. 390: single column is clean, but the page runs 4,000 to 5,000 px and the status panel pushes the first CTA down. Only one live card; three Coming soon cards follow, so the page is mostly roadmap.
- **Writing:**
  - "Peakhour Support is built to answer shoppers on WhatsApp and hand the hard ones to your team, and that part is switching on soon." -> Lead with what is live: "Peakhour Support shows what shoppers asked your assistant that it could not answer." Then: "A shared inbox and AI replies are coming soon."
  - "These are built. We switch them on once the support channels are ready for every store." -> Coming soon: shared inbox, AI reply drafts and a WhatsApp support assistant.

### `/shopify`

- **Owning files:** `src/app/(site)/shopify/page.tsx`, `src/components/marketing/shopify/*`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Daylight: yes, the reference. Issues against itself: 1280: the yellow highlighter underline on the hero headline is a second accent device; the header CTA says Join the waitlist while the hero says Install on Shopify; the navy WhatsApp section and the Autopilot section are heavy blocks back to back. 390: the tab row (Sell more, 24/7 | Shelves that sell | ...) scrolls off-screen and the panel then repeats its content as an accordion; about 8,000 px.
- **Writing:**
  - "Header: Join the waitlist vs hero: Install on Shopify" -> On Shopify routes the header CTA should match the hero.
  - "Conversations deleted 180 days after the last message, with a legal hold when needed" -> Supported by the privacy policy. Keep.
  - "Five jobs Peakhour takes off your plate." -> Keep. It is the standard.

### `/launch-partner`

- **Owning files:** `src/app/(site)/launch-partner/page.tsx`, `launch-partner-form.tsx`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Daylight: yes (peach hero, orange CTA, yellow highlighter on "with us."). 1280: form card and the three steps are balanced; the footer is a bare one-line strip unlike the site footer. 390: the form card precedes the benefit list; clean.
- **Writing:**
  - "Build Peakhour.ai with us." -> Become a Launch Partner. (the brand is typed as a label in the heading)
  - "We're onboarding a small group of launch partners ahead of public launch." -> We are taking a small group of Launch Partners before public launch. (capitalise Launch Partner)
  - "Apply to be a launch partner" -> Become a Launch Partner.

### `/coming-soon`

- **Owning files:** `src/app/(site)/coming-soon/page.tsx`, `src/components/marketing/launch/launch-chrome.tsx`
- **Owner lane:** DL-3
- **Priority:** P0
- **Design:** Daylight: yes. 1280: the "Ask Neel & Co." chat card overlaps the product card and is clipped at the right edge, and the lower half of the chat is empty white; below it a sparse "What it does" row of five narrow cards, then a navy band. 390: the demo stacks well; the empty chat panel is a large blank area.
- **Writing:**
  - "Your WhatsApp and website conversations in one inbox, answered by AI or by you." -> FALSE or stale: support.channel_inbox and support.ai_replies are in development. Rewrite: "Answers shoppers on your Shopify store and on WhatsApp, from your real catalogue."
  - "A shopper asks about size and delivery ... and a markdown appears in the activity feed with an Undo." -> An illustration of several features at once. Label it "Example". Keep the markdown only as "suggests a markdown you apply, with Undo" (automatic_markdowns).
  - "Works with: WordPress" -> WordPress is in development (integration.wordpress). Remove it, or mark it Coming soon.
  - "Your AI team behind every channel you sell on." -> Approved teaser line. Keep.

### `/about`

- **Owning files:** `src/app/(site)/about/page.tsx`, `src/content/pages/about.ts`, `src/content/pages/about-view.tsx`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Daylight: yes. 1280: the hero card ("Modules 5, Markets 6, Plan One, for all five") is filler numbers; the markets list is a two-column bullet list in a big grey band; two company address cards are fine. 390: clean. In review.
- **Writing:**
  - "One platform, five modules." -> What Peakhour does. (old "five modules" positioning)
  - "The markets it is built for." -> Where Peakhour works: India, UK, USA, Canada, Australia and New Zealand. (one sentence replaces the band)
  - "Who stands behind it." -> Who runs Peakhour.
  - "Modules 5 / Markets 6 / Plan One, for all five (facts card)" -> Delete: counts are not facts a merchant uses.

### `/contact`

- **Owning files:** `src/app/(site)/contact/page.tsx`
- **Owner lane:** DL-1
- **Priority:** P0
- **Design:** OLD THEME: cream ground, gold gradient header CTA, a black "Get started free" button, three centred icon cards. 1280: the 24-hour card and the CTA float in empty cream. 390: the icon cards are very tall for two lines of text each.
- **Writing:**
  - "Have a question, feedback, or want to explore how Peakhour can work for your business? We'd love to hear from you." -> Questions about Peakhour? Write to the right inbox and a person replies. (the guide's own after)
  - "Get in touch" -> Contact Peakhour.
  - "Most inquiries get a reply within 24 hours on business days." -> Check this commitment with the owner; it is not in capabilities.ts.
  - "Ready to see Peakhour in action? / Get started free" -> Join the waitlist (or Install on Shopify). "Get started free" implies an open trial.
  - "General Inquiries / Privacy & Legal" -> General questions / Privacy and legal. (sentence case)

### `/privacy-policy`

- **Owning files:** `src/app/(site)/privacy-policy/page.tsx`
- **Owner lane:** DL-1
- **Priority:** P1
- **Design:** OLD THEME ground: cream background with a logo-only header and a full footer. 1280: a 560 px text column in a 1280 px viewport; plain bold headings, no contents list, no anchors. 390: readable. Legal text is long by nature: it needs a contents list and sticky anchors, not a redesign.
- **Writing:**
  - "...the companies that operate the Peakhour.ai platform ... an AI-powered marketing automation service (the "Service")" -> STALE positioning. Rewrite to the current description; legal review required. The numbered body is otherwise fine.

### `/terms`

- **Owning files:** `src/app/(site)/terms/page.tsx`
- **Owner lane:** DL-1
- **Priority:** P1
- **Design:** OLD THEME ground: cream background with a logo-only header and a full footer. 1280: a 560 px text column in a 1280 px viewport; plain bold headings, no contents list, no anchors. 390: readable. Legal text is long by nature: it needs a contents list and sticky anchors, not a redesign.
- **Writing:**
  - "Peakhour.ai is an AI-powered marketing automation platform that: Analyzes your content... Generates advertising creatives... Manages and optimizes advertising campaigns on connected platforms." -> STALE: describes the old LinkedIn-ads product. Rewrite: "Peakhour is the AI business platform for growing brands. It answers shoppers, writes and posts content, plans and reviews ads, and prepares Google Business Profile changes, and you approve what goes live." Legal review before it changes.

### `/cookie-policy`

- **Owning files:** `src/app/(site)/cookie-policy/page.tsx`
- **Owner lane:** DL-1
- **Priority:** P2
- **Design:** OLD THEME ground: cream background with a logo-only header and a full footer. 1280: a 560 px text column in a 1280 px viewport; plain bold headings, no contents list, no anchors. 390: readable. Legal text is long by nature: it needs a contents list and sticky anchors, not a redesign.
- **Writing:**
  - "(no marketing copy)" -> Legal text is exempt from the 18-word rule; keep the legal wording.

### `/data-deletion`

- **Owning files:** `src/app/(site)/data-deletion/page.tsx`
- **Owner lane:** DL-1
- **Priority:** P1
- **Design:** OLD THEME ground: cream background with a logo-only header and a full footer. 1280: a 560 px text column in a 1280 px viewport; plain bold headings, no contents list, no anchors. 390: readable. Legal text is long by nature: it needs a contents list and sticky anchors, not a redesign.
- **Writing:**
  - "Peakhour.ai is an AI-powered marketing platform. When you connect a Meta account..." -> STALE. Rewrite: "Peakhour is an AI business platform. When you connect a Meta account (Facebook, Instagram or WhatsApp Business), Peakhour stores the connection details it needs to run the integration."

### `/help/data-retention`

- **Owning files:** `src/app/(site)/help/data-retention/page.tsx`
- **Owner lane:** DL-1
- **Priority:** P2
- **Design:** Same cream legal layout (DL-1 owns the legal pages). 1280: a wide table inside the 560 px column. 390: check that the table scrolls rather than clips.
- **Writing:**
  - "Today this page covers LinkedIn, the only platform whose dashboard Peakhour ships to users." -> May be stale (X and Meta dashboards ship). Check, then: "This page covers LinkedIn today."

### `/integrations/whatsapp`

- **Owning files:** `src/app/(site)/integrations/whatsapp/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: hero plus a facts card, then Status, What it does, Your data, Connect, FAQ; no product visual beyond a small brand tile, and "What it does" is a thin bullet list. 390: clean single column, no overflow.
- **Writing:**
  - "Checked against the product on 2026-11-15. (under "What it does not do")" -> Internal audit language. Remove it from the page; keep it in the page record.
  - "What it does not do (heading)" -> Limits. (the list then reads as facts)
  - "Join the waitlist (the only CTA)" -> Fine while signups are closed. Add a CTA that names the thing, such as "See how Peakhour uses this connection".

### `/integrations/linkedin`

- **Owning files:** `src/app/(site)/integrations/linkedin/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: hero plus a facts card, then Status, What it does, Your data, Connect, FAQ; no product visual beyond a small brand tile, and "What it does" is a thin bullet list. 390: clean single column, no overflow.
- **Writing:**
  - "Checked against the product on 2026-11-15. (under "What it does not do")" -> Internal audit language. Remove it from the page; keep it in the page record.
  - "What it does not do (heading)" -> Limits. (the list then reads as facts)
  - "Join the waitlist (the only CTA)" -> Fine while signups are closed. Add a CTA that names the thing, such as "See how Peakhour uses this connection".

### `/integrations/x`

- **Owning files:** `src/app/(site)/integrations/x/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: hero plus a facts card, then Status, What it does, Your data, Connect, FAQ; no product visual beyond a small brand tile, and "What it does" is a thin bullet list. 390: clean single column, no overflow.
- **Writing:**
  - "Checked against the product on 2026-11-15. (under "What it does not do")" -> Internal audit language. Remove it from the page; keep it in the page record.
  - "What it does not do (heading)" -> Limits. (the list then reads as facts)
  - "Join the waitlist (the only CTA)" -> Fine while signups are closed. Add a CTA that names the thing, such as "See how Peakhour uses this connection".

### `/integrations/beehiiv`

- **Owning files:** `src/app/(site)/integrations/beehiiv/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: hero plus a facts card, then Status, What it does, Your data, Connect, FAQ; no product visual beyond a small brand tile, and "What it does" is a thin bullet list. 390: clean single column, no overflow.
- **Writing:**
  - "Checked against the product on 2026-11-15. (under "What it does not do")" -> Internal audit language. Remove it from the page; keep it in the page record.
  - "What it does not do (heading)" -> Limits. (the list then reads as facts)
  - "Join the waitlist (the only CTA)" -> Fine while signups are closed. Add a CTA that names the thing, such as "See how Peakhour uses this connection".

### `/integrations/meta-ads`

- **Owning files:** `src/app/(site)/integrations/meta-ads/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: hero plus a facts card, then Status, What it does, Your data, Connect, FAQ; no product visual beyond a small brand tile, and "What it does" is a thin bullet list. 390: clean single column, no overflow.
- **Writing:**
  - "Checked against the product on 2026-11-15. (under "What it does not do")" -> Internal audit language. Remove it from the page; keep it in the page record.
  - "What it does not do (heading)" -> Limits. (the list then reads as facts)
  - "Join the waitlist (the only CTA)" -> Fine while signups are closed. Add a CTA that names the thing, such as "See how Peakhour uses this connection".

### `/integrations/instagram`

- **Owning files:** `src/app/(site)/integrations/instagram/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: hero plus a facts card, then Status, What it does, Your data, Connect, FAQ; no product visual beyond a small brand tile, and "What it does" is a thin bullet list. 390: clean single column, no overflow.
- **Writing:**
  - "Checked against the product on 2026-11-15. (under "What it does not do")" -> Internal audit language. Remove it from the page; keep it in the page record.
  - "What it does not do (heading)" -> Limits. (the list then reads as facts)
  - "Join the waitlist (the only CTA)" -> Fine while signups are closed. Add a CTA that names the thing, such as "See how Peakhour uses this connection".

### `/integrations/facebook-pages`

- **Owning files:** `src/app/(site)/integrations/facebook-pages/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: hero plus a facts card, then Status, What it does, Your data, Connect, FAQ; no product visual beyond a small brand tile, and "What it does" is a thin bullet list. 390: clean single column, no overflow.
- **Writing:**
  - "Checked against the product on 2026-11-15. (under "What it does not do")" -> Internal audit language. Remove it from the page; keep it in the page record.
  - "What it does not do (heading)" -> Limits. (the list then reads as facts)
  - "Join the waitlist (the only CTA)" -> Fine while signups are closed. Add a CTA that names the thing, such as "See how Peakhour uses this connection".

### `/integrations/google-business-profile`

- **Owning files:** `src/app/(site)/integrations/google-business-profile/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: hero plus a facts card, then Status, What it does, Your data, Connect, FAQ; no product visual beyond a small brand tile, and "What it does" is a thin bullet list. 390: clean single column, no overflow.
- **Writing:**
  - "Checked against the product on 2026-11-15. (under "What it does not do")" -> Internal audit language. Remove it from the page; keep it in the page record.
  - "What it does not do (heading)" -> Limits. (the list then reads as facts)
  - "Join the waitlist (the only CTA)" -> Fine while signups are closed. Add a CTA that names the thing, such as "See how Peakhour uses this connection".

### `/integrations/x-ads`

- **Owning files:** `src/app/(site)/integrations/x-ads/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: hero plus a facts card, then Status, What it does, Your data, Connect, FAQ; no product visual beyond a small brand tile, and "What it does" is a thin bullet list. 390: clean single column, no overflow.
- **Writing:**
  - "Checked against the product on 2026-11-15. (under "What it does not do")" -> Internal audit language. Remove it from the page; keep it in the page record.
  - "What it does not do (heading)" -> Limits. (the list then reads as facts)
  - "Join the waitlist (the only CTA)" -> Fine while signups are closed. Add a CTA that names the thing, such as "See how Peakhour uses this connection".

### `/integrations/google-ads`

- **Owning files:** `src/app/(site)/integrations/google-ads/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). The page is a placeholder: Status Coming soon, "Nothing is available to connect yet", "Nothing yet" under data, a one-step connect list. Keep unpublished; do not polish.
- **Writing:**
  - "Peakhour's Google Ads connection is built, but it is not switched on for merchants yet, so there is nothing to connect today. This page stays in review until it is." -> Internal publishing note shown to readers. Remove; "Coming soon." is enough. Keep the page unpublished.
  - "Nothing is available to connect yet." -> Coming soon.

### `/integrations/google-search-console`

- **Owning files:** `src/app/(site)/integrations/google-search-console/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). The page is a placeholder: Status Coming soon, "Nothing is available to connect yet", "Nothing yet" under data, a one-step connect list. Keep unpublished; do not polish.
- **Writing:**
  - "Peakhour's Google Ads connection is built, but it is not switched on for merchants yet, so there is nothing to connect today. This page stays in review until it is." -> Internal publishing note shown to readers. Remove; "Coming soon." is enough. Keep the page unpublished.
  - "Nothing is available to connect yet." -> Coming soon.

### `/integrations/linkedin-ads`

- **Owning files:** `src/app/(site)/integrations/linkedin-ads/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). The page is a placeholder: Status Coming soon, "Nothing is available to connect yet", "Nothing yet" under data, a one-step connect list. Keep unpublished; do not polish.
- **Writing:**
  - "Peakhour's Google Ads connection is built, but it is not switched on for merchants yet, so there is nothing to connect today. This page stays in review until it is." -> Internal publishing note shown to readers. Remove; "Coming soon." is enough. Keep the page unpublished.
  - "Nothing is available to connect yet." -> Coming soon.

### `/integrations`

- **Owning files:** `src/app/(site)/integrations/page.tsx`, `src/content/pages/integrations.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: directory grid of equal cards, then an FAQ with one or two questions and a CTA band; the hero panel counts ("Live 4 / Beta 1 / Coming soon 0") are noise. 390: clean.
- **Writing:**
  - "Hero: These are the channels and connectors Peakhour works with today, grouped by what they are for. Each page says what the connection does and what it does not, and a Beta chip means it is still being finished. Connections that are not yet switched on are not listed." -> About 55 words. Cut to "Each page says what a connection does and does not do. Beta means still being finished."
  - "Browse, with the status of each." -> The connections.
  - "What Peakhour connects to, and how far each one goes" -> Keep.

### `/features`

- **Owning files:** `src/app/(site)/features/page.tsx`, `src/content/pages/features.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: directory grid of equal cards, then an FAQ with one or two questions and a CTA band; the hero panel counts ("Live 4 / Beta 1 / Coming soon 0") are noise. 390: clean. Scope problem: the hub lists only Presence and Content features, so Commerce, Growth and Support features are missing from "Features".
- **Writing:**
  - "What Peakhour does for your Google listing and your content" -> Peakhour features. (cover Commerce and Growth too, or rename)
  - "Where are the other features?" -> The answer must link to /commerce, /growth and /shopify/features.

### `/features/google-business-profile-management`

- **Owning files:** `src/app/(site)/features/google-business-profile-management/page.tsx`, `src/content/pages/features.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: a heading plus a small facts card, then the same stacked sections as every other page (verified, where it runs, steps, FAQ, related, CTA band); no product visual, so the page reads as a spec sheet. 390: clean single column, 2,700 to 3,100 px, nothing broken.
- **Writing:**
  - "Checked against the product on 2026-11-15. / What it does today, and what it does not." -> Remove the date line. Heading: "What it does, and what it does not."
  - "Available now. / Available to early users while we finish it." -> "Live." / "In beta." Say it plainly.

### `/features/review-management`

- **Owning files:** `src/app/(site)/features/review-management/page.tsx`, `src/content/pages/features.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: a heading plus a small facts card, then the same stacked sections as every other page (verified, where it runs, steps, FAQ, related, CTA band); no product visual, so the page reads as a spec sheet. 390: clean single column, 2,700 to 3,100 px, nothing broken.
- **Writing:**
  - "Checked against the product on 2026-11-15. / What it does today, and what it does not." -> Remove the date line. Heading: "What it does, and what it does not."
  - "Available now. / Available to early users while we finish it." -> "Live." / "In beta." Say it plainly.

### `/features/local-listing-health`

- **Owning files:** `src/app/(site)/features/local-listing-health/page.tsx`, `src/content/pages/features.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: a heading plus a small facts card, then the same stacked sections as every other page (verified, where it runs, steps, FAQ, related, CTA band); no product visual, so the page reads as a spec sheet. 390: clean single column, 2,700 to 3,100 px, nothing broken.
- **Writing:**
  - "Checked against the product on 2026-11-15. / What it does today, and what it does not." -> Remove the date line. Heading: "What it does, and what it does not."
  - "Available now. / Available to early users while we finish it." -> "Live." / "In beta." Say it plainly.

### `/features/brand-voice`

- **Owning files:** `src/app/(site)/features/brand-voice/page.tsx`, `src/content/pages/features.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: a heading plus a small facts card, then the same stacked sections as every other page (verified, where it runs, steps, FAQ, related, CTA band); no product visual, so the page reads as a spec sheet. 390: clean single column, 2,700 to 3,100 px, nothing broken.
- **Writing:**
  - "Checked against the product on 2026-11-15. / What it does today, and what it does not." -> Remove the date line. Heading: "What it does, and what it does not."
  - "Available now. / Available to early users while we finish it." -> "Live." / "In beta." Say it plainly.

### `/features/social-media-content`

- **Owning files:** `src/app/(site)/features/social-media-content/page.tsx`, `src/content/pages/features.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: a heading plus a small facts card, then the same stacked sections as every other page (verified, where it runs, steps, FAQ, related, CTA band); no product visual, so the page reads as a spec sheet. 390: clean single column, 2,700 to 3,100 px, nothing broken.
- **Writing:**
  - "Checked against the product on 2026-11-15. / What it does today, and what it does not." -> Remove the date line. Heading: "What it does, and what it does not."
  - "Available now. / Available to early users while we finish it." -> "Live." / "In beta." Say it plainly.

### `/features/peakhour-summit`

- **Owning files:** `src/app/(site)/features/peakhour-summit/page.tsx`, `src/content/pages/feature-peakhour-summit.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template. 1280: a heading plus a small facts card, then the same stacked sections as every other page (verified, where it runs, steps, FAQ, related, CTA band); no product visual, so the page reads as a spec sheet. 390: clean single column, 2,700 to 3,100 px, nothing broken.
- **Writing:**
  - "Reviews run only for businesses whose growth autonomy level is above 0." -> Jargon from an internal setting. Rewrite: "Reviews run when autonomous growth is switched on for you." (confirm wording with the owner)
  - "Peakhour Summit is Peakhour's four-part AI review of growth decisions..." -> Matches growth.peakhour_summit (beta). Keep.
  - "Checked against the product on 2026-11-15." -> Remove from the reader view.

### `/features/ai-blog-writer`

- **Owning files:** `src/app/(site)/features/ai-blog-writer/page.tsx`, `src/content/pages/features.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). Shared Daylight template. 1280: a heading plus a small facts card, then the same stacked sections as every other page (verified, where it runs, steps, FAQ, related, CTA band); no product visual, so the page reads as a spec sheet. 390: clean single column, 2,700 to 3,100 px, nothing broken.
- **Writing:**
  - "Checked against the product on 2026-11-15." -> Remove from the reader view.
  - "(page held in review with no capability claim)" -> content.ai_blog_writer and content.beehiiv_newsletter are approved live. Attach the claim in the page record so the gate can publish it.

### `/features/beehiiv-newsletter`

- **Owning files:** `src/app/(site)/features/beehiiv-newsletter/page.tsx`, `src/content/pages/features.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). Shared Daylight template. 1280: a heading plus a small facts card, then the same stacked sections as every other page (verified, where it runs, steps, FAQ, related, CTA band); no product visual, so the page reads as a spec sheet. 390: clean single column, 2,700 to 3,100 px, nothing broken.
- **Writing:**
  - "Checked against the product on 2026-11-15." -> Remove from the reader view.
  - "(page held in review with no capability claim)" -> content.ai_blog_writer and content.beehiiv_newsletter are approved live. Attach the claim in the page record so the gate can publish it.

### `/shopify/features`

- **Owning files:** `src/app/(site)/shopify/features/page.tsx`, `src/content/pages/shopify.features.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** Shared Daylight template with the Shopify feature kit (demo card in the hero, install steps, permissions). Closest to the /shopify standard. 1280: sections are text-only after the hero demo; "What the app asks for" shows raw scope names in monospace. 390: clean. Hub of seven cards then an FAQ.
- **Writing:**
  - "This page lists each feature that is ready to read about, with its status today." -> Seven features, each with its status. (cut the first clause)
  - "Everything Peakhour does on Shopify" -> Keep.

### `/shopify/features/ai-shopping-assistant`

- **Owning files:** `src/app/(site)/shopify/features/ai-shopping-assistant/page.tsx`, `src/content/pages/shopify.features.*.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Shared Daylight template with the Shopify feature kit (demo card in the hero, install steps, permissions). Closest to the /shopify standard. 1280: sections are text-only after the hero demo; "What the app asks for" shows raw scope names in monospace. 390: clean.
- **Writing:**
  - "Checked against the product on 2026-11-15. / WHAT IT DOES NOT DO" -> Remove the date line. Heading: Limits.
  - "read_products / write_products (permissions, monospace)" -> Keep the scope names but lead with a plain sentence: "Peakhour reads your products and writes back only the changes you approve."
  - "Keep going. / Related" -> Related pages.
  - "Install on Shopify (hero) vs Join the waitlist (header)" -> The header CTA should match the page.

### `/shopify/features/whatsapp-ai-shopping`

- **Owning files:** `src/app/(site)/shopify/features/whatsapp-ai-shopping/page.tsx`, `src/content/pages/shopify.features.*.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Shared Daylight template with the Shopify feature kit (demo card in the hero, install steps, permissions). Closest to the /shopify standard. 1280: sections are text-only after the hero demo; "What the app asks for" shows raw scope names in monospace. 390: clean.
- **Writing:**
  - "Checked against the product on 2026-11-15. / WHAT IT DOES NOT DO" -> Remove the date line. Heading: Limits.
  - "read_products / write_products (permissions, monospace)" -> Keep the scope names but lead with a plain sentence: "Peakhour reads your products and writes back only the changes you approve."
  - "Keep going. / Related" -> Related pages.
  - "Install on Shopify (hero) vs Join the waitlist (header)" -> The header CTA should match the page.
  - "Sell on WhatsApp with an AI assistant, and check out on your Shopify store" -> Matches commerce.whatsapp_shopping.checkout_link. Keep.

### `/shopify/features/product-recommendations`

- **Owning files:** `src/app/(site)/shopify/features/product-recommendations/page.tsx`, `src/content/pages/shopify.features.*.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Shared Daylight template with the Shopify feature kit (demo card in the hero, install steps, permissions). Closest to the /shopify standard. 1280: sections are text-only after the hero demo; "What the app asks for" shows raw scope names in monospace. 390: clean.
- **Writing:**
  - "Checked against the product on 2026-11-15. / WHAT IT DOES NOT DO" -> Remove the date line. Heading: Limits.
  - "read_products / write_products (permissions, monospace)" -> Keep the scope names but lead with a plain sentence: "Peakhour reads your products and writes back only the changes you approve."
  - "Keep going. / Related" -> Related pages.
  - "Install on Shopify (hero) vs Join the waitlist (header)" -> The header CTA should match the page.

### `/shopify/features/frequently-bought-together`

- **Owning files:** `src/app/(site)/shopify/features/frequently-bought-together/page.tsx`, `src/content/pages/shopify.features.*.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Shared Daylight template with the Shopify feature kit (demo card in the hero, install steps, permissions). Closest to the /shopify standard. 1280: sections are text-only after the hero demo; "What the app asks for" shows raw scope names in monospace. 390: clean.
- **Writing:**
  - "Checked against the product on 2026-11-15. / WHAT IT DOES NOT DO" -> Remove the date line. Heading: Limits.
  - "read_products / write_products (permissions, monospace)" -> Keep the scope names but lead with a plain sentence: "Peakhour reads your products and writes back only the changes you approve."
  - "Keep going. / Related" -> Related pages.
  - "Install on Shopify (hero) vs Join the waitlist (header)" -> The header CTA should match the page.

### `/shopify/features/whatsapp-cod-confirmation`

- **Owning files:** `src/app/(site)/shopify/features/whatsapp-cod-confirmation/page.tsx`, `src/content/pages/shopify.features.*.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Shared Daylight template with the Shopify feature kit (demo card in the hero, install steps, permissions). Closest to the /shopify standard. 1280: sections are text-only after the hero demo; "What the app asks for" shows raw scope names in monospace. 390: clean.
- **Writing:**
  - "Checked against the product on 2026-11-15. / WHAT IT DOES NOT DO" -> Remove the date line. Heading: Limits.
  - "read_products / write_products (permissions, monospace)" -> Keep the scope names but lead with a plain sentence: "Peakhour reads your products and writes back only the changes you approve."
  - "Keep going. / Related" -> Related pages.
  - "Install on Shopify (hero) vs Join the waitlist (header)" -> The header CTA should match the page.

### `/shopify/features/ai-seo`

- **Owning files:** `src/app/(site)/shopify/features/ai-seo/page.tsx`, `src/content/pages/shopify.features.*.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Shared Daylight template with the Shopify feature kit (demo card in the hero, install steps, permissions). Closest to the /shopify standard. 1280: sections are text-only after the hero demo; "What the app asks for" shows raw scope names in monospace. 390: clean.
- **Writing:**
  - "Checked against the product on 2026-11-15. / WHAT IT DOES NOT DO" -> Remove the date line. Heading: Limits.
  - "read_products / write_products (permissions, monospace)" -> Keep the scope names but lead with a plain sentence: "Peakhour reads your products and writes back only the changes you approve."
  - "Keep going. / Related" -> Related pages.
  - "Install on Shopify (hero) vs Join the waitlist (header)" -> The header CTA should match the page.

### `/shopify/features/ai-product-descriptions`

- **Owning files:** `src/app/(site)/shopify/features/ai-product-descriptions/page.tsx`, `src/content/pages/shopify.features.*.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Shared Daylight template with the Shopify feature kit (demo card in the hero, install steps, permissions). Closest to the /shopify standard. 1280: sections are text-only after the hero demo; "What the app asks for" shows raw scope names in monospace. 390: clean.
- **Writing:**
  - "Checked against the product on 2026-11-15. / WHAT IT DOES NOT DO" -> Remove the date line. Heading: Limits.
  - "read_products / write_products (permissions, monospace)" -> Keep the scope names but lead with a plain sentence: "Peakhour reads your products and writes back only the changes you approve."
  - "Keep going. / Related" -> Related pages.
  - "Install on Shopify (hero) vs Join the waitlist (header)" -> The header CTA should match the page.

### `/shopify/guides/whatsapp-cod-confirmation`

- **Owning files:** `src/app/(site)/shopify/guides/whatsapp-cod-confirmation/page.tsx`, `src/content/pages/guide-whatsapp-cod-confirmation.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). Same template, no problems beyond the family notes.
- **Writing:**
  - "(page in review)" -> Claims match commerce.cod_confirmation. Nothing blocks publishing except the review state.

### `/shopify/compare/aisensy`

- **Owning files:** `src/app/(site)/shopify/compare/aisensy/page.tsx`, `src/content/pages/seo9-directories.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). Comparison page with a "How this was checked" panel showing "Reviewed by: Pending review", which is process shown to readers.
- **Writing:**
  - "Reviewed by: Pending review" -> Do not publish with this line; complete the review or remove it.
  - "Written by: Peakhour Growth" -> Remove, or name a person. A team label is not proof.
  - "Peakhour vs AiSensy for Shopify" -> Keep. Every competitor claim must link to the vendor's own page (verify at publish).

### `/shopify/compare/interakt`

- **Owning files:** `src/app/(site)/shopify/compare/interakt/page.tsx`, `src/content/pages/seo9-directories.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). Comparison page with a "How this was checked" panel showing "Reviewed by: Pending review", which is process shown to readers.
- **Writing:**
  - "Reviewed by: Pending review" -> Do not publish with this line; complete the review or remove it.
  - "Written by: Peakhour Growth" -> Remove, or name a person. A team label is not proof.
  - "Peakhour vs Interakt for Shopify" -> Keep. Every competitor claim must link to the vendor's own page (verify at publish).

### `/shopify/compare/rep-ai`

- **Owning files:** `src/app/(site)/shopify/compare/rep-ai/page.tsx`, `src/content/pages/seo9-directories.ts`
- **Owner lane:** DL-3
- **Priority:** P1
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). Comparison page with a "How this was checked" panel showing "Reviewed by: Pending review", which is process shown to readers.
- **Writing:**
  - "Reviewed by: Pending review" -> Do not publish with this line; complete the review or remove it.
  - "Written by: Peakhour Growth" -> Remove, or name a person. A team label is not proof.
  - "Peakhour vs Rep AI for Shopify" -> Keep. Every competitor claim must link to the vendor's own page (verify at publish).

### `/industries`

- **Owning files:** `src/app/(site)/industries/page.tsx`, `src/content/pages/industries.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). Shared Daylight template. 1280: directory grid of equal cards, then an FAQ with one or two questions and a CTA band; the hero panel counts ("Live 4 / Beta 1 / Coming soon 0") are noise. 390: clean.
- **Writing:**
  - "(page in review; the hub lists one entry)" -> A hub with a single child looks empty. Publish it with a second entry, or hold it.

### `/industries/fashion-apparel`

- **Owning files:** `src/app/(site)/industries/fashion-apparel/page.tsx`, `src/content/pages/industry-fashion-apparel.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). Shared Daylight template. 1280: a heading plus a small facts card, then the same stacked sections as every other page (verified, where it runs, steps, FAQ, related, CTA band); no product visual, so the page reads as a spec sheet. 390: clean single column, 2,700 to 3,100 px, nothing broken.
- **Writing:**
  - "Peakhour for fashion and apparel stores" -> Keep. Claims match commerce.find_my_match, product_recommendations and cod_confirmation.

### `/guides`

- **Owning files:** `src/app/(site)/guides/page.tsx`, `src/content/pages/seo9-directories.ts`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** In review: a "Draft, not published" ribbon shows on dev (expected; a 404 on production). Shared Daylight template. 1280: directory grid of equal cards, then an FAQ with one or two questions and a CTA band; the hero panel counts ("Live 4 / Beta 1 / Coming soon 0") are noise. 390: clean.
- **Writing:**
  - "(page in review; the hub lists one entry)" -> A hub with a single child looks empty. Publish it with a second entry, or hold it.

### `/auth`

- **Owning files:** `src/app/(site)/auth/page.tsx`, `auth-flow.tsx`, `password-signin.tsx`
- **Owner lane:** DL-2
- **Priority:** P0
- **Design:** OLD THEME, the clearest example: cream ground, a full-height BLACK panel with an italic serif gold "Free to try.", gold eyebrow rules, gold gradient button, gold-bordered input, gold numerals (5 / 0 / 14). 1280: the black panel takes 40 percent of the width and its content is a fake dashboard. 390: the panel is dropped, leaving a plain cream form with a large empty top.
- **Writing:**
  - "Your whole business, waiting on the other side. Free to try." -> Sign in to Peakhour. We'll email you a link: no password needed. (the guide's own after)
  - "Answered 34 shoppers on WhatsApp today / 2 articles drafted from this week's news / LinkedIn post scheduled · 3 leads in inbox / Inbox clear — 12 conversations resolved / Google listing synced · 2 new reviews" -> FAKE PROOF: unlabelled invented activity. "3 leads in inbox" and "12 conversations resolved" describe features that are not live (growth.lead_inbox, support.channel_inbox). Delete the panel.
  - "Commerce, Content, Growth and Presence on one account, with Support coming soon, free for your first 14 days." -> Delete, or follow the trial decision. "0 credit cards required" and "14 days free" depend on an open trial.
  - "One email. No password. Ever." -> Sign in with your email. (drop "Ever")
  - "Sign in with password / reviewers only" -> Do not show a reviewers-only control to the public.
  - "Free trial of every module" -> Remove, or follow the trial decision.

### `/auth/verify`

- **Owning files:** `src/app/(site)/auth/verify/page.tsx`
- **Owner lane:** DL-2
- **Priority:** P1
- **Design:** OLD THEME ground (cream, black button), a small centred card. 1280: the card floats in a large empty cream field. 390: same, fine.
- **Writing:**
  - "Verification failed / We couldn't verify your sign-in link" -> This sign-in link did not work.
  - "Invalid verification link. Please request a new one." -> The link has expired or was already used. Request a new one.

### `/auth/accept-invite`

- **Owning files:** `src/app/(site)/auth/accept-invite/page.tsx`
- **Owner lane:** DL-2
- **Priority:** P1
- **Design:** OLD THEME ground; an error card and one button. Same as /auth/verify.
- **Writing:**
  - "Invitation expired / Invalid invitation link. Please ask for a new invite." -> The heading says expired and the body says invalid. One message: "This invitation link did not work. Ask the person who invited you to send a new one."
  - "Go to sign in" -> Sign in.

### `/auth/complete-profile`

- **Owning files:** `src/app/(site)/auth/complete-profile/page.tsx`
- **Owner lane:** DL-2
- **Priority:** P2
- **Design:** OLD THEME ground; a plain card form, fine at both widths.
- **Writing:**
  - "Tell us a bit about yourself" -> Your name and phone.
  - "We'll send a verification code if provided" -> If you add a number, we text a code to check it.

### `/claim/shopify`

- **Owning files:** `src/app/(site)/claim/shopify/page.tsx`
- **Owner lane:** DL-2
- **Priority:** P1
- **Design:** OLD THEME ground, a narrow card. The error state doubles the heading ("Claim your Shopify store" then "Invalid claim link").
- **Writing:**
  - "This link is missing information. Open the Peakhour app in your Shopify admin and use the "Claim this store" button there." -> Specific and good. Keep; drop the doubled heading.

### `/claim/wordpress`

- **Owning files:** `src/app/(site)/claim/wordpress/page.tsx`
- **Owner lane:** DL-2
- **Priority:** P1
- **Design:** OLD THEME ground; same as /claim/shopify. WordPress is in development, so a merchant should not reach this page yet.
- **Writing:**
  - "Connect your WordPress site" -> integration.wordpress is in development. Keep the route, but do not link it publicly until the plugin ships.
  - "Open Peakhour in your WordPress admin and use the "Claim" link there." -> Fine for the plugin flow.

### `/reconnect/wordpress`

- **Owning files:** `src/app/(site)/reconnect/wordpress/page.tsx`
- **Owner lane:** DL-2
- **Priority:** P2
- **Design:** OLD THEME ground; a card with a code field and an error. Same WordPress availability point.
- **Writing:**
  - "Enter the code shown in your WordPress plugin to link this site back to your account." -> Fine. Keep.

### `/shopify/connect`

- **Owning files:** `src/app/(site)/shopify/connect/page.tsx`
- **Owner lane:** DL-2
- **Priority:** P1
- **Design:** OLD THEME ground: an icon card with a numbered box. 1280: the card sits in a large empty field.
- **Writing:**
  - "If you were connecting or reconnecting your store, that didn't finish. Everything Peakhour needs happens inside the Shopify admin, so that is where to pick it up." -> Connecting your store did not finish. Finish it in your Shopify admin.
  - "Email us" -> Write to support@peakhour.ai. (name the address)

### `/share/[token]`

- **Owning files:** `src/app/(site)/share/[token]/page.tsx`
- **Owner lane:** DL-2
- **Priority:** P2
- **Design:** OLD THEME ground; the error state is one small card in an empty page with no header, no way back and no next step.
- **Writing:**
  - "This link can't be used / This link does not exist or has expired." -> This link has expired or is wrong. Ask the person who shared it to send it again. (add a Back to Peakhour link)

### `/growth/confirm/[token]`

- **Owning files:** `src/app/(site)/growth/confirm/[token]/page.tsx`
- **Owner lane:** DL-2
- **Priority:** P2
- **Design:** OLD THEME ground; an error card with one button; same empty-page issue as /share.
- **Writing:**
  - "This link is not valid. Open the latest message we sent you on WhatsApp, or send your plan again from Growth." -> Specific and good. Keep.

### `404 (any missing path; /gate-404 renders it)`

- **Owning files:** `src/app/(site)/not-found.tsx`, `src/components/marketing/public-not-found*.tsx`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Daylight: yes. 1280: a hero-like block with a large empty right half. 390: clean. Footer present.
- **Writing:**
  - "We couldn't find that page" -> Keep.
  - "The link may be old, or the address mistyped. These are good places to start." -> Try one of these.

### `/seo-kit`

- **Owning files:** `src/app/(site)/seo-kit/page.tsx`
- **Owner lane:** DL-3
- **Priority:** P2
- **Design:** Dev-only design review route (never in the sitemap). Audited for completeness; not a customer page. Do not polish; confirm it 404s on production.
- **Writing:**
  - "This route exists on dev only and is never in the sitemap." -> Internal. Keep off production.

## Summary

| Page | Design verdict | Writing verdict | Priority | Owner lane |
|---|---|---|---|---|
| `/` | Daylight | Weak | P1 | DL-3 |
| `/pricing` | Old theme | False, stale or weak | P0 | DL-1 |
| `/pricing/teams` | Old theme | False, stale or weak | P0 | DL-1 |
| `/peaks` | Daylight | False, stale or weak | P0 | DL-3 |
| `/how-it-works` | Daylight | Weak | P1 | DL-3 |
| `/commerce` | Daylight | Weak | P1 | DL-3 |
| `/content` | Daylight | Needs edits | P1 | DL-3 |
| `/growth` | Daylight | Weak | P1 | DL-3 |
| `/presence` | Daylight | Needs edits | P1 | DL-3 |
| `/support` | Daylight | Needs edits | P1 | DL-3 |
| `/shopify` | Daylight | Needs edits | P2 | DL-3 |
| `/launch-partner` | Daylight | Needs edits | P2 | DL-3 |
| `/coming-soon` | Daylight | False, stale or weak | P0 | DL-3 |
| `/about` | Daylight | Weak | P1 | DL-3 |
| `/contact` | Old theme | False, stale or weak | P0 | DL-1 |
| `/privacy-policy` | Old theme | Needs edits | P1 | DL-1 |
| `/terms` | Old theme | Needs edits | P1 | DL-1 |
| `/cookie-policy` | Old theme | Needs edits | P2 | DL-1 |
| `/data-deletion` | Old theme | Needs edits | P1 | DL-1 |
| `/help/data-retention` | Daylight | Needs edits | P2 | DL-1 |
| `/integrations/whatsapp` | Daylight | Needs edits | P1 | DL-3 |
| `/integrations/linkedin` | Daylight | Needs edits | P1 | DL-3 |
| `/integrations/x` | Daylight | Needs edits | P1 | DL-3 |
| `/integrations/beehiiv` | Daylight | Needs edits | P1 | DL-3 |
| `/integrations/meta-ads` | Daylight | Needs edits | P1 | DL-3 |
| `/integrations/instagram` | Daylight | Needs edits | P1 | DL-3 |
| `/integrations/facebook-pages` | Daylight | Needs edits | P1 | DL-3 |
| `/integrations/google-business-profile` | Daylight | Needs edits | P1 | DL-3 |
| `/integrations/x-ads` | Daylight | Needs edits | P1 | DL-3 |
| `/integrations/google-ads` | Daylight | Needs edits | P2 | DL-3 |
| `/integrations/google-search-console` | Daylight | Needs edits | P2 | DL-3 |
| `/integrations/linkedin-ads` | Daylight | Needs edits | P2 | DL-3 |
| `/integrations` | Daylight | Needs edits | P1 | DL-3 |
| `/features` | Daylight | Needs edits | P1 | DL-3 |
| `/features/google-business-profile-management` | Daylight | Needs edits | P1 | DL-3 |
| `/features/review-management` | Daylight | Needs edits | P1 | DL-3 |
| `/features/local-listing-health` | Daylight | Needs edits | P1 | DL-3 |
| `/features/brand-voice` | Daylight | Needs edits | P1 | DL-3 |
| `/features/social-media-content` | Daylight | Needs edits | P1 | DL-3 |
| `/features/peakhour-summit` | Daylight | Needs edits | P1 | DL-3 |
| `/features/ai-blog-writer` | Daylight | Needs edits | P1 | DL-3 |
| `/features/beehiiv-newsletter` | Daylight | Needs edits | P1 | DL-3 |
| `/shopify/features` | Daylight | Needs edits | P1 | DL-3 |
| `/shopify/features/ai-shopping-assistant` | Daylight | Weak | P2 | DL-3 |
| `/shopify/features/whatsapp-ai-shopping` | Daylight | Weak | P2 | DL-3 |
| `/shopify/features/product-recommendations` | Daylight | Weak | P2 | DL-3 |
| `/shopify/features/frequently-bought-together` | Daylight | Weak | P2 | DL-3 |
| `/shopify/features/whatsapp-cod-confirmation` | Daylight | Weak | P2 | DL-3 |
| `/shopify/features/ai-seo` | Daylight | Weak | P2 | DL-3 |
| `/shopify/features/ai-product-descriptions` | Daylight | Weak | P2 | DL-3 |
| `/shopify/guides/whatsapp-cod-confirmation` | Daylight | Needs edits | P2 | DL-3 |
| `/shopify/compare/aisensy` | Daylight | Needs edits | P1 | DL-3 |
| `/shopify/compare/interakt` | Daylight | Needs edits | P1 | DL-3 |
| `/shopify/compare/rep-ai` | Daylight | Needs edits | P1 | DL-3 |
| `/industries` | Daylight | Needs edits | P2 | DL-3 |
| `/industries/fashion-apparel` | Daylight | Needs edits | P2 | DL-3 |
| `/guides` | Daylight | Needs edits | P2 | DL-3 |
| `/auth` | Old theme | False, stale or weak | P0 | DL-2 |
| `/auth/verify` | Old theme | Needs edits | P1 | DL-2 |
| `/auth/accept-invite` | Old theme | Needs edits | P1 | DL-2 |
| `/auth/complete-profile` | Old theme | Needs edits | P2 | DL-2 |
| `/claim/shopify` | Old theme | Needs edits | P1 | DL-2 |
| `/claim/wordpress` | Old theme | Needs edits | P1 | DL-2 |
| `/reconnect/wordpress` | Old theme | Needs edits | P2 | DL-2 |
| `/shopify/connect` | Old theme | Needs edits | P1 | DL-2 |
| `/share/[token]` | Old theme | Needs edits | P2 | DL-2 |
| `/growth/confirm/[token]` | Old theme | Needs edits | P2 | DL-2 |
| `404 (any missing path; /gate-404 renders it)` | Daylight | Needs edits | P2 | DL-3 |
| `/seo-kit` | Daylight | Needs edits | P2 | DL-3 |

Counts by priority: P0 6, P1 39, P2 24. By lane: DL-1 8, DL-2 10, DL-3 51.
