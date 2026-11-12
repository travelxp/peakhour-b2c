import { cn } from "@/lib/utils";

/**
 * <PageShell> + <PageHeader> — the layout contract for every /dashboard route.
 *
 * WHY THIS EXISTS. There was no page-layout primitive, so all 49 dashboard
 * routes declared their own frame. Only 20 carried an <h1> at all, and 12 of
 * those 20 already used exactly `text-2xl font-semibold tracking-tight` —
 * PageHeader adopts that so the largest existing group needs no restyling.
 * The drift it replaces:
 *
 *   - Six content measures (max-w-2xl / 3xl / 4xl / 5xl / 6xl / uncapped),
 *     one of them left-aligned instead of centred, which left ~830px of empty
 *     gutter to the right of /dashboard/settings/billing at 1920px.
 *   - Three title styles — 25 files with `text-2xl font-bold`, 12 with
 *     `text-2xl font-semibold`, 1 with `text-3xl font-bold` — and the 29
 *     routes with no <h1> at all.
 *   - Twelve routes re-declaring their own root padding on top of the
 *     shell's: 48px where both sides use `p-6`, 32px where the route uses
 *     `p-4`, and 56px on /dashboard/content, which stacks `container … py-8`.
 *
 * DIVISION OF RESPONSIBILITY. The dashboard shell
 * (src/app/(site)/dashboard/layout.tsx) owns page PADDING — it is already the
 * single owner, and routes that re-declare it are the bug. PageShell owns
 * MEASURE (max-width + centring) and VERTICAL RHYTHM. Pages own neither: a
 * page adopting PageShell should carry no `p-*`, `max-w-*` or `mx-auto` on its
 * root, and should pick a `width` instead. This is a convention, not an
 * enforced invariant at runtime, but src/app/(site)/dashboard/page-shell.lint.test.ts
 * fails the build if a page.tsx declares its own root frame or two <h1>s.
 *
 * "Root" means the outermost element the route renders, which is not always
 * in the page.tsx: the Commerce routes are one-line pages delegating to a
 * component in src/components/commerce, and that component is the root. A
 * first pass searched page.tsx files only and so missed six of them, which is
 * why they are listed here.
 *
 * One shell per route, though. A component rendered INSIDE a page that
 * already opened a shell must not open another — nested shells double the
 * measure wrapper and break any `[data-slot="page-shell"]` selector or lint
 * rule built on this contract.
 *
 * NOTE ON TYPE SCALE: PageHeader's description renders at `text-sm` (14px).
 * The ad-hoc headers it replaces used an unsized `text-muted-foreground`
 * (16px), so adopting pages get a slightly quieter sub-title. Deliberate —
 * it matches the routes that already used `text-sm` and stops the header
 * block from out-weighing the content beneath it.
 *
 * LARGE SCREENS (>= 2xl, 1536px). Without a rule the `standard` and `wide`
 * caps left 400-800px of empty gutter at 1920/2560. `standard` now grows to
 * 80rem and `wide` to 100rem at 2xl; `PageGrid` adds a 4th card column at the
 * same breakpoint; and an optional `rail` slot adds a sticky 20rem context
 * column that only exists at >= 2xl (below it the rail stacks under the
 * content, so nothing is hidden on tablets). Prose keeps `max-w-prose`
 * (PAGE_PROSE) at every size - a wider page must not mean longer lines.
 * The dashboard layout's banner slot still caps at max-w-360; it is empty in
 * the common case and lives in layout.tsx (another lane owns it), so syncing
 * it to the new `wide` cap is a follow-up.
 *
 * TABLET (768-1023px). Phone->desktop jumps (`sm:` then `lg:`) left tablets on
 * the phone layout. PageGrid steps 1 -> 2 (sm) -> 3 (md) -> 4 (2xl), `kpi`
 * 2 -> 3 (md) -> 4 (lg), and tables degrade below `md` (see DataTable /
 * `ScrollTable` guidance in the PR).
 *
 * CONTAINER QUERIES. PageGrid wraps its grid in an `@container`, so its
 * columns respond to the width of the content area, not the viewport - the
 * sidebar toggles between 256px and 48px, which no viewport breakpoint can
 * see. `container-type: inline-size` applies layout containment, which makes
 * the element the containing block for `position: fixed` descendants (they
 * would pin to the container instead of the viewport) and it also clips
 * nothing but creates a stacking context. Audit finding: every dialog, sheet,
 * popover, select, tooltip and toast in this app is a Radix/sonner portal
 * rendered under <body>, so none of them is a DOM descendant of a grid; and
 * `fixed` is not used on any element rendered inside a card grid. PageGrid is
 * therefore safe for cards and KPI tiles, but do NOT put a `fixed` element
 * inside one, and do NOT apply `@container` to PageShell itself (pages hold
 * sticky bars and inline fixed overlays).
 */

