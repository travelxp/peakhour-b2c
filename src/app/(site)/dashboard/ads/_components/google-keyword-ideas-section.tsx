"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { googleAdsApi, type GoogleMatchType } from "@/lib/api/google-ads";
import { GOOGLE_DEFAULT_MATCH_TYPE, GOOGLE_MATCH_TYPES, type DraftKeyword, type TargetingDraft } from "@/lib/google-targeting-view";
import {
  GOOGLE_IDEA_ALREADY_ADDED,
  GOOGLE_IDEAS_ATTRIBUTION,
  GOOGLE_IDEAS_FIGURES_NOTE,
  GOOGLE_IDEAS_TITLE,
  googleIdeaBidRange,
  googleIdeaCompetitionLabel,
  googleIdeaSearchesSentence,
  googleKeywordIdeasErrorMessage,
  ideaAddProblem,
  ideaAsKeyword,
  keywordIdeasRequest,
  seedWordsFromDraft,
} from "@/lib/google-keyword-ideas-view";

const ANY_LANGUAGE = "any";

/**
 * ★★G-14g — Google's Keyword Ideas, mounted in the targeting step's Search
 * part (`google-targeting-dialog.tsx`), beside the campaign's own keywords.
 *
 * ★ONE REQUEST PER CLICK: nothing is asked of Google until the merchant
 * presses the button, and nothing is asked again on its own.
 *
 * ★NEVER MERGED: the ideas are listed here, labelled as Google's. An idea
 * joins the keyword list only through `onPick`, at the match type picked on
 * its row (PHRASE until another is picked), and the step's Save writes it.
 */
export function GoogleKeywordIdeasSection({
  campaignId,
  draft,
  disabled,
  pausedKeys,
  onPick,
}: {
  campaignId: string;
  draft: TargetingDraft;
  disabled: boolean;
  pausedKeys?: ReadonlySet<string>;
  /** Adds the keyword to the step's list, as typing it would. */
  onPick: (keyword: DraftKeyword) => void;
}) {
  // Started from the campaign's own keywords once; the merchant edits from there.
  const [words, setWords] = useState(() => seedWordsFromDraft(draft));
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState(draft.languages[0]?.languageConstant ?? ANY_LANGUAGE);
  const [matchTypes, setMatchTypes] = useState<Record<string, GoogleMatchType>>({});
  // A language taken out of the campaign since is not sent.
  const languageSent = draft.languages.some((l) => l.languageConstant === language) ? language : "";
  const request = keywordIdeasRequest({ words, url, language: languageSent }, draft);
  const ask = useMutation({
    mutationFn: () => googleAdsApi.getKeywordIdeas(campaignId, request.input),
  });
  const result = ask.data;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{GOOGLE_IDEAS_TITLE}</Label>
        <Badge variant="outline">Google Ads</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{GOOGLE_IDEAS_ATTRIBUTION}</p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!request.problem && !ask.isPending) ask.mutate();
        }}
      >
        <Input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Words to start from, separated by commas" maxLength={1600} aria-label="Words to start from" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="A page of your site (optional)" maxLength={2048} aria-label="A page of your site" />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={languageSent || ANY_LANGUAGE} onValueChange={setLanguage}>
            <SelectTrigger className="w-56" aria-label="Language for ideas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_LANGUAGE}>Any language</SelectItem>
              {draft.languages.map((l) => (
                <SelectItem key={l.languageConstant} value={l.languageConstant}>
                  {l.name ?? l.languageConstant}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" disabled={disabled || ask.isPending || !!request.problem}>
            {ask.isPending ? "Asking Google…" : "Get ideas from Google"}
          </Button>
        </div>
      </form>
      {request.placesNote ? <p className="text-xs text-muted-foreground">{request.placesNote}</p> : null}
      {request.problem && (words || url) ? <p className="text-xs text-muted-foreground">{request.problem}</p> : null}
      {ask.isError ? (
        <p className="text-xs text-destructive-on-tint">{googleKeywordIdeasErrorMessage(ask.error, "Google Ads didn't send keyword ideas. Try again in a moment.")}</p>
      ) : null}

      {result ? (
        result.ideas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Google has no keyword ideas for these. Try other words or another page.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{GOOGLE_IDEAS_FIGURES_NOTE}</p>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {result.ideas.map((idea) => {
                const matchType = matchTypes[idea.text] ?? GOOGLE_DEFAULT_MATCH_TYPE;
                const problem = ideaAddProblem(idea, matchType, draft, pausedKeys);
                const figures = [googleIdeaSearchesSentence(idea), googleIdeaCompetitionLabel(idea), googleIdeaBidRange(idea, result.currencyCode)].filter(Boolean);
                return (
                  <li key={idea.text} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      {idea.text}
                      {figures.length > 0 ? <span className="block text-xs text-muted-foreground">{figures.join(" · ")}</span> : null}
                      {problem && problem !== GOOGLE_IDEA_ALREADY_ADDED ? <span className="block text-xs text-muted-foreground">{problem}</span> : null}
                    </span>
                    <span className="flex items-center gap-1">
                      <Select value={matchType} onValueChange={(v) => setMatchTypes((m) => ({ ...m, [idea.text]: v as GoogleMatchType }))}>
                        <SelectTrigger className="w-28" aria-label={`Match type for ${idea.text}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GOOGLE_MATCH_TYPES.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" disabled={disabled || !!problem} title={problem ?? undefined} onClick={() => onPick(ideaAsKeyword(idea, matchType))}>
                        {problem === GOOGLE_IDEA_ALREADY_ADDED ? "Added" : "Add as keyword"}
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )
      ) : null}
    </div>
  );
}
