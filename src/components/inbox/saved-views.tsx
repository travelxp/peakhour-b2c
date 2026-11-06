"use client";

import { useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSavedViews, useViewAdmin } from "@/hooks/use-inbox-desk";
import { actionError } from "@/lib/inbox-customer";
import { useDeskTags } from "@/hooks/use-inbox-desk";
import {
  VIEWS_MAX,
  VIEW_NAME_MAX,
  canWorkConversation,
  createFlightGuard,
  isViewActive,
  pageOfView,
  viewOpensAsSaved,
  viewFiltersOfPage,
  viewNameError,
  viewSummary,
  type DeskTag,
  type PageFilters,
  type SavedView,
} from "@/lib/inbox-desk";

/**
 * Saved views (team desk parity, SA-10): a named set of the list's own filters (status, assignee, tag, Insights topic, priority, channel) the
 * whole business shares, such as "Urgent delivery". Picking one REPLACES the filters on the page with the view's, so it shows exactly what the
 * same filters picked by hand would. A view stores no search text (it can be a customer's name). Editors and above save and delete; a viewer can
 * still open them.
 *
 * The pure view is below the hook-using container so every state can be rendered as markup.
 */
export function SavedViewsView({
  views,
  page,
  canEdit,
  tags,
  busy,
  error,
  onApply,
  onSave,
  onDelete,
}: {
  views: readonly SavedView[];
  page: PageFilters;
  canEdit: boolean;
  tags: readonly DeskTag[] | undefined;
  busy: boolean;
  /** The last save's plain error, or null. */
  error: string | null;
  onApply: (next: PageFilters) => void;
  /** Resolves to a plain error to show, or null when it was saved. */
  onSave: (name: string) => Promise<string | null>;
  onDelete: (view: SavedView) => void;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const active = views.find((v) => isViewActive(v, page)) ?? null;
  if (views.length === 0 && !canEdit) return null;

  async function save() {
    const bad = viewNameError(name, views);
    if (bad) return void setProblem(bad);
    const failed = await onSave(name);
    setProblem(failed);
    if (!failed) {
      setName("");
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Saved views" data-testid="saved-views">
      {views.length > 0 && (
        <select
          aria-label="Saved views"
          value={active?.id ?? ""}
          onChange={(e) => {
            const v = views.find((x) => x.id === e.target.value);
            if (v) onApply(pageOfView(v.filters));
          }}
          title={active ? viewSummary(active.filters, tags) : "Open a saved view"}
          className="h-6 max-w-44 rounded-md border bg-background px-1.5 text-xs"
        >
          <option value="" disabled>
            Saved views
          </option>
          {views.map((v) => (
            // ★a view for one named teammate (made through the api) cannot be drawn as a chip: it is listed but not openable, never opened as something broader
            <option key={v.id} value={v.id} disabled={!viewOpensAsSaved(v.filters)} title={viewOpensAsSaved(v.filters) ? viewSummary(v.filters, tags) : "This view is for one teammate and cannot be opened here"}>
              {v.name}
            </option>
          ))}
        </select>
      )}
      {canEdit && active && (
        <Button size="xs" variant="ghost" disabled={busy} aria-label={`Delete the view ${active.name}`} onClick={() => onDelete(active)}>
          <Trash2 />
        </Button>
      )}
      {canEdit && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="xs" variant="ghost" disabled={views.length >= VIEWS_MAX} title={views.length >= VIEWS_MAX ? `You can keep up to ${VIEWS_MAX} views. Delete one to add another.` : undefined}>
              <Bookmark />
              Save view
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-2 p-3">
            <p className="text-xs text-muted-foreground">Saves the filters on this page under a name your whole team can open. Search text is not saved.</p>
            <p className="text-xs font-medium">{viewSummary(viewFiltersOfPage(page), tags)}</p>
            <div className="flex gap-1.5">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setProblem(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                }}
                placeholder="Urgent delivery"
                aria-label="View name"
                className="h-8 text-xs"
                maxLength={VIEW_NAME_MAX}
              />
              <Button size="sm" disabled={busy || !name.trim()} onClick={() => void save()}>
                Save
              </Button>
            </div>
            {(problem ?? error) && (
              <p role="alert" className="text-xs text-destructive">
                {problem ?? error}
              </p>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/** The wired control: the business's views, and the two writes. */
export function SavedViews({ role, page, onApply }: { role: string | null; page: PageFilters; onApply: (next: PageFilters) => void }) {
  const query = useSavedViews();
  const tags = useDeskTags();
  const admin = useViewAdmin();
  // one guard per control, held in a ref: two clicks in one tick are one request
  const saveGuard = useState(createFlightGuard)[0];
  const deleteGuard = useState(createFlightGuard)[0];
  const canEdit = canWorkConversation(role);
  // a failed read is shown as nothing rather than as "no views": the filters above still work
  const views = query.data?.views ?? [];
  return (
    <SavedViewsView
      views={views}
      page={page}
      canEdit={canEdit}
      tags={tags.data?.tags}
      busy={admin.save.isPending || admin.remove.isPending}
      error={null}
      onApply={onApply}
      onSave={async (name) => {
        let failed: string | null = null;
        await saveGuard.run(async () => {
          try {
            await admin.save.mutateAsync({ name, filters: viewFiltersOfPage(page) });
            toast.success("View saved.");
          } catch (e) {
            failed = actionError(e, "Saving the view");
          }
        });
        return failed;
      }}
      onDelete={(v) =>
        void deleteGuard.run(async () => {
          try {
            await admin.remove.mutateAsync(v.id);
            toast.success("View deleted.");
          } catch (e) {
            toast.error(actionError(e, "Deleting the view"));
          }
        })
      }
    />
  );
}