/**
 * Content measures. Values are deliberately few — a page picks the closest
 * tier rather than inventing a max-width, which is how the six-measure drift
 * happened in the first place.
 */
const PAGE_WIDTHS = {
  /** Single-column reading/forms: settings, billing, one-column detail. 768px.
   *  Deliberately does NOT grow at 2xl: it is a reading measure. */
  narrow: "max-w-3xl",
  /** The default. Card grids and most list pages. 1152px, 1280px at 2xl. */
  standard: "max-w-6xl 2xl:max-w-7xl",
  /** Dense multi-column dashboards (KPI rows, analytics). 1440px, 1600px at
   *  2xl. The layout's banner slot is still capped at max-w-360. */
  wide: "max-w-360 2xl:max-w-400",
  /** Opt out entirely: tables, boards, calendars that want every pixel. */
  full: "max-w-none",
} as const;

/** The same tiers when a `rail` is present: at 2xl the cap grows by the rail
 *  (20rem) plus its gap (1.5rem) so the MAIN column keeps its tier width. */
const PAGE_WIDTHS_WITH_RAIL = {
  narrow: "max-w-3xl 2xl:max-w-[69.5rem]",
  standard: "max-w-6xl 2xl:max-w-[101.5rem]",
  wide: "max-w-360 2xl:max-w-[121.5rem]",
  full: "max-w-none",
} as const;

/** Line-length cap for running prose on any page. Apply to paragraphs, not
 *  to cards or tables. ~65ch regardless of how wide the shell is. */
export const PAGE_PROSE = "max-w-prose";

export type PageShellWidth = keyof typeof PAGE_WIDTHS;

export interface PageShellProps extends React.ComponentProps<"div"> {
  /** Content measure. Defaults to `standard`. See PAGE_WIDTHS. */
  width?: PageShellWidth;
  /**
   * Fill the available viewport height instead of growing with content, and
   * become a column flex container so one child can take the remaining space
   * with `min-h-0 flex-1`. For surfaces that own their own scrolling — chat
   * threads, boards, split panes.
   *
   * This exists so such a page never has to guess the shell's chrome height.
   * /dashboard/ask used to hard-code `h-[calc(100dvh-5rem)]`, which assumed
   * 80px of chrome when the real figure is 104px (header 56 + shell padding
   * 48; the banner slot adds nothing in the common case, being
   * `empty:hidden`) — so it overflowed its container by 24px on every device.
   * Anything computed from a literal goes stale the moment the shell's
   * padding changes; this cannot.
   *
   * Requires the shell to have a definite height, which is why the dashboard
   * layout pins `h-svh` on SidebarProvider — see the comment there. Without
   * that, `flex-1` here resolves against an indefinite height and sizes to
   * content, i.e. `fill` silently does nothing.
   *
   * `min-h-0` is the load-bearing half: without it this flex item's automatic
   * minimum size is its content height, so a long thread would push the shell
   * into a nested scrollbar instead of scrolling inside the page.
   */
  fill?: boolean;
  /**
   * Optional right-hand context rail (activity, "needs you", tips). At >= 2xl
   * it is a sticky 20rem column beside the content; below 2xl it stacks UNDER
   * the content, so it must be supplementary - never the only place an action
   * lives. Not supported together with `fill`.
   */
  rail?: React.ReactNode;
}

/**
 * Root wrapper for a dashboard route. Owns measure + vertical rhythm.
 *
 * The rhythm steps down on mobile (16px) from desktop (24px): 24px is a
 * desktop value, and applying it unchanged at 375px is what made the phone
 * layout read as loose. Nested rhythm groups inside a page should use the
 * same `space-y-4 sm:space-y-6` pair so a page doesn't mix scales.
 */
