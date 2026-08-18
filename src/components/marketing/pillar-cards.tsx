"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PILLAR_ORDER, PILLARS } from "@/lib/pillars";
import { cn } from "@/lib/utils";

/**
 * The five pillars as one row of tall panels that open in place.
 *
 * The constraint driving the shape: all five names have to stay readable at
 * all times AND the whole set has to fit one desktop screen, which rules out
 * both a 3+2 grid (two rows) and a classic accordion (names stack). So the row
 * is a flex track where the open panel takes ~2.7 shares and the rest hold
 * ~0.82 — enough width for a name at every state, never enough for a second
 * row.
 *
 * Three ways in, because a visitor on a laptop, on a phone and on a keyboard
 * each expect a different one: pointer hover (mouse only — `pointerType` is
 * checked so a tap can't also leave a panel stuck open behind the one the
 * visitor actually chose), click/tap, and focus. Click PINS, so a mouse user
 * who opens a panel and moves the cursor across it to read doesn't lose it.
 *
 * The open detail deliberately contains NOTHING FOCUSABLE. It collapses when
 * another panel is hovered, so anything tabbable inside it would be a focus
 * stop the visitor cannot see — and making the collapsed region `inert` to
 * prevent that only moves the bug, because `inert` over the active element
 * blurs it to <body>. There is no arrangement of "focusable content inside a
 * region that another element's hover collapses" that behaves. A pillar's own
 * page is reached from the header and footer, which link the same five routes.
 *
 * Below `lg` the same component is a vertical accordion: the row would give
 * each panel ~110px, which is narrower than the words inside it.
 */

/**
 * Resting height of the row — a FLOOR, not a fixed height.
 *
 * The panels clip their overflow (they have to: the veil and the gold rail
 * are drawn to the rounded corners), so a fixed height that turns out to be
 * one line short doesn't scroll, it silently eats the bottom of the open
 * detail — the free-plan badge and the "Explore" link. `min-h` keeps the
 * poster proportions at rest, lets `align-items: stretch` equalise the five
 * panels as before, and lets the row grow instead of swallowing anything.
 *
 * 34rem is measured against the tallest case, which is NOT the widest
 * viewport: at 1024px the track is 928px and the open panel only ~419px, so
 * Content's six channel chips wrap to two rows and its detail runs ~504px.
 * Above ~1130px the panel is wide enough that they fit one row again.
 */
const ROW_HEIGHT = "lg:min-h-[34rem]";

