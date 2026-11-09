"use client";

import { useMemo, useState } from "react";
import { UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDeskSettings, useDeskTags, useDeskTeam, useSaveDeskSettings, useTagAdmin } from "@/hooks/use-inbox-desk";
import { useInsights } from "@/hooks/use-insights";
import { actionError } from "@/lib/inbox-customer";
import { useAuth } from "@/providers/auth-provider";
import {
  AWAY_MAX,
  AUTO_CLOSE_MAX_DAYS,
  ROUTING_CHANNELS,
  ROUTING_CHANNEL_LABEL,
  TAG_LIMIT,
  TAG_NAME_MAX,
  WEEK,
  awayPreview,
  canManageDesk,
  createFlightGuard,
  formFromSettings,
  pruneAvailable,
  tagCountLine,
  tagNameError,
  toggleAvailable,
  validateForm,
  type DeskForm,
  type DeskTag,
  type TeamMemberRef,
} from "@/lib/inbox-desk";

/**
 * Inbox settings > Team desk (I3a): the first-reply target, business hours and the away line, round-robin, and the tags. Owners and
 * admins edit; everyone else reads it (the controls are not drawn, the values are). A save that the api refuses shows the api's own
 * sentence.
 */

export const TEAM_DESK_READONLY_NOTE = "Only owners and admins can change these settings.";

