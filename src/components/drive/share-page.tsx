"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchSharePage, openSharedFile, type SharePageState } from "@/lib/api/drive-share";
import { ERROR_TEXT, GONE_TEXT, LOCKED_TEXT, visitorNotice } from "@/lib/drive-share-copy";

/**
 * The page a Drive share link lands on: `/share/<token>` (owner decision 2026-11-04). PUBLIC: the person has no Peakhour account.
 *
 * THE NOTICE COMES BEFORE THE FILE. The page first asks the api what the link is (a GET that records nothing and serves nothing) and
 * shows "Opening this link records your IP address and device. We keep these for N days." from the number the api returns. Only then
 * is there a button; only pressing it sends the POST that records the visit and returns a short-lived signed URL; and only then does
 * the browser go to the file. The notice is on the page itself, not behind a click, and the page never navigates to a file on its own.
 * NO NUMBER, NO BUTTON: if the api cannot say how long it keeps an address, the page says the file is unavailable instead of opening it.
 */

export type ShareView =
  | { step: "loading" }
  | { step: "ready"; passwordRequired: boolean; retentionDays: number; wrongPassword?: boolean; locked?: boolean }
  | { step: "opened"; url: string; name: string; retentionDays: number }
  | { step: "gone" }
  | { step: "error" };

export interface SharePageViewProps {
  view: ShareView;
  password: string;
  busy: boolean;
  onPassword: (v: string) => void;
  onOpen: () => void;
}

export function SharePageView({ view, password, busy, onPassword, onOpen }: SharePageViewProps) {
  if (view.step === "loading") {
    return (
      <Card aria-busy="true">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">Checking this link.</CardContent>
      </Card>
    );
  }
  if (view.step === "gone" || view.step === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{view.step === "gone" ? "This link can't be used" : "This file isn't available"}</CardTitle>
          <CardDescription role="alert">{view.step === "gone" ? GONE_TEXT : ERROR_TEXT}</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (view.step === "opened") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your file is on its way</CardTitle>
          <CardDescription>{view.name} should open or download now. If it does not, use the button below.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button asChild>
            <a href={view.url} rel="noreferrer">Open file</a>
          </Button>
          {view.retentionDays > 0 ? <p className="text-xs text-muted-foreground">{visitorNotice(view.retentionDays)}</p> : null}
        </CardContent>
      </Card>
    );
  }
  const needsPassword = view.passwordRequired;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{needsPassword ? "Enter the password to open this file" : "Someone shared a file with you"}</CardTitle>
        {/* The notice is part of the page, visible before anything can be pressed. */}
        <CardDescription data-testid="visitor-notice">{visitorNotice(view.retentionDays)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {view.locked ? (
          <p role="alert" className="text-sm text-destructive-on-tint">{LOCKED_TEXT}</p>
        ) : (
          <>
            {needsPassword ? (
              <div className="grid gap-1.5">
                <label htmlFor="share-password" className="text-sm font-medium">Password</label>
                <Input
                  id="share-password"
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => onPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy && password.length > 0) onOpen();
                  }}
                />
                {view.wrongPassword ? <p role="alert" className="text-sm text-destructive-on-tint">That password is not right.</p> : null}
              </div>
            ) : null}
            <Button onClick={onOpen} disabled={busy || (needsPassword && password.length === 0)}>
              {busy ? "Opening." : "Open file"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export interface SharePageProps {
  token: string;
  /** Test seams: the two api calls and the browser's navigation. */
  load?: (token: string) => Promise<SharePageState>;
  open?: typeof openSharedFile;
  navigate?: (url: string) => void;
}

export function SharePage({ token, load = fetchSharePage, open = openSharedFile, navigate = (url) => window.location.assign(url) }: SharePageProps) {
  const [view, setView] = useState<ShareView>({ step: "loading" });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void load(token).then((s) => {
      if (cancelled) return;
      if (s.kind === "ready") setView({ step: "ready", passwordRequired: s.passwordRequired, retentionDays: s.retentionDays });
      else setView({ step: s.kind });
    });
    return () => {
      cancelled = true;
    };
  }, [token, load]);

  async function onOpen() {
    if (busy || view.step !== "ready") return;
    setBusy(true);
    const r = await open(token, view.passwordRequired ? password : undefined);
    setBusy(false);
    if (r.kind === "opened") {
      setView({ step: "opened", url: r.url, name: r.name, retentionDays: r.retentionDays || view.retentionDays });
      navigate(r.url);
    } else if (r.kind === "password") {
      setView({ step: "ready", passwordRequired: true, retentionDays: r.retentionDays || view.retentionDays, wrongPassword: r.wrong });
      setPassword("");
    } else if (r.kind === "locked") {
      setView({ step: "ready", passwordRequired: true, retentionDays: r.retentionDays || view.retentionDays, locked: true });
    } else {
      setView({ step: r.kind });
    }
  }

  return (
    <div className="mx-auto grid min-h-[70vh] w-full max-w-lg content-center gap-4 px-4 py-10">
      <SharePageView view={view} password={password} busy={busy} onPassword={setPassword} onOpen={onOpen} />
    </div>
  );
}