export function PageShell({
  width = "standard",
  fill = false,
  rail,
  className,
  children,
  ...props
}: PageShellProps) {
  if (rail && !fill) {
    return (
      <div
        data-slot="page-shell"
        data-rail=""
        className={cn(
          "mx-auto w-full space-y-4 sm:space-y-6 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:items-start 2xl:gap-6 2xl:space-y-0",
          PAGE_WIDTHS_WITH_RAIL[width],
          className,
        )}
        {...props}
      >
        <div data-slot="page-shell-main" className="min-w-0 space-y-4 sm:space-y-6">
          {children}
        </div>
        <aside
          data-slot="page-shell-rail"
          className="space-y-4 2xl:sticky 2xl:top-4"
        >
          {rail}
        </aside>
      </div>
    );
  }
  return (
    <div
      data-slot="page-shell"
      data-fill={fill || undefined}
      className={cn(
        "mx-auto w-full space-y-4 sm:space-y-6",
        PAGE_WIDTHS[width],
        fill && "flex min-h-0 flex-1 flex-col",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const GRID_VARIANTS = {
  /** Cards of comparable weight: 1 -> 2 -> 3 -> 4 columns by CONTAINER width. */
  cards: "grid gap-4 @md:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4",
  /** KPI tiles: 2 up on phones, stepping to 3, 4 and 6 as the content grows. */
  kpi: "grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-4 @7xl:grid-cols-6",
} as const;

export interface PageGridProps extends React.ComponentProps<"div"> {
  /** Column ladder. Defaults to `cards`. */
  variant?: keyof typeof GRID_VARIANTS;
}

/**
 * Container-query card/KPI grid. The OUTER element is the `@container`; the
 * grid is its child (a container cannot restyle itself). See the CONTAINER
 * QUERIES paragraph above for why this is safe and where it is not.
 */
export function PageGrid({
  variant = "cards",
  className,
  children,
  ...props
}: PageGridProps) {
  return (
    <div data-slot="page-grid" className="@container">
      <div className={cn(GRID_VARIANTS[variant], className)} {...props}>
        {children}
      </div>
    </div>
  );
}

export interface PageHeaderProps
  extends Omit<React.ComponentProps<"div">, "title" | "children"> {
  /** The page title. Rendered as the page's one and only <h1>. */
  title: React.ReactNode;
  /** Optional one-line description under the title. Renders at `text-sm`. */
  description?: React.ReactNode;
  /** Optional leading visual (icon tile, avatar) shown left of the title. */
  icon?: React.ReactNode;
  /**
   * Optional trailing actions (buttons, links, status chips). Wraps BELOW the
   * title under `sm`.
   *
   * The actions track is `shrink-0`, so it is held at its natural width and
   * the title absorbs the shrink — the right default for buttons, which
   * should never be squashed. An action of VARIABLE width (a URL, an email,
   * anything user-supplied) must therefore cap itself with a max-width
   * alongside `truncate`, because it will not be shrunk for you. See the
   * Overview hero for the worked example.
   *
   * Caveat worth knowing before you pick that number: a caller can only see
   * the VIEWPORT, but what constrains this row is the content area
   * (viewport − sidebar − padding), and the sidebar toggles between 256px
   * and 48px at runtime. So no viewport-relative unit is right in both
   * states — prefer a flat `sm:`/`lg:` max-width tuned for the expanded
   * sidebar (the tighter case). A container query on this header is the
   * real answer and lands with the tablet density work.
   */
  actions?: React.ReactNode;
}

/**
 * Standard page header: one <h1>, optional description, optional leading icon,
 * optional trailing actions.
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="shrink-0">{icon}</div>}
        <div className="min-w-0 space-y-1">
          {/* `min-w-0` alone only PERMITS the track to shrink below min-content
              — an unbroken title (a long org or domain name) would then just
              overflow the narrowed box and still push the row wider than the
              viewport. `wrap-break-word` is what actually resolves it: the
              title wraps rather than clipping, so no part of the page's
              identity is hidden from the reader. */}
          <h1 className="wrap-break-word text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {/* `wrap-break-word` here too, not just on the <h1>: overflow-wrap
              is per-element and does not inherit from the sibling above.
              Descriptions carry API- and AI-derived strings (Overview passes
              `stats.businessType`), so an unbroken token would otherwise
              overflow this narrowed track with nothing clipping it. */}
          {description && (
            <p className="wrap-break-word max-w-prose text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
