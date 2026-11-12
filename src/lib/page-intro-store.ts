/**
 * Remembers which "What is this page?" strips a merchant has dismissed.
 *
 * Persisted in localStorage, but every access is wrapped: storage throws in
 * private windows and with blocked site data. When it does, dismissal still
 * holds for the session through an in-memory set, and the strip simply comes
 * back on the next visit. The page never depends on storage working.
 */
const PREFIX = "ph:page-intro:dismissed:";
const session = new Set<string>();
const listeners = new Set<() => void>();

function readStored(id: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + id) === "1";
  } catch {
    return false;
  }
}

export function isPageIntroDismissed(id: string): boolean {
  return session.has(id) || readStored(id);
}

export function dismissPageIntro(id: string): void {
  session.add(id);
  try {
    window.localStorage.setItem(PREFIX + id, "1");
  } catch {
    // Storage unavailable: the in-memory set above still hides it this session.
  }
  for (const l of listeners) l();
}

export function subscribePageIntro(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam: forget the in-memory dismissals. */
export function resetPageIntroSession(): void {
  session.clear();
  for (const l of listeners) l();
}
