"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { PlanLimitDialog } from "@/components/upgrade/plan-limit-dialog";
import { CreateWorkspaceButton } from "@/components/integrations/create-workspace-button";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LinkedinIcon } from "@/components/brand/brand-icons";

interface AdminPage {
  organizationId: string;
  organizationName?: string;
  role?: string;
}

/**
 * `error.details` of a 409 QUEUED_POSTS_AFFECTED from the page toggle.
 *
 * The toggle refuses rather than silently arming a failure: a scheduled post
 * freezes its author, the publisher re-checks that author when the post goes out,
 * and a Page change therefore reaches BACKWARDS into the queue. Each affected
 * post would fail terminally at its own scheduled time — days apart, long after
 * the click. So the server hands back what would break and waits.
 */
interface QueuedPostsAffected {
  /** Exact. `posts` is a capped sample — see `truncated`. */
  count: number;
  truncated: boolean;
  posts: {
    itemId: string;
    scheduledAtUtc: string;
    /** Rendered with this, not the browser's zone — the same way the Scheduled
     *  tab and calendar render it, so a list the user cross-checks before
     *  cancelling cannot be a day off from what they are checking against. */
    audienceTimezone: string;
    preview: string;
    reason: "page_not_enabled" | "person_posting_disabled";
  }[];
}

/** A toggle held for confirmation, with what it would break. */
interface PendingToggle {
  pageId: string;
  pageName: string;
  next: boolean;
  affected: QueuedPostsAffected;
}

/** Per-Page brand verdict from GET /v1/integrations/linkedin_content/pages. */
interface PageFitResponse {
  brandAnchor: string | null;
  pages: {
    organizationId: string;
    organizationName: string | null;
    brandFit: "match" | "unrelated" | "unknown";
  }[];
}

