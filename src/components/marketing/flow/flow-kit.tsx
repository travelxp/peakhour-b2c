import Link from "next/link";
import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { PeakhourLogo } from "@/components/shared/peakhour-logo";
import { SITE, cn } from "@/lib/utils";

/**
 * The Daylight pieces for the pages a person reaches mid-flow (sign-in, claim, reconnect, share, plan
 * confirmation): one calm card on the marketing ground, the same buttons as /shopify, and four notice tones.
 * Every colour is a token, so the pieces follow `.theme-daylight` (globals.css) and nothing here is a hex.
 *
 * Behaviour never lives here: these are frames and styles. The pages keep their own state, calls and redirects.
 */

/** The marketing ground the flow pages sit on: the pale coral hero tint fading to white. */
const FLOW_GROUND = "bg-[linear-gradient(180deg,var(--daylight-hero)_0%,var(--background)_85%)]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** The stage for a flow card inside a layout that already has its own chrome (the auth layout): centred, on the Daylight ground. */
export const flowStage = `flex flex-1 items-start justify-center px-4 py-6 sm:items-center sm:py-12 ${FLOW_GROUND}`;

/** A link inside flow prose: the kit's underline, with the coral stroke. */
export const flowLink = `rounded-sm font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4 hover:text-brand-strong ${FOCUS}`;

/**
 * min-h-dvh, not min-h-screen: on a phone `vh` is the tallest viewport, so a min-h-screen column scrolls a little even
 * when the content fits. The @supports variant sorts after the base utility, so `dvh` wins exactly where it is understood.
 */
export const flowScreen = "flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col";

/** The legal strip under a flow page. Support is a mailto, never /contact (the coming-soon gate hides that page). */
export function FlowLegalStrip({ className, help = "Trouble signing in?" }: { className?: string; help?: string }) {
  const link = `rounded-sm py-1 -my-1 underline underline-offset-2 hover:text-foreground focus-visible:text-foreground ${FOCUS}`;
  return (
    <footer
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4 py-3 text-center text-xs text-muted-foreground sm:py-4",
        className,
      )}
    >
      {/* The address spells itself out only where there is width for it; the sr-only text keeps the visible word a prefix of the name (WCAG 2.5.3). */}
      <a href={`mailto:${SITE.contactGeneral}`} className={link}>
        <span className="sm:hidden">Help</span>
        <span className="sr-only sm:hidden"> — email {SITE.contactGeneral}</span>
        <span className="hidden sm:inline">
          {help} {SITE.contactGeneral}
        </span>
      </a>
      <span aria-hidden className="opacity-40">
        ·
      </span>
      <Link href="/terms" className={link}>
        Terms
      </Link>
      <span aria-hidden className="opacity-40">
        ·
      </span>
      <Link href="/privacy-policy" className={link}>
        Privacy
      </Link>
      <span aria-hidden className="opacity-40">
        ·
      </span>
      <Link href="/cookie-policy" className={link}>
        Cookies
      </Link>
    </footer>
  );
}

/**
 * A whole flow page that has no site chrome of its own (claim, reconnect, share, confirm): the Daylight wrapper, the
 * logo, one centred column and the legal strip. The logo is `PeakhourLogo` and nothing else.
 */
export function FlowPage({ children, width = "max-w-lg" }: { children: ReactNode; width?: string }) {
  return (
    <div className={cn("theme-daylight overflow-x-clip", flowScreen, FLOW_GROUND)}>
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 py-4 sm:px-6 sm:py-5">
        {/* prefetch off: a flow page is often opened from an email or another app, and every gated URL renders the teaser. */}
        <Link prefetch={false} href="/" className={cn("flex items-center rounded-sm", FOCUS)} aria-label={`${SITE.name} home`}>
          <PeakhourLogo className="h-7 w-auto sm:h-8" decorative />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-8 pt-2 sm:items-center sm:pb-12">
        <div className={cn("w-full", width)}>{children}</div>
      </main>
      <FlowLegalStrip help="Need help?" />
    </div>
  );
}

/** The one raised card every flow state sits on. */
export function FlowCard({ children, className, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cn("w-full rounded-3xl border bg-card p-5 shadow-[var(--daylight-shadow)] sm:p-8", className)} {...rest}>
      {children}
    </div>
  );
}

const TILE_TONE = {
  brand: "bg-brand-soft text-brand-ink",
  ok: "bg-[var(--daylight-ok-soft)] text-[var(--daylight-ok-ink)]",
  warn: "bg-[var(--daylight-warn-soft)] text-[var(--daylight-warn-ink)]",
  bad: "bg-[var(--daylight-bad-soft)] text-[var(--daylight-bad-ink)]",
} as const;
export type FlowTone = keyof typeof TILE_TONE;

