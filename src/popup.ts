import { addSession, createSession, deleteSession, sanitizeStored, type Session } from "./sessions";

const STORAGE_KEY = "sessions";

async function loadSessions(): Promise<Session[]> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return sanitizeStored(data[STORAGE_KEY]);
}

async function saveSessions(list: Session[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

async function restore(session: Session): Promise<void> {
  const win = await chrome.windows.create({ url: session.tabs.map((t) => t.url) });
  const opened = win?.tabs ?? [];
  await Promise.all(
    session.tabs.map((saved, i) => {
      const tab = opened[i];
      return saved.pinned && tab?.id !== undefined
        ? chrome.tabs.update(tab.id, { pinned: true })
        : Promise.resolve(undefined);
    }),
  );
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function setStatus(message: string): void {
  const status = document.getElementById("status");
  if (status) status.textContent = message;
}

async function render(): Promise<void> {
  const root = document.getElementById("list");
  if (!root) return;
  const sessions = await loadSessions();
  root.replaceChildren();
  if (sessions.length === 0) {
    root.append(el("p", { className: "empty", textContent: "No saved sessions yet." }));
    return;
  }
  for (const s of sessions) {
    const meta = `${s.tabs.length} tab${s.tabs.length === 1 ? "" : "s"} · ${new Date(s.createdAt).toLocaleDateString()}`;
    const restoreBtn = el("button", { textContent: "Restore", type: "button" });
    restoreBtn.addEventListener("click", () => void restore(s));
    const deleteBtn = el("button", { textContent: "Delete", type: "button", className: "danger" });
    deleteBtn.addEventListener("click", async () => {
      await saveSessions(deleteSession(await loadSessions(), s.id));
      await render();
    });
    root.append(
      el(
        "div",
        { className: "item" },
        el("div", { className: "info" }, el("strong", { textContent: s.name }), el("span", { textContent: meta })),
        el("div", { className: "actions" }, restoreBtn, deleteBtn),
      ),
    );
  }
}

async function onSave(): Promise<void> {
  const input = document.getElementById("name") as HTMLInputElement;
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const session = createSession(input.value, tabs);
  if (!session) {
    setStatus("Nothing to save: no regular web pages in this window.");
    return;
  }
  await saveSessions(addSession(await loadSessions(), session));
  input.value = "";
  setStatus(`Saved ${session.tabs.length} tabs.`);
  await render();
}

document.getElementById("save")?.addEventListener("click", () => void onSave());
void render();
