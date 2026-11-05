"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExtraPanel, type PanelContext } from "@/components/presence/edit/extra-panel";
import { addableServices, inFlightChanges, serviceKey, serviceLabel, servicesValue, withService, withoutService, type ServiceEntry, type ServicesResponse } from "@/lib/presence-extras";

function ServicesBody({ ctx }: { ctx: PanelContext<ServicesResponse> }) {
  const { data, label, access, busy, submit, changes, network } = ctx;
  const [draft, setDraft] = useState<ServiceEntry[] | null>(null);
  const [pick, setPick] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = draft ?? data.current;
  const waiting = inFlightChanges(changes, network, "services").length > 0;
  // Changing is withheld when the network's choices did not load (nothing can be added), but a service can still be removed.
  const canEdit = access.mode === "edit" && !waiting;
  const addable = addableServices(list, data.options);

  async function review() {
    const built = servicesValue(data.current, list);
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
      {data.optionsNotice && <p className="text-xs text-warning-on-tint">{data.optionsNotice} Adding a service is not available until the list loads.</p>}
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      {access.mode === "view" && <p className="text-xs text-muted-foreground">{access.why}</p>}
      {waiting && <p className="text-xs text-muted-foreground">A change to your services is waiting below. Approve or decline it before making another.</p>}
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">You have no services on {label} yet.</p>
      ) : (
        <ul className="divide-y">
          {list.map((s) => (
            <li key={serviceKey(s)} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm">
                {serviceLabel(s, data.options)}
                {s.description ? <span className="text-xs text-muted-foreground"> ({s.description})</span> : null}
              </span>
              {canEdit && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setDraft(withoutService(list, serviceKey(s)))}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && addable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="service-pick">
            Add a service
          </label>
          <select id="service-pick" className="h-9 rounded-md border bg-background px-2 text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Add a service</option>
            {addable.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={!pick || busy} onClick={() => { setDraft(withService(list, pick)); setPick(""); }}>
            Add
          </Button>
        </div>
      )}
      {draft && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">The whole list is sent, so any service you leave out is removed.</p>
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

/** Your services. Drawn only for a network that declares them. The list is whole: services you do not touch are kept exactly as the network holds them. */
export function ServicesCard({ location, network }: { location?: string | undefined; network?: string | undefined }) {
  return (
    <ExtraPanel<ServicesResponse> field="services" location={location} network={network} title="Your services" blurb="The services you offer, from the list for your kind of business." what="services" itemCount={(d) => d.current.length}>
      {(ctx) => <ServicesBody ctx={ctx} />}
    </ExtraPanel>
  );
}