/** The icon tile at the head of a card: a soft square with the icon in its own ink step (AA on its tint). */
export function FlowIcon({ icon: Icon, tone = "brand", className }: { icon: LucideIcon; tone?: FlowTone; className?: string }) {
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", TILE_TONE[tone], className)}>
      <Icon className="size-5" strokeWidth={2.25} aria-hidden />
    </span>
  );
}

/**
 * The head of a card: tile, then the page's single H1 and a line under it. `headingRef` and `tabIndex` serve the sign-in
 * card, which moves focus to its heading when the outcome changes.
 */
export function FlowHead({
  icon,
  tone,
  title,
  children,
  as: Heading = "h1",
  headingRef,
  tabIndex,
}: {
  icon?: LucideIcon;
  tone?: FlowTone;
  title: ReactNode;
  children?: ReactNode;
  as?: "h1" | "h2";
  headingRef?: React.Ref<HTMLHeadingElement>;
  tabIndex?: number;
}) {
  return (
    <div className="flex items-start gap-3.5">
      {icon ? <FlowIcon icon={icon} tone={tone} /> : null}
      <div className="min-w-0 flex-1">
        <Heading
          ref={headingRef}
          tabIndex={tabIndex}
          className="text-[1.6rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-balance focus-visible:outline-none sm:text-3xl"
        >
          {title}
        </Heading>
        {children ? <div className="mt-2 text-[15px] text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

const NOTICE_TONE = {
  bad: { cls: "border-[var(--daylight-bad)]/30 bg-[var(--daylight-bad-soft)] text-[var(--daylight-bad-ink)]", icon: AlertCircle },
  warn: { cls: "border-[var(--daylight-amber)]/60 bg-[var(--daylight-warn-soft)] text-[var(--daylight-warn-ink)]", icon: AlertTriangle },
  ok: { cls: "border-[var(--daylight-ok)]/30 bg-[var(--daylight-ok-soft)] text-[var(--daylight-ok-ink)]", icon: CheckCircle2 },
  info: { cls: "bg-muted text-foreground", icon: Info },
} as const;

/** A message inside a card. Pass `role="alert"` for an error or a refusal, `role="status"` for a confirmation. */
export function FlowNotice({ tone, children, className, ...rest }: { tone: keyof typeof NOTICE_TONE } & ComponentProps<"div">) {
  const { cls, icon: Icon } = NOTICE_TONE[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-2xl border p-3.5 text-sm leading-snug", cls, className)} {...rest}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const BTN_BASE = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-center text-[15px] font-bold transition-[transform,background-color] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS}`;
const BTN_VARIANT = {
  primary:
    "bg-brand-gradient text-brand-contrast shadow-[0_8px_20px_-8px_var(--brand)] hover:-translate-y-0.5 focus-visible:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:translate-y-0 aria-disabled:pointer-events-none",
  ghost:
    "shadow-[inset_0_0_0_2px_var(--foreground)] hover:bg-muted disabled:pointer-events-none disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:pointer-events-none",
  quiet: "text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-60",
} as const;

/** The flow's button: a coral pill, an outlined pill, or a quiet text one. `asChild` styles a link. Full width unless `inline`. */
export function FlowButton({
  variant = "primary",
  inline = false,
  asChild = false,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BTN_VARIANT; inline?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  // A button defaults to type="button": a FlowButton inside a form must not submit it by accident.
  const typeProps = asChild ? {} : { type: "button" as const };
  return <Comp {...typeProps} className={cn(BTN_BASE, BTN_VARIANT[variant], inline ? "w-auto" : "w-full", className)} {...props} />;
}

/** A choice in a "which one?" list: a selectable card, coral when picked. */
export function flowOption(selected: boolean, blocked = false, row = false) {
  return cn(
    "flex w-full gap-0.5 rounded-2xl border-2 bg-card p-3.5 text-left text-sm transition-colors",
    FOCUS,
    selected ? "border-brand bg-brand-soft" : "border-border hover:border-foreground/40 hover:bg-muted",
    row ? "flex-row items-center justify-between" : "flex-col items-start",
    blocked && "cursor-not-allowed opacity-60 hover:border-border hover:bg-card",
  );
}

/** A quiet panel for facts ("Signed in as ..."), on the mist ground. */
export const flowFacts = "rounded-2xl bg-muted p-3.5 text-sm text-muted-foreground";

/** The spinner, in coral, for an inline wait. Reduced motion stops the spin. */
export function FlowSpinner({ className, onBrand = false }: { className?: string; onBrand?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-5 shrink-0 animate-spin rounded-full border-2 motion-reduce:animate-none",
        onBrand ? "border-brand-contrast/40 border-t-brand-contrast" : "border-border border-t-brand",
        className,
      )}
    />
  );
}
