"use client";

/**
 * PLACEHOLDER FOR LANE K. The Brand Kit tab of the Drive page mounts `<BrandKitTab onUpload={...} />` from this path; lane K's branch
 * (feat/drive-k) owns the real component at this exact path with this exact signature. When the two meet, TAKE LANE K'S FILE: this one
 * exists only so the Drive page compiles on its own.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the real tab (lane K) takes the upload opener; this stand-in keeps its signature
export function BrandKitTab(_props: { onUpload?: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
      Your Brand Kit, with logos, colours, fonts and voice, is coming to this tab.
    </div>
  );
}
