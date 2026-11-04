"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FileText, Loader2, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ColorRole, FontRole, KitFont, KitGuideline, KitScope, KitView, KitVoice, LogoForm } from "@/lib/api/brand-kit";
import {
  COLOR_ROLES,
  FONT_ROLES,
  LOGO_FORMS,
  colorRoleLabel,
  fontRoleLabel,
  inheritNote,
  logoAdWarning,
  logoFormLabel,
  scopeLabel,
  scopePill,
  voiceIsEmpty,
  voiceSummary,
  type KitDraft,
  type SectionKey,
} from "@/lib/brand-kit";

/**
 * The Brand Kit tab of Drive, as a pure view (Peakhour Drive B2). The container (`BrandKitTab`) owns the data, the draft and the saving; this
 * draws one state of it, so loading, error, empty, read-only, unsaved and saving can each be rendered and asserted on their own.
 *
 * Layout and copy follow the Main board's Brand Kit tab: a line about what the kit is for, a pill for who it is shared with, then Logos,
 * Colours, Fonts, Voice and Guidelines as cards.
 */

export interface BrandKitViewProps {
  /** The scope being edited, or null when this person may only look. */
  scope: KitScope | null;
  /** The scopes this person may switch between. One or none means no switch is drawn. */
  scopes: KitScope[];
  businessName: string;
  draft: KitDraft;
  /** What every generator sees: used to say a section follows the organisation. */
  effective: KitView | null;
  voice: KitVoice | null;
  websiteUrl: string | null;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  /** A business has its own kit that the person could drop to follow the organisation again. */
  hasOverride: boolean;
  /** The pre-fill review panel, drawn above the cards when there is one. */
  review: ReactNode;
  prefillBusy: boolean;
  onScope: (scope: KitScope) => void;
  onSave: () => void;
  onDiscard: () => void;
  onRevert: () => void;
  onPrefill: () => void;
  onAddLogo: () => void;
  onLogoForm: (index: number, form: LogoForm) => void;
  onRemoveLogo: (index: number) => void;
  /** Returns why the colour was refused, or null when it was added. */
  onAddColor: (hex: string, role?: ColorRole) => string | null;
  onColorRole: (index: number, role: ColorRole | undefined) => void;
  onRemoveColor: (index: number) => void;
  onAddFont: () => void;
  onFontRole: (index: number, role: FontRole) => void;
  onRemoveFont: (index: number) => void;
  onAddGuideline: () => void;
  onRemoveGuideline: (index: number) => void;
  onOpenGuideline: (g: KitGuideline) => void;
  fontHintText: string | null;
}

function Card({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {children}
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </section>
  );
}

function RoleSelect<T extends string>({
  value,
  options,
  label,
  onChange,
  none,
}: {
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  label: string;
  onChange: (v: T | undefined) => void;
  none?: string;
}) {
  const NONE = "__none__";
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : (v as T))}>
      <SelectTrigger size="sm" className="h-8 w-full text-xs" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {none && <SelectItem value={NONE}>{none}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon-xs" onClick={onClick} aria-label={label} className="shrink-0">
      <X aria-hidden="true" />
    </Button>
  );
}

function Inherit({ text }: { text: string | null }) {
  return text ? <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{text}</p> : null;
}

/** The colour box: type or paste a hex; the reason it was refused is said under the box, not lost in a toast. */
function ColorAdder({ onAdd }: { onAdd: (hex: string, role?: ColorRole) => string | null }) {
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const why = onAdd(value);
        setProblem(why);
        if (!why) setValue("");
      }}
    >
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Add a colour</span>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="#1f4d3f" className="font-mono" aria-invalid={problem ? true : undefined} />
        </label>
        <Button type="submit" variant="outline">
          <Plus aria-hidden="true" /> Add colour
        </Button>
      </div>
      {problem && (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </form>
  );
}

/** "Heading Aa" in the real font. Loads the font file once; until it loads, or if it will not, the page's own font stands in. */
function FontSample({ font, index }: { font: KitFont; index: number }) {
  const [family, setFamily] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!font.url || typeof FontFace === "undefined" || typeof document === "undefined") return;
    let cancelled = false;
    const name = `kit-font-${font.mediaId}`;
    try {
      // The constructor throws on a source it cannot parse, and that must not take the tab down: the sample just stays in the page's font.
      new FontFace(name, `url(${JSON.stringify(font.url)})`)
        .load()
        .then((loaded) => {
          if (cancelled) return;
          document.fonts.add(loaded);
          setFamily(name);
        })
        .catch(() => undefined);
    } catch {
      return;
    }
    return () => {
      cancelled = true;
    };
  }, [font.mediaId, font.url]);
  const heading = font.role === "heading";
  return (
    <div style={family ? { fontFamily: `"${family}", system-ui, sans-serif` } : undefined} data-font-sample={index}>
      <div className={heading ? "text-2xl font-semibold" : "text-[15px]"}>{heading ? "Heading Aa" : font.role === "body" ? "Body text looks like this." : "Accent text Aa"}</div>
    </div>
  );
}