export function TeamDeskFormView({
  form,
  onChange,
  canEdit,
  team,
  defaults,
  error,
  saving,
  onSave,
  zones,
  tags,
  topics,
}: {
  form: DeskForm;
  onChange: (next: DeskForm) => void;
  canEdit: boolean;
  team: readonly TeamMemberRef[];
  defaults: { awayMessage: string; opensToken: string };
  /** The first problem with the form, or the api's refusal. */
  error: string | null;
  saving: boolean;
  onSave: () => void;
  zones: readonly string[];
  /** SA-10: the business's tags and the Insights topics a rule can name. Optional, so a caller that predates them still renders. */
  tags?: readonly DeskTag[];
  topics?: ReadonlyArray<{ key: string; title: string }>;
}) {
  const set = (patch: Partial<DeskForm>) => onChange({ ...form, ...patch });
  const tagList = tags ?? [];
  // the topics Insights has seen, plus any a saved rule already names (so a rule never shows blank)
  const topicList = [...(topics ?? []), ...form.smartTagRules.filter((r) => r.topic && !(topics ?? []).some((t) => t.key === r.topic)).map((r) => ({ key: r.topic, title: r.topic }))];
  const usedChannels = new Set(form.routingRules.map((r) => r.channel));
  const freeChannels = ROUTING_CHANNELS.filter((c) => !usedChannels.has(c));
  const disabled = !canEdit || saving;
  const preview = awayPreview(form.awayMessage, defaults.awayMessage, defaults.opensToken);
  return (
    <div className="space-y-5 text-sm" data-testid="team-desk-form">
      {!canEdit && <p className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">{TEAM_DESK_READONLY_NOTE}</p>}

      <div className="space-y-1.5">
        <Label htmlFor="desk-first-reply">First-reply target (minutes)</Label>
        <Input
          id="desk-first-reply"
          inputMode="numeric"
          value={form.firstResponseMinutes}
          disabled={disabled}
          onChange={(e) => set({ firstResponseMinutes: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })}
          className="h-8 w-28"
        />
        <p className="text-xs text-muted-foreground">
          How long a shopper should wait for a person. The timer on a conversation that needs you turns amber at half of this and red at this, and counts only the time your team is open.
        </p>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="desk-hours-on">Business hours</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">Timers pause while your team is closed, and a shopper handed to your team is told when you open.</p>
          </div>
          <Switch id="desk-hours-on" checked={form.hoursEnabled} disabled={disabled} onCheckedChange={(v) => set({ hoursEnabled: v })} />
        </div>
        {form.hoursEnabled && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="desk-zone">Timezone</Label>
              <select
                id="desk-zone"
                value={form.timezone}
                disabled={disabled}
                onChange={(e) => set({ timezone: e.target.value })}
                className="h-8 w-full rounded-md border bg-background px-2 text-xs"
              >
                {(zones.includes(form.timezone) ? zones : [form.timezone, ...zones]).map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <ul className="space-y-1.5">
              {form.days.map((d, i) => {
                const label = WEEK.find((w) => w.day === d.day)?.label ?? "";
                const update = (patch: Partial<typeof d>) => set({ days: form.days.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <li key={d.day} className="flex flex-wrap items-center gap-2">
                    <span className="w-24 text-xs font-medium">{label}</span>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch size="sm" checked={!d.closed} disabled={disabled} aria-label={`${label} open`} onCheckedChange={(v) => update({ closed: !v })} />
                      {d.closed ? "Closed" : "Open"}
                    </label>
                    {!d.closed && (
                      <>
                        <input type="time" aria-label={`${label} opens`} value={d.open} disabled={disabled} onChange={(e) => update({ open: e.target.value })} className="rounded-md border bg-background px-1.5 py-0.5 text-xs" />
                        <span className="text-xs text-muted-foreground">to</span>
                        <input type="time" aria-label={`${label} closes`} value={d.close} disabled={disabled} onChange={(e) => update({ close: e.target.value })} className="rounded-md border bg-background px-1.5 py-0.5 text-xs" />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-1.5 border-t pt-4">
        <Label htmlFor="desk-away">Away message</Label>
        <Textarea
          id="desk-away"
          value={form.awayMessage}
          disabled={disabled}
          maxLength={AWAY_MAX}
          placeholder={defaults.awayMessage}
          onChange={(e) => set({ awayMessage: e.target.value })}
          className="min-h-16 text-xs"
        />
        <p className="text-xs text-muted-foreground">
          When the assistant hands a conversation to your team outside your hours, the shopper reads this. Use {defaults.opensToken} where the time you next open should go. Leave it empty to use: {defaults.awayMessage}
        </p>
        <p className="rounded-md bg-muted/40 p-2 text-xs" data-testid="away-preview">
          <span className="font-medium">Preview: </span>
          {preview}
        </p>
      </div>

      <div className="space-y-2 border-t pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="desk-rr">Take turns on new conversations</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">When the assistant hands a conversation to your team, it goes to the next available teammate. Off by default.</p>
          </div>
          <Switch id="desk-rr" checked={form.autoAssign} disabled={disabled} onCheckedChange={(v) => set({ autoAssign: v })} />
        </div>
        {form.autoAssign && (
          <fieldset className="space-y-1">
            <legend className="text-xs text-muted-foreground">Who is available</legend>
            {team.length === 0 && <p className="text-xs text-muted-foreground">No teammates with Editor access or above yet.</p>}
            {team.map((m) => (
              <label key={m.userId} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.availableUserIds.includes(m.userId)} disabled={disabled} onChange={() => set({ availableUserIds: toggleAvailable(form.availableUserIds, m.userId) })} />
                {m.name}
              </label>
            ))}
            {form.availableUserIds.length === 0 && <p className="text-xs text-muted-foreground">Choose at least one teammate, or conversations stay unassigned.</p>}
          </fieldset>
        )}
      </div>

      <div className="space-y-2 border-t pt-4" data-testid="routing-section">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="desk-routing">Route by channel</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Send a channel&apos;s new conversations to its own people, taking turns among them. A channel with no people named uses the turns above. Off by default.
            </p>
          </div>
          <Switch id="desk-routing" checked={form.routing} disabled={disabled} onCheckedChange={(v) => set({ routing: v })} />
        </div>
        {form.routing && (
          <div className="space-y-2">
            {form.routingRules.map((rule, i) => (
              <fieldset key={rule.channel} className="space-y-1 rounded-md border p-2">
                <legend className="px-1 text-xs font-medium">{ROUTING_CHANNEL_LABEL[rule.channel]}</legend>
                {team.map((m) => (
                  <label key={m.userId} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={rule.userIds.includes(m.userId)}
                      disabled={disabled}
                      onChange={() => set({ routingRules: form.routingRules.map((r, j) => (j === i ? { ...r, userIds: toggleAvailable(r.userIds, m.userId) } : r)) })}
                    />
                    {m.name}
                  </label>
                ))}
                {rule.userIds.length === 0 && <p className="text-xs text-muted-foreground">Choose at least one teammate, or remove this channel.</p>}
                {canEdit && (
                  <Button size="xs" variant="ghost" disabled={disabled} onClick={() => set({ routingRules: form.routingRules.filter((_, j) => j !== i) })}>
                    Remove {ROUTING_CHANNEL_LABEL[rule.channel]}
                  </Button>
                )}
              </fieldset>
            ))}
            {canEdit && freeChannels.length > 0 && (
              <select
                aria-label="Add a channel"
                value=""
                disabled={disabled}
                onChange={(e) => {
                  const channel = ROUTING_CHANNELS.find((c) => c === e.target.value);
                  if (channel) set({ routingRules: [...form.routingRules, { channel, userIds: [] }] });
                }}
                className="h-8 rounded-md border bg-background px-2 text-xs"
              >
                <option value="">Add a channel…</option>
                {freeChannels.map((c) => (
                  <option key={c} value={c}>
                    {ROUTING_CHANNEL_LABEL[c]}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t pt-4" data-testid="autoclose-section">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="desk-autoclose">Close quiet conversations</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mark a conversation Done when nobody has written in it for a number of days. The customer is told nothing, and if they write again it opens again. Off by default.
            </p>
          </div>
          <Switch id="desk-autoclose" checked={form.autoClose} disabled={disabled} onCheckedChange={(v) => set({ autoClose: v })} />
        </div>
        {form.autoClose && (
          <div className="flex items-center gap-2 text-xs">
            <Label htmlFor="desk-autoclose-days">Close after</Label>
            <Input
              id="desk-autoclose-days"
              inputMode="numeric"
              value={form.autoCloseDays}
              disabled={disabled}
              onChange={(e) => set({ autoCloseDays: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) })}
              className="h-8 w-20"
              aria-describedby="desk-autoclose-max"
            />
            <span id="desk-autoclose-max">days (1 to {AUTO_CLOSE_MAX_DAYS})</span>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t pt-4" data-testid="smarttags-section">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="desk-smarttags">Tag conversations by topic</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When Insights finds a topic in a conversation, add the tag you pick. It only adds tags: removing one by hand sticks. Off by default.
            </p>
          </div>
          <Switch id="desk-smarttags" checked={form.smartTags} disabled={disabled} onCheckedChange={(v) => set({ smartTags: v })} />
        </div>
        {form.smartTags && (
          <div className="space-y-2">
            {tagList.length === 0 && <p className="text-xs text-muted-foreground">Create a tag below first, then pick it here.</p>}
            {form.smartTagRules.map((rule, i) => (
              <div key={`${rule.topic}-${i}`} className="flex flex-wrap items-center gap-1.5">
                <select
                  aria-label="Topic"
                  value={rule.topic}
                  disabled={disabled}
                  onChange={(e) => set({ smartTagRules: form.smartTagRules.map((r, j) => (j === i ? { ...r, topic: e.target.value } : r)) })}
                  className="h-8 max-w-48 rounded-md border bg-background px-2 text-xs"
                >
                  <option value="">Pick a topic…</option>
                  {topicList.map((t) => (
                    <option key={t.key} value={t.key} disabled={t.key !== rule.topic && form.smartTagRules.some((r) => r.topic === t.key)}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">gets</span>
                <select
                  aria-label="Tag"
                  value={rule.tagId}
                  disabled={disabled}
                  onChange={(e) => set({ smartTagRules: form.smartTagRules.map((r, j) => (j === i ? { ...r, tagId: e.target.value } : r)) })}
                  className="h-8 max-w-40 rounded-md border bg-background px-2 text-xs"
                >
                  <option value="">Pick a tag…</option>
                  {tagList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {canEdit && (
                  <Button size="xs" variant="ghost" disabled={disabled} aria-label="Remove this automatic tag" onClick={() => set({ smartTagRules: form.smartTagRules.filter((_, j) => j !== i) })}>
                    Remove
                  </Button>
                )}
              </div>
            ))}
            {canEdit && form.smartTagRules.length < 50 && (
              <Button size="xs" variant="outline" disabled={disabled} onClick={() => set({ smartTagRules: [...form.smartTagRules, { topic: "", tagId: "" }] })}>
                Add an automatic tag
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {canEdit && (
        <Button size="sm" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save team desk settings"}
        </Button>
      )}
    </div>
  );
}

/** Tag management: create, rename, delete, and how many of the 30 are used. Immediate actions, each with its own result. */
export function TagManagerView({
  tags,
  canEdit,
  busy,
  error,
  onCreate,
  onRename,
  onDelete,
}: {
  tags: readonly DeskTag[];
  canEdit: boolean;
  busy: boolean;
  error: string | null;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const full = tags.length >= TAG_LIMIT;
  return (
    <div className="space-y-2 border-t pt-4" data-testid="tag-manager">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Tags</h3>
        <span className="text-xs text-muted-foreground" data-testid="tag-count">
          {tagCountLine(tags.length)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Label conversations your own way, then filter the list by tag. Deleting a tag removes it from every conversation.</p>
      {tags.length === 0 && <p className="text-xs text-muted-foreground">No tags yet.</p>}
      <ul className="space-y-1">
        {tags.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-xs">
            {editing?.id === t.id ? (
              <>
                <Input value={editing.name} maxLength={TAG_NAME_MAX} aria-label={`Rename ${t.name}`} onChange={(e) => setEditing({ id: t.id, name: e.target.value })} className="h-7 text-xs" />
                <Button
                  size="xs"
                  disabled={busy}
                  onClick={async () => {
                    const err = tagNameError(editing.name, tags, t.id);
                    if (err) return void setLocalError(err);
                    setLocalError(null);
                    if (await onRename(t.id, editing.name)) setEditing(null);
                  }}
                >
                  Save
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {canEdit &&
                  (deleting === t.id ? (
                    <>
                      <Button
                        size="xs"
                        variant="destructive"
                        disabled={busy}
                        onClick={async () => {
                          await onDelete(t.id);
                          setDeleting(null);
                        }}
                      >
                        Delete tag
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setDeleting(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="xs" variant="ghost" onClick={() => setEditing({ id: t.id, name: t.name })}>
                        Rename
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setDeleting(t.id)}>
                        Delete
                      </Button>
                    </>
                  ))}
              </>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="flex gap-1.5">
          <Input value={name} maxLength={TAG_NAME_MAX} placeholder={full ? `You have ${TAG_LIMIT} tags` : "New tag"} aria-label="New tag name" disabled={full || busy} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
          <Button
            size="sm"
            variant="outline"
            disabled={full || busy || !name.trim()}
            onClick={async () => {
              const err = tagNameError(name, tags);
              if (err) return void setLocalError(err);
              setLocalError(null);
              if (await onCreate(name)) setName("");
            }}
          >
            Add tag
          </Button>
        </div>
      )}
      {full && <p className="text-xs text-muted-foreground">{TAG_LIMIT} is the most a business can have. Delete a tag you no longer use to add another.</p>}
      {(localError ?? error) && (
        <p role="alert" className="text-xs text-destructive">
          {localError ?? error}
        </p>
      )}
    </div>
  );
}

function useZones(): string[] {
  return useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Dubai"];
    }
  }, []);
}

export function TeamDeskCard({ role }: { role: string | null }) {
  const { user } = useAuth();
  const settings = useDeskSettings();
  const team = useDeskTeam();
  const tags = useDeskTags();
  const save = useSaveDeskSettings();
  const admin = useTagAdmin();
  const zones = useZones();
  // the topics Insights has found, for the automatic-tag rules (SA-10). A failed read just leaves the list short.
  const insights = useInsights();
  const topics = useMemo(() => (insights.data?.items ?? []).map((i) => ({ key: i.key, title: i.title })), [insights.data]);
  const canEdit = canManageDesk(role);
  // ★DEFAULTS TO THE PERSON'S OWN Settings > Preferences TIMEZONE, then the browser's, for a business that has set none
  const fallbackZone = user?.preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [edited, setEdited] = useState<DeskForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const saveGuard = useState(createFlightGuard)[0];
  const tagGuard = useState(createFlightGuard)[0];

  const data = settings.data;
  if (settings.isError) return <p className="text-sm text-muted-foreground">Couldn&apos;t load the team desk settings. Reload the page to try again.</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  // once the teammates are known, a saved name that is no longer one of them is not shown or sent
  const base = formFromSettings(data.settings, fallbackZone);
  const form = team.data ? pruneAvailable(edited ?? base, team.data.team) : (edited ?? base);

  async function onSave() {
    const problem = validateForm(form);
    if (problem) return void setError(problem);
    setError(null);
    await saveGuard.run(async () => {
      try {
        await save.mutateAsync(form);
        setEdited(null);
        toast.success("Team desk settings saved.");
      } catch (e) {
        // the api's own sentence for a refusal (it names the fix)
        setError(actionError(e, "Saving the team desk settings"));
      }
    });
  }

  const tagAction = async (fn: () => Promise<unknown>, what: string): Promise<boolean> => {
    let okay = false;
    await tagGuard.run(async () => {
      try {
        await fn();
        setTagError(null);
        okay = true;
      } catch (e) {
        setTagError(actionError(e, what));
      }
    });
    return okay;
  };

  return (
    <div className="space-y-5">
      <TeamDeskFormView
        form={form}
        onChange={(next) => {
          setEdited(next);
          setError(null);
        }}
        canEdit={canEdit}
        team={team.data?.team ?? []}
        defaults={data.defaults}
        error={error}
        saving={save.isPending}
        onSave={() => void onSave()}
        zones={zones}
        tags={tags.data?.tags ?? []}
        topics={topics}
      />
      <TagManagerView
        tags={tags.data?.tags ?? []}
        canEdit={canEdit}
        busy={admin.create.isPending || admin.rename.isPending || admin.remove.isPending}
        error={tagError}
        onCreate={(name) => tagAction(() => admin.create.mutateAsync(name), "Creating the tag")}
        onRename={(id, name) => tagAction(() => admin.rename.mutateAsync({ id, name }), "Renaming the tag")}
        onDelete={async (id) => void (await tagAction(() => admin.remove.mutateAsync(id), "Deleting the tag"))}
      />
    </div>
  );
}

/** The "Team desk" button beside Manage, and the sheet it opens. Shown to every role: a teammate reads the settings, an admin edits them. */
export function TeamDeskSheet({ role }: { role: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="shrink-0">
          <UsersRound className="size-4" />
          Team desk
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Team desk</SheetTitle>
          <SheetDescription>How quickly your team replies, when it is open, and how conversations are shared out.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{open && <TeamDeskCard role={role} />}</div>
      </SheetContent>
    </Sheet>
  );
}
