"use client";

import { useEffect, useRef, useState } from "react";
import { PeakMark } from "./shopify-art";

/**
 * A sample owner chat with Peakhour on WhatsApp: a question, an approval, and
 * the CONFIRM step that every spend asks for. It plays once when it scrolls
 * into view. The server renders the finished thread, and reduced motion keeps
 * it that way.
 *
 * Held to the api: BOOST prepares an ad that is saved as a draft and does not
 * spend until the merchant switches it on (command-router.ts), and CONFIRM
 * expires after 10 minutes (CONFIRM_TTL_MINUTES).
 */
type Msg = { from: "owner" | "peakhour"; time: string; body: React.ReactNode; buttons?: string[] };

const THREAD: Msg[] = [
  { from: "owner", time: "9:02", body: "How is the store doing?" },
  {
    from: "peakhour",
    time: "9:02",
    body: (
      <>
        <b>Neel &amp; Co.</b>
        <br />
        38 recent orders and ₹61,420 in sales. 3 products are running low: Indigo kurta XL, Amla hair oil, Silk dupatta. 2 store
        suggestions are waiting for you.
      </>
    ),
  },
  { from: "owner", time: "9:03", body: "Any posts waiting?" },
  {
    from: "peakhour",
    time: "9:03",
    body: "1 LinkedIn post is ready: “How we hand-print every kurta in Bagru”.",
    buttons: ["Approve", "Skip"],
  },
  { from: "owner", time: "9:04", body: "Approve. And boost it" },
  {
    from: "peakhour",
    time: "9:04",
    body: (
      <>
        Approved. I&apos;ll prepare an ad from that post. It is saved as a draft and spends nothing until you switch it on.
        <br />
        <br />
        Reply <code className="rounded bg-black/5 px-1 font-mono text-xs font-bold">CONFIRM</code> within 10 minutes to go
        ahead.
      </>
    ),
  },
  { from: "owner", time: "9:05", body: "CONFIRM" },
];

const STEP_MS = 1100;

export function ShopifyOwnerChat() {
  const [shown, setShown] = useState(THREAD.length);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        setShown(0);
        THREAD.forEach((_, i) => timers.push(window.setTimeout(() => setShown(i + 1), 400 + i * STEP_MS)));
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Sample chat between a store owner and Peakhour on WhatsApp"
      className="mx-auto w-full max-w-[340px] rounded-[40px] bg-[var(--daylight-phone)] p-3 shadow-[0_40px_80px_-30px_rgb(0_0_0/70%),inset_0_0_0_1.5px_rgb(255_255_255/12%)]"
    >
      <div className="overflow-hidden rounded-[30px] bg-wa-wallpaper text-wa-text">
        <div className="flex items-center gap-2.5 bg-wa-header px-3.5 pb-3 pt-3.5 text-white">
          <span className="grid size-9 place-items-center rounded-full bg-brand-gradient">
            <PeakMark className="size-5" />
          </span>
          <span className="leading-tight">
            <b className="block text-sm">Peakhour</b>
            <span className="text-micro opacity-80">Business account</span>
          </span>
        </div>
        <div className="flex min-h-[420px] flex-col sm:min-h-[452px] gap-1.5 px-2.5 py-3 text-[13px] leading-snug">
          {THREAD.map((m, i) => (
            <div
              key={i}
              data-on={i < shown}
              className={
                m.from === "owner"
                  ? "daylight-bubble max-w-[86%] self-end rounded-[10px] rounded-tr-sm bg-wa-bubble-out px-2.5 pb-1.5 pt-2 shadow-[0_1px_1px_rgb(0_0_0/8%)]"
                  : "daylight-bubble max-w-[86%] self-start rounded-[10px] rounded-tl-sm bg-wa-bubble-in px-2.5 pb-1.5 pt-2 shadow-[0_1px_1px_rgb(0_0_0/8%)]"
              }
            >
              {m.body}
              {m.buttons && (
                <span className="mt-2 flex gap-1.5 border-t border-black/10 pt-1.5 text-center font-semibold text-wa-link">
                  {m.buttons.map((b) => (
                    <span key={b} className="flex-1">
                      {b}
                    </span>
                  ))}
                </span>
              )}
              <span className="mt-0.5 block text-right text-micro text-wa-text/70">{m.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
