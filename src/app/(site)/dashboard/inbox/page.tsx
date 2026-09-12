"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import {
  useWaConversations,
  useWaThread,
  useWaHandoff,
  useWaResume,
  type WaConversation,
} from "@/hooks/use-wa-conversations";
import { inboxApi, type InboxItem, type InboxPriority } from "@/lib/api/inbox";
import { ReviewReplyCard } from "@/components/inbox/review-reply-card";
import { listFetchState, showsSkeleton, showsRows } from "@/lib/list-fetch-state";
import {
  inboxTabFromParam,
  REVIEW_SUMMARY_QUERY_KEY,
  type InboxTab,
} from "@/lib/review-summary";
import {
  REVIEW_PAGE_LIMIT,
  reviewQueueOrder,
  reviewsAreTruncated,
  unansweredBadge,
} from "@/lib/review-reply";
import { PageShell } from "@/components/dashboard/page-shell";

/**
 * Inbox — ONE queue for everything inbound (D-inbox): every channel is
 * an adapter into the same list. Lanes shipped so far: WhatsApp
 * conversations (live chat) and LinkedIn lead-gen leads (G2 — scored
 * by the lead qualifier, priority-ranked, SLA clock running). New
 * channels join as adapters, never as new pages.
 */

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/15 text-success-on-tint" },
  resolved: { label: "Resolved", className: "bg-muted text-muted-foreground" },
  escalated: { label: "With a human", className: "bg-warning/15 text-warning-on-tint" },
};

function StatusPill({ status }: { status: string }) {
  const v = STATUS_LABEL[status] ?? STATUS_LABEL.active;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${v.className}`}>{v.label}</span>;
}

function Bubble({ role, content }: { role: string; content: string }) {
  const mine = role === "assistant" || role === "merchant";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg p-2.5 text-sm ${
          mine
            ? "rounded-tr-none bg-[#dcf8c6] text-foreground"
            : "rounded-tl-none bg-white text-foreground shadow-sm"
        }`}
      >
        {role === "merchant" && <p className="mb-0.5 text-[11px] font-medium opacity-70">You (from your phone)</p>}
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

// ── Leads lane (sup_inbox, kind: lead) ────────────────────────────────

const PRIORITY_BADGE: Record<InboxPriority, string> = {
  urgent: "bg-destructive/15 text-destructive-on-tint",
  high: "bg-warning/15 text-warning-on-tint",
  normal: "bg-state-info/15 text-state-info-on-tint",
  low: "bg-muted/60 text-muted-foreground",
};

const SOURCE_LABEL: Record<string, string> = { linkedin: "LinkedIn" };

function slaLabel(item: InboxItem): string | null {
  const due = item.sla?.firstResponseDueAt;
  if (!due || item.sla?.firstRespondedAt || item.status !== "queued") return null;
  const ms = new Date(due).getTime() - Date.now();
  if (ms <= 0) return "response overdue";
  const hours = Math.round(ms / (60 * 60 * 1000));
  return hours < 1 ? "respond within the hour" : `respond within ${hours}h`;
}

