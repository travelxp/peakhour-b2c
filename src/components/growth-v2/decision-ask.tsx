"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAskDecisionV2 } from "@/lib/api/growth-v2";

/** The api's bounds on a question (`zAskRequest`). */
export const ASK_MIN = 5;
export const ASK_MAX = 400;

/** A refused or failed ask, in the api's own sentence when it sent one. */
export function askErrorText(err: unknown): string {
  return err instanceof ApiError && err.message ? err.message : "Couldn't answer that just now. Try again in a moment.";
}

/**
 * "Ask about this decision": one question, answered from the facts the council had
 * and what it said. Free, and it changes nothing. The answer arrives under the box;
 * if the api would not stand behind a number in it, there is no answer, only that
 * sentence. Key it by decision so a new selection starts empty.
 */
export function DecisionAsk({ decisionId, disabled }: { decisionId: string; disabled?: string }) {
  const [question, setQuestion] = useState("");
  const ask = useAskDecisionV2();
  const trimmed = question.trim();
  const ready = disabled === undefined && trimmed.length >= ASK_MIN && !ask.isPending;

  return (
    <div className="grid gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) ask.mutate({ id: decisionId, question: trimmed });
        }}
        className="flex items-center gap-2 rounded-xl border bg-background p-2 pl-3"
        aria-label="Ask about this decision"
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={disabled !== undefined}
          maxLength={ASK_MAX}
          aria-label="Ask about this decision"
          placeholder="Ask about this decision: “What if we stop X completely?”"
          className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="sm" disabled={!ready} title={disabled}>
          <Send aria-hidden /> {ask.isPending ? "Asking…" : "Ask"}
        </Button>
      </form>
      {/* The answer belongs to the question that was asked: edit the question and it goes. */}
      {ask.isSuccess && ask.variables?.question === trimmed ? (
        <p role="status" className="whitespace-pre-line rounded-lg bg-muted px-3 py-2.5 text-sm">
          {ask.data.answer}
        </p>
      ) : null}
      {ask.isError && ask.variables?.question === trimmed ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {askErrorText(ask.error)}
        </p>
      ) : null}
    </div>
  );
}
