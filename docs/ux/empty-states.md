# Dashboard zero-data and failed-load audit

Scope: the 65 `page.tsx` files under `src/app/(site)/dashboard`, including the
components the thin pages delegate to (`src/components/commerce`,
`growth-v2`, `drive`).

Method: code reading plus grep, per page. **No page was opened in a browser.**
"Current zero state" is what the source renders when the request succeeds with
no rows. "Failed load" is what it renders when the request errors or is paused
(offline). Pages marked "not read in full" were classified from grep hits for
`EmptyState`, `isError`, `length === 0` and "No ... yet" strings only.

The baseline was better than the brief assumed: most collection pages already
had a deliberate zero state and a deliberate error state. The defects were
concentrated in four places: a zero state with no action, a zero state that
was shown for a failed load, a page with no error branch at all, and a blank
text-only "No ideas yet".

Legend for **Gap**: `none` = adequate, `fixed` = changed in this PR,
`n/a` = not a collection (form, redirect, detail, or dashboard of widgets).

## Collection pages

| Route | Current zero state | Failed load | Gap |
|---|---|---|---|
| strategist | Bare text "No ideas yet. Click Get Ideas" (when the query had no data, which included a failed request) | Rendered the same bare text | **fixed**: `EmptyState` with one action (Get ideas), `QueryError` + Retry for error/offline |
| calendar (week/month) | Empty grid cells, by design | Inline error (read in part) | none |
| calendar/ideas | Empty day cells and an unscheduled list | Nothing: no `isError` handling, an error drew an empty calendar | **fixed**: `QueryError` strip with Retry above the calendar |
| calendar/recurring | Card: "No recurring schedules yet" with how-to prose, no action | Card with "Try refreshing" (no button) | **fixed**: `EmptyState` with action "Open the calendar". Error card left as is |
| content (library) | Per-category "No channels here yet" labels | Inline notice | none |
| content/news | Purpose-built `EmptyNewsDesk` | `ErrorBlock` | none |
| content/ledger | `EmptyState` | `EmptyState`-style error with retry | none |
| content/sources | `EmptyState` | handled | none |
| content/seasonal-events | Text with "Click Add event" beside the Add event button | `error` banner | none (the action is on the page, adjacent) |
| content/autopilot | Per-section text | Inline error + Retry | none |
| content/beehiiv | `EmptyState` "No content synced yet" | handled | none |
| content/beehiiv/[id] | "Article not found" + Go back | **None**: `isLoading` only, so an error read as "Article not found" | **fixed**: `QueryError` + Retry |
| content/linkedin, content/x | `EmptyState` (not read in full) | `isError` present (not read in full) | none found |
| content/whatsapp (page, analytics) | Thin pages delegating (not read in full) | not read in full | not assessed |
| content/whatsapp/templates | "No templates yet. Draft your first one on the left." (action is on the same page) | toast on mutation errors | none |
| content/x-ads | Redirect | n/a | n/a |
| commerce (home), catalog, channels, knowledge, pricing, reviews | `EmptyState` | `isError` present | none |
| commerce/autopilot | `EmptyState` (inside component) | `isError` present | none |
| commerce/broadcasts | "No broadcasts yet. When you send one, its results appear here." | Retry button | none (the send form is on the same page) |
| commerce/inventory | "No products have synced yet..." | Error + Retry | none |
| commerce/win-back | Settings form, "None yet" for revenue | Retry | none |
| commerce/assistant, commerce/demand | Preview / thin page | not read in full | not assessed |
| growth (home), channels, decisions, rules, learning | `QueryBoundary` wraps every query: loading, error, retry; per-list text such as "Nothing needs you" | `QueryBoundary` | none |
| growth/learning/creatives, signals | `EmptyState` / text | Retry | none |
| growth/rules/audiences (+ [id]) | `EmptyState` | handled | none |
| growth/rules/business, growth/start | Form / wizard | handled | n/a |
| inbox (leads) | Card "No leads yet", prose only | Card + Retry | **fixed**: `EmptyState`, action "Open Ads" |
| inbox (reviews) | Card "No reviews here yet", prose only | Card + Retry | **fixed**: `EmptyState`, action "Connect a review site" (Integrations) |
| pages, pages/[id] | `EmptyState` | handled | none |
| tasks | `EmptyState` | handled | none |
| drive (files, trash) | `EmptyState` per tab | `listState` already separates loading/offline/error | none |
| settings/tickets | Card "No tickets yet" with no action | **None**: `isLoading` only, so an error read as "No tickets yet" | **fixed**: `QueryError` + Retry, `EmptyState` with action "Send feedback" |
| settings/feedback-admin | "No tickets match the current filters" | **None**: same `isLoading`-only defect | **fixed**: `QueryError` + Retry (admin screen; zero text left as is) |
| settings/feedback-admin/[id], settings/billing, settings/preferences, settings/whatsapp, settings/team | Forms or detail views | handled in the pages that query | n/a |
| ads | `EmptyState` | handled | none |
| insights/analytics, insights/search-console | Charts with per-widget notices (not read in full) | `isError` present | none found |
| integrations | Card grid; every provider shows a Connect action | `isError` present | n/a |
| overview | Widget dashboard; campaigns widget says "No campaigns yet" with a next step | per-widget | n/a |
| peaks | Dormant by design when no pack is on sale | `isError` present | n/a |
| ask, presence, presence/review-poster, dashboard root | Chat, form or redirect | n/a | n/a |

## Query errors that rendered nothing or the wrong thing

Found by listing every dashboard file that reads `isLoading`/`isPending` but
never `isError`, `error`, `QueryBoundary`, `fetchStatus` or a state helper.

Fixed: strategist, calendar/ideas, content/beehiiv/[id], settings/tickets,
settings/feedback-admin.

Left alone on purpose (they appear in that list but are not list pages or
degrade quietly by design): `ads/_components/audience-card`,
`calendar/_components/compose-new-sheet`, `content/x/_components/tweet-composer`,
`audience/discover-audiences-dialog`, `cms/model-select`,
`commerce/assistant-preview`, `dashboard/attention-bell`,
`dashboard/credits-cap-banner`, `dashboard/peaks-trend-card`,
`dashboard/waiting-for-you`, `dashboard/work-completed-card`,
`molecules/chat-panel`, `upgrade/add-business-dialog`, `shared/header-nav`.
These are overview widgets, dialogs and a banner; a failed request hides the
widget rather than drawing a wrong "empty". They may deserve the same
treatment later and were not individually assessed.

How the new states decide (`src/lib/query-view-state.ts`):

- `isLoading` is not used. It is `isFetching && isPending`, so it is false for
  a paused (offline) first fetch, and the page used to fall through to its
  empty branch.
- loading = `isPending` and `fetchStatus !== "paused"`; offline = `isPending`
  and paused; error = `isError` **and no data**. A failed background refetch
  with data on screen keeps the data. A manual retry with no data resets
  `error` to null and `status` to pending, so the screen returns to loading
  until the retry settles.

## Route boundaries

17 pillar folders gained an `error.tsx` (ads, ask, calendar, commerce, content,
drive, growth, inbox, insights, integrations, overview, pages, peaks, presence,
settings, strategist, tasks). `dashboard/error.tsx` already existed and already
caught everything below it, so these add a section-specific message and the
Report this link rather than closing an unhandled hole. A test fails if a
future pillar folder is added without one. `dashboard/not-found.tsx` is new.

Caveat: Next.js renders a segment `not-found.tsx` only for `notFound()` calls
inside it. An unmatched URL under `/dashboard` still renders the root
`(site)/not-found.tsx`, which this PR does not change.