export function ManagePagesDialog({
  open,
  onOpenChange,
  extra,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>;
  onChanged?: () => void;
}) {
  const { entitlements } = useAuth();
  const pages: AdminPage[] = useMemo(
    () => (Array.isArray(extra?.pages) ? extra.pages : []),
    [extra],
  );
  const cap = entitlements?.limits.maxLinkedInPagesPerBusiness;
  const planLabel = entitlements?.plan ?? "your";

  /**
   * Brand fit per Page.
   *
   * ★WHY THIS DIALOG NEEDS IT. The connect-time guard enforces "one workspace =
   * one brand", but it runs BEFORE Pages exist: one LinkedIn member who
   * administers two brands' Pages hands us both inside a single approved
   * connection, and these switches then let either one be enabled here. Doing so
   * re-mixes exactly what the guard separated — the composer publishes as the
   * Page you picked while every AI surface (Redraft, Compose, voice) keeps
   * writing as the WORKSPACE's brand, because brand voice, taxonomy and value
   * proposition are read per business and no Page selection reaches them.
   *
   * Fetched rather than computed here so the comparison uses the same trusted
   * anchor the connect guard uses. Only `brandFit` + `brandAnchor` are consumed:
   * the endpoint also returns `enabled` and `cap`, but this dialog's optimistic
   * toggle state and cap maths already work, and a second source for them would
   * be two things to keep in step for no gain.
   *
   * A failed fetch degrades to no warnings — advice is not worth an error state.
   */
  const fitQuery = useQuery({
    queryKey: ["linkedin-page-fit"],
    queryFn: () => api.get<PageFitResponse>("/v1/integrations/linkedin_content/pages"),
    enabled: open,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const fitById = useMemo(() => {
    const map = new Map<string, "match" | "unrelated" | "unknown">();
    for (const p of fitQuery.data?.pages ?? []) map.set(p.organizationId, p.brandFit);
    return map;
  }, [fitQuery.data]);

  // Seed local state from the connection's persisted set. Missing
  // `enabledResourceIds` (legacy rows, fresh OAuth before the API
  // onConnect seeder ran) means "all admin pages enabled" — the b2c
  // mirror of the `/me` filter's legacy compat.
  const persistedIds: string[] | null = useMemo(() => {
    const caps = extra?.capabilities as
      | { pages?: { enabledResourceIds?: string[] } }
      | undefined;
    const ids = caps?.pages?.enabledResourceIds;
    return Array.isArray(ids) ? ids : null;
  }, [extra]);

  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => {
    if (persistedIds === null) return new Set(pages.map((p) => p.organizationId));
    return new Set(persistedIds);
  });

  // Re-seed when the dialog re-opens against a refreshed connection.
  // Without this, a Refresh of the integration tile (which fetches
  // updated `extra`) wouldn't propagate into the dialog's switches
  // until the user closed and reopened the dialog twice.
  useEffect(() => {
    if (!open) return;
    if (persistedIds === null) {
      setEnabledIds(new Set(pages.map((p) => p.organizationId)));
    } else {
      setEnabledIds(new Set(persistedIds));
    }
  }, [open, persistedIds, pages]);

  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle | null>(null);
  /**
   * The Page whose switch was clicked while the plan was already full.
   *
   * ★A DISABLED SWITCH WITH A TOOLTIP WAS NOT AN ANSWER. The cap used to be
   * expressed as a dead control explained on HOVER — which is unreachable on a
   * phone, unreachable by tap, and invisible to anyone who does not think to
   * hover a thing that looks broken. So the honest reading of the UI was "this
   * page cannot be enabled", full stop, with the fact that it is a purchasable
   * limit hidden behind a gesture half the users cannot make.
   *
   * The switch stays live at the cap and clicking it opens the same
   * PlanLimitDialog the workspace switcher uses. Same rule, same surface,
   * whether the thing being sized is a business or a Page.
   */
  const [capBlocked, setCapBlocked] = useState<string | null>(null);
  /** Which answer to a held 409 is currently in flight. */
  const [answeringWith, setAnsweringWith] = useState<"cancel" | "keep" | null>(null);

  const enabledCount = enabledIds.size;
  const atCap = typeof cap === "number" && enabledCount >= cap;
  const overCap = typeof cap === "number" && enabledCount > cap; // legacy state

  async function togglePage(
    pageId: string,
    next: boolean,
    onQueued?: "cancel" | "keep",
  ) {
    if (pending.has(pageId)) return;
    setError(null);
    if (!onQueued) setPendingToggle(null);
    setAnsweringWith(onQueued ?? null);

    // Optimistic — flip THIS pageId via the updater form so two rapid
    // clicks on DIFFERENT pages don't clobber each other (each click
    // would otherwise capture a stale `enabledIds` closure from before
    // the other's `setEnabledIds` committed). Rollback below uses the
    // same per-pageId updater form so a failed toggle only reverts its
    // own flip, leaving other concurrent successes intact.
    setEnabledIds((prev) => {
      const optimistic = new Set(prev);
      if (next) optimistic.add(pageId);
      else optimistic.delete(pageId);
      return optimistic;
    });

    setPending((p) => new Set(p).add(pageId));
    try {
      const res = await api.patch<{
        queuedPosts?: { cancelledItemIds?: string[]; skippedItemIds?: string[] };
      }>("/v1/integrations/linkedin_content/pages", {
        pageId,
        enabled: next,
        // Set only once the user has answered the 409 below. Absent on the first
        // attempt ON PURPOSE — that is what makes the server refuse instead of
        // arming a queue of doomed posts on an uninformed click.
        ...(onQueued ? { onQueued } : {}),
      });
      setPendingToggle(null);
      // ★A skipped item is one a worker grabbed mid-request, or that went
      // terminal underneath us. It was NOT cancelled and will still try to
      // publish — then fail terminally, days later, for a reason the user has
      // just been told is handled. The server returns these deliberately; saying
      // nothing would claim a clean sweep we did not make.
      const skipped = res?.queuedPosts?.skippedItemIds?.length ?? 0;
      if (onQueued === "cancel" && skipped > 0) {
        setError(
          skipped === 1
            ? "1 post could not be cancelled — it was already publishing. Check the Scheduled tab."
            : `${skipped} posts could not be cancelled — they were already publishing. Check the Scheduled tab.`,
        );
      }
      onChanged?.();
    } catch (err) {
      // Roll back this pageId only — never overwrite the whole set,
      // since other concurrent toggles may have landed in the meantime.
      setEnabledIds((prev) => {
        const reverted = new Set(prev);
        if (next) reverted.delete(pageId);
        else reverted.add(pageId);
        return reverted;
      });
      // Not an error — a question. The server is telling us this change would
      // break posts already in the queue, and handing over the list so the user
      // can decide. Rolling the switch back above is what makes the held state
      // honest: nothing has changed yet.
      if (err instanceof ApiError && err.code === "QUEUED_POSTS_AFFECTED") {
        const details = err.details as QueuedPostsAffected | undefined;
        if (details && Array.isArray(details.posts) && details.posts.length > 0) {
          setPendingToggle({
            pageId,
            pageName:
              pages.find((pg) => pg.organizationId === pageId)?.organizationName ||
              `Page ${pageId}`,
            next,
            affected: details,
          });
          return;
        }
      }
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update page. Please try again.");
      }
    } finally {
      setAnsweringWith(null);
      setPending((p) => {
        const n = new Set(p);
        n.delete(pageId);
        return n;
      });
    }
  }

  /**
   * The ONE way this dialog closes.
   *
   * ★A held 409 is a question about a specific moment: which posts this toggle
   * would break, given the state a second ago. Leaving it set across a close
   * means reopening to a stale question whose answer fires a decision about a
   * state that has since moved on. Every affordance routes here — Esc, the X, and
   * "Done", which used to call `onOpenChange` directly and so skipped the clear.
   * Not an effect: setState-in-effect is a lint error in this repo.
   */
  function closeDialog() {
    setPendingToggle(null);
    onOpenChange(false);
  }

  const capLabel =
    typeof cap === "number"
      ? `${enabledCount} of ${cap} active on your ${planLabel} plan`
      : `${enabledCount} active · unlimited on your ${planLabel} plan`;

  // Off-brand Pages that are switched ON right now. These are the ones already
  // costing the user something — the composer publishes as them while the AI
  // writes as this workspace's brand — so the callout describes the live state
  // rather than warning about a hypothetical click.
  const offBrandEnabled = pages.filter(
    (p) => enabledIds.has(p.organizationId) && fitById.get(p.organizationId) === "unrelated",
  );
  const brandAnchor = fitQuery.data?.brandAnchor ?? null;

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : closeDialog())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A66C2] text-white">
              <LinkedinIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Manage LinkedIn pages</DialogTitle>
              <DialogDescription>{capLabel}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {offBrandEnabled.length > 0 && (
          <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-micro text-warning-on-tint">
            <p className="font-medium">
              {offBrandEnabled.length === 1
                ? `${offBrandEnabled[0]!.organizationName || "One page"} looks like a different brand`
                : `${offBrandEnabled.length} pages look like a different brand`}
              {brandAnchor ? ` to ${brandAnchor}` : ""}
            </p>
            {/* The consequence, stated plainly — this is the actual reported
                bug: the Page switched and Redraft kept writing as the old
                brand, which reads as the AI ignoring you rather than as a
                workspace boundary doing its job. */}
            <p>
              A workspace has one brand voice. You can publish to these pages,
              but everything the AI writes here — Compose, Redraft, tone — is
              grounded in this workspace&apos;s brand, so drafts will come back
              in the wrong voice. Give the other brand its own workspace and its
              content gets its own voice, audience and reporting.
            </p>
            <CreateWorkspaceButton
              provider="LinkedIn"
              suggestedName={offBrandEnabled[0]!.organizationName ?? null}
            />
          </div>
        )}

        {overCap && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-micro text-warning-on-tint">
            You have more pages enabled than your plan allows. They keep
            posting for now, but new toggles are blocked until you disable a
            page or upgrade.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-micro text-destructive">
            {error}
          </div>
        )}

        {pendingToggle && (
          <QueuedPostsPrompt
            pending={pendingToggle}
            busy={pending.has(pendingToggle.pageId) ? answeringWith : null}
            onCancelPosts={() =>
              togglePage(pendingToggle.pageId, pendingToggle.next, "cancel")
            }
            onKeepPosts={() =>
              togglePage(pendingToggle.pageId, pendingToggle.next, "keep")
            }
            onAbandon={() => setPendingToggle(null)}
          />
        )}

        <TooltipProvider delayDuration={150}>
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {pages.map((p) => {
              const isOn = enabledIds.has(p.organizationId);
              const isPending = pending.has(p.organizationId);
              // At the cap, turning a page ON is a purchase rather than a
              // toggle — the switch stays live and routes to the plan dialog.
              // A page that is already ON always keeps a working switch, since
              // turning things off is never gated.
              const capReached = atCap && !isOn;
              const switchEl = (
                <Switch
                  checked={isOn}
                  disabled={isPending}
                  onCheckedChange={(v) => {
                    if (capReached) {
                      setCapBlocked(p.organizationName || `Page ${p.organizationId}`);
                      return;
                    }
                    togglePage(p.organizationId, v);
                  }}
                  aria-label={`Toggle ${p.organizationName || p.organizationId}`}
                />
              );
              return (
                <li
                  key={p.organizationId}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <span className="truncate">
                        {p.organizationName || `Page ${p.organizationId}`}
                      </span>
                      {/* Marked on the row as well as in the callout above, so
                          the flag is visible BEFORE the switch is flipped —
                          `unknown` is never marked (an unanchored workspace, or
                          a Page whose name has not hydrated yet, is not
                          evidence of anything). */}
                      {fitById.get(p.organizationId) === "unrelated" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              tabIndex={0}
                              className="shrink-0 rounded bg-warning/20 px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide text-warning-on-tint"
                            >
                              Other brand
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-60 text-micro">
                            This page doesn&apos;t look like
                            {brandAnchor ? ` ${brandAnchor}` : " this workspace's brand"}.
                            You can still use it, but AI drafts here are written in
                            this workspace&apos;s voice.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-micro text-muted-foreground">
                      {p.role && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
                          {p.role}
                        </span>
                      )}
                      <a
                        href={`https://www.linkedin.com/company/${p.organizationId}/admin/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
                      >
                        Manage on LinkedIn
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                  {capReached ? (
                    <Tooltip>
                      {/* ★THE SWITCH IS THE TRIGGER, NOT A SPAN AROUND IT. The
                          wrapper existed because the switch used to be
                          `disabled` — a disabled control takes no focus and
                          fires no pointer events, so something else had to. Now
                          that it is live, the wrapper's `tabIndex={0}` would add
                          a second, unlabelled tab stop on every capped row: the
                          keyboard user lands on an anonymous box, then on the
                          switch, for one control. */}
                      <TooltipTrigger asChild>{switchEl}</TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[220px] text-micro">
                        Your plan covers {cap} {cap === 1 ? "page" : "pages"}. Turn another off, or
                        add this one to your plan.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    switchEl
                  )}
                </li>
              );
            })}
          </ul>
        </TooltipProvider>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {atCap ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings/billing">Upgrade plan</Link>
            </Button>
          ) : (
            <span />
          )}
          {/* closeDialog, not onOpenChange: this button bypassed the wrapper
              that clears a held 409, so Esc and the X abandoned the question but
              "Done" left it to reappear on reopen — and answering it later would
              fire a decision about a state that had moved on. */}
          <Button variant="ghost" size="sm" onClick={() => closeDialog()}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ★THE SAME DIALOG THE WORKSPACE SWITCHER OPENS. One plan sizes what you
        can run — a business, a Page — so reaching either edge has to land on
        one surface saying one thing. A bespoke message here would be a second
        answer to the same question, and the two would drift.
        A SIBLING of the Manage dialog rather than a child: nesting one Radix
        Dialog.Root inside another puts the inner one's context in front of the
        outer's for everything below it, and there is no reason to reason about
        that when both portal to the body regardless. The Manage dialog stays
        OPEN behind it on purpose — the likeliest next move after reading the
        cap is turning a different page off, which is the list underneath. */}
    <PlanLimitDialog
      open={capBlocked !== null}
      onOpenChange={(next) => !next && setCapBlocked(null)}
      title={`${capBlocked ?? "That page"} isn't on your plan`}
      description={`Your ${planLabel} plan covers ${cap} LinkedIn ${cap === 1 ? "page" : "pages"} for this business. Turn another one off to free a slot, or add this page to your plan.`}
      benefit="Each enabled page gets its own posting queue, audience and reporting — nothing is shared or mixed between them."
      ctaLabel="Add a page to my plan"
    />
    </>
  );
}

/**
 * The question the toggle asks before it changes anything.
 *
 * ★A Page change reaches BACKWARDS into the queue. Scheduled posts freeze their
 * author, and the publisher re-checks it when the post goes out — so disabling a
 * Page (or enabling the first one, which turns personal-feed posting off) leaves
 * every affected post to fail terminally at its own scheduled time, days apart,
 * with nothing tying the failures back to the click. This is the moment where
 * that is still preventable, so it is the moment the user gets told.
 *
 * Three answers, and no default: cancelling posts and publishing nothing at all
 * are both consequences someone has to choose, and "Keep the page as it is" has
 * to stay available or the dialog would be a trap.
 */
function QueuedPostsPrompt({
  pending,
  busy,
  onCancelPosts,
  onKeepPosts,
  onAbandon,
}: {
  pending: PendingToggle;
  /** Which action is in flight, if any. Per-ACTION rather than per-page: a single
   *  boolean made an in-flight "Change anyway" relabel the destructive
   *  "Cancel N posts" button to "Working…", which reads as the cancel running. */
  busy: "cancel" | "keep" | null;
  onCancelPosts: () => void;
  onKeepPosts: () => void;
  onAbandon: () => void;
}) {
  const { count, posts } = pending.affected;
  const one = count === 1;
  // Both reasons produce the same failure; the sentence differs because the
  // CAUSE differs, and "enabling a page broke my personal posts" is the one
  // nobody would guess.
  const personal = posts.some((x) => x.reason === "person_posting_disabled");
  const shown = posts.slice(0, 5);

  return (
    <div
      // Announced AND focused. Without this a screen-reader user gets only the
      // switch snapping back — no way to discover that a question was asked, let
      // alone answer it. (This file already announces the far more trivial
      // "Fetching Page names" notice.)
      role="alertdialog"
      aria-live="assertive"
      aria-label="Scheduled posts would fail"
      tabIndex={-1}
      ref={(el) => el?.focus()}
      className="space-y-2.5 rounded-md border border-warning/50 bg-warning/10 px-3 py-2.5 text-micro text-warning-on-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-warning"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">
            {one ? "1 scheduled post would fail" : count + " scheduled posts would fail"}
          </p>
          <p>
            {personal
              ? "Turning on " +
                pending.pageName +
                " means this workspace publishes as its page, so posts already scheduled to your personal feed can no longer go out."
              : "Posts already scheduled to publish as " +
                pending.pageName +
                " can't go out once it's switched off."}{" "}
            {one ? "It" : "They"} would fail silently at the scheduled time.
          </p>
        </div>
      </div>

      <ul className="space-y-1 border-t border-warning/30 pt-2">
        {shown.map((x) => (
          <li key={x.itemId} className="flex items-baseline gap-2">
            <span className="shrink-0 tabular-nums opacity-80">
              {new Date(x.scheduledAtUtc).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                timeZone: x.audienceTimezone,
              })}
            </span>
            <span className="truncate">{x.preview || "(no text)"}</span>
          </li>
        ))}
        {count > shown.length && (
          <li className="italic opacity-70">+ {count - shown.length} more</li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2 border-t border-warning/30 pt-2">
        <Button
          size="sm"
          variant="destructive"
          onClick={onCancelPosts}
          disabled={busy !== null}
          aria-busy={busy === "cancel"}
        >
          {busy === "cancel"
            ? "Cancelling…"
            : one
              ? "Cancel that post"
              : "Cancel " + count + " posts"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onKeepPosts}
          disabled={busy !== null}
          aria-busy={busy === "keep"}
        >
          {busy === "keep" ? "Applying…" : "Change anyway"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onAbandon} disabled={busy !== null}>
          Keep the page as it is
        </Button>
      </div>
      {/* "Change anyway" is a real choice — someone may be about to re-enable the
          page, or want to edit those posts first — but it must not read as the
          safe one. */}
      <p className="opacity-80">
        &ldquo;Change anyway&rdquo; leaves {one ? "it" : "them"} scheduled, and{" "}
        {one ? "it" : "they"} will fail. Posts on other channels are never
        touched.
      </p>
    </div>
  );
}
