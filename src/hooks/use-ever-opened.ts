import { useState } from "react";

/**
 * True from the first time `open` is true, and for good after. A lazy dialog is mounted only once this is true, and stays mounted so its
 * close animation plays and its state survives a reopen. Nothing mounts (and nothing downloads) for a merchant who never opens it.
 */
export function useEverOpened(open: boolean): boolean {
  const [seen, setSeen] = useState(open);
  if (open && !seen) setSeen(true);
  return seen || open;
}
