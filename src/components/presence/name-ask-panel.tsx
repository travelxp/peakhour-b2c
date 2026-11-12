"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNameAnswer, useNameAsk } from "@/hooks/use-name-ask";
import { OPEN_PICKER_EVENT, networkCardId } from "@/components/presence/network-card-state";
import type { ConnectableNetwork } from "@/lib/presence-panels";

/**
 * GBP L14: "Is this your business?", asked ONCE, near the top of the page, of the person who can answer it. A panel, not a modal: it blocks
 * nothing. It shows while the listing's name looks off, nobody has confirmed it and nobody has put it off; any answer takes it away.
 *
 * ★THE LINE ON THE CONNECT CARD STAYS, so a question put off with "Not now" can still be answered there. ★A PERSON WHO CANNOT ANSWER SEES NO
 * PANEL (`useNameAsk` withholds it): it would be a question with no button. ★IT COMES BACK WHEN THE TITLE CHANGES, because the api ties both
 * answers to the title the person saw. ★THE NETWORK'S NAME COMES FROM ITS LABEL: no network is named in this file.
 */
export function NameAskPanel({ network }: { network: ConnectableNetwork }) {
  const ask = useNameAsk(network);
  const answer = useNameAnswer(network);
  // "No, choose another listing" is an answer too: the panel steps aside until the listing it asked about changes.
  const [declinedFor, setDeclinedFor] = useState<string | null>(null);
  const asked = `${ask.pending.join("|")}#${ask.titles.join("|")}`;
  if (!ask.show || declinedFor === asked) return null;

  const names = ask.titles.join(", ");
  const choose = () => {
    setDeclinedFor(asked);
    window.dispatchEvent(new CustomEvent(OPEN_PICKER_EVENT, { detail: network.network }));
    document.getElementById(networkCardId(network.network))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id={ask.anchor} aria-label="Is this your business?" className="rounded-xl border bg-card p-4 shadow-sm" data-testid="name-ask-panel">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <div className="space-y-3 text-sm">
          <p>
            <span className="font-medium">{names}</span> {ask.titles.length === 1 ? "is" : "are"} linked as your business on {network.label}. Its name is different from{" "}
            {ask.businessName}. That&rsquo;s fine if you trade under another name. Is this your business?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={answer.isPending} onClick={() => answer.mutate({ locationNames: ask.pending, answer: "yes" })}>
              {answer.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              Yes, this is my business
            </Button>
            {ask.another.kind === "picker" ? (
              <Button size="sm" variant="outline" disabled={answer.isPending} onClick={choose}>
                No, choose another listing
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href={network.connectHref}>No. {ask.another.text}</Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={answer.isPending} onClick={() => answer.mutate({ locationNames: ask.pending, answer: "not_now" })}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
