"use client";

import { useEffect, useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Loader2, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { linkedInContentApi, type ComposerPolicyAdvisory } from "@/lib/api/linkedin-content";
import { cn } from "@/lib/utils";

const POLICY_DEBOUNCE_MS = 800;

const POLICY_MIN_CHARS = 24;

/**
 * Debounced advisory content-policy check. Fires
 * `POST /v1/linkedin/content/check-policy` 800ms after the user stops
 * typing, once there's enough text to be worth classifying.
 *
 * Returns:
 *   - `null`      while text is too short to check
 *   - `undefined` while a debounce/request window is open (pending)
 *   - advisory otherwise. A 429 (rate-limited) or any error resolves
 *     to a `checked:false` advisory so the chip renders a neutral
 *     "couldn't check" — never a scary error or a false "OK".
 */
export function usePolicyCheck(
  text: string,
  authorType: "person" | "org",
): ComposerPolicyAdvisory | null | undefined {
  const trimmed = text.trim();
  const longEnough = trimmed.length >= POLICY_MIN_CHARS;
  // Store only the async result, tagged with BOTH the text and the
  // author type it was computed for. The null (too-short) and undefined
  // (pending) states are DERIVED below from the current text+author —
  // no synchronous setState in the effect (avoids cascading renders),
  // and the chip flips to "pending" the instant either changes. Tagging
  // by author matters: an org post has a different policy surface than a
  // personal post, so a person-scoped result must not linger after the
  // user switches to a company page without editing the text.
  const [res, setRes] = useState<
    { forText: string; forAuthor: "person" | "org"; advisory: ComposerPolicyAdvisory } | null
  >(null);

  useEffect(() => {
    if (!longEnough) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      linkedInContentApi
        .checkPolicy(trimmed, authorType)
        .then((advisory) => {
          if (!cancelled) setRes({ forText: trimmed, forAuthor: authorType, advisory });
        })
        .catch(() => {
          // 429 / network / soft-fail — treat as "couldn't check".
          if (!cancelled) {
            setRes({
              forText: trimmed,
              forAuthor: authorType,
              advisory: { overall: "ok", summary: "", findings: [], issueCount: 0, checked: false },
            });
          }
        });
    }, POLICY_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [trimmed, longEnough, authorType]);

  if (!longEnough) return null;
  // pending: no fresh result for the current text + author
  if (!res || res.forText !== trimmed || res.forAuthor !== authorType) return undefined;
  return res.advisory;
}

/**
 * Advisory policy chip rendered near Publish. Non-blocking — the hard
 * gate still runs server-side at publish. States:
 *   - hidden while too-short (null)
 *   - "Checking…" while pending (undefined)
 *   - "Policy: OK" when clean
 *   - "Policy: N issue(s)" with a hover popover of findings
 *   - "Couldn't check" (neutral) when the gate soft-failed / was rate-limited
 */
export function PolicyChip({ state }: { state: ComposerPolicyAdvisory | null | undefined }) {
  if (state === null) return null;
  if (state === undefined) {
    return (
      <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
        Checking policy…
      </span>
    );
  }

  if (!state.checked) {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        title="We couldn't run the policy check just now — it doesn't block publishing."
      >
        <Shield className="size-3.5" />
        Policy check unavailable
      </span>
    );
  }

  if (state.overall === "ok") {
    return (
      <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-success-on-tint">
        <ShieldCheck className="size-3.5" />
        Policy: OK
      </span>
    );
  }

  const issues = state.findings.filter((f) => f.verdict !== "ok");
  const tone =
    state.overall === "block"
      ? "text-destructive"
      : "text-warning-on-tint";
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tone,
          )}
          aria-label={`Content policy: ${state.issueCount} issue${state.issueCount === 1 ? "" : "s"}. Hover for details.`}
        >
          <ShieldAlert className="size-3.5" />
          Policy: {state.issueCount} issue{state.issueCount === 1 ? "" : "s"}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" side="top" className="w-80">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className={cn("size-4", tone)} />
          {state.overall === "block" ? "Likely policy violation" : "Possible policy issues"}
        </div>
        {state.summary && (
          <p className="mt-1 text-xs text-muted-foreground">{state.summary}</p>
        )}
        <ul className="mt-2 space-y-1.5">
          {issues.map((f, i) => (
            <li key={`${f.category}-${i}`} className="text-xs">
              <span
                className={cn(
                  "mr-1.5 rounded-sm px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  f.verdict === "block"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-warning/10 text-warning-on-tint",
                )}
              >
                {f.category.replace(/_/g, " ")}
              </span>
              {f.rationale}
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
          Advisory only — you can still publish. The same check runs when you post.
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

// ── Hook DNA scoring ─────────────────────────────────────────────────
