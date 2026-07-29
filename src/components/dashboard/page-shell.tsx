import { cn } from "@/lib/utils";

/**
 * <PageShell> + <PageHeader> — the layout contract for every /dashboard route.
 *
 * WHY THIS EXISTS. There was no page-layout primitive, so all 49 dashboard
 * routes declared their own frame. 20 of them had already converged on
 * `<h1 className="text-2xl font-semibold tracking-tight">` — this codifies
 * that majority convention rather than inventing a new one. The drift it
 * replaces:
 *
 *   - Six content measures (max-w-2xl / 3xl / 4xl / 5xl / 6xl / uncapped),
 *     one of them left-aligned instead of centred, which left ~830px of empty
 *     gutter to the right of /dashboard/settings/billing at 1920px.
 *   - Three title styles — 25 `text-2xl font-bold`, 12 `text-2xl
 *     font-semibold`, 1 `text-3xl font-bold` — with the first group mostly
 *     emitted as <h2>, so those pages carried no <h1> at all.
 *   - Ten routes re-declaring their own root padding on top of the shell's,
 *     doubling it to 48px.
 *
 * DIVISION OF RESPONSIBILITY. The dashboard shell
 * (src/app/(site)/dashboard/layout.tsx) owns page PADDING — it is already the
 * single owner, and routes that re-declare it are the bug. PageShell owns
 * MEASURE (max-width + centring) and VERTICAL RHYTHM. Pages own neither: a
 * page adopting PageShell should carry no `p-*`, `max-w-*` or `mx-auto` on its
 * root, and should pick a `width` instead. That is a convention, not yet an
 * enforced invariant — the remaining self-padding routes (calendar,
 * calendar/recurring, content/autopilot, whatsapp, inbox, insights/*,
 * settings/team, content) are migrated in the follow-up, and the lint rule
 * that pins it lands with them.
 *
 * NOTE ON TYPE SCALE: PageHeader's description renders at `text-sm` (14px).
 * The ad-hoc headers it replaces used an unsized `text-muted-foreground`
 * (16px), so adopting pages get a slightly quieter sub-title. Deliberate —
 * it matches the routes that already used `text-sm` and stops the header
 * block from out-weighing the content beneath it.
 *
 * Container queries are deliberately NOT applied here yet: `container-type`
 * makes an element a containing block for fixed-position descendants, so
 * turning it on app-wide needs its own audit. That lands with the tablet
 * density work.
 */

/**
 * Content measures. Values are deliberately few — a page picks the closest
 * tier rather than inventing a max-width, which is how the six-measure drift
 * happened in the first place.
 */
const PAGE_WIDTHS = {
  /** Single-column reading/forms: settings, billing, one-column detail. 768px. */
  narrow: "max-w-3xl",
  /** The default. Card grids and most list pages. 1152px. */
  standard: "max-w-6xl",
  /** Dense multi-column dashboards (KPI rows, analytics). 1440px. Kept in
   *  sync with the banner-slot cap in the dashboard layout shell. */
  wide: "max-w-360",
  /** Opt out entirely: tables, boards, calendars that want every pixel. */
  full: "max-w-none",
} as const;

export type PageShellWidth = keyof typeof PAGE_WIDTHS;

export interface PageShellProps extends React.ComponentProps<"div"> {
  /** Content measure. Defaults to `standard`. See PAGE_WIDTHS. */
  width?: PageShellWidth;
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
   * anything user-supplied) must therefore cap itself — e.g.
   * `max-w-[60vw] sm:max-w-72` alongside `truncate` — because it will not be
   * shrunk for you. See the Overview hero for the worked example.
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
