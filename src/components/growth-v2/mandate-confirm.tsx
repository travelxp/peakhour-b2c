"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const send = useMutation({ mutationFn: () => growthLinkApi.sendCode(token) });
  const confirm = useMutation({ mutationFn: (c: string) => growthLinkApi.confirm(token, cleanCode(c)) });

  const link = described.data;
  const dead = (described.isError && linkIsDead(described.error)) || (confirm.isError && linkIsDead(confirm.error));
  return (
    <div className="mx-auto grid min-h-[70vh] w-full max-w-lg content-center gap-4 px-4 py-10">
      <MandateConfirmView
        link={link}
        loading={described.isPending}
        loadError={described.isError ? linkErrorMessage(described.error) : undefined}
        codeAsked={send.isSuccess || link?.otpSent === true}
        sending={send.isPending}
        confirming={confirm.isPending}
        done={confirm.data}
        code={code}
        dead={dead}
        error={confirm.isError ? linkErrorMessage(confirm.error) : send.isError ? linkErrorMessage(send.error) : undefined}
        onCode={(v) => setCode(cleanCode(v))}
        onSend={() => send.mutate()}
        onConfirm={() => confirm.mutate(code)}
      />
    </div>
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
      <Card aria-busy="true">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">Opening your plan.</CardContent>
      </Card>
    );
  }
  if (p.loadError || !p.link) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This link can&apos;t be used</CardTitle>
          <CardDescription role="alert">{p.loadError ?? "This link is not valid."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dashboard/growth">Go to Growth</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  const { link } = p;
  if (p.done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{link.change ? "Your change is saved" : "Your plan is on"}</CardTitle>
          <CardDescription>
            {link.change
              ? "The engine now works to your new plan. Nothing else changed."
              : "The engine starts by watching and proposing. Every change waits for your approval until it has earned more, and nothing spends beyond your ceiling."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm">{link.plan}</p>
          {!link.change && !p.done.holdout.started ? (
            <p className="text-xs text-muted-foreground">Lift measurement has not started yet ({p.done.holdout.reason}). The engine will say so on Growth home.</p>
          ) : null}
          <Button asChild>
            <Link href="/dashboard/growth">Open Growth</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{link.change ? "Confirm this change to your plan" : "Confirm your plan"}</CardTitle>
        <CardDescription>
          {link.change ? "Your plan changes only when you enter the code below." : "Nothing is spent until you enter the code below."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="rounded-lg border bg-muted/40 p-3 text-sm">{link.plan}</p>
        {p.dead ? (
          <p role="alert" className="text-sm text-destructive-on-tint">
            {p.error}
          </p>
        ) : !p.codeAsked ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">We will text a six-digit code to your WhatsApp number {link.sentTo}.</p>
            <Button type="button" onClick={p.onSend} disabled={p.sending}>
              Text me the code
            </Button>
            {p.error ? (
              <p role="alert" className="text-sm text-destructive-on-tint">
                {p.error}
              </p>
            ) : null}
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (codeIsComplete(p.code)) p.onConfirm();
            }}
          >
            <label htmlFor="mandate-code" className="text-sm font-medium">
              The {CODE_LENGTH}-digit code sent to your WhatsApp {link.sentTo}
            </label>
            <Input
              id="mandate-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="w-40 text-lg tracking-[0.3em] tabular-nums"
              maxLength={CODE_LENGTH + 2}
              value={p.code}
              onChange={(e) => p.onCode(e.target.value)}
            />
            {p.error ? (
              <p role="alert" className="text-sm text-destructive-on-tint">
                {p.error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!codeIsComplete(p.code) || p.confirming}>
                {link.change ? "Confirm the change" : "Confirm and start"}
              </Button>
              <Button type="button" variant="outline" onClick={p.onSend} disabled={p.sending}>
                Send a new code
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
