"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, RotateCcw, Smartphone, Trash2, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addAppErrorMessage,
  addBusinessApp,
  appLabel,
  listBusinessApps,
  platformLabel,
  removeBusinessApp,
  safeHttpsUrl,
  setBusinessAppStatus,
  splitApps,
  type BusinessApp,
} from "@/lib/api/business-apps";

function AppRow({ app, children }: { app: BusinessApp; children: React.ReactNode }) {
  const icon = safeHttpsUrl(app.iconUrl);
  const store = safeHttpsUrl(app.storeUrl);
  const label = appLabel(app);
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="h-9 w-9 object-cover" />
          ) : (
            <Smartphone className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-sm font-medium">{label}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{platformLabel(app.platform)}</span>
          </div>
          {app.status === "pending" && app.evidence && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{app.evidence}</p>
          )}
        </div>
        {store && (
          <a
            href={store}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Open ${label} in the store`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-1 self-end sm:self-auto">{children}</div>
    </li>
  );
}

/** "Your apps": the mobile apps on this business's list, with add, confirm, reject, restore and remove. */
export function YourAppsPanel() {
  const { org, business } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["business-apps", org?._id, business?._id];
  const query = useQuery({ queryKey, queryFn: listBusinessApps, enabled: !!org });
  const [link, setLink] = useState("");
  const [addError, setAddError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showRejected, setShowRejected] = useState(false);
  const [removing, setRemoving] = useState<BusinessApp | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["business-apps"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-discovery"] });
  }

  const add = useMutation({
    mutationFn: addBusinessApp,
    onSuccess: () => {
      setLink("");
      setAddError("");
      setActionError("");
      refresh();
    },
    onError: (err) => setAddError(addAppErrorMessage(err)),
  });

  // Optimistic: the row moves at once and snaps back if the api refuses.
  const setStatus = useMutation({
    mutationFn: (v: { appId: string; status: "confirmed" | "rejected" }) => setBusinessAppStatus(v.appId, v.status),
    onMutate: async (v) => {
      setActionError("");
      await queryClient.cancelQueries({ queryKey });
      // Remember only THIS app's old status, so two in-flight changes roll back independently.
      const previousStatus = queryClient.getQueryData<BusinessApp[]>(queryKey)?.find((a) => a.appId === v.appId)?.status;
      queryClient.setQueryData<BusinessApp[]>(queryKey, (apps) =>
        apps?.map((a) => (a.appId === v.appId ? { ...a, status: v.status } : a)),
      );
      return { previousStatus };
    },
    onError: (_e, v, ctx) => {
      const back = ctx?.previousStatus;
      if (back) {
        queryClient.setQueryData<BusinessApp[]>(queryKey, (apps) =>
          apps?.map((a) => (a.appId === v.appId ? { ...a, status: back } : a)),
        );
      }
      setActionError("Couldn't save that. Try again.");
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: removeBusinessApp,
    onMutate: () => setActionError(""),
    onError: () => setActionError("Couldn't remove that app. Try again."),
    onSettled: () => {
      setRemoving(null);
      refresh();
    },
  });

  const apps = query.data ?? [];
  const { confirmed, pending, rejected } = splitApps(apps);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" aria-hidden="true" />
          Your apps
        </CardTitle>
        <CardDescription>The iPhone and Android apps Peakhour can promote for you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isError && (
          <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Couldn&apos;t load your apps.{" "}
            <button type="button" className="underline" onClick={() => void query.refetch()}>
              Try again
            </button>
          </div>
        )}
        {actionError && (
          <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionError}
          </div>
        )}

        {query.isPending && <p className="text-sm text-muted-foreground">Loading your apps...</p>}

        {query.data && confirmed.length === 0 && pending.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No apps found. If you have one, paste its App Store or Google Play link.
          </p>
        )}

        {confirmed.length > 0 && (
          <ul className="space-y-2" aria-label="Your apps">
            {confirmed.map((app) => (
              <AppRow key={app.appId} app={app}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRemoving(app)}
                  disabled={remove.isPending}
                  aria-label={`Remove ${appLabel(app)}`}
                >
                  <Trash2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Remove</span>
                </Button>
              </AppRow>
            ))}
          </ul>
        )}

        {pending.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Is this your app?</p>
              <Badge variant="secondary">{pending.length} to review</Badge>
            </div>
            <ul className="space-y-2" aria-label="Apps to review">
              {pending.map((app) => (
                <AppRow key={app.appId} app={app}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus.mutate({ appId: app.appId, status: "rejected" })}
                    aria-label={`No, ${appLabel(app)} isn't mine`}
                  >
                    <X className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">No</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setStatus.mutate({ appId: app.appId, status: "confirmed" })}
                    aria-label={`Yes, ${appLabel(app)} is mine`}
                  >
                    <Check className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Yes</span>
                  </Button>
                </AppRow>
              ))}
            </ul>
          </div>
        )}

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!link.trim() || add.isPending) return;
            setAddError("");
            add.mutate(link);
          }}
        >
          <label htmlFor="add-app-link" className="text-sm font-medium">
            Add an app
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="add-app-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste an App Store or Google Play link"
              inputMode="url"
              autoComplete="off"
              aria-invalid={addError ? true : undefined}
              aria-describedby={addError ? "add-app-error" : undefined}
            />
            <Button type="submit" disabled={!link.trim() || add.isPending}>
              {add.isPending ? "Adding..." : "Add app"}
            </Button>
          </div>
          {addError && (
            <p id="add-app-error" role="alert" className="text-sm text-destructive">
              {addError}
            </p>
          )}
        </form>

        {rejected.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground"
              aria-expanded={showRejected}
              onClick={() => setShowRejected((v) => !v)}
            >
              {showRejected ? "Hide apps you said aren't yours" : "Show apps you said aren't yours"}
            </button>
            {showRejected && (
              <ul className="space-y-2" aria-label="Apps you said aren't yours">
                {rejected.map((app) => (
                  <AppRow key={app.appId} app={app}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus.mutate({ appId: app.appId, status: "confirmed" })}
                      aria-label={`Restore ${appLabel(app)}`}
                    >
                      <RotateCcw className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Restore</span>
                    </Button>
                  </AppRow>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && !remove.isPending && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing ? appLabel(removing) : "this app"}?</AlertDialogTitle>
            <AlertDialogDescription>
              It comes off your list and Peakhour stops promoting it. You can add it again with its store link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(e) => {
                // Keep the dialog (and its title) open until the DELETE settles: onSettled closes it.
                e.preventDefault();
                if (removing && !remove.isPending) remove.mutate(removing.appId);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
