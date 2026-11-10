"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Mic, Sparkles } from "lucide-react";
import { linkedInContentApi, type LinkedInVoiceCard } from "@/lib/api/linkedin-content";
import { api, ApiError } from "@/lib/api";

const PERSPECTIVE_LABEL: Record<LinkedInVoiceCard["voice"]["perspective"], string> = {
  first_person_singular: "I",
  first_person_plural: "We",
  third_person: "They",
};

/**
 * Surface the auto-synthesised LinkedIn voice card alongside the
 * composer so the user sees the tone/perspective/signature phrases
 * we learned from their own posts before they type.
 */
/**
 * Says whose voice the AI writes in, when that is NOT the Page you selected.
 *
 * ★THE REPORTED BUG THIS ANSWERS: switch the Page to another brand, hit Redraft,
 * and the draft comes back about the OTHER brand. Nothing is broken — every AI
 * op on this surface posts to `/v1/content/rewrite`, which grounds on
 * `buildBusinessContext(orgId, businessId)`: the WORKSPACE's brand voice,
 * taxonomy and value proposition. The request has no field for a Page and could
 * not accept one. So the AI is behaving exactly as designed and the UI was
 * silent about it, which reads as the AI ignoring you.
 *
 * The fix that matters is structural — the other brand belongs in its own
 * workspace, where its voice, audience and reporting are its own. This notice is
 * how the composer says so at the moment of confusion, instead of after it.
 *
 * Renders NOTHING in the ordinary case (Page matches the workspace, unanchored
 * workspace, personal feed, or the fit lookup failed) — a note on every draft
 * would be noise, and noise is how real warnings get ignored.
 */
export function OffBrandVoiceNotice({ authorKey }: { authorKey: string }) {
  const pageId = authorKey.startsWith("org:") ? authorKey.slice("org:".length) : null;

  // Same key + endpoint the Manage-Pages dialog uses, so the two dedupe rather
  // than each paying for the round trip.
  const { data } = useQuery({
    queryKey: ["linkedin-page-fit"],
    queryFn: () =>
      api.get<{
        brandAnchor: string | null;
        pages: { organizationId: string; brandFit: "match" | "unrelated" | "unknown" }[];
      }>("/v1/integrations/linkedin_content/pages"),
    enabled: pageId !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!pageId || !data) return null;
  const fit = data.pages.find((p) => p.organizationId === pageId)?.brandFit;
  if (fit !== "unrelated") return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-on-tint">
      <Sparkles className="size-3.5 shrink-0 self-center" />
      <span>
        Publishing to this page, but AI drafts are written in
        {data.brandAnchor ? ` ${data.brandAnchor}` : " this workspace"}&apos;s
        voice — this workspace has one brand.
      </span>
      <Link
        href="/dashboard/integrations?manage_pages=1"
        className="font-medium underline underline-offset-2 hover:no-underline"
      >
        Give it its own workspace
      </Link>
    </div>
  );
}

export function VoiceCardPanel() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["linkedin-voice-card"],
    queryFn: () => linkedInContentApi.voiceCard(),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Loading your voice card…
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <Mic className="mr-1 inline size-3" />
          Your LinkedIn voice card will appear here once you have 5+ published posts. We&apos;ll learn your tone and signature patterns automatically.
        </div>
      );
    }
    return null;
  }

  if (!data) return null;

  const v = data.voice;
  const s = data.structure;
  const tones = v.tone.slice(0, 4);
  const sigPhrases = v.signaturePhrases.slice(0, 3);
  const neverDoes = v.neverDoes.slice(0, 3);
  const avoidTopics = data.content.avoidTopics.slice(0, 3);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
          >
            <div className="flex items-center gap-2 text-sm">
              <Mic className="size-4 text-muted-foreground" />
              <span className="font-medium">Your LinkedIn voice</span>
              <span className="rounded-sm border px-1.5 py-0 text-micro uppercase tracking-wide text-muted-foreground">
                {PERSPECTIVE_LABEL[v.perspective]} · {v.formality}/10 formality
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Trained on {data.generatedFrom} post{data.generatedFrom === 1 ? "" : "s"}
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t px-3 py-3 text-xs">
          <dl className="grid gap-3 sm:grid-cols-2">
            {tones.length > 0 && (
              <div>
                <dt className="text-micro uppercase tracking-wide text-muted-foreground">Tone</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {tones.map((t) => (
                    <span
                      key={t}
                      className="rounded-sm bg-muted px-1.5 py-0.5 text-micro"
                    >
                      {t}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-micro uppercase tracking-wide text-muted-foreground">Typical length</dt>
              <dd className="mt-1">
                {s.averageWordCount} words avg · range {s.wordCountRange?.[0] ?? 0}–{s.wordCountRange?.[1] ?? 0}
              </dd>
            </div>
            {sigPhrases.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-micro uppercase tracking-wide text-muted-foreground">Signature phrases</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {sigPhrases.map((p) => (
                    <span
                      key={p}
                      className="rounded-sm border bg-muted/40 px-1.5 py-0.5 text-micro"
                    >
                      &ldquo;{p}&rdquo;
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {neverDoes.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-micro uppercase tracking-wide text-muted-foreground">Never does</dt>
                <dd className="mt-1">
                  <ul className="ml-4 list-disc space-y-0.5 text-micro text-muted-foreground">
                    {neverDoes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-micro uppercase tracking-wide text-muted-foreground">Opening</dt>
              <dd className="mt-1 line-clamp-2">{s.openingStyle}</dd>
            </div>
            <div>
              <dt className="text-micro uppercase tracking-wide text-muted-foreground">Closing</dt>
              <dd className="mt-1 line-clamp-2">{s.closingStyle}</dd>
            </div>
            {avoidTopics.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-micro uppercase tracking-wide text-muted-foreground">Avoid topics</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {avoidTopics.map((t) => (
                    <span
                      key={t}
                      className="rounded-sm border border-warning/30 bg-warning/8 px-1.5 py-0.5 text-micro text-warning-on-tint"
                    >
                      {t}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
