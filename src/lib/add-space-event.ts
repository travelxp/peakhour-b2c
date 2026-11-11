/**
 * The "Add space" door. The dialog itself (`components/media/add-space-dialog.tsx`) is mounted once in the dashboard layout as a lazy
 * chunk and listens for this event; anything that wants it open imports only this file, so a button never pulls the dialog into the
 * page's first-load JS.
 */
export const ADD_SPACE_EVENT = "peakhour:add-space";

export function openAddSpace(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ADD_SPACE_EVENT));
}
