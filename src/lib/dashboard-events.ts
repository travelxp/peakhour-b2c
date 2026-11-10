/**
 * Window events that let a component outside the dashboard shell ask the
 * shell's own widgets to open. The command menu and the feedback sheet live in
 * dashboard/layout.tsx; an error screen or a 404 cannot reach their state, so
 * it dispatches one of these and the widget listens.
 */
export const OPEN_COMMAND_MENU_EVENT = "ph:open-command-menu";
export const OPEN_FEEDBACK_EVENT = "ph:open-feedback";

function fire(name: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}

export const openCommandMenu = (): void => fire(OPEN_COMMAND_MENU_EVENT);
export const openFeedback = (): void => fire(OPEN_FEEDBACK_EVENT);
