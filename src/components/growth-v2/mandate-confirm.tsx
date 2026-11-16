"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, LinkIcon, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FlowButton, FlowCard, FlowHead, FlowNotice, FlowPage, FlowSpinner, flowFacts } from "@/components/marketing/flow/flow-kit";
import { growthLinkApi, type LinkConfirmed, type LinkDescription } from "@/lib/api/growth-link";
import { CODE_LENGTH, cleanCode, codeIsComplete, linkErrorMessage, linkIsDead } from "@/lib/growth-link";

/**
 * The page behind the WhatsApp link (Growth Engine v2, plan 2.9, row H5): read the plan, get a code, enter it.
 *
 * ★OPENING THE LINK PROVES NOTHING. The page only describes the plan; a code is sent to the verified number only when the
 * person asks, and only a correct code switches the plan on (or, for a change, saves it). Nothing here spends.
 * ★IT IS PUBLIC: no sign-in is needed or assumed, and it never shows anything but the plan sentence and where the code went.
 */

export function MandateConfirm({ token }: { token: string }) {
  const described = useQuery<LinkDescription>({ queryKey: ["growth-link", token], queryFn: () => growthLinkApi.describe(token), retry: false });
  const [code, setCode] = useState("");
  // ★ONCE A CODE HAS BEEN ASKED FOR, THE BOX STAYS: a failed resend (a cooldown, a delivery failure) must not take the box away
  // from someone who holds a valid code in WhatsApp.
  const [asked, setAsked] = useState(false);
  const send = useMutation({ mutationFn: () => growthLinkApi.sendCode(token), onSuccess: () => setAsked(true) });
  const confirm = useMutation({ mutationFn: (c: string) => growthLinkApi.confirm(token, cleanCode(c)) });

  const link = described.data;
  // Asking for a new code clears the last wrong one (below), so what is shown is always the newest answer: a stale "not right"
  // never masks a cooldown, a failed send or a dead link. The link is dead only by the answer that is shown.
  const lastError = confirm.isError ? confirm.error : send.isError ? send.error : undefined;
  const dead = lastError !== undefined && linkIsDead(lastError);
  return (
    <FlowPage>
      <MandateConfirmView
        link={link}
        loading={described.isPending}
        loadError={described.isError ? linkErrorMessage(described.error) : undefined}
        codeAsked={asked || link?.otpSent === true}
        sending={send.isPending}
        confirming={confirm.isPending}
        done={confirm.data}
        code={code}
        dead={dead}
        error={lastError !== undefined ? linkErrorMessage(lastError) : undefined}
        onCode={(v) => setCode(cleanCode(v))}
        onSend={() => {
          confirm.reset();
          setCode("");
          send.mutate();
        }}
        onConfirm={() => confirm.mutate(code)}
      />
    </FlowPage>
  );
}

export interface MandateConfirmViewProps {
  link: LinkDescription | undefined;
  loading?: boolean;
  /** The sentence for a link that could not be read. */
  loadError?: string;
  /** A code has been sent for this link (now or earlier). */
  codeAsked: boolean;
  sending?: boolean;
  confirming?: boolean;
  /** Set once the correct code was accepted. */
  done?: LinkConfirmed;
  code: string;
  /** The link is finished: expired, used, locked. No retry is offered. */
  dead?: boolean;
  error?: string;
  onCode: (v: string) => void;
  onSend: () => void;
  onConfirm: () => void;
}

export function MandateConfirmView(p: MandateConfirmViewProps) {
  if (p.loading) {
    return (
      <FlowCard aria-busy="true">
        <h1 className="sr-only">Confirm your plan</h1>
        <p role="status" className="flex items-center justify-center gap-2.5 py-8 text-sm text-muted-foreground">
          <FlowSpinner />
          Opening your plan.
        </p>
      </FlowCard>
    );
  }
  if (p.loadError || !p.link) {
    return (
      <FlowCard>
        <FlowHead icon={LinkIcon} tone="warn" title="This link can't be used">
          <span role="alert">{p.loadError ?? "This link is not valid."}</span>
        </FlowHead>
        <FlowButton asChild variant="ghost" className="mt-5">
          <Link href="/dashboard/growth">Go to Growth</Link>
        </FlowButton>
      </FlowCard>
    );
  }
  const { link } = p;
  if (p.done) {
    return (
      <FlowCard>
        <FlowHead icon={CircleCheck} tone="ok" title={link.change ? "Your change is saved" : "Your plan is on"}>
          {link.change
            ? "Peakhour now works to your new plan. Nothing else changed."
            : "Peakhour starts by watching and proposing. Every change waits for your approval until it has earned more, and nothing spends beyond your ceiling."}
        </FlowHead>
        <div className="mt-5 grid gap-3">
          <p className={flowFacts + " text-[15px] text-foreground"}>{link.plan}</p>
          {!link.change && !p.done.holdout.started ? (
            <p className="text-sm text-muted-foreground">Lift measurement has not started yet ({p.done.holdout.reason}). Peakhour will say so on Growth home.</p>
          ) : null}
          <FlowButton asChild>
            <Link href="/dashboard/growth">Open Growth</Link>
          </FlowButton>
        </div>
      </FlowCard>
    );
  }
  return (
    <FlowCard>
      <FlowHead icon={ShieldCheck} title={link.change ? "Confirm this change to your plan" : "Confirm your plan"}>
        {link.change ? "Your plan changes only when you enter the code below." : "Nothing is spent until you enter the code below."}
      </FlowHead>
      <div className="mt-5 grid gap-4">
        <p className={flowFacts + " text-[15px] text-foreground"}>{link.plan}</p>
        {p.dead ? (
          <FlowNotice tone="bad" role="alert">
            {p.error}
          </FlowNotice>
        ) : !p.codeAsked ? (
          <div className="grid gap-3">
            <p className="text-[15px] text-muted-foreground">We will text a six-digit code to your WhatsApp number {link.sentTo}.</p>
            <FlowButton type="button" onClick={p.onSend} disabled={p.sending}>
              Text me the code
            </FlowButton>
            {p.error ? (
              <FlowNotice tone="bad" role="alert">
                {p.error}
              </FlowNotice>
            ) : null}
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              // Enter on a box already confirming would send the single-use code twice, and the second answer ("used") would replace the first.
              if (codeIsComplete(p.code) && !p.confirming) p.onConfirm();
            }}
          >
            <label htmlFor="mandate-code" className="text-sm font-bold">
              The {CODE_LENGTH}-digit code sent to your WhatsApp {link.sentTo}
            </label>
            <Input
              id="mandate-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="h-12 w-44 rounded-xl bg-card text-lg tracking-[0.3em] tabular-nums"
              maxLength={CODE_LENGTH + 2}
              value={p.code}
              onChange={(e) => p.onCode(e.target.value)}
            />
            {p.error ? (
              <FlowNotice tone="bad" role="alert">
                {p.error}
              </FlowNotice>
            ) : null}
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <FlowButton type="submit" className="sm:flex-1" disabled={!codeIsComplete(p.code) || p.confirming}>
                {link.change ? "Confirm the change" : "Confirm and start"}
              </FlowButton>
              <FlowButton type="button" variant="ghost" className="sm:flex-1" onClick={p.onSend} disabled={p.sending}>
                Send a new code
              </FlowButton>
            </div>
          </form>
        )}
      </div>
    </FlowCard>
  );
}
