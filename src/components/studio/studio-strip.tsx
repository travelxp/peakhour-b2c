"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { jobsListQuery, useCancelJob, useJobs } from "@/hooks/use-jobs";
import { useStudioAbilities } from "@/hooks/use-studio-flow";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { STUDIO_PATHS } from "@/lib/studio-flow";
import { finishedJobs, jobLine, rememberedWork, studioJobs, workHref, type StudioJob } from "@/lib/studio-strip";

const S = STUDIO_COPY.strip;

/** What the Studio jobs among the running ones are, from the jobs list the sidebar badge already reads. */
function useStudioJobs(): { jobs: StudioJob[]; ready: boolean } {
  const q = useJobs("active");
  const rows = q.data?.rows;
  const jobs = useMemo(() => studioJobs(rows ?? []), [rows]);
  return { jobs, ready: q.isSuccess };
}

export interface StudioStripViewProps {
  jobs: StudioJob[];
  href: (job: StudioJob) => string | null;
  /** An editor may stop work; a viewer only watches. */
  canStop: boolean;
  stopping: boolean;
  onStop: (job: StudioJob) => void;
}

/**
 * The running-jobs strip (UX spec 4.4): a one-line bar under the tabs while Studio is making something. "Making your previews · 2 of 4 ready"
 * (polite, so it is read without stealing focus), a link to where it shows, and Stop. Nothing when nothing is running.
 */
export function StudioStripView({ jobs, href, canStop, stopping, onStop }: StudioStripViewProps) {
  if (jobs.length === 0) return null;
  return (
    <section aria-label={S.region} data-slot="studio-strip" className="space-y-1">
      {jobs.map((j) => {
        const to = href(j);
        return (
          <div key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
            <p className="min-w-0 flex-1" role="status" aria-live="polite">
              {jobLine(j)}
            </p>
            {to && (
              <Link href={to} className="text-sm font-medium underline underline-offset-2">
                {S.see}
              </Link>
            )}
            {canStop && (
              <Button type="button" variant="ghost" size="sm" className="h-11 px-2" disabled={stopping} onClick={() => onStop(j)}>
                {stopping ? S.stopping : S.stop}
              </Button>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** The strip, mounted once by the Studio layout. */
export function StudioStrip() {
  const { jobs } = useStudioJobs();
  const { canMake } = useStudioAbilities();
  const cancel = useCancelJob();
  const pathname = usePathname();
  // Where the work shows: read when rendered, so a press made a moment ago is the one it points at.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the stored id changes with a press, which also changes `jobs`
  const target = useMemo(() => rememberedWork(), [jobs]);
  return (
    <StudioStripView
      jobs={jobs}
      href={(j) => {
        const to = workHref(j.kind, target, STUDIO_PATHS);
        // No link to the page the merchant is already on.
        return to && to !== pathname ? to : null;
      }}
      canStop={canMake}
      stopping={cancel.isPending}
      onStop={(j) =>
        cancel.mutate(j.id, {
          onSuccess: () => toast(S.stopped(j.done ?? 0)),
        })
      }
    />
  );
}

/**
 * "Your previews are ready", from anywhere in the dashboard (mounted by the dashboard shell for organisations with Studio). A job that was
 * running and is gone fires one toast with "See them", unless the merchant is already in Studio, where the page and the strip show it.
 */
export function StudioReadyToaster() {
  const { jobs, ready } = useStudioJobs();
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = usePathname();
  const before = useRef<StudioJob[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    const was = before.current;
    before.current = jobs;
    if (!was || pathname?.startsWith("/dashboard/studio")) return;
    const gone = finishedJobs(was, jobs);
    if (gone.length === 0) return;
    // A job that left the running list may have finished, failed or been stopped: only one the api says is done is announced as ready.
    void qc
      .fetchQuery({ ...jobsListQuery("recent"), staleTime: 0 })
      .then((r) => {
        const done = new Set(r.rows.filter((x) => x.status === "done").map((x) => x._id));
        for (const kind of new Set(gone.filter((j) => done.has(j.id)).map((j) => j.kind))) {
          const to = workHref(kind, rememberedWork(), STUDIO_PATHS);
          toast.success(S.readyToast[kind], to ? { action: { label: S.seeThem, onClick: () => router.push(to) } } : undefined);
        }
      })
      .catch(() => undefined);
  }, [jobs, ready, pathname, router, qc]);
  return null;
}
