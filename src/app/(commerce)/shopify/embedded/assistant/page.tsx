"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  Badge,
  Box,
  TextField,
  SkeletonPage,
  SkeletonBodyText,
  Spinner,
} from "@shopify/polaris";
import { getSessionToken } from "../_lib/session";
import { startReconnect } from "../_lib/context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * In-app catalog-grounded assistant (P1.11) — the reviewer-testability
 * keystone. A reviewer (or merchant) asks a catalog question right here and
 * gets the SAME grounded answer the WhatsApp channel gives, with no WABA
 * required. Non-subscribers get a capped daily teaser; at the cap the API
 * returns 402 and we show the upgrade nudge.
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type Phase =
  | { status: "loading" }
  | { status: "notlinked" }
  | { status: "error"; message: string }
  | { status: "ready" };

const SUGGESTIONS = [
  "What are your best sellers?",
  "Do you have anything under $20?",
  "What's good for a gift?",
];

function AssistantSkeleton() {
  return (
    <SkeletonPage title="Assistant">
      <Card>
        <BlockStack gap="400">
          <SkeletonBodyText lines={4} />
        </BlockStack>
      </Card>
    </SkeletonPage>
  );
}

export default function AssistantPage() {
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [capped, setCapped] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Bootstrap: confirm the store is linked (reuse /context — a 404/inactive
  // store routes to the connect CTA, same story as the other pages).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSessionToken();
      if (cancelled) return;
      if (!token) {
        setPhase({ status: "error", message: "Couldn't get a Shopify session. Please reopen Peakhour from your Shopify admin." });
        return;
      }
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/context`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 404 || res.status === 400) {
          setPhase({ status: "notlinked" });
          return;
        }
        if (!res.ok) {
          setPhase({ status: "error", message: `Could not load the assistant (${res.status}).` });
          return;
        }
        const ctx = (await res.json()) as { connected?: boolean };
        setPhase(ctx.connected ? { status: "ready" } : { status: "notlinked" });
      } catch {
        if (!cancelled) setPhase({ status: "error", message: "Network error loading the assistant." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setSendError(null);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");

    const token = await getSessionToken();
    if (!token) {
      setSendError("Couldn't get a Shopify session. Please reopen from your admin.");
      setSending(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/assistant/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        capped?: boolean;
      };
      if (res.status === 402) {
        setCapped(true);
        if (data.reply) setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
      } else if (!res.ok) {
        setSendError("The assistant couldn’t answer just now. Please try again in a moment.");
      } else if (data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
      }
    } catch {
      setSendError("Network error contacting the assistant.");
    }
    setSending(false);
  }, [sending]);

  if (phase.status === "loading") return <AssistantSkeleton />;

  if (phase.status === "notlinked" || phase.status === "error") {
    return (
      <Page title="Assistant">
        <Card>
          <BlockStack gap="300">
            <Text as="p" variant="bodyMd">
              {phase.status === "notlinked"
                ? "Finish linking your store to use the assistant."
                : phase.message}
            </Text>
            {phase.status === "notlinked" && (
              <Box>
                <Button
                  onClick={() => {
                    void startReconnect();
                  }}
                >
                  Set up Peakhour Commerce
                </Button>
              </Box>
            )}
          </BlockStack>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Assistant"
      subtitle="Ask anything about your catalog — the same answers your shoppers get on WhatsApp"
    >
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <div
              ref={scrollRef}
              // role=log + polite so screen readers announce each assistant
              // reply as it arrives (BFS accessibility).
              role="log"
              aria-live="polite"
              aria-label="Assistant conversation"
              style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}
            >
              {messages.length === 0 && (
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Try one of these, or ask your own:
                  </Text>
                  <InlineStack gap="200" wrap>
                    {SUGGESTIONS.map((s) => (
                      <Button key={s} size="slim" onClick={() => void send(s)} disabled={sending}>
                        {s}
                      </Button>
                    ))}
                  </InlineStack>
                </BlockStack>
              )}
              {messages.map((m, i) => (
                <InlineStack key={i} align={m.role === "user" ? "end" : "start"}>
                  <div style={{ maxWidth: "80%" }}>
                    <Box
                      background={m.role === "user" ? "bg-fill-brand" : "bg-fill-secondary"}
                      padding="300"
                      borderRadius="200"
                    >
                      <Text as="p" variant="bodyMd" tone={m.role === "user" ? "text-inverse" : undefined}>
                        {m.content}
                      </Text>
                    </Box>
                  </div>
                </InlineStack>
              ))}
              {sending && (
                <InlineStack align="start" gap="200" blockAlign="center">
                  <Spinner size="small" />
                  <Text as="span" variant="bodySm" tone="subdued">Thinking…</Text>
                </InlineStack>
              )}
            </div>

            {sendError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{sendError}</Text>
              </Banner>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <InlineStack gap="200" blockAlign="center" wrap={false}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Message"
                    labelHidden
                    value={input}
                    onChange={setInput}
                    placeholder="Ask about your products…"
                    autoComplete="off"
                    disabled={sending || capped}
                  />
                </div>
                <Button submit variant="primary" loading={sending} disabled={!input.trim() || capped}>
                  Send
                </Button>
              </InlineStack>
            </form>
          </BlockStack>
        </Card>

        {capped && (
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="attention">Free preview limit reached</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                You’ve used today’s free preview. Subscribe to the Commerce Assistant to chat without
                limits — and put it live on WhatsApp so it answers your shoppers around the clock.
              </Text>
              <Box>
                <Button
                  variant="primary"
                  url="/shopify/embedded/subscription"
                >
                  See plans
                </Button>
              </Box>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
