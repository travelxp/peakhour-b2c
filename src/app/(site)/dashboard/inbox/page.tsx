"use client";

import dynamic from "next/dynamic";
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
import { useAuth } from "@/providers/auth-provider";
import { createComposerStore } from "@/lib/wa-inbox-reply";
import { ConversationsPane, WaitingForConnection } from "@/components/inbox/conversations-pane";
import { SCOPE_LABEL, offersAllStores, openAddress, scopeFromParam, type InboxScope } from "@/lib/inbox-all-stores";
import { useInsights } from "@/hooks/use-insights";
import { insightsBadge } from "@/lib/insights";
import { INBOX_SUBTITLE, threadFromParam } from "@/lib/inbox-view";
import { inboxApi, type InboxItem, type InboxPriority } from "@/lib/api/inbox";
import { listFetchState, showsSkeleton } from "@/lib/list-fetch-state";
import {
  inboxTabFromParam,
  REVIEW_SUMMARY_QUERY_KEY,
  type InboxTab,
} from "@/lib/review-summary";
import { REVIEW_PLACES_QUERY_KEY } from "@/lib/review-places";
import {
  REVIEW_PAGE_LIMIT,
  reviewQueueOrder,
  reviewsAreTruncated,
  unansweredBadge,
} from "@/lib/review-reply";
import { PageShell } from "@/components/dashboard/page-shell";

// Tabs other than Conversations (and the all-stores scope) load on demand.
const AllStoresPane = dynamic(() => import("@/components/inbox/all-stores-pane").then((mod) => mod.AllStoresPane));
const InsightsPane = dynamic(() => import("@/components/inbox/insights-pane").then((mod) => mod.InsightsPane));
const AskYourInbox = dynamic(() => import("@/components/whatsapp/ask-your-inbox").then((mod) => mod.AskYourInbox));
const ReviewReplyCard = dynamic(() => import("@/components/inbox/review-reply-card").then((mod) => mod.ReviewReplyCard));