export function BrandKitView(p: BrandKitViewProps) {
  const editing = p.scope !== null;
  const { draft } = p;
  const voice = voiceSummary(p.voice);
  const adWarning = logoAdWarning(draft);
  const note = (s: SectionKey) => (p.scope ? inheritNote(p.scope, s, draft, p.effective) : null);
  const kitIsEmpty = draft.logos.length + draft.colors.length + draft.fonts.length + draft.guidelines.length === 0;
  const pill = p.scope ? scopePill(p.scope, p.businessName) : "Read only";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">Every creative and ad Peakhour makes reads from here. Change it once and new work follows.</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{pill}</span>
          {editing && (
            <Button variant="outline" onClick={p.onPrefill} disabled={p.prefillBusy || !p.websiteUrl} title={p.websiteUrl ? undefined : "This business has no website address on file."}>
              {p.prefillBusy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              Read my website
            </Button>
          )}
        </div>
      </div>

      {p.scopes.length > 1 && p.scope && (
        <div role="group" aria-label="Who this kit is for" className="flex flex-wrap items-center gap-2">
          {p.scopes.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={p.scope === s}
              disabled={p.dirty && p.scope !== s}
              title={p.dirty && p.scope !== s ? "Save or discard your changes first." : undefined}
              onClick={() => p.onScope(s)}
              className={cn(
                "min-h-9 rounded-full border px-3.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                p.scope === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {scopeLabel(s, p.businessName)}
            </button>
          ))}
          {p.scope === "business" && p.hasOverride && (
            <Button variant="ghost" size="sm" onClick={p.onRevert} disabled={p.saving || p.dirty}>
              Use the organisation&apos;s kit instead
            </Button>
          )}
        </div>
      )}
      {!editing && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">You can look at the Brand Kit. An editor or admin can change it.</p>}

      {p.review}

      {editing && kitIsEmpty && !p.review && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-card p-4">
          <div>
            <div className="text-[15px] font-semibold">Your Brand Kit is empty</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.websiteUrl ? "Peakhour can read your website for colours and a logo. You review them before anything is saved." : "Add a logo and your colours below."}
            </p>
          </div>
          {p.websiteUrl && (
            <Button onClick={p.onPrefill} disabled={p.prefillBusy}>
              Start from my website
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
        <Card
          title="Logos"
          note={draft.logos.length ? draft.logos.map((l) => logoFormLabel(l.form)).join(", ") + "." : "Add the logo in each form you have. Ads use the first that fits."}
        >
          <Inherit text={note("logos")} />
          {draft.logos.length > 0 && (
            <ul className="grid grid-cols-2 gap-2">
              {draft.logos.map((l, i) => (
                <li key={l.mediaId} className="flex flex-col gap-1.5">
                  <div className="relative flex h-21 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a Drive file's public URL, already on our CDN */}
                    <img src={l.url} alt={`${l.name} (${logoFormLabel(l.form)})`} className="max-h-full max-w-full object-contain p-2" loading="lazy" />
                    {editing && (
                      <span className="absolute top-1 right-1 rounded-md bg-card/90">
                        <RemoveButton label={`Remove ${l.name}`} onClick={() => p.onRemoveLogo(i)} />
                      </span>
                    )}
                  </div>
                  {editing ? (
                    <RoleSelect
                      value={l.form}
                      options={LOGO_FORMS.map((f) => ({ value: f.form, label: f.label }))}
                      label={`Which form is ${l.name}`}
                      onChange={(v) => v && p.onLogoForm(i, v)}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{logoFormLabel(l.form)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {adWarning && (
            <p role="status" className="text-xs text-foreground">
              {adWarning}
            </p>
          )}
          {editing && (
            <Button variant="outline" size="sm" className="self-start" onClick={p.onAddLogo}>
              <Plus aria-hidden="true" /> Add a logo
            </Button>
          )}
        </Card>

        <Card title="Colours" note={draft.colors.length ? "Edit any time. Ads use them in this order." : "Read them from your website, or add your own."}>
          <Inherit text={note("colors")} />
          {draft.colors.length > 0 && (
            <ul className="grid grid-cols-2 gap-2">
              {draft.colors.map((c, i) => (
                <li key={c.hex} className="flex flex-col gap-1">
                  <div className="relative h-14 rounded-lg border" style={{ background: c.hex }} role="img" aria-label={`Colour ${c.hex}`}>
                    {editing && (
                      <span className="absolute top-1 right-1 rounded-md bg-card/90">
                        <RemoveButton label={`Remove ${c.hex}`} onClick={() => p.onRemoveColor(i)} />
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{c.hex}</span>
                  {editing ? (
                    <RoleSelect<ColorRole>
                      value={c.role}
                      options={COLOR_ROLES.map((r) => ({ value: r.role, label: r.label }))}
                      label={`What ${c.hex} is for`}
                      none="No role"
                      onChange={(v) => p.onColorRole(i, v)}
                    />
                  ) : (
                    c.role && <span className="text-xs text-muted-foreground">{colorRoleLabel(c.role)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editing && <ColorAdder onAdd={p.onAddColor} />}
        </Card>

        <Card title="Fonts" note={draft.fonts.length ? "Use only fonts you are licensed to use. A font file has to be Published to appear in ads." : undefined}>
          <Inherit text={note("fonts")} />
          {draft.fonts.map((f, i) => (
            <div key={f.mediaId} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <FontSample font={f} index={i} />
                <div className="mt-1 truncate text-xs text-muted-foreground">{f.family ?? "Font file"}</div>
              </div>
              {editing && (
                <>
                  <div className="w-28 shrink-0">
                    <RoleSelect<FontRole>
                      value={f.role}
                      options={FONT_ROLES.map((r) => ({ value: r.role, label: r.label }))}
                      label={`What ${f.family ?? "this font"} is for`}
                      onChange={(v) => v && p.onFontRole(i, v)}
                    />
                  </div>
                  <RemoveButton label={`Remove ${f.family ?? "font"} (${fontRoleLabel(f.role)})`} onClick={() => p.onRemoveFont(i)} />
                </>
              )}
            </div>
          ))}
          {draft.fonts.length === 0 && !note("fonts") && <p className="text-sm text-muted-foreground">No fonts yet. Ads and creatives use a clean default.</p>}
          {p.fontHintText && <p className="text-sm text-muted-foreground">{p.fontHintText}</p>}
          {editing && (
            <Button variant="outline" size="sm" className="self-start" onClick={p.onAddFont}>
              <Plus aria-hidden="true" /> Add a font file
            </Button>
          )}
        </Card>

        <Card title="Voice" note={voiceIsEmpty(voice) ? undefined : "From your Brand Voice. Every creative and ad reads it."}>
          {voiceIsEmpty(voice) ? (
            <p className="text-sm text-muted-foreground">No brand voice is recorded yet. Peakhour reads one from your website when a business is added.</p>
          ) : (
            <div className="flex flex-col gap-2.5 text-sm">
              {voice.tone && <p className="leading-snug">{voice.tone}</p>}
              {voice.headline && <p className="text-muted-foreground">Sounds like: “{voice.headline}”</p>}
              {voice.uses.length > 0 && <Chips label="Words we use" words={voice.uses} />}
              {voice.avoids.length > 0 && <Chips label="Words we avoid" words={voice.avoids} />}
            </div>
          )}
        </Card>

        <Card title="Guidelines" note={draft.guidelines.some((g) => g.visibility === "private") ? "Private. Shared only by expiring link." : undefined}>
          <Inherit text={note("guidelines")} />
          {draft.guidelines.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm">
              {draft.guidelines.map((g, i) => (
                <li key={g.mediaId} className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <button type="button" onClick={() => p.onOpenGuideline(g)} className="min-w-0 flex-1 truncate text-left underline-offset-4 hover:underline">
                    {g.name}
                  </button>
                  {g.visibility === "private" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Private</span>}
                  {editing && <RemoveButton label={`Remove ${g.name}`} onClick={() => p.onRemoveGuideline(i)} />}
                </li>
              ))}
            </ul>
          )}
          {draft.guidelines.length === 0 && !note("guidelines") && <p className="text-sm text-muted-foreground">Brand books and packaging rules, kept where Peakhour can read them.</p>}
          {editing && (
            <Button variant="outline" size="sm" className="self-start" onClick={p.onAddGuideline}>
              <Plus aria-hidden="true" /> Add a document
            </Button>
          )}
        </Card>
      </div>

      {p.error && (
        <p role="alert" className="text-sm text-destructive">
          {p.error}
        </p>
      )}

      {editing && p.dirty && (
        <div role="region" aria-label="Unsaved changes" className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-md">
          <span className="text-sm">
            You have changes that are not saved.
            {p.scope === "org" && <span className="text-muted-foreground"> Saving changes the kit for every business.</span>}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={p.onDiscard} disabled={p.saving}>
              Discard
            </Button>
            <Button onClick={p.onSave} disabled={p.saving}>
              {p.saving ? (
                <>
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Saving…
                </>
              ) : (
                "Save Brand Kit"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chips({ label, words }: { label: string; words: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {words.map((w) => (
          <span key={w} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

/** What the tab shows before there is a kit to draw. */
export function BrandKitSkeleton() {
  return (
    <div role="status" aria-label="Loading your Brand Kit" className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl border bg-muted motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function BrandKitLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border bg-card p-5 text-sm">
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function BrandKitOffline() {
  return (
    <div role="status" className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
      You look to be offline. Your Brand Kit will load when you are back online.
    </div>
  );
}
