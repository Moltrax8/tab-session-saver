/** Pure session logic. No browser APIs, so it is fully unit-testable. */

export interface SavedTab {
  url: string;
  title: string;
  pinned: boolean;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  tabs: SavedTab[];
}

export interface TabLike {
  url?: string;
  title?: string;
  pinned?: boolean;
}

export const MAX_SESSIONS = 50;
export const MAX_NAME_LENGTH = 80;
export const MAX_TITLE_LENGTH = 200;

const RESTORABLE = /^https?:\/\//i;

/** Only http(s) pages can be reopened reliably; chrome://, file:// and similar are skipped. */
export function isRestorable(url: string): boolean {
  return RESTORABLE.test(url);
}

/** Convert browser tabs to saved tabs: drops non-restorable and duplicate URLs, keeps order. */
export function tabsToSaved(tabs: readonly TabLike[]): SavedTab[] {
  const seen = new Set<string>();
  const saved: SavedTab[] = [];
  for (const tab of tabs) {
    const url = tab.url;
    if (!url || !isRestorable(url) || seen.has(url)) continue;
    seen.add(url);
    saved.push({
      url,
      title: (tab.title?.trim() || url).slice(0, MAX_TITLE_LENGTH),
      pinned: tab.pinned === true,
    });
  }
  return saved;
}

export function defaultName(now: number): string {
  return `Session ${new Date(now).toISOString().slice(0, 16).replace("T", " ")}`;
}

/** Returns null when there is nothing worth saving. */
export function createSession(
  name: string,
  tabs: readonly TabLike[],
  now: number = Date.now(),
  id: string = crypto.randomUUID(),
): Session | null {
  const saved = tabsToSaved(tabs);
  if (saved.length === 0) return null;
  const cleanName = name.trim().slice(0, MAX_NAME_LENGTH) || defaultName(now);
  return { id, name: cleanName, createdAt: now, tabs: saved };
}

/** Newest first; the oldest sessions fall off once MAX_SESSIONS is exceeded. */
export function addSession(list: readonly Session[], session: Session): Session[] {
  return [session, ...list].slice(0, MAX_SESSIONS);
}

export function deleteSession(list: readonly Session[], id: string): Session[] {
  return list.filter((s) => s.id !== id);
}

/** Defensive read of whatever is in storage; anything malformed is dropped. */
export function sanitizeStored(raw: unknown): Session[] {
  if (!Array.isArray(raw)) return [];
  const out: Session[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const s = item as Partial<Session>;
    if (typeof s.id !== "string" || typeof s.name !== "string") continue;
    if (typeof s.createdAt !== "number" || !Array.isArray(s.tabs)) continue;
    const tabs = tabsToSaved(s.tabs as TabLike[]);
    if (tabs.length === 0) continue;
    out.push({ id: s.id, name: s.name.slice(0, MAX_NAME_LENGTH), createdAt: s.createdAt, tabs });
  }
  return out.slice(0, MAX_SESSIONS);
}
