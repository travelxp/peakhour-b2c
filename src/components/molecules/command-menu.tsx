"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { OPEN_COMMAND_MENU_EVENT } from "@/lib/dashboard-events";

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
    // The dialog is not mounted until the first open, so the event must mount
    // it as well as open it — setOpen alone does nothing before the first Cmd+K.
    const show = () => {
      setEverOpened(true);
      setOpen(true);
    };
    document.addEventListener("keydown", down);
    window.addEventListener(OPEN_COMMAND_MENU_EVENT, show);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener(OPEN_COMMAND_MENU_EVENT, show);
    };
  }, []);

  if (!everOpened) return null;
  return <CommandMenuDialog open={open} onOpenChange={setOpen} />;
}
