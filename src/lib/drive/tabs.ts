/** The tabs of the Drive page, in order. The id is what `?tab=` carries, so a link to Smart Cleanup or Storage works. */
export const DRIVE_TABS = [
  { id: "files", label: "Files" },
  { id: "brand", label: "Brand Kit" },
  { id: "cleanup", label: "Smart Cleanup" },
  { id: "trash", label: "Trash" },
  { id: "storage", label: "Storage" },
] as const;
export type DriveTab = (typeof DRIVE_TABS)[number]["id"];

/** The tab a `?tab=` value names; anything else is Files. */
export const tabFromParam = (v: string | null): DriveTab => DRIVE_TABS.find((t) => t.id === v)?.id ?? "files";
