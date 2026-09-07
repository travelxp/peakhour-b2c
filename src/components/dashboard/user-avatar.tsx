"use client";

import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { initialsOf, resolveAvatar, type ResolvedAvatar } from "@/lib/avatars";

/**
 * The signed-in user's avatar tile.
 *
 * Two components on purpose. `AvatarTile` is PURE — it takes a resolved avatar
 * and renders it — so the Settings picker can preview twenty tiles the user has
 * not chosen without twenty subscriptions to auth context. `UserAvatar` is the
 * one that reads context, and it is what every chrome surface mounts.
 */

export function AvatarTile({
  avatar,
  initials,
  className,
  glyphClassName,
}: {
  avatar: ResolvedAvatar;
  /** Rendered only for the monogram family. */
  initials: string;
  className?: string;
  /** Type scale for the tile's contents. Callers size this with the tile. */
  glyphClassName?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center justify-center overflow-hidden rounded-lg",
        avatar.variant.className,
        className,
      )}
    >
      {avatar.family === "monogram" ? (
        <span className={cn("font-semibold leading-none tracking-tight", glyphClassName)}>
          {initials}
        </span>
      ) : (
        // `leading-none` matters more than it looks: an emoji inherits the
        // line-height of its box, and at the default the glyph sits low enough
        // in a 32px tile to clip its own descender against the rounded corner.
        <span className={cn("leading-none", glyphClassName)}>{avatar.variant.glyph}</span>
      )}
    </span>
  );
}

/**
 * The current user's avatar, resolved from their saved preference.
 *
 * ★THE SEED IS THE EMAIL, NOT THE NAME. It picks the default gradient for a
 * user who has never chosen one, and it has to be stable: a display name is
 * editable, so seeding on it would silently re-colour someone's tile the day
 * they fixed a typo in their own name.
 */
export function UserAvatar({
  className,
  glyphClassName,
}: {
  className?: string;
  glyphClassName?: string;
}) {
  const { user } = useAuth();
  const seed = user?.email ?? user?.name ?? "peakhour";
  const avatar = resolveAvatar(user?.preferences?.avatar, seed);
  return (
    <AvatarTile
      avatar={avatar}
      initials={initialsOf(user?.name, user?.email)}
      className={className}
      glyphClassName={glyphClassName}
    />
  );
}
