"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExtraPanel, type PanelContext } from "@/components/presence/edit/extra-panel";
import { useBasedDraft } from "@/hooks/use-presence-extras";
import {
  draftDroppedWords,
  detailLabel,
  detailLine,
  detailsValue,
  inFlightChanges,
  offeredDetails,
  waitingWords,
  withChoice,
  withDetail,
  withoutDetail,
  type AttributeEntry,
  type AttributeOption,
  type AttributesResponse,
} from "@/lib/presence-extras";

function Editor({ option, entry, onSet, onChoice, onClear, disabled }: {
  option: AttributeOption;
  entry: AttributeEntry | undefined;
  onSet: (e: AttributeEntry) => void;
  onChoice: (value: string, state: "set" | "unset" | "unknown") => void;
  onClear: () => void;
  disabled: boolean;
}) {
  const id = `detail-${option.id}`;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <label htmlFor={id} className="text-sm">
        {option.label}
        {option.group ? <span className="text-xs text-muted-foreground"> ({option.group})</span> : null}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {option.kind === "yesno" && (
          <select id={id} className="h-9 rounded-md border bg-background px-2 text-sm" disabled={disabled} value={entry?.kind === "yesno" ? String(entry.value) : ""} onChange={(e) => (e.target.value ? onSet({ id: option.id, kind: "yesno", value: e.target.value === "true" }) : onClear())}>
            <option value="">Not said</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        )}
        {option.kind === "choice" && entry?.kind === "choice" && entry.values.length > 1 && (
          // Several values held: every one is kept. Shown, and cleared as a whole; choosing one would drop the rest.
          <>
            <span id={id} className="text-sm">{entry.values.map((v) => option.values.find((x) => x.value === v)?.label ?? v).join(", ")}</span>
            <Button size="sm" variant="outline" disabled={disabled} onClick={onClear}>
              Clear
            </Button>
          </>
        )}
        {option.kind === "choice" && !(entry?.kind === "choice" && entry.values.length > 1) && (
          <select id={id} className="h-9 rounded-md border bg-background px-2 text-sm" disabled={disabled} value={entry?.kind === "choice" ? (entry.values[0] ?? "") : ""} onChange={(e) => (e.target.value ? onSet({ id: option.id, kind: "choice", values: [e.target.value] }) : onClear())}>
            <option value="">Not said</option>
            {option.values.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        {option.kind === "link" && entry?.kind === "link" && entry.values.length > 1 && (
          <>
            <span id={id} className="break-all text-sm">{entry.values.join(", ")}</span>
            <Button size="sm" variant="outline" disabled={disabled} onClick={onClear}>
              Clear
            </Button>
          </>
        )}
        {option.kind === "link" && !(entry?.kind === "link" && entry.values.length > 1) && (
          <Input id={id} className="w-64" placeholder="https://" disabled={disabled} value={entry?.kind === "link" ? (entry.values[0] ?? "") : ""} onChange={(e) => (e.target.value ? onSet({ id: option.id, kind: "link", values: [e.target.value] }) : onClear())} />
        )}
        {option.kind === "choices" &&
          option.values.map((v) => {
            const now = entry?.kind === "choices" ? (entry.set.includes(v.value) ? "set" : entry.unset.includes(v.value) ? "unset" : "unknown") : "unknown";
            return (
              <label key={v.value} className="flex items-center gap-1 text-xs">
                {v.label}
                <select aria-label={`${option.label}: ${v.label}`} className="h-8 rounded-md border bg-background px-1 text-xs" disabled={disabled} value={now} onChange={(e) => onChoice(v.value, e.target.value as "set" | "unset" | "unknown")}>
                  <option value="unknown">Not said</option>
                  <option value="set">Yes</option>
                  <option value="unset">No</option>
                </select>
              </label>
            );
          })}
      </div>
    </li>
  );
}

function DetailsBody({ ctx }: { ctx: PanelContext<AttributesResponse> }) {
  const { data, label, access, busy, submit, changes, network, can } = ctx;
  const d = useBasedDraft<AttributeEntry[]>(data.base);
  const draft = d.draft;
  const setDraft = (next: AttributeEntry[] | null) => (next ? d.set(next) : d.clear());
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = draft ?? data.current;
  const waiting = inFlightChanges(changes, network, "attributes").length > 0;
  // A deprecated detail is never offered: the network accepts an update to one and does not save it.
  const offered = offeredDetails(data.options);
  const canEdit = access.mode === "edit" && !waiting && offered.length > 0;
  const edit = (next: AttributeEntry[]) => setDraft(next);

  async function review() {
    const built = detailsValue(data.current, list);
    if (!built.ok) return setMessage(built.message);
    setMessage(null);
    const r = await submit(built.value, d.base ?? data.base);
    if (r.ok) {
      setNotice(r.message);
      setDraft(null);
    } else {
      setMessage(r.message);
      if (r.stale) setDraft(null);
    }
  }

  const offeredIds = new Set(offered.map((o) => o.id));
  // What the network holds that the list no longer offers (or marks deprecated): shown, and removable, never editable.
  const heldOther = list.filter((e) => !offeredIds.has(e.id));

  return (
    <>
      {data.optionsNotice && <p className="text-xs text-warning-on-tint">{data.optionsNotice} Changing details is not available until the list loads.</p>}
      {d.dropped && <p role="status" className="text-xs text-warning-on-tint">{draftDroppedWords(label, "details")}</p>}
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      {access.mode === "view" && <p className="text-xs text-muted-foreground">{access.why}</p>}
      {waiting && <p className="text-xs text-muted-foreground">{waitingWords("details", can)}</p>}
      {data.current.length === 0 && !draft && <p className="text-xs text-muted-foreground">You have no details on {label} yet.</p>}
      {canEdit ? (
        <ul className="divide-y">
          {offered.map((o) => (
            <Editor
              key={o.id}
              option={o}
              entry={list.find((e) => e.id === o.id)}
              disabled={busy}
              onSet={(e) => edit(withDetail(list, e))}
              onChoice={(value, state) => edit(withChoice(list, o.id, value, state))}
              onClear={() => edit(withoutDetail(list, o.id))}
            />
          ))}
        </ul>
      ) : (
        list.length > 0 && (
          <ul className="space-y-1 text-sm">
            {list.map((e) => (
              <li key={e.id}>{detailLine(e, data.options)}</li>
            ))}
          </ul>
        )
      )}
      {canEdit && heldOther.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">These are on your listing, but are no longer offered to change:</p>
          <ul className="space-y-1 text-sm">
            {heldOther.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span>{detailLine(e, data.options)}</span>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => edit(withoutDetail(list, e.id))} aria-label={`Remove ${detailLabel(e.id, data.options)}`}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!draft && message && (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}
      {draft && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">A detail you clear is removed, and {label} may check it before showing it.</p>
          {message && (
            <p role="alert" className="text-xs text-destructive">
              {message}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !canEdit} onClick={() => void review()}>
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

/** Details about your business (accessibility, amenities and so on): only the ones the network offers for your kind of business and country. */
export function DetailsCard({ location, network }: { location?: string | undefined; network?: string | undefined }) {
  return (
    <ExtraPanel<AttributesResponse> field="attributes" location={location} network={network} title="Your details" blurb="Facts about your business that customers look for, from the list for your kind of business and country." what="details">
      {(ctx) => <DetailsBody ctx={ctx} />}
    </ExtraPanel>
  );
}
