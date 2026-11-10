"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { PaymentModal as PaymentModalImpl } from "./payment-modal";

// The Stripe embedded checkout, vaul and the gateway launcher are only needed
// once a checkout payload exists. Importing PaymentModal directly pulled them
// into the first-load JS of every dashboard route (via the upgrade drawer in
// the sidebar), so the real modal is fetched when a checkout first opens.
const PaymentModalChunk = dynamic(
  () => import("./payment-modal").then((m) => m.PaymentModal),
  { ssr: false },
);

export function PaymentModal(props: ComponentProps<typeof PaymentModalImpl>) {
  if (!props.checkout) return null;
  return <PaymentModalChunk {...props} />;
}
