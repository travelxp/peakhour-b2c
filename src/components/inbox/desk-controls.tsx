"use client";

import { useRef, useState } from "react";
import { Check, Tag, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AssigneeBadge, TagChips } from "@/components/inbox/desk-badges";
import { useAssignThread, useDeskTags, useDeskTeam, useSetThreadTags, useTagAdmin } from "@/hooks/use-inbox-desk";
import { actionError } from "@/lib/inbox-customer";
import {
  TAGS_PER_THREAD_MAX,
  TAG_LIMIT,
  assigneeFor,
  canManageDesk,
  canWorkConversation,
  createFlightGuard,
  tagNameError,
  toggleTag,
  type DeskTag,
  type TeamMemberRef,
  type ThreadAssignee,
} from "@/lib/inbox-desk";

/**
 * The open conversation's assign control and tag editor (I3a), under the title in the thread header.
 *
 * ★A VIEWER SEES WHO HAS IT AND WHICH TAGS IT CARRIES, AND NO CONTROL. The api refuses a viewer's write; this does not offer one.
 * The pure view is below the hook-using container so the gate can be tested as markup.
 */
export function DeskControlsView({
  canWork,
  canCreateTag,
  assignee,
  me,
  team,
  tags,
  tagIds,
  busy,
  onAssign,
  onToggleTag,
  onCreateTag,
}: {
  canWork: boolean;
  canCreateTag: boolean;
  assignee: ThreadAssignee | null;
  me: string | null;
  team: readonly TeamMemberRef[];
  tags: readonly DeskTag[];
  tagIds: readonly string[];
  busy: boolean;
  /** A teammate's id, "me" or null (unassign). */
  onAssign: (pick: string | null) => void;
  onToggleTag: (tagId: string) => void;
  /** Resolves to a plain error to show, or null when the tag was created. */
  onCreateTag: (name: string) => Promise<string | null>;
}) {
  const [newTag, setNewTag] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const creating = useRef(false);

  if (!canWork) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" data-testid="desk-readonly">
        <AssigneeBadge assignee={assignee} />
        <span>{assignee ? `Assigned to ${assignee.name}` : "Not assigned"}</span>
        <TagChips tagIds={tagIds} tags={tags} />
      </div>
    );
  }

  const others = team.filter((t) => t.userId !== me);
  async function create() {
    if (creating.current) return;
    const err = tagNameError(newTag, tags);
    if (err) return void setTagError(err);
    creating.current = true;
    try {
      const failed = await onCreateTag(newTag);
      setTagError(failed);
      if (!failed) setNewTag("");
    } finally {
      creating.current = false;
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5" data-testid="desk-controls">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="xs" variant="outline" disabled={busy} aria-label="Assign this conversation">
            <UserRound />
            {assignee ? assignee.name : "Assign"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {me && assignee?.userId !== me && <DropdownMenuItem onSelect={() => onAssign("me")}>Assign to me</DropdownMenuItem>}
          {others.map((m) => (
            <DropdownMenuItem key={m.userId} disabled={assignee?.userId === m.userId} onSelect={() => onAssign(m.userId)}>
              {m.name}
              {assignee?.userId === m.userId && <Check className="ml-auto size-3.5" />}
            </DropdownMenuItem>
          ))}
          {assignee && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onAssign(null)}>Unassign</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <TagChips tagIds={tagIds} tags={tags} />
      <Popover>
        <PopoverTrigger asChild>
          <Button size="xs" variant="ghost" aria-label="Edit tags">
            <Tag />
            Tags
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2 p-3">
          {tags.length === 0 && <p className="text-xs text-muted-foreground">{canCreateTag ? "No tags yet. Create the first one below." : "No tags yet. An owner or admin can create them."}</p>}
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {tags.map((t) => {
              const on = tagIds.includes(t.id);
              const atLimit = !on && tagIds.length >= TAGS_PER_THREAD_MAX;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  disabled={busy || atLimit}
                  onClick={() => onToggleTag(t.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  <span className="truncate">{t.name}</span>
                  {on && <Check className="size-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
          {tagIds.length >= TAGS_PER_THREAD_MAX && <p className="text-xs text-muted-foreground">A conversation can carry up to {TAGS_PER_THREAD_MAX} tags.</p>}
          {canCreateTag && (
            <div className="space-y-1 border-t pt-2">
              <div className="flex gap-1.5">
                <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="New tag" aria-label="New tag name" className="h-8 text-xs" maxLength={30} />
                <Button size="sm" variant="outline" disabled={!newTag.trim() || tags.length >= TAG_LIMIT} onClick={() => void create()}>
                  Add
                </Button>
              </div>
              {tags.length >= TAG_LIMIT && <p className="text-xs text-muted-foreground">You have {TAG_LIMIT} tags, the most a business can have. Delete one in Team desk settings to add another.</p>}
              {tagError && (
                <p role="alert" className="text-xs text-destructive">
                  {tagError}
                </p>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** The wired control: the teammates, the tags, and the two writes (optimistic, put back with a plain message on a failure). */
export function ThreadDeskControls({
  threadId,
  role,
  assignee,
  tagIds,
}: {
  threadId: string;
  role: string | null;
  assignee: ThreadAssignee | null;
  tagIds: string[];
}) {
  const canWork = canWorkConversation(role);
  const team = useDeskTeam(canWork);
  const tags = useDeskTags();
  const assign = useAssignThread(threadId);
  const setTags = useSetThreadTags(threadId);
  const admin = useTagAdmin();
  // one guard per control, and per thread: held in a ref so two clicks in one tick are one request
  const assignGuard = useRef(createFlightGuard()).current;
  const tagGuard = useRef(createFlightGuard()).current;

  const list = team.data?.team ?? [];
  const me = team.data?.me ?? null;

  return (
    <DeskControlsView
      canWork={canWork}
      canCreateTag={canManageDesk(role)}
      assignee={assignee}
      me={me}
      team={list}
      tags={tags.data?.tags ?? []}
      tagIds={tagIds}
      busy={assign.isPending || setTags.isPending}
      onAssign={(pick) =>
        void assignGuard.run(() =>
          assign.mutateAsync({ pick, optimistic: assigneeFor(pick, me, list) }).catch((e: unknown) => {
            toast.error(actionError(e, "Assigning this conversation"));
          }),
        )
      }
      onToggleTag={(tagId) =>
        void tagGuard.run(() =>
          setTags.mutateAsync(toggleTag(tagIds, tagId)).catch((e: unknown) => {
            toast.error(actionError(e, "Changing the tags"));
          }),
        )
      }
      onCreateTag={async (name) => {
        try {
          const created = await admin.create.mutateAsync(name);
          // a tag made from a conversation goes onto it: that is why the person made it
          if (tagIds.length < TAGS_PER_THREAD_MAX) await setTags.mutateAsync([...tagIds, created.id]).catch(() => undefined);
          return null;
        } catch (e) {
          return actionError(e, "Creating the tag");
        }
      }}
    />
  );
}
