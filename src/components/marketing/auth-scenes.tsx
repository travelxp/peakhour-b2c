"use client";

import { useEffect, useState } from "react";
import { TerrainCanvas } from "@/components/marketing/terrain-canvas";

/**
 * The changing half of /auth.
 *
 * The two-panel layout was already right — an always-dark brand panel beside
 * the form — and static. One promise, held for as long as someone takes to
 * type an email. Five scenes, one per module, each with its own generated
 * ground in that module's series colour, turn the wait into the pitch: this is
 * the last surface before signup and the only one where a visitor is captive.
 *
 * Manual controls exist for their own sake, not as a reduced-motion fallback —
 * someone who wants to re-read the scene that just left should not have to
 * wait four rotations for it. Auto-advance is what the preference switches
 * off; the dots keep working either way.
 */

interface Scene {
  module: string;
  headline: string;
  body: string;
  /** Stable seed for the ground, so a module always gets the same terrain. */
  seed: number;
  /** The module's chart-series colour, as "r,g,b". */
  rgb: string;
}

const SCENES: Scene[] = [
  {
    module: "Peakhour Commerce",
    headline: "It answered 41 buyers last night.",
    body: "Live catalogue, live stock, in their language — on WhatsApp and on your storefront.",
    seed: 11,
    rgb: "201,130,12",
  },
  {
    module: "Peakhour Content",
    headline: "Tuesday's newsletter is already written.",
    body: "Drafted in your voice from the sources you trust, queued for your approval.",
    seed: 27,
    rgb: "142,118,232",
  },
  {
    module: "Peakhour Growth",
    headline: "It cut the ad set that stopped paying.",
    body: "Ads, SEO and creator campaigns, watched daily instead of monthly.",
    seed: 43,
    rgb: "16,156,135",
  },
  {
    module: "Peakhour Support",
    headline: "Every channel, one queue, nothing missed.",
    body: "Email, chat, WhatsApp and DMs — drafted, routed, timed against your SLA.",
    seed: 61,
    rgb: "74,143,224",
  },
  {
    module: "Peakhour Presence",
    headline: "Your listing was wrong. It isn't now.",
    body: "Google, Maps and AI search kept right, with every review answered.",
    seed: 79,
    rgb: "224,90,147",
  },
];

const DWELL_MS = 5000;

export function AuthScenes() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Read the preference here rather than mirroring it into state — setting
    // state from an effect body is what `react-hooks/set-state-in-effect`
    // exists to stop, and the mirror bought nothing: this is the only place
    // that consults it. A visitor who flips the preference mid-session keeps
    // the behaviour they loaded with, which is a fair trade for not holding
    // a second copy of a browser fact.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Keyed on `index`: pressing a dot restarts the dwell rather than dropping
    // the visitor into the tail of the interval that was already running.
    const id = setInterval(() => setIndex((i) => (i + 1) % SCENES.length), DWELL_MS);
    return () => clearInterval(id);
  }, [index]);

  const scene = SCENES[index];

  return (
    <div className="relative z-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-14 -inset-y-10 -z-10 opacity-70"
      >
        {/* Keyed on the scene so the canvas remounts and repaints in the new
            module's colour — TerrainCanvas paints on size change, not on prop
            change, because every other caller is static. */}
        <TerrainCanvas
          key={scene.seed}
          seed={scene.seed}
          rgb={scene.rgb}
          options={{ layers: 3, baseline: 1.02, amplitude: 0.42, alpha: 0.7 }}
        />
      </div>

      {/* aria-live so a screen-reader user is told the panel changed under
          them rather than finding different words on the next tab stop. */}
      <div aria-live="polite" aria-atomic="true">
        <p
          className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: `rgb(${scene.rgb})` }}
        >
          {scene.module}
        </p>
        <p className="mt-4 max-w-xl text-3xl font-extrabold leading-[1.06] tracking-tight text-pretty xl:text-4xl">
          {scene.headline}
        </p>
        <p className="mt-4 max-w-md text-on-ink-dim">{scene.body}</p>
      </div>

      <div className="mt-7 flex gap-1.5">
        {SCENES.map((s, i) => (
          <button
            key={s.seed}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show ${s.module}`}
            aria-current={i === index}
            className={`h-[3px] w-7 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${
              i === index ? "bg-brand-gradient" : "bg-white/25 hover:bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
