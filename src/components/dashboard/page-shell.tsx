import { cn } from "@/lib/utils";

/**
 * <PageShell> + <PageHeader> — the layout contract for every /dashboard route.
 *
 * WHY THIS EXISTS. Before this, there was no page-layout primitive at all, so
 * all 49 dashboard routes re-invented their own frame. The drift that produced:
 *
 *   - Six different content measures (max-w-2xl / 3xl / 4xl / 5xl / 6xl /
 *     uncapped), one of them left-aligned instead of centred, which left ~830px
 *     of empty gutter on the right of /dashboard/settings/billing at 1920px.
 *   - Three different page-title styles (20x `text-2xl font-bold`, 12x
 *     `text-2xl font-semibold`, 1x `text-3xl font-bold`), mostly emitted as
 *     <h2> so pages carried no <h1> at all.
 *   - Ten routes that re-declared their own root padding on top of the one the
 *     dashboard shell already applies, doubling it to 48px.
 *
 * DIVISION OF RESPONSIBILITY. The dashboard shell
 * (src/app/(site)/dashboard/layout.tsx) owns page PADDING — it is already the
 * single owner, and pages that re-declare it are the bug. PageShell owns
 * MEASURE (max-width + centring) and VERTICAL RHYTHM. Pages own neither.
 * A page should therefore never set `p-*` on its root, and never set
 * `max-w-*`/`mx-auto` on its root — pick a `width` instead.
 *
 * Container queries are deliberately NOT applied here yet: `container-type`
 * makes an element a containing block for fixed-position descendants, so
 * turning it on app-wide needs its own audit. That lands with the tablet
 * density work, not here.
 */

/**
 * Content measures. Values are deliberately few — a page picks the closest
 * tier rather than inventing a max-width, which is how the six-measure drift
 * happened in the first place.
 */
const PAGE_WIDTHS = {
  /** Single-column reading/forms: settings, billing, one-column detail. ~768px. */
  narrow: "max-w-3xl",
  /** The default. Card grids and most list pages. ~1152px. */
  standard: "max-w-6xl",
  /** Dense multi-column dashboards (KPI rows, analytics). 1440px. */
  wide: "max-w-[90rem]",
  /** Opt out entirely: tables, boards, calendars that want every pixel. */
  full: "max-w-none",
} as const;

export type PageShellWidth = keyof typeof PAGE_WIDTHS;

interface PageShellProps extends React.ComponentProps<"div"> {
  /** Content measure. Defaults to `standard`. See PAGE_WIDTHS. */
  width?: PageShellWidth;
}

/**
 * Root wrapper for a dashboard route. Owns measure + vertical rhythm.
 *
 * The rhythm steps down on mobile (16px) from desktop (24px): 24px is a
 * desktop value, and applying it unchanged at 375px is what made the phone
 * layout read as loose.
 */
export function PageShell({
  width = "standard",
  className,
  children,
  ...props
}: PageShellProps) {
  return (
    <div
      data-slot="page-shell"
      className={cn(
        "mx-auto w-full space-y-4 sm:space-y-6",
        PAGE_WIDTHS[width],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** The page title. Rendered as the page's one and only <h1>. */
  title: React.ReactNode;
  /** Optional one-line description under the title. */
  description?: React.ReactNode;
  /** Optional leading visual (icon tile, avatar) shown left of the title. */
  icon?: React.ReactNode;
  /**
   * Optional trailing actions (buttons, links, status chips). Wraps BELOW the
   * title under `sm` rather than competing with it for width — long org names
   * used to crush the trailing element on the Overview hero.
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
        {/* min-w-0 so a long unbroken title truncates inside the flex track
            instead of forcing the row wider than the viewport. */}
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
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
