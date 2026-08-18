"use client";

import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAskInbox } from "@/hooks/use-wa-inbox-intelligence";

const SUGGESTIONS = [
  "Who is at risk of churning, and why?",
  "What are customers asking about most?",
  "Who wanted to buy but didn't complete?",
  "Any complaints this week?",
];

/**
 * "Ask your inbox" — a natural-language question box over the business's own
 * WhatsApp conversations. Each question is one priced query
 * (whatsapp.inbox_intelligence); the answer is grounded in the merchant's inbox
 * with contact citations.
 */
export function AskYourInbox() {
  const [question, setQuestion] = useState("");
  const ask = useAskInbox();
  const answer = ask.data;

  function submit(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 3 || ask.isPending) return;
    setQuestion(trimmed);
    ask.mutate(trimmed);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Ask your inbox</p>
        <Badge variant="secondary" className="ml-auto text-xs">Charged per question</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Ask anything about your WhatsApp conversations — trends, complaints, buying signals, who to follow up with.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => submit(s)}
            disabled={ask.isPending}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-2">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(question);
          }}
          placeholder="e.g. Which customers are unhappy and why?"
          rows={2}
          className="flex-1"
          disabled={ask.isPending}
        />
        <Button onClick={() => submit(question)} disabled={ask.isPending || question.trim().length < 3}>
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {ask.isPending && <p className="mt-3 text-sm text-muted-foreground">Reading your inbox…</p>}

      {ask.isError && (
        <p className="mt-3 text-sm text-destructive">
          Couldn’t analyse your inbox right now. Please try again.
        </p>
      )}

      {answer && !ask.isPending && (
        <div className="mt-4 rounded-lg border bg-muted/30 p-3">
          <p className="whitespace-pre-wrap text-sm">{answer.answer}</p>
          {answer.citations.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Based on</p>
              <ul className="mt-1.5 space-y-1">
                {answer.citations.map((c, i) => (
                  <li key={`${c.waId}-${i}`} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.contactName || c.waId}</span> — {c.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