function LeadRow({ item, onChanged }: { item: InboxItem; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const act = useMutation({
    mutationFn: (status: "in_review" | "resolved") => inboxApi.setStatus(item._id, status),
    onSuccess: (res) => {
      toast.success(res.status === "resolved" ? "Lead marked resolved." : "Marked as being handled — SLA clock noted.");
      onChanged();
    },
    onError: () => toast.error("Couldn't update the lead. Try again in a moment."),
  });

  const lead = item.lead;
  const sla = slaLabel(item);

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${PRIORITY_BADGE[item.priority]}`}>
              {item.priority}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {SOURCE_LABEL[item.source] ?? item.source}
            </Badge>
            {typeof lead?.score === "number" && (
              <Badge variant="outline" className="text-[10px]">
                score {lead.score}
                {lead.qualified ? " · qualified" : ""}
              </Badge>
            )}
            {item.status !== "queued" && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {item.status.replaceAll("_", " ")}
              </Badge>
            )}
            {sla && <span className="text-[11px] text-warning-on-tint">{sla}</span>}
          </div>
          <p className="truncate text-sm font-medium">
            {item.contact?.name || item.contact?.email || item.subject || "Lead"}
            {lead?.campaignName ? (
              <span className="ml-2 font-normal text-muted-foreground">via {lead.campaignName}</span>
            ) : null}
          </p>
          {item.body && <p className="text-xs text-muted-foreground">{item.body}</p>}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? "Hide details" : "Details"}
          </button>
          {expanded && (
            <div className="space-y-1.5 rounded-md bg-muted/30 p-2 text-xs">
              {lead?.fitReasons && lead.fitReasons.length > 0 && (
                <div>
                  <p className="font-medium">Why this score</p>
                  <ul className="list-inside list-disc text-muted-foreground">
                    {lead.fitReasons.map((r, i) => (
                      <li key={`${i}-${r.slice(0, 24)}`}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lead?.riskFlags && lead.riskFlags.length > 0 && (
                <p className="text-muted-foreground">Flags: {lead.riskFlags.join(", ").replaceAll("_", " ")}</p>
              )}
              {lead?.fields && Object.keys(lead.fields).length > 0 && (
                <div>
                  <p className="font-medium">Form answers</p>
                  <dl className="text-muted-foreground">
                    {Object.entries(lead.fields).map(([k, v]) => (
                      <div key={k} className="flex gap-1">
                        <dt className="shrink-0 font-medium">{k.replaceAll("_", " ").toLowerCase()}:</dt>
                        <dd className="min-w-0 wrap-break-word">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>
        {item.status === "queued" || item.status === "in_review" ? (
          <div className="flex shrink-0 gap-1.5">
            {item.status === "queued" && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={act.isPending} onClick={() => act.mutate("in_review")}>
                I&apos;m on it
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={act.isPending} onClick={() => act.mutate("resolved")}>
              Resolve
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LeadsPane() {
  const queryClient = useQueryClient();
  const leads = useQuery({
    queryKey: ["inbox-leads"],
    queryFn: () => inboxApi.list({ kind: "lead", limit: 100 }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const onChanged = () => queryClient.invalidateQueries({ queryKey: ["inbox-leads"] });

  const state = listFetchState(leads, leads.data?.items?.length ?? 0);
  // ⚠️★★★`showsSkeleton`, NOT `loading || waiting` — AND THE DIFFERENCE IS THE
  //  BUG THE HELPER EXISTS FOR. `waiting` means the query is DISABLED: nobody
  //  has asked, so nothing is in flight and nothing will arrive. A skeleton
  //  there spins for ever. The helper says `loading` alone; hand-rolling the
  //  pair beside it re-introduced exactly what it was written to prevent.
  if (showsSkeleton(state)) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  // ★NOTHING ASKED, SO NOTHING CLAIMED. Not the empty state — that one asserts
  //  the list came back with no rows, which we have not established.
  if (state === "waiting") return null;
  if (state === "paused") return <WaitingForConnection what="leads" />;
  // A failed fetch must never masquerade as "no leads" — leads keep
  // arriving (and billing) server-side whether or not this list loads.
  if (state === "error") {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load your leads</p>
        <p className="max-w-md text-xs text-muted-foreground">
          New leads still arrive and get scored in the background. Try refreshing in a moment.
        </p>
        <Button size="sm" variant="outline" onClick={() => leads.refetch()}>
          Retry
        </Button>
      </Card>
    );
  }
  // Hot first: priority rank, then newest.
  const PRIORITY_RANK: Record<InboxPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const items = [...(leads.data?.items ?? [])].sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return b.createdAt.localeCompare(a.createdAt);
  });
  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <Sparkles className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">No leads yet</p>
        <p className="max-w-md text-xs text-muted-foreground">
          When someone submits a LinkedIn Lead Gen form on one of your campaigns, it lands here —
          scored, prioritised, and on an SLA clock. Run a lead-generation campaign from the Ads
          Manager to start the flow.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <LeadRow key={item._id} item={item} onChanged={onChanged} />
      ))}
    </div>
  );
}

/**
 * What a lane says while it is waiting on the network.
 *
 * ★ONE SENTENCE, THREE LANES. A paused query never resolves and never errors,
 * so without this the merchant watches placeholders for ever with nothing to
 * act on — and three hand-written versions of that sentence is three chances
 * for one of them to go missing again.
 */
function WaitingForConnection({ what }: { what: string }) {
  return (
    <p className="text-center text-xs text-muted-foreground">
      Waiting for a connection — your {what} will load when you&apos;re back online.
    </p>
  );
}

// ── Reviews lane (sup_inbox, kind: review — S0·4) ─────────────────────

/**
 * The Google reviews lane.
 *
 * ★★THE ONLY LANE WHOSE REPLY LEAVES PEAKHOUR FOR A PAGE THE MERCHANT'S
 * CUSTOMERS READ. Everything it decides — what the box starts with, what a
 * refusal means, whether a `recorded: false` is a success — is in
 * `lib/review-reply.ts`, tested; `ReviewReplyCard` is the markup.
 *
 * ⚠️ZERO ROWS TODAY, AND THAT IS NOT A BUG. `sup_inbox` holds no
 * `google_review` items until the Pub/Sub notification topic is provisioned
 * (plan S0·1, unassigned). The empty state has to say what will fill it rather
 * than implying the merchant has no reviews — nobody has told us either way.
 */
function useReviewsQuery() {
  return useQuery({
    queryKey: ["inbox-reviews"],
    queryFn: () => inboxApi.list({ kind: "review", limit: REVIEW_PAGE_LIMIT }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

function ReviewsPane({ query }: { query: ReturnType<typeof useReviewsQuery> }) {
  const queryClient = useQueryClient();
  // ★★ANSWERING A REVIEW CHANGES PRESENCE TOO. That card has a five-minute
  // staleTime and no refetch on focus, so without this a merchant who
  // answered their last waiting review and walked back to Presence was still
  // offered "Answer 1 waiting review" for the one they had just answered.
  const onChanged = () => {
    queryClient.invalidateQueries({ queryKey: ["inbox-reviews"] });
    queryClient.invalidateQueries({ queryKey: REVIEW_SUMMARY_QUERY_KEY });
  };

  const state = listFetchState(query, query.data?.items?.length ?? 0);
  // ⚠️`showsSkeleton` — see the leads lane above. `waiting` is a DISABLED
  //  query: nothing is in flight, so a skeleton there spins for ever.
  if (showsSkeleton(state)) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }
  // ★NOTHING ASKED, SO NOTHING CLAIMED — and emphatically not the empty state:
  //  "you are all caught up" about reviews we never requested is the sentence
  //  this lane most needs to avoid.
  if (state === "waiting") return null;
  if (state === "paused") return <WaitingForConnection what="reviews" />;
  // ★★A FAILED FETCH MUST NEVER READ AS "NO REVIEWS". An unanswered one-star
  // review is the most expensive row in this app, and "you're all caught up"
  // is the worst possible thing to say about one we simply could not load.
  if (state === "error") {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load your reviews</p>
        <p className="max-w-md text-xs text-muted-foreground">
          This is a problem loading the list, not an empty inbox. Try again in a moment.
        </p>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>
          Retry
        </Button>
      </Card>
    );
  }
  const items = reviewQueueOrder(query.data?.items ?? []);
  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <Sparkles className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">No reviews here yet</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Once your Google Business Profile is connected and sending us review notifications, every
          new review lands here — worst first — with a reply you can publish back to your listing
          without leaving Peakhour.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ReviewReplyCard key={item._id} item={item} onChanged={onChanged} />
      ))}
      {/* ⚠️A CAPPED LIST SAYS SO. `GET /inbox` maxes out at 100 and sorts
          newest-first with no cursor, so the rows dropped are the OLDEST —
          exactly where an unanswered review has been waiting longest. */}
      {reviewsAreTruncated(query.data?.items) && (
        <p className="px-1 text-xs text-muted-foreground">
          Showing your {REVIEW_PAGE_LIMIT} most recent reviews. Older ones aren&apos;t listed here
          yet — answer these and they&apos;ll come into view.
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function InboxPage() {
  // useSearchParams needs a Suspense boundary or the route bails out of
  // static rendering at build time — the same wrapper dashboard/ads uses, for
  // the same reason.
  //
  // ⚠️AND THE FALLBACK CARRIES THE HEADER, as that precedent's own comment
  // says it must: an empty shell renders blank on a hard load and then shifts
  // the whole page down when the real content arrives.
  return (
    <Suspense
      fallback={
        <PageShell>
          <InboxHeader />
          <Skeleton className="h-64 w-full" />
        </PageShell>
      }
    >
      <InboxTabs />
    </Suspense>
  );
}

/** ★ONE HEADER, so the fallback and the page cannot describe the screen
 *  differently — which is exactly how a loading state comes to shift the
 *  page it is standing in for. */
function InboxHeader() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        One queue for everything inbound — conversations and leads, whichever channel they came
        from.
      </p>
    </div>
  );
}

function InboxTabs() {
  const conversationsQuery = useWaConversations();
  const { conversations } = conversationsQuery;
  const refetchConversations = conversationsQuery.refetch;
  const convState = listFetchState(conversationsQuery, conversations.length);
  const [selected, setSelected] = useState<string | null>(null);
  const threadQuery = useWaThread(selected);
  const thread = threadQuery.data;
  // ★AND THE SAME `enabled`-GATED TRAP AGAIN: with
  // no thread selected the query is pending and idle for ever. Silent rather
  // than false — a blank pane claims nothing — but a blank pane is still not an
  // answer when the merchant is offline.
  const threadState = listFetchState(threadQuery, thread?.messages.length ?? 0);
  const handoff = useWaHandoff();
  const resume = useWaResume();
  // ★★HOISTED SO THE BADGE EXISTS BEFORE THE TAB IS OPENED. A count that only
  // appears once you have already looked at the lane is not a count — the
  // number of reviews waiting on an answer is the thing that makes somebody
  // open the app at all.
  const reviews = useReviewsQuery();
  // ★★SO A LINK CAN NAME A LANE. Presence's "answer 3 waiting reviews" button
  // dropped somebody on Conversations, with the thing they asked for one
  // unexplained click away. Read once, on mount: the hash is a starting point,
  // not a controlled value, so clicking a tab afterwards still just works.
  // ★★★A SEARCH PARAM, NOT A HASH, AND THAT IS THE WHOLE OF THE FIX. A hash
  // read in a `useState` initializer is read DURING RENDER, while the App
  // Router only writes the new URL in HistoryUpdater's `useInsertionEffect` —
  // and with no `loading.tsx` on this route the page mounts in the same
  // commit, so the initializer saw the PREVIOUS page's hash. Clicking
  // "Answer N waiting reviews" on Presence therefore landed on Conversations:
  // the exact bug the link exists to fix, working on a hard load and broken on
  // the only path anybody takes. `useSearchParams` is subscribed to the router
  // rather than read off `window`, so it is right on both.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fromUrl = inboxTabFromParam(params.get("tab"));
  // ★THE LANE THE USER JUST CLICKED, held until the URL catches up:
  // `router.push` commits in a transition, during which `useSearchParams`
  // still returns the OLD params — so without this the tab visibly lags the
  // click. The same reason `dashboard/ads` holds a `pendingChannel`.
  const [picked, setPicked] = useState<InboxTab | null>(null);
  // ★★AND IT IS RELEASED AS SOON AS THE URL AGREES, which is what makes Back
  // work: a held value that outlived the navigation would override the lane
  // the user just went back to, for ever.
  if (picked !== null && picked === fromUrl) setPicked(null);
  const tab = picked ?? fromUrl;

  /**
   * ★★★THE URL IS WRITTEN, NOT JUST READ. Holding the lane in local state
   * alone meant a reload, a bookmark or a Back returned somebody to the lane
   * they had LEFT — and a merchant who switches to Reviews and refreshes is
   * doing the most ordinary thing there is.
   *
   * `push`, because a tab click is a user gesture and Back should undo it.
   */
  function selectTab(next: InboxTab) {
    setPicked(next);
    const search = new URLSearchParams(params.toString());
    search.set("tab", next);
    router.push(`${pathname}?${search.toString()}`, { scroll: false });
  }
  // ★★★THE "SHOW IT AT ALL" DECISION IS THE MODULE'S, because it is the one
  // that can claim something untrue. `unanswered > 0` hid the badge on a
  // TRUNCATED page whose hundred newest reviews were all answered — a silent
  // tab asserting nothing is waiting, about older rows we never fetched.
  const badge = unansweredBadge(reviews.data?.items);

  return (
    <PageShell>
      <InboxHeader />

      {/* ⚠️★★MANUAL ACTIVATION, because `onValueChange` now NAVIGATES. With
          Radix's default "automatic", arrowing across the tab list selects on
          every focus move — so each keypress would push a history entry and
          Back would walk through tabs instead of leaving the page. The
          `dashboard/ads` precedent sets this for exactly the same reason. */}
      <Tabs
        value={tab}
        activationMode="manual"
        onValueChange={(v) => selectTab(inboxTabFromParam(v))}
      >
        <TabsList>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="reviews">
            Reviews
            {/* ⚠️NO BADGE AT ZERO, and none while the count is unknown. A "0"
                is a claim that there is nothing waiting, which a failed or
                in-flight fetch has not earned. */}
            {badge && (
              <Badge className="ml-1.5 bg-warning/15 px-1.5 text-[10px] text-warning-on-tint">
                {badge.label}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <LeadsPane />
        </TabsContent>

        {/* ⚠️★★`forceMount`, BECAUSE RADIX UNMOUNTS AN INACTIVE PANE. This is
            the one tab holding a composer, and a merchant who glances at Leads
            mid-reply came back to an empty box — a public reply they had
            written, gone, with no undo. The same data loss `appendReply` was
            written to prevent, arrived at by a different route.
            ⚠️★★★AND `forceMount` ALONE LEAVES IT VISIBLE ON EVERY TAB. Radix
            computes `hidden={!present}` with `present = forceMount || isSelected`,
            so forcing the mount also forces `hidden` off — the reviews pane
            rendered underneath Conversations and Leads. `data-state` is set
            independently of `present`, so the hiding has to be ours. */}
        <TabsContent
          value="reviews"
          className="mt-4 data-[state=inactive]:hidden"
          forceMount
        >
          <ReviewsPane query={reviews} />
        </TabsContent>

        <TabsContent value="conversations" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            {/* Thread list */}
            <Card className="max-h-[70vh] overflow-y-auto p-2">
              {/* ⚠️★★★THE THIRD LANE, AND THE ONE WITH THE EXTRA TRAP. This query
                  is `enabled`-gated on a business being picked, so a DISABLED
                  query sits pending with an idle fetch for ever — the repair
                  the other two lanes needed (`isPending`) would spin a skeleton
                  here with nothing behind it. It also had no error branch at
                  all, so a failed request read as "No conversations yet". */}
              {/* ⚠️`showsSkeleton` — see the leads lane. `waiting` is a disabled
                  query, and a skeleton for it never resolves. */}
              {showsSkeleton(convState) && (
                <div className="space-y-2 p-2">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              )}
              {convState === "paused" && (
                <div className="p-2">
                  <WaitingForConnection what="conversations" />
                </div>
              )}
              {convState === "error" && (
                <div className="space-y-2 p-4 text-center">
                  <p className="text-sm font-medium">Couldn&apos;t load your conversations</p>
                  <p className="text-xs text-muted-foreground">
                    This is a problem loading the list, not an empty inbox.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => refetchConversations()}>
                    Retry
                  </Button>
                </div>
              )}
              {convState === "empty" && (
                <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
              )}
              {/* ⚠️★★★A FAILED REFRESH SAYS SO WITHOUT TAKING THE ROWS AWAY. This
                  lane polls every thirty seconds, so `error` here is usually a
                  failed BACKGROUND refetch with the last good list still behind
                  it — query-core keeps `data` and flips `status`. Collapsing
                  that into `error` painted "couldn't load your conversations,
                  this is not an empty inbox" directly above the conversations it
                  had just listed. `stale` keeps the rows and admits the
                  staleness instead. */}
              {convState === "stale" && (
                <p className="px-2 pb-1 text-[11px] text-muted-foreground">
                  Couldn&apos;t refresh just now — showing the last update.{" "}
                  <button
                    onClick={() => refetchConversations()}
                    className="underline underline-offset-2"
                  >
                    Retry
                  </button>
                </p>
              )}
              {showsRows(convState) && conversations.map((conv: WaConversation) => (
                <button
                  key={conv.threadId}
                  onClick={() => setSelected(conv.threadId)}
                  className={`flex w-full flex-col gap-0.5 rounded-lg p-2.5 text-left hover:bg-muted ${
                    selected === conv.threadId ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{conv.contactName || conv.waId}</span>
                    <StatusPill status={conv.status} />
                  </div>
                  <span className="truncate text-xs text-muted-foreground">{conv.preview || "…"}</span>
                </button>
              ))}
            </Card>

            {/* Thread view */}
            <Card className="flex max-h-[70vh] flex-col p-0">
              {!selected && (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                  Select a conversation to view it.
                </div>
              )}
              {selected && (
                <>
                  <div className="flex items-center justify-between border-b p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{thread?.contactName || selected.split(":").slice(2).join(":")}</p>
                      {thread && <StatusPill status={thread.status} />}
                    </div>
                    {thread?.status === "escalated" ? (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={resume.isPending}
                        onClick={() =>
                          resume.mutate(selected, {
                            onSuccess: () => toast.success("Handed back — the assistant will reply again."),
                            onError: (e: Error) => toast.error(e?.message || "Couldn't hand back"),
                          })
                        }
                      >
                        {resume.isPending ? "…" : "Return to AI"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={handoff.isPending}
                        onClick={() =>
                          handoff.mutate(selected, {
                            onSuccess: () => toast.success("Flagged for you — the assistant will hold off."),
                            onError: (e: Error) => toast.error(e?.message || "Couldn't hand off"),
                          })
                        }
                      >
                        {handoff.isPending ? "…" : "Take over"}
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto bg-[#e5ddd5] p-3">
                    {threadState === "loading" && <Skeleton className="h-20 w-full" />}
                    {threadState === "paused" && <WaitingForConnection what="messages" />}
                    {threadState === "error" && (
                      <p className="p-4 text-center text-sm text-muted-foreground">
                        Couldn&apos;t load this conversation. Try again in a moment.
                      </p>
                    )}
                    {thread?.messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
                    {threadState === "empty" && (
                      <p className="p-4 text-center text-sm text-muted-foreground">No messages.</p>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
