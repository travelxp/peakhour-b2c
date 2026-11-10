"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// The dialog (cmdk, the page list, ~17 icons) is not needed for first paint.
// This shell owns only the Cmd/Ctrl+K listener; the dialog chunk is fetched on
// the first open and stays mounted afterwards so later opens are instant.
const CommandMenuDialog = dynamic(
  () => import("./command-menu-dialog").then((m) => m.CommandMenuDialog),
  { ssr: false },
);

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setEverOpened(true);
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (!everOpened) return null;
  return <CommandMenuDialog open={open} onOpenChange={setOpen} />;
}
