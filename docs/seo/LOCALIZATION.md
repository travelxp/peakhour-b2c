# Adding a language to peakhour.ai

Status (2026-11-15): the machine is built and tested; **English is the only finished language**. The owner will approve the English work first, then the other languages follow. No `messages/<locale>.json` other than `en.json` is committed.

Policy: `Peakhour_SEO_AEO_Bible_v1.md` sections 4.8, 9.4 and 10. Code: `src/i18n/`, `src/lib/seo/` (`types.ts`, `resolve.ts`, `publish.ts`, `locale-route.ts`, `language-options.ts`, `page-content.ts`, `metadata.ts`), `src/middleware.ts`, `src/app/(site)/ph-locale/`.

## How it behaves

- English is unprefixed and unchanged. Every other locale has a lowercase prefix from `LOCALES`: `/fr-ca`, `/es-es`, `/pt-br`.
- No detection. No `Accept-Language` redirect, no locale cookie. A visitor changes language only by clicking the switcher or following a link.
- Scope is the public marketing pages in the registry (`src/lib/seo/pages.ts`). The dashboard, onboarding, CMS, auth, claim and reconnect stay English and unprefixed.
- The middleware (after the coming-soon gate) rewrites `/{prefix}/{path}` to the internal route `src/app/(site)/ph-locale/[locale]/[[...path]]` **only** when that page's variant is publishable in that locale (`isPublishable`). Otherwise the visitor gets the public 404. A prefix is reserved even while nothing is published.
- A non-English page renders only the copy written for that locale (`src/content/pages/`). There is never an English fallback at a non-English URL (Bible 10, T19). English is a fallback only for a development preview (`contentFor` with `previewFallback`, off Production).

## Add a language, step by step

Use `fr-CA` as the example. Every step is a PR; nothing is published until step 8.

1. **Skeleton.** `npx tsx scripts/i18n/new-locale.ts fr-CA` writes `messages/fr-CA.json` with `en.json`'s keys and `""` values. It refuses an unknown locale (declare it in `LOCALES` first, `src/lib/seo/types.ts`) and never overwrites a file.
2. **Translate the messages** (header, footer, 404, launch chrome, language switcher, and the template-kit labels once SEO-5 has moved them). Fill every value. Do not leave `""`.
3. **Native reviewer.** A native reader approves the strings and each page's copy. Record the reviewer's name on every variant (`reviewer`). A page is not published without one.
4. **Page copy.** For each page to translate, add a `fr-CA` entry to its `ByLocale<PageContent>` in `src/content/pages/<pageId>.ts`, registered in `src/content/pages/index.ts`: `title` (60 characters or fewer), `description` (160 or fewer), `h1`, `lead` (the direct answer first), sections. Write for local search queries (Bible 13), not by translating word for word. Translate only pages that have a reason to exist in that market.
5. **Variant record.** In `pages.ts`, add to the page: `locales: { "fr-CA": { path: "/fr-ca/shopify", status: "draft", reviewer: "..." } }`. The path is lowercase, under the locale prefix, and may use a translated slug. Status moves `draft`, `review`, `published`.
6. **Capability and legal gates.** The page's claims must hold in that market (product, support, privacy, billing, currency, disclaimers; Bible 12). The existing publish gate still applies: the English page must be published and every capability claim satisfied.
7. **Tests.** Delete the "commits no non-English message file" test in `src/i18n/messages.test.ts` (it exists only to hold the owner's approval gate) and run the gates below. Key parity (`messages.test.ts`) fails if the file's keys differ from `en.json`. The registry test fails if a published variant has no copy or no reviewer.
8. **Publish.** Set `PUBLISHED_LOCALES` in `src/lib/seo/types.ts` to include the locale, and set each approved variant's `status` to `published` (with `publishedAt`). From then on, per page: the URL serves, `pageMeta` emits hreflang (self, reciprocal, `x-default`), the sitemap lists the variant with alternates, and the language switcher appears in the header in place of the static English chip, linking to the equivalent page or, where none exists, to the nearest published ancestor with a visible "section page only" notice.
9. **After release.** Run `scripts/seo/smoke.ts` against dev. Check one translated URL in Search Console once Production opens. Review quarterly (Bible 12).

## Checks that must pass

| Check | Where |
| --- | --- |
| `npm run lint`, `npx tsc --noEmit -p .` | CI |
| `npx vitest run --maxWorkers=2` | includes key parity, English text unchanged, locale routing, hreflang reciprocity (T10), switcher fallback (T11), no English fallback (T19), sitemap alternates |
| `next build` and `npm run budget` | next-intl is server-only here; it must add no client JS to dashboard routes |
| `npx tsx scripts/seo/smoke.ts <dev url>` | unpublished locale URLs are real 404s; no hreflang on English while only English is published |
| a11y smoke | the switcher is a labelled `nav` with `lang` and `hrefLang` on each link |

## Things that are deliberately not done

- No locale detection or redirects, and no locale cookie.
- No moving of existing routes into `app/[locale]`; the internal route is one group, reached only by the middleware's rewrite. `/ph-locale/...` asked for directly is a 404.
- Dynamic strings still in English: the signup CTA label from the catalog (`lib/catalog.ts`), the launch pages' perk and step copy, and the page bodies. They move as each language reaches them.
- The SEO-5 template kit's fixed labels are still English in the components (`src/components/marketing/seo/`): the Live, Beta, Coming soon, Paused and Retired chips and their sentences (`status-meta.ts`), the "Breadcrumb" and "What it does not do" labels, the comparison legend (Yes, Partial, Not documented, Not supported, Unknown), and the "Draft, not published" ribbon. They move into `messages/en.json` (a `Kit` namespace, read on the server and passed to the sync components as props, as the header does) in the same PR that translates the first language, so other rows building on the kit are not disturbed.
