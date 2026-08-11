"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-triggered reveal for the marketing surface — the story pages read as
 * a sequence, and content that arrives as you reach it is what makes them read
 * that way rather than as one long wall.
 *
 * Deliberately hand-rolled on IntersectionObserver rather than pulling in an
 * animation library: this is the only motion primitive the marketing pages
 * need, and it costs ~1kB instead of ~40kB on a page whose whole job is to
 * load fast for a first-time visitor.
 *
 * Three things keep it safe to hide content behind:
 *
 *  1. `prefers-reduced-motion` is handled in CSS (globals.css), so a
 *     reduced-motion visitor sees everything at full opacity even before this
 *     component mounts — the preference is honoured with no JS at all.
 *  2. A `<noscript>` rule on the pages that use it neutralises `.reveal`
 *     entirely, so a no-JS visitor gets the whole page.
 *  3. The observer is disconnected after the first intersection — this is an
 *     entrance, not a scrubbed animation, and re-hiding content that scrolls
 *     back off-screen is both distracting and a way to lose it permanently if
 *     the observer ever misfires.
 */
export function Reveal({
  children,
  className,
  /** Stagger, in ms, applied as a transition-delay. Keep under ~400ms: past
   *  that the delay outlasts the scroll and the item appears to be missing. */
  delay = 0,
  /** Render as a different element when the parent's layout needs one (a list
   *  item inside a <ul>, say) — a stray <div> there is invalid markup. */
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /**
     * The reveal is a DOM effect, NOT React state. Flipping the attribute
     * directly rather than through setState buys three things on a page that
     * mounts several dozen of these: no re-render per element, no cascading
     * render warning from the react-hooks lint rules, and the "already
     * revealed" fact stored in the DOM — which is exactly where the CSS that
     * reads it lives. React never renders `data-shown` itself, so nothing
     * reconciles the attribute back away.
     */
    const show = () => {
      el.dataset.shown = "true";
    };
    // No IntersectionObserver (very old browser, a stripped in-app webview):
    // show it rather than leaving the section permanently blank.
    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          show();
          observer.disconnect();
        }
      },
      // A negative bottom margin holds the reveal until the element is
      // properly in view — firing on the first pixel means the animation is
      // over before the visitor has looked at it.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // Mount only: the observer disconnects itself on the first intersection,
    // and re-running would re-observe an element that is already revealed.
  }, []);

  return (
    <Tag
      // One cast rather than a generic ref type per tag: the union of the three
      // allowed elements is always an HTMLElement, which is all the effect uses.
      ref={ref as React.Ref<never>}
      className={cn("reveal", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
