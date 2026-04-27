"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reply, Quote, X, Send } from "lucide-react";
import { xApi, extractTweetId, type PublishTweetInput } from "@/lib/api/x";
import { ApiError } from "@/lib/api";

const MAX_LEN = 280;

type ReplyMode = { kind: "none" } | { kind: "reply"; id: string; raw: string } | { kind: "quote"; id: string; raw: string };

export function TweetComposer() {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [showRefs, setShowRefs] = useState(false);
  const [refMode, setRefMode] = useState<ReplyMode>({ kind: "none" });
  const [refInput, setRefInput] = useState("");
  const [refError, setRefError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const publish = useMutation({
    mutationFn: (input: PublishTweetInput) => xApi.publish(input),
    onSuccess: () => {
      setText("");
      setRefMode({ kind: "none" });
      setRefInput("");
      setShowRefs(false);
      setFeedback({ kind: "success", message: "Tweet published." });
      queryClient.invalidateQueries({ queryKey: ["x-tweets"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : "Failed to publish tweet.";
      setFeedback({ kind: "error", message });
    },
  });

  const remaining = MAX_LEN - text.length;
  const tooLong = remaining < 0;
  const empty = text.trim().length === 0;
  const disabled = empty || tooLong || publish.isPending;

  function attachReference(kind: "reply" | "quote") {
    const id = extractTweetId(refInput);
    if (!id) {
      setRefError("Couldn't read a tweet id from that input. Paste a status URL or numeric id.");
      return;
    }
    setRefError(null);
    setRefMode({ kind, id, raw: refInput.trim() });
  }

  function clearReference() {
    setRefMode({ kind: "none" });
    setRefInput("");
    setRefError(null);
  }

  function onSubmit() {
    if (disabled) return;
    setFeedback(null);
    const body: PublishTweetInput = { text: text.trim() };
    if (refMode.kind === "reply") body.replyToTweetId = refMode.id;
    if (refMode.kind === "quote") body.quoteTweetId = refMode.id;
    publish.mutate(body);
  }

  return (
    <div className="space-y-3">
      {refMode.kind !== "none" && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {refMode.kind === "reply" ? <Reply className="size-4" /> : <Quote className="size-4" />}
          <span className="text-muted-foreground">
            {refMode.kind === "reply" ? "Replying to" : "Quoting"}
          </span>
          <span className="font-mono text-xs truncate">{refMode.raw}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2"
            onClick={clearReference}
            aria-label="Remove reference"
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's happening?"
        rows={4}
        className="resize-none"
        aria-label="Tweet text"
      />

      {showRefs && refMode.kind === "none" && (
        <div className="space-y-2 rounded-md border p-3">
          <Label htmlFor="x-ref-input" className="text-xs uppercase tracking-wide text-muted-foreground">
            Reply to / quote a tweet
          </Label>
          <Input
            id="x-ref-input"
            value={refInput}
            onChange={(e) => setRefInput(e.target.value)}
            placeholder="https://x.com/user/status/123..."
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => attachReference("reply")} disabled={!refInput}>
              <Reply className="size-3.5 mr-1" /> Reply
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => attachReference("quote")} disabled={!refInput}>
              <Quote className="size-3.5 mr-1" /> Quote
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowRefs(false); setRefInput(""); setRefError(null); }}>
              Cancel
            </Button>
          </div>
          {refError && <p className="text-xs text-destructive">{refError}</p>}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {refMode.kind === "none" && !showRefs && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowRefs(true)}>
              <Reply className="size-3.5 mr-1" /> Reply / quote
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={
              tooLong
                ? "text-sm font-medium text-destructive"
                : remaining <= 20
                  ? "text-sm font-medium text-amber-600"
                  : "text-sm text-muted-foreground"
            }
            aria-live="polite"
          >
            {remaining}
          </span>
          <Button onClick={onSubmit} disabled={disabled} aria-busy={publish.isPending}>
            <Send className="size-4 mr-1.5" />
            {publish.isPending ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      {feedback && (
        <p
          role="status"
          className={
            feedback.kind === "error"
              ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              : "rounded-md border border-green-200 bg-green-50/60 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
          }
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
