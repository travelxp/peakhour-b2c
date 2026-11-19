import { MakeFinalBar } from "@/components/studio/make-final";

/**
 * What every Studio screen shares (UX spec 2.2): the Make final bar. It shows when something is waiting to be made final, so the count and the
 * price are the same on the ideas, the plan's neighbours, a creative and the Shortlist.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MakeFinalBar />
    </>
  );
}