/**
 * Inbox — ONE queue for everything inbound (D-inbox): every channel is
 * an adapter into the same list. Lanes shipped so far: conversations (WhatsApp
 * live chat and, read-only, storefront chats — `components/inbox/conversations-pane.tsx`),
 * LinkedIn lead-gen leads (G2 — scored by the lead qualifier, priority-ranked,
 * SLA clock running), Google reviews, Insights (what customers keep raising, with the
 * questions the assistant could not answer answered in place) and "Ask your inbox" (Inbox phase 2). New channels join as adapters, never
 * as new pages.
 */

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
            <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide ${PRIORITY_BADGE[item.priority]}`}>
              {item.priority}
            </span>
            <Badge variant="outline" className="text-micro uppercase tracking-wide">
              {SOURCE_LABEL[item.source] ?? item.source}
            </Badge>
            {typeof lead?.score === "number" && (
              <Badge variant="outline" className="text-micro">
                score {lead.score}
                {lead.qualified ? " · qualified" : ""}
              </Badge>
            )}
            {item.status !== "queued" && (
              <Badge variant="outline" className="text-micro uppercase tracking-wide">
                {item.status.replaceAll("_", " ")}
              </Badge>
            )}
            {sla && <span className="text-micro text-warning-on-tint">{sla}</span>}
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

// ── Reviews lane (sup_inbox, kind: review — S0·4) ─────────────────────

/**
 * The reviews lane.
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
    // the all-locations view counts the same unanswered reviews, per place
    queryClient.invalidateQueries({ queryKey: REVIEW_PLACES_QUERY_KEY });
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
          Once a review network is connected and sending us reviews, every new review lands here
          — worst first — with a reply you can publish back to its page without leaving Peakhour,
          where the network takes replies.
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
      <p className="mt-1 text-sm text-muted-foreground">{INBOX_SUBTITLE}</p>
    </div>
  );
}

function InboxTabs() {
  // ★A search param, as the tab is (see below): an alert email links to `?tab=conversations&thread=<key>` and lands on that conversation.
  const params = useSearchParams();
  const threadParam = threadFromParam(params.get("thread"));
  const [selected, setSelected] = useState<string | null>(threadParam);
  // a second alert link followed while the Inbox is already open names another conversation: follow it (once per link, so choosing a
  // different conversation afterwards is not undone)
  const [seenThreadParam, setSeenThreadParam] = useState(threadParam);
  if (threadParam !== seenThreadParam) {
    setSeenThreadParam(threadParam);
    if (threadParam) setSelected(threadParam);
  }
  // ✅WA T4: the composer's inputs. (The ticking clock is read inside the badge and the composer, so a tick does not re-render the
  //  whole Inbox.)
  const { org, orgs, businesses } = useAuth();
  const role = orgs.find((o) => o._id === org?._id)?.role ?? null;
  // ★ONE STORE FOR THE PAGE'S LIFE: a draft, its key, its last warning and its in-flight flag per thread, kept across switching
  //  threads or tabs, and written by a send that settles after its composer unmounted.
  const [composerStore] = useState(createComposerStore);
  // ★★HOISTED SO THE BADGE EXISTS BEFORE THE TAB IS OPENED. A count that only
  // appears once you have already looked at the lane is not a count — the
  // number of reviews waiting on an answer is the thing that makes somebody
  // open the app at all.
  const reviews = useReviewsQuery();
  // Insights: what customers keep raising. ★A COUNT ONLY ONCE IT IS KNOWN, like the reviews': a failed or in-flight read shows no badge
  //  rather than a zero that claims nothing is waiting. The api's own `needsAction` is the number; the same read feeds the tab.
  const insights = useInsights();
  const waiting = insightsBadge(insights.data);
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
    // a topic filter belongs to the conversation list it was opened on: choosing a lane by hand starts from the whole list
    search.delete("topic");
    router.push(`${pathname}?${search.toString()}`, { scroll: false });
  }
  // ★★★THE "SHOW IT AT ALL" DECISION IS THE MODULE'S, because it is the one
  // that can claim something untrue. `unanswered > 0` hid the badge on a
  // TRUNCATED page whose hundred newest reviews were all answered — a silent
  // tab asserting nothing is waiting, about older rows we never fetched.
  const badge = unansweredBadge(reviews.data?.items);

  // "All my stores" (I3f): a read-only list across the person's stores, offered only to someone with more than one. The scope is in the
  // URL (`?scope=all`) so a reload keeps it; opening a row switches the session to that store (see AllStoresPane), drops the scope and
  // names the thread, so the address always describes the pinned store.
  const scope: InboxScope = offersAllStores(businesses.length) ? scopeFromParam(params.get("scope")) : "store";
  function selectScope(next: InboxScope) {
    const search = new URLSearchParams(params.toString());
    search.set("tab", "conversations");
    if (next === "all") search.set("scope", "all");
    else search.delete("scope");
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  }
  function openFromAllStores(threadId: string) {
    router.replace(openAddress(pathname, params.toString(), threadId), { scroll: false });
    setSelected(threadId);
  }

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
          <TabsTrigger value="insights">
            Insights
            {waiting > 0 && (
              <Badge className="ml-1.5 bg-warning/15 px-1.5 text-micro text-warning-on-tint">{waiting}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="reviews">
            Reviews
            {/* ⚠️NO BADGE AT ZERO, and none while the count is unknown. A "0"
                is a claim that there is nothing waiting, which a failed or
                in-flight fetch has not earned. */}
            {badge && (
              <Badge className="ml-1.5 bg-warning/15 px-1.5 text-micro text-warning-on-tint">
                {badge.label}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ask">Ask your inbox</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-4">
          <InsightsPane />
        </TabsContent>

        <TabsContent value="ask" className="mt-4">
          <AskYourInbox />
        </TabsContent>

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
          {offersAllStores(businesses.length) && (
            <div className="mb-3 flex items-center gap-1.5" role="group" aria-label="Stores">
              {(["store", "all"] as const).map((v) => (
                <Button key={v} size="xs" variant={scope === v ? "secondary" : "ghost"} aria-pressed={scope === v} onClick={() => selectScope(v)}>
                  {SCOPE_LABEL[v]}
                </Button>
              ))}
            </div>
          )}
          {scope === "all" ? (
            <AllStoresPane onOpen={openFromAllStores} />
          ) : (
            <ConversationsPane role={role} selected={selected} onSelect={setSelected} composerStore={composerStore} />
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
