"use client";

import { HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionCard } from "@/components/commerce/knowledge-base";
import { useKbRequests } from "@/hooks/use-knowledge-base";
import { listFetchState, showsSkeleton } from "@/lib/list-fetch-state";
import { WaitingForConnection } from "@/components/inbox/conversations-pane";

/**
 * Questions shoppers asked that the assistant could not answer in this business (Inbox phase 2). Each is a `kind: "request"` knowledge
 * row the assistant recorded when it did not know; "Answer once" saves the owner's answer as a knowledge entry, marks the question
 * answered, and the assistant uses it from then on. The save is the knowledge base's own (`POST /v1/kb/requests/:id/answer`): it writes
 * the entry once and claims the question once, so a double press cannot make two entries.
 *
 * MARKUP ONLY: the same card the Knowledge base page uses, so the two cannot answer differently.
 */
export function QuestionsPane() {
  const q = useKbRequests();
  const requests = q.data?.requests ?? [];
  const state = listFetchState(q, requests.length);
  if (showsSkeleton(state)) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }
  if (state === "waiting") return null;
  if (state === "paused") return <WaitingForConnection what="questions" />;
  if (state === "error") {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load your questions</p>
        <p className="max-w-md text-xs text-muted-foreground">This is a problem loading the list, not a sign that nobody asked anything. Try again in a moment.</p>
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
          Retry
        </Button>
      </Card>
    );
  }
  if (requests.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <HelpCircle className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">No unanswered questions</p>
        <p className="max-w-md text-xs text-muted-foreground">
          When a shopper asks something your assistant has no answer for, the question lands here. Answer it once and the assistant uses your answer from then on.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Your assistant couldn&apos;t answer these. Write the answer once and it will use it from now on.
      </p>
      <ul className="space-y-3">
        {requests.map((r) => (
          <QuestionCard key={r.id} request={r} answerLabel="Answer once" />
        ))}
      </ul>
    </div>
  );
}
