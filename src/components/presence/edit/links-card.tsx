"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExtraPanel, type PanelContext } from "@/components/presence/edit/extra-panel";
import { inFlightChanges, linksValue, linkTypeLabel, withLink, withoutLink, withPreferred, type ActionLink, type LinksResponse } from "@/lib/presence-extras";

function LinksBody({ ctx }: { ctx: PanelContext<LinksResponse> }) {
  const { data, label, access, busy, submit, changes, network } = ctx;
  const [draft, setDraft] = useState<ActionLink[] | null>(null);
  const [type, setType] = useState(data.types[0]?.type ?? "");
  const [uri, setUri] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = draft ?? data.current;
  const waiting = inFlightChanges(changes, network, "links").length > 0;
  const canEdit = access.mode === "edit" && !waiting;

  async function review() {
    const built = linksValue(data.current, list, data.types);
    if (!built.ok) return setMessage(built.message);
    setMessage(null);
    const r = await submit(built.value);
    if (r.ok) {
      setNotice(r.message);
      setDraft(null);
    } else setMessage(r.message);
  }

  return (
    <>
      <p className="text-xs text-muted-foreground">Links that a partner provides are not shown here and are not changed.</p>
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      {access.mode === "view" && <p className="text-xs text-muted-foreground">{access.why}</p>}
      {waiting && <p className="text-xs text-muted-foreground">A change to your links is waiting below. Approve or decline it before making another.</p>}
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">You have no booking or order links on {label} yet.</p>
      ) : (
        <ul className="divide-y">
          {list.map((l, i) => (
            <li key={`${l.type}|${l.uri}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="break-all text-sm">
                {linkTypeLabel(l.type, data.types)}: {l.uri}
                {l.preferred ? <span className="text-xs text-muted-foreground"> (preferred)</span> : null}
              </span>
              {canEdit && (
                <span className="flex gap-2">
                  {!l.preferred && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setDraft(withPreferred(list, i))}>
                      Make preferred
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setDraft(withoutLink(list, i))}>
                    Remove
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && data.types.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs" htmlFor="link-type">
              Kind of link
            </label>
            <select id="link-type" className="h-9 rounded-md border bg-background px-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              {data.types.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs" htmlFor="link-uri">
              Web address
            </label>
            <Input id="link-uri" className="w-72" placeholder="https://" value={uri} onChange={(e) => setUri(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" disabled={!type || !uri.trim() || busy} onClick={() => { setDraft(withLink(list, { type, uri: uri.trim() })); setUri(""); }}>
            Add link
          </Button>
        </div>
      )}
      {draft && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">The whole list of links is sent, so any link you leave out is removed.</p>
          {message && (
            <p role="alert" className="text-xs text-destructive">
              {message}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void review()}>
              {busy ? "Preparing..." : "Review change"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setDraft(null); setMessage(null); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Your booking and order links. Drawn only for a network that declares them. */
export function LinksCard({ location, network }: { location?: string | undefined; network?: string | undefined }) {
  return (
    <ExtraPanel<LinksResponse> field="links" location={location} network={network} title="Your links" blurb="Where customers go to book or order." what="links" itemCount={(d) => d.current.length}>
      {(ctx) => <LinksBody ctx={ctx} />}
    </ExtraPanel>
  );
}
