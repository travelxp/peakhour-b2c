"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerPanel, useRefreshSummary } from "@/hooks/use-wa-conversations";
import {
  WINDOW_LIMITED_NOTE,
  ORDERS_EMPTY,
  actionError,
  canChangeConversation,
  codLine,
  creditsLabel,
  firstSeenLine,
  lifetimeLine,
  money,
  orderDate,
  ordersNote,
  plainStatus,
  priced,
  sentimentLabel,
  type CustomerPanelData,
  type PanelOrder,
} from "@/lib/inbox-customer";

/**
 * The customer panel beside an open conversation (Inbox phase 2): who this customer is and what they have bought, so the person who
 * answers knows the history.
 *
 * MARKUP ONLY. Who sees which contact detail is the api's (a viewer gets no name and no number; everyone else gets the number masked to
 * its last four digits, never in full), which orders belong to the customer is the api's, and the sentences and the price on the
 * buttons are `lib/inbox-customer.ts`'s, tested there.
 *
 * ★THE ORDERS ARE READ LIVE AND NOT KEPT, so a failed read says it failed ("Orders could not be loaded just now") and never reads as
 * "no orders". The panel opens by itself with the conversation; nothing on it costs anything until a person presses Refresh summary.
 */

function OrderRow({ o }: { o: PanelOrder }) {
  const cod = codLine(o.cod);
  const status = [plainStatus(o.financialStatus), plainStatus(o.fulfillmentStatus)].filter(Boolean).join(" · ");
  return (
    <li className="rounded-md border p-2 text-xs" data-testid="panel-order">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{o.name}</span>
        <span className="shrink-0 text-muted-foreground">{orderDate(o.createdAt)}</span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">{o.cancelledAt ? `Cancelled ${orderDate(o.cancelledAt)}` : status}</span>
        {o.total && <span className="shrink-0 font-medium">{money(o.total)}</span>}
      </div>
      {cod && <p className="mt-0.5 text-muted-foreground">{cod}</p>}
      {o.tracking.map((t, i) => (
        <p key={i} className="mt-0.5 truncate text-muted-foreground">
          {t.url ? (
            <a href={t.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline underline-offset-2">
              Track {[t.company, t.number].filter(Boolean).join(" ") || "parcel"}
              <ExternalLink className="size-3" />
            </a>
          ) : (
            <>Tracking: {[t.company, t.number].filter(Boolean).join(" ")}</>
          )}
        </p>
      ))}
    </li>
  );
}

/** One older page of orders. ★Each page is its own query keyed by its cursor, so "Show older orders" appends without re-reading the pages above it. */
function MoreOrders({ threadId, after }: { threadId: string; after: string }) {
  const q = useCustomerPanel(threadId, after);
  const [more, setMore] = useState(false);
  if (q.isLoading) return <Skeleton className="h-16 w-full" />;
  const orders = q.data?.orders;
  if (q.isError || !orders || orders.state !== "ok") {
    return (
      <p className="text-xs text-muted-foreground">
        Older orders could not be loaded just now.{" "}
        <button className="underline underline-offset-2" onClick={() => void q.refetch()}>
          Try again
        </button>
      </p>
    );
  }
  return (
    <>
      <ul className="space-y-1.5">{orders.items.map((o) => <OrderRow key={o.orderId} o={o} />)}</ul>
      {orders.nextCursor && !more && (
        <Button size="xs" variant="outline" onClick={() => setMore(true)}>
          Show older orders
        </Button>
      )}
      {orders.nextCursor && more && <MoreOrders threadId={threadId} after={orders.nextCursor} />}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function CustomerPanel({ threadId, role }: { threadId: string; role: string | null }) {
  const q = useCustomerPanel(threadId);
  const refresh = useRefreshSummary(threadId);
  const canRefresh = canChangeConversation(role);

  if (q.isLoading) {
    return (
      <div className="space-y-3 p-3" data-testid="customer-panel">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="space-y-2 p-3 text-xs" data-testid="customer-panel">
        <p className="font-medium">Couldn&apos;t load the customer details</p>
        <p className="text-muted-foreground">This is a problem loading them, not a customer with nothing to show.</p>
        <Button size="xs" variant="outline" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  const d: CustomerPanelData = q.data;

  if (d.anonymous) {
    return (
      <div className="p-3 text-xs text-muted-foreground" data-testid="customer-panel">
        <p className="font-medium text-foreground">{d.message}</p>
        <p className="mt-1">This visitor didn&apos;t sign in, so there is no way to tell who they are or to link their other chats.</p>
      </div>
    );
  }

  const price = priced("Refresh summary", d.prices.customerSummary);
  const sentiment = sentimentLabel(d.summary?.sentiment ?? null);
  const note = d.orders ? ordersNote(d.orders.state) : null;
  const orders = d.orders;

  return (
    <div className="space-y-4 p-3" data-testid="customer-panel">
      {d.contact && (
        <Section title="Customer">
          {d.contact.name !== undefined ? (
            <p className="text-sm font-medium">{d.contact.name || "Name not shared"}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Contact details are hidden for your role.</p>
          )}
          <dl className="space-y-0.5 text-xs text-muted-foreground">
            {d.contact.phone && (
              <div className="flex justify-between gap-2">
                <dt>Phone</dt>
                <dd className="font-medium text-foreground">{d.contact.phone}</dd>
              </div>
            )}
            {d.contact.locale && (
              <div className="flex justify-between gap-2">
                <dt>Language</dt>
                <dd className="font-medium text-foreground">{d.contact.locale}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt>Conversations</dt>
              <dd className="font-medium text-foreground">{d.contact.conversationCount}</dd>
            </div>
          </dl>
          {firstSeenLine(d.contact.firstSeenAt) && <p className="text-xs text-muted-foreground">{firstSeenLine(d.contact.firstSeenAt)}</p>}
        </Section>
      )}

      {d.summary && (
        <Section title="What they want">
          {d.summary.text ? (
            <p className="whitespace-pre-wrap text-xs">{d.summary.text}</p>
          ) : (
            <p className="text-xs text-muted-foreground">No summary yet. One is written when a conversation ends, or you can write one now.</p>
          )}
          {(sentiment || d.summary.topics.length > 0) && (
            <p className="text-xs text-muted-foreground">
              {[sentiment, d.summary.topics.length ? `Topics: ${d.summary.topics.slice(0, 5).join(", ")}` : null].filter(Boolean).join(" · ")}
            </p>
          )}
          {d.summary.updatedAt && <p className="text-[11px] text-muted-foreground">Updated {orderDate(d.summary.updatedAt)}</p>}
          {canRefresh && (
            <div className="space-y-1 pt-1">
              <Button
                size="xs"
                variant="outline"
                disabled={!price.available || refresh.isPending}
                onClick={() =>
                  refresh.mutate(undefined, {
                    onSuccess: (r) => toast.success(r.chargedCredits > 0 ? `Summary refreshed. ${creditsLabel(r.chargedCredits)} used.` : "Summary refreshed."),
                    onError: (e) => toast.error(actionError(e, "Refreshing the summary")),
                  })
                }
              >
                {refresh.isPending ? "Refreshing…" : price.text}
              </Button>
              {!price.available && <p className="text-[11px] text-muted-foreground">Refreshing the summary isn&apos;t available right now.</p>}
              <p className="text-[11px] text-muted-foreground">Only runs when you press it.</p>
            </div>
          )}
        </Section>
      )}

      {orders && (
        <Section title="Orders">
          {orders.lifetime && <p className="text-xs font-medium">{lifetimeLine(orders.lifetime)}</p>}
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
          {orders.state === "ok" && orders.windowLimited && <p className="text-[11px] text-muted-foreground">{WINDOW_LIMITED_NOTE}</p>}
          {orders.state === "ok" && orders.items.length === 0 && <p className="text-xs text-muted-foreground">{ORDERS_EMPTY}</p>}
          {orders.state === "unavailable" && (
            <Button size="xs" variant="outline" onClick={() => void q.refetch()}>
              Try again
            </Button>
          )}
          {orders.state === "ok" && orders.items.length > 0 && (
            <>
              <ul className="space-y-1.5">{orders.items.map((o) => <OrderRow key={o.orderId} o={o} />)}</ul>
              {orders.nextCursor && <OlderOrders threadId={threadId} after={orders.nextCursor} />}
            </>
          )}
        </Section>
      )}
    </div>
  );
}

function OlderOrders({ threadId, after }: { threadId: string; after: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
        Show older orders
      </Button>
    );
  }
  return <MoreOrders threadId={threadId} after={after} />;
}
