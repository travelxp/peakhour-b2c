"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown, FileX2, Lock, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FlowButton, FlowCard, FlowHead, FlowNotice, FlowPage, FlowSpinner } from "@/components/marketing/flow/flow-kit";
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

/** Only an https (or http, in dev) address is ever put in an href or navigated to: the api hands back a signed storage URL, never a script. */
export function safeFileUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export type ShareView =
  | { step: "loading" }
  | { step: "ready"; passwordRequired: boolean; retentionDays: number; wrongPassword?: boolean; locked?: boolean; failed?: boolean }
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
      <FlowCard aria-busy="true">
        <h1 className="sr-only">Shared file</h1>
        <p role="status" className="flex items-center justify-center gap-2.5 py-8 text-sm text-muted-foreground">
          <FlowSpinner />
          Checking this link.
        </p>
      </FlowCard>
    );
  }
  if (view.step === "gone" || view.step === "error") {
    return (
      <FlowCard>
        <FlowHead icon={FileX2} tone={view.step === "gone" ? "warn" : "bad"} title={view.step === "gone" ? "This link can't be used" : "This file isn't available"}>
          <span role="alert">{view.step === "gone" ? GONE_TEXT : ERROR_TEXT}</span>
        </FlowHead>
      </FlowCard>
    );
  }
  if (view.step === "opened") {
    return (
      <FlowCard>
        <FlowHead icon={FileDown} tone="ok" title="Your file is on its way">
          {view.name} should open or download now. If it does not, use the button below.
        </FlowHead>
        <div className="mt-5 grid gap-3">
          <FlowButton asChild>
            <a href={safeFileUrl(view.url) ?? "#"} rel="noreferrer">Open file</a>
          </FlowButton>
          {view.retentionDays > 0 ? <p className="text-sm text-muted-foreground">{visitorNotice(view.retentionDays)}</p> : null}
        </div>
      </FlowCard>
    );
  }
  const needsPassword = view.passwordRequired;
  return (
    <FlowCard>
      <FlowHead
        icon={needsPassword ? Lock : ShieldCheck}
        title={needsPassword ? "Enter the password to open this file" : "Someone shared a file with you"}
      >
        {/* The notice is part of the page, visible before anything can be pressed. */}
        <span data-testid="visitor-notice">{visitorNotice(view.retentionDays)}</span>
      </FlowHead>
      <div className="mt-5 grid gap-3">
        {view.locked ? (
          <FlowNotice tone="bad" role="alert">{LOCKED_TEXT}</FlowNotice>
        ) : (
          <>
            {needsPassword ? (
              <div className="grid gap-1.5">
                <label htmlFor="share-password" className="text-sm font-bold">Password</label>
                <Input
                  id="share-password"
                  type="password"
                  autoComplete="off"
                  value={password}
                  className="h-12 rounded-xl bg-card text-base"
                  onChange={(e) => onPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy && password.length > 0) onOpen();
                  }}
                />
                {view.wrongPassword ? <FlowNotice tone="bad" role="alert" className="mt-1">That password isn’t right. Try again.</FlowNotice> : null}
              </div>
            ) : null}
            {view.failed ? <FlowNotice tone="bad" role="alert">{ERROR_TEXT}</FlowNotice> : null}
            <FlowButton onClick={onOpen} disabled={busy || (needsPassword && password.length === 0)}>
              {busy ? "Opening." : "Open file"}
            </FlowButton>
          </>
        )}
      </div>
    </FlowCard>
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
  // A ref, not the state: two quick triggers (Enter then a click) must not both send the POST, which records twice and counts two tries.
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, [token]);

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
    if (inFlight.current || view.step !== "ready") return;
    inFlight.current = true;
    setBusy(true);
    const r = await open(token, view.passwordRequired ? password : undefined);
    inFlight.current = false;
    // The visitor left, or the link changed, while the request was out: do not move the browser to a file they walked away from.
    if (!alive.current) return;
    setBusy(false);
    if (r.kind === "opened" && safeFileUrl(r.url) === null) {
      setView({ ...view, failed: true });
    } else if (r.kind === "opened") {
      setView({ step: "opened", url: r.url, name: r.name, retentionDays: r.retentionDays || view.retentionDays });
      navigate(r.url);
    } else if (r.kind === "password") {
      setView({ step: "ready", passwordRequired: true, retentionDays: r.retentionDays || view.retentionDays, wrongPassword: r.wrong });
      setPassword("");
    } else if (r.kind === "locked") {
      setView({ step: "ready", passwordRequired: true, retentionDays: r.retentionDays || view.retentionDays, locked: true });
    } else if (r.kind === "gone") {
      setView({ step: "gone" });
    } else {
      // A blip is not the end of the link: keep the page and the password box, say so, and let them press again.
      setView({ ...view, failed: true });
    }
  }

  return (
    <FlowPage>
      <SharePageView view={view} password={password} busy={busy} onPassword={setPassword} onOpen={onOpen} />
    </FlowPage>
  );
}
