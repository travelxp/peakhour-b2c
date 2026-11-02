"use client";

import { AudienceProfilePanel } from "@/components/audience/audience-profile-panel";
import { WhatWeveLearned } from "@/components/audience/what-weve-learned";

/**
 * Your Business (G2) — what the platform understands about the customer.
 *
 * ★NOT AN ADS SCREEN, WHICH IS THE WHOLE MOVE. This panel has lived inside the
 * Ads hub since it was built, and the plan's diagnosis is blunt: burying it
 * under Ads is why nobody has ever corrected one. The profile is
 * channel-neutral — the same understanding decides who a LinkedIn campaign and
 * an X campaign target — and Content, Support and Commerce will all want to
 * read it. The Ads hub keeps a summary card that links here.
 *
 * ★AND CORRECTING IT IS THE POINT, NOT READING IT. Design §12.4 calls the
 * proposal-then-correction pair the single best signal this engine gets, and
 * a correction is a `stated` fact that outranks anything we inferred. This page
 * exists so that act has somewhere to happen.
 *
 * No new API: the panel already reads `GET /profile`, writes `PATCH /profile`
 * and can rebuild with `POST /profile/refresh`.
 */
export default function YourBusinessPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Your business</h2>
        <p className="text-muted-foreground">
          What we understand about you, and where we got it from. Every audience we
          suggest is built out of this — so telling us where we&apos;re wrong is the
          fastest way to make them better.
        </p>
      </div>

      {/* Open by default: on its own page there is nothing else to look at, and
          collapsing the only content behind a click is how a surface stays
          unread. */}
      <AudienceProfilePanel defaultOpen />

      {/* ★AND WHAT THE CORRECTIONS ABOVE HAVE ACTUALLY TAUGHT US (H1). A
          customer asked to correct our understanding, whose corrections
          visibly go nowhere, stops correcting — and the loop has been running
          for months with nothing rendering a single thing it learned. */}
      <WhatWeveLearned />
    </div>
  );
}