export function PillarCards({
  /**
   * Catalog keys to badge "soon", already resolved by the page through the
   * same rule the integrations grid uses (lib/pillar-channels.ts). Required,
   * not optional: a caller who forgets it should fail to compile rather than
   * quietly ship chips that claim more than the grid does.
   */
  comingSoonKeys,
}: {
  comingSoonKeys: readonly string[];
}) {
  // The parent is a server component, so this prop is stable for the life of
  // the page — but this component re-renders on every hover, and rebuilding
  // the set five times per pointer move for nothing is just waste.
  const comingSoon = useMemo(() => new Set(comingSoonKeys), [comingSoonKeys]);
  // Three inputs, one derived state, and the ORDER is the whole design.
  //
  // Focus first. A cursor left sitting anywhere over the row holds `hovered`
  // indefinitely, so ranking hover above it meant a keyboard visitor could tab
  // through all five panels without opening one — the open panel stayed
  // wherever the mouse happened to be parked. A parked cursor is not an
  // intent; a Tab is. Hover takes the row back on the next real pointer MOVE,
  // which is what `onPointerEnter` clearing `focused` below is for.
  //
  // Pin last, underneath both, is what makes "click to keep it, then move the
  // mouse away" work — promote it and a pinned panel swallows every later
  // hover and focus.
  const [pinned, setPinned] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = focused ?? hovered ?? pinned;

  /**
   * The trigger. Opening is just a pin; CLOSING has to release the two inputs
   * that outrank the pin as well, because every gesture that pins also sets
   * one of them — a tap focuses the button, a click leaves the cursor on the
   * panel. Clearing only `pinned` would leave `active` unchanged, which made
   * the second tap on a mobile accordion header do nothing at all.
   *
   * The test is `pinned === i`, not `active === i`: on a mouse the panel is
   * already open from hover when the first click lands, and treating that as
   * "close" would make pinning unreachable.
   */
  const toggle = (i: number) => {
    if (pinned === i) {
      setPinned(null);
      setHovered(null);
      setFocused(null);
    } else {
      setPinned(i);
    }
  };

  return (
    <div
      className={cn("flex flex-col gap-3 lg:flex-row", ROW_HEIGHT)}
      // Only a real mouse leaving the track clears the hover. Touch never sets
      // it in the first place, and a keyboard user is handled by focus below.
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHovered(null);
      }}
      // focusout bubbles, so this fires for anything inside the track. Only
      // clear when focus has actually left it — moving between the trigger and
      // the "Explore" link inside one panel must not close that panel.
      onBlur={(e) => {
        // Alt-tabbing away fires focusout with a null relatedTarget too, and
        // collapsing the panel the visitor was reading — behind a window they
        // cannot see — is a change they never asked for and never saw.
        if (!document.hasFocus()) return;
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(null);
      }}
    >
      {PILLAR_ORDER.map((slug, i) => {
        const pillar = PILLARS[slug];
        const Icon = pillar.icon;
        const isActive = active === i;
        const isDimmed = active !== null && !isActive;
        const detailsId = `pillar-detail-${slug}`;
        const labelId = `pillar-label-${slug}`;

        return (
          <div
            key={slug}
            id={slug}
            data-active={isActive ? "true" : undefined}
            className={cn(
              // `u-rail` is the shared gold hairline, and it reads
              // `data-active` — so an open panel wears the same marker the
              // dashboard nav uses for the page you're on.
              "u-rail relative flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-2xl border bg-background",
              "transition-[flex-grow,border-color,box-shadow] duration-500 ease-brand motion-reduce:transition-none",
              // `basis-0` rather than `flex-1`: the shorthand and the `grow-*`
              // longhand below would both set flex-grow, and which one wins
              // would come down to stylesheet order.
              "lg:basis-0",
              isActive
                ? "border-brand/55 shadow-lg shadow-brand/10 lg:grow-[2.7]"
                : isDimmed
                  ? "lg:grow-[0.82]"
                  : "lg:grow",
            )}
            onPointerEnter={(e) => {
              if (e.pointerType !== "mouse") return;
              setHovered(i);
              // Clearing `focused` while the trigger still holds DOM focus is a
              // small lie, and a deliberate one: the next Tab corrects it, and
              // nothing focusable lives in the region this closes, so nobody
              // loses their place over it.
              setFocused(null);
            }}
            // focusin bubbles up from the trigger.
            onFocus={() => setFocused(i)}
          >
            <CardVeil active={isActive} />

            {/* Sits the content on the floor of a tall panel — and, because it
                is shrinkable, gives its own height back the moment the open
                detail needs it. `justify-end` would do the first job and fail
                the second: an over-tall column with end alignment overflows
                past the TOP edge, where `overflow-hidden` clips it away. */}
            <span aria-hidden className="hidden lg:block lg:min-h-0 lg:flex-1" />

            {/* The heading wraps the trigger rather than sitting beside it —
                the WAI-ARIA accordion shape, and the only one available here:
                an <h3> is flow content and would be invalid inside a <button>,
                while dropping the heading altogether (which this component did
                until now) takes the five pillar names out of the document
                outline and makes the whole section unreachable to anyone
                navigating by heading. Preflight already strips the margin and
                resets font-size/weight to inherit, so it changes nothing
                visually. */}
            <h3 className="relative min-w-0 shrink-0">
              <button
                type="button"
                aria-expanded={isActive}
                aria-controls={detailsId}
                // Names the trigger — and through it the <h3> that wraps it —
                // "Commerce", rather than "Commerce" followed by the whole
                // value-proposition sentence, which is what name-from-content
                // would otherwise concatenate for both.
                aria-labelledby={labelId}
                onClick={() => toggle(i)}
                className="flex w-full min-w-0 items-start gap-3 rounded-2xl p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset lg:flex-col lg:gap-3.5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-inner">
                  <Icon className="size-5 text-brand-contrast" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span id={labelId} className="block text-base font-bold tracking-tight">
                    {pillar.name}
                  </span>
                  {/* The one line a collapsed panel carries. It folds away
                      while another panel is open, because at ~110px it would
                      wrap to six lines and stop being scannable.

                      `max-h-40` is the ceiling that fold animates from, so it
                      also caps this line at EVERY width: 160px against a
                      longest `valueProp` of ~120px at 320px. Grow the copy
                      past that and it clips on phones. */}
                  <span
                    className={cn(
                      "mt-1.5 block overflow-hidden text-sm font-normal text-muted-foreground transition-[max-height,opacity,margin] duration-500 ease-brand motion-reduce:transition-none",
                      isDimmed ? "lg:mt-0 lg:max-h-0 lg:opacity-0" : "max-h-40 opacity-100",
                    )}
                  >
                    {pillar.valueProp}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "mt-2 size-4 shrink-0 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none lg:hidden",
                    isActive && "rotate-180",
                  )}
                />
              </button>
            </h3>

            {/* 0fr → 1fr is the only height transition that runs from
                content-sized to zero without a hardcoded max-height, which
                would clip whichever pillar ends up tallest. */}
            <div
              id={detailsId}
              // The collapsed detail stays in the DOM so it can transition, so
              // it also has to leave the a11y tree and the tab order —
              // `aria-expanded={false}` on the trigger promises it isn't there.
              //
              // Unconditional, and safe to be so only because the detail holds
              // no focusable content (see the note at the top of the file) —
              // `inert` can therefore never land on the active element.
              inert={!isActive}
              className={cn(
                "relative grid shrink-0 transition-[grid-template-rows,opacity] duration-500 ease-brand motion-reduce:transition-none",
                isActive ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="flex flex-col gap-3.5 px-5 pb-5">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-label">
                      Key capabilities
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {pillar.features.map((f) => (
                        <li key={f.title} className="flex items-start gap-2 text-sm">
                          <Check
                            className="mt-0.5 size-3.5 shrink-0 text-brand"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          <span className="text-muted-foreground">{f.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-label">
                      Channels &amp; platforms
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {pillar.channels.map((c) => {
                        const soon = c.key !== undefined && comingSoon.has(c.key);
                        return (
                          <li
                            key={c.name}
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-xs",
                              // Dashed, not merely dimmer: the state has to
                              // survive being read by someone who can't tell
                              // the two greys apart. The word carries it too.
                              soon
                                ? "border-dashed text-muted-foreground"
                                : "bg-muted/50 text-muted-foreground",
                            )}
                          >
                            {c.name}
                            {soon && (
                              <>
                                <span aria-hidden className="ml-1 opacity-70">
                                  &middot; soon
                                </span>
                                {/* The grid below says "Coming soon" in full;
                                    a chip has no room for it, so the short
                                    form is visual and the full phrase is what
                                    a screen reader actually hears. */}
                                <span className="sr-only"> &mdash; coming soon</span>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* The payoff — one outcome, stated as the visitor's result
                      rather than as another product feature. */}
                  {/* `--brand-soft` is theme-STABLE (only --brand-label flips
                      in .dark), so a 40% wash of it composites to a mid brown
                      on a dark ground and drops the label to 2.7:1. The dark
                      step is the one the pricing pages already use. */}
                  <div className="rounded-xl border border-brand/25 bg-brand-soft/40 px-3.5 py-2.5 dark:bg-brand/5">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-label">
                      The outcome
                    </p>
                    <p className="mt-1.5 text-sm font-medium">{pillar.outcomes[0]}</p>
                  </div>

                  {/* --brand-soft / --brand-ink are theme-stable, so at full
                      opacity this chip is the brightest object on a dark page.
                      The dark step is the one /auth and /pricing already use
                      for this exact pair. */}
                  <span className="self-start rounded-full bg-brand-soft px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-ink dark:bg-brand/12 dark:text-brand-soft">
                    {pillar.freeLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The empty upper half of a tall panel, filled with the same concentric-ridge
 * motif the hero orbit and the Peakhour mark carry — so the whitespace reads
 * as brand rather than as unfinished layout. Desktop only: below `lg` the
 * panels are content-height and there is no space to fill.
 */
function CardVeil({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 hidden h-1/2 transition-opacity duration-500 ease-brand motion-reduce:transition-none lg:block",
        active ? "opacity-100" : "opacity-60",
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, var(--brand) 14%, transparent), transparent 70%)",
        }}
      />
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-0 size-full"
        focusable="false"
      >
        <g fill="none" stroke="var(--brand)" strokeLinecap="round" opacity="0.3">
          <circle cx="50" cy="4" r="16" strokeWidth="0.5" />
          <circle cx="50" cy="4" r="26" strokeWidth="0.5" strokeDasharray="2 4" />
          <circle cx="50" cy="4" r="36" strokeWidth="0.5" strokeDasharray="1 5" />
        </g>
      </svg>
    </div>
  );
}
