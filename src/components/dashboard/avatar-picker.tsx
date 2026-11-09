"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/providers/auth-provider";
import { updateProfile } from "@/lib/auth";
import {
  CHARACTER_VARIANTS,
  MONOGRAM_VARIANTS,
  initialsOf,
  resolveAvatar,
} from "@/lib/avatars";
import { AvatarTile } from "@/components/dashboard/user-avatar";
import { cn } from "@/lib/utils";

/**
 * Settings → Your avatar. Two families, one tile each, saved on click.
 *
 * ── ★★NO SAVE BUTTON, AND THAT IS THE RIGHT CALL HERE
 *
 * Every other control on this page is a Select whose effect the user cannot see
 * until it is applied, so those batch behind "Save preferences". An avatar is
 * the opposite: the choice IS the preview, the sidebar tile updates as soon as
 * `refreshUser` lands, and a staged selection would mean the picture you are
 * looking at is not yet the picture you have. One click, one write.
 *
 * ── ★★THE PREVIEW TILES DO NOT SUBSCRIBE TO AUTH
 *
 * `AvatarTile` is pure — it takes an already-resolved avatar — which is why
 * this page can render eighteen of them without eighteen context subscriptions
 * re-rendering on every auth refresh. `UserAvatar` (the context-reading one) is
 * mounted once, in the shell.
 *
 * ── ★★AND THE WRITE SENDS THE NAME BACK
 *
 * `PUT /auth/profile` requires `name` — it is the endpoint that completes a
 * profile, not a preferences patch — so the current name is echoed. Sending
 * anything else here would rename the user as a side effect of picking a
 * picture, which is why the control is disabled outright when there is no name
 * to echo rather than defaulting one.
 */
export function AvatarPicker() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);

  const seed = user?.email ?? user?.name ?? "peakhour";
  const initials = initialsOf(user?.name, user?.email);
  const current = user?.preferences?.avatar ?? null;
  const resolved = resolveAvatar(current, seed);

  /**
   * Which tile reads as chosen.
   *
   * ★COMPARED AGAINST THE RESOLVED AVATAR, NOT THE RAW TOKEN. A user who has
   * never picked one has `avatar: null` and is shown their seeded default
   * monogram in the sidebar — so comparing tokens would leave every tile
   * unselected while the shell clearly displays one of them. The list has to
   * agree with the tile it is describing.
   */
  const selectedId = resolved.variant.id;
  const selectedFamily = resolved.family;

  async function choose(token: string) {
    if (saving || !user?.name) return;
    setSaving(token);
    try {
      await updateProfile({ name: user.name, preferences: { avatar: token } });
      await refreshUser();
    } catch {
      toast.error("Couldn't save your avatar. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  const disabled = !user?.name;

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AvatarTile
            avatar={resolved}
            initials={initials}
            className="size-11"
            glyphClassName="text-base"
          />
          <div>
            <CardTitle>Your avatar</CardTitle>
            <CardDescription>
              Shown beside your name in the sidebar and anywhere your teammates see you.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {disabled && (
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Add your name first — your avatar is saved alongside it.
          </p>
        )}

        <section className="space-y-2">
          <div>
            <p className="text-sm font-medium">Your initials</p>
            <p className="text-xs text-muted-foreground">
              {initials} on a colour of your choosing.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {MONOGRAM_VARIANTS.map((v) => {
              const token = `monogram:${v.id}`;
              const isSelected = selectedFamily === "monogram" && selectedId === v.id;
              return (
                <li key={v.id}>
                  <AvatarChoice
                    label={`Initials on ${v.label}`}
                    selected={isSelected}
                    saving={saving === token}
                    disabled={disabled}
                    onSelect={() => void choose(token)}
                  >
                    <AvatarTile
                      avatar={{ family: "monogram", variant: v }}
                      initials={initials}
                      className="size-11"
                      glyphClassName="text-sm"
                    />
                  </AvatarChoice>
                </li>
              );
            })}
          </ul>
        </section>

        <Separator />

        <section className="space-y-2">
          <div>
            <p className="text-sm font-medium">Characters</p>
            <p className="text-xs text-muted-foreground">
              Pick a face — or something that isn&rsquo;t one.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {CHARACTER_VARIANTS.map((v) => {
              const token = `character:${v.id}`;
              const isSelected = selectedFamily === "character" && selectedId === v.id;
              return (
                <li key={v.id}>
                  <AvatarChoice
                    label={v.label}
                    selected={isSelected}
                    saving={saving === token}
                    disabled={disabled}
                    onSelect={() => void choose(token)}
                  >
                    <AvatarTile
                      avatar={{ family: "character", variant: v }}
                      initials={initials}
                      className="size-11"
                      glyphClassName="text-xl"
                    />
                  </AvatarChoice>
                </li>
              );
            })}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}

/**
 * One selectable tile.
 *
 * `aria-pressed` rather than a radio group: these are eighteen buttons across
 * two labelled sections, and a single radiogroup spanning both would make the
 * arrow keys walk from a colour swatch into a character set as if they were one
 * scale. The visible ring and the check are the same state, so nothing is
 * conveyed by colour alone.
 */
function AvatarChoice({
  label,
  selected,
  saving,
  disabled,
  onSelect,
  children,
}: {
  label: string;
  selected: boolean;
  saving: boolean;
  disabled: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled || saving}
      onClick={onSelect}
      className={cn(
        "relative rounded-xl p-0.5 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "ring-2 ring-brand ring-offset-2 ring-offset-background"
          : "opacity-80 hover:opacity-100 hover:ring-2 hover:ring-border",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
      {saving && (
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70">
          <Loader2 className="size-4 animate-spin" aria-hidden />
        </span>
      )}
      {selected && !saving && (
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-brand text-brand-ink"
        >
          <Check className="size-2.5" />
        </span>
      )}
    </button>
  );
}
