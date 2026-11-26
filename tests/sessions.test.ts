import { describe, expect, it } from "vitest";
import {
  MAX_NAME_LENGTH,
  MAX_SESSIONS,
  addSession,
  createSession,
  defaultName,
  deleteSession,
  isRestorable,
  sanitizeStored,
  tabsToSaved,
  type Session,
} from "../src/sessions";

const NOW = Date.UTC(2026, 10, 25, 12, 30);

function session(id: string): Session {
  return { id, name: id, createdAt: NOW, tabs: [{ url: "https://a.test/", title: "A", pinned: false }] };
}

describe("isRestorable", () => {
  it("accepts http and https", () => {
    expect(isRestorable("https://example.com/x")).toBe(true);
    expect(isRestorable("HTTP://example.com")).toBe(true);
  });
  it("rejects internal and local schemes", () => {
    for (const url of ["chrome://settings", "file:///C:/a.txt", "about:blank", "javascript:alert(1)", ""]) {
      expect(isRestorable(url)).toBe(false);
    }
  });
});

describe("tabsToSaved", () => {
  it("drops non-restorable and duplicate URLs and keeps order", () => {
    const saved = tabsToSaved([
      { url: "https://a.test/", title: "A" },
      { url: "chrome://extensions", title: "Ext" },
      { url: "https://a.test/", title: "A again" },
      { url: "https://b.test/", title: "B", pinned: true },
      {},
    ]);
    expect(saved.map((t) => t.url)).toEqual(["https://a.test/", "https://b.test/"]);
    expect(saved[1]?.pinned).toBe(true);
  });
  it("falls back to the URL when the title is empty and truncates long titles", () => {
    const saved = tabsToSaved([
      { url: "https://a.test/", title: "   " },
      { url: "https://b.test/", title: "x".repeat(500) },
    ]);
    expect(saved[0]?.title).toBe("https://a.test/");
    expect(saved[1]?.title).toHaveLength(200);
  });
});

describe("createSession", () => {
  it("returns null when there is nothing restorable", () => {
    expect(createSession("x", [{ url: "chrome://newtab" }], NOW, "id")).toBeNull();
  });
  it("uses a default name when the name is blank", () => {
    const s = createSession("   ", [{ url: "https://a.test/" }], NOW, "id");
    expect(s?.name).toBe(defaultName(NOW));
    expect(s?.name).toBe("Session 2026-11-25 12:30");
  });
  it("trims and caps the name", () => {
    const s = createSession("  " + "n".repeat(200) + "  ", [{ url: "https://a.test/" }], NOW, "id");
    expect(s?.name).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe("list operations", () => {
  it("adds newest first and caps the list", () => {
    let list: Session[] = [];
    for (let i = 0; i < MAX_SESSIONS + 5; i++) list = addSession(list, session(`s${i}`));
    expect(list).toHaveLength(MAX_SESSIONS);
    expect(list[0]?.id).toBe(`s${MAX_SESSIONS + 4}`);
  });
  it("deletes by id and ignores unknown ids", () => {
    const list = [session("a"), session("b")];
    expect(deleteSession(list, "a").map((s) => s.id)).toEqual(["b"]);
    expect(deleteSession(list, "zzz")).toHaveLength(2);
  });
});

describe("sanitizeStored", () => {
  it("returns an empty list for garbage", () => {
    for (const bad of [undefined, null, 5, "x", {}, [null, 1, "a"]]) {
      expect(sanitizeStored(bad)).toEqual([]);
    }
  });
  it("keeps valid sessions and cleans their tabs", () => {
    const stored = [
      { id: "ok", name: "Good", createdAt: 1, tabs: [{ url: "https://a.test/", title: "A" }, { url: "chrome://x" }] },
      { id: "empty", name: "No tabs", createdAt: 1, tabs: [{ url: "chrome://x" }] },
      { id: 7, name: "bad id", createdAt: 1, tabs: [] },
    ];
    const out = sanitizeStored(stored);
    expect(out).toHaveLength(1);
    expect(out[0]?.tabs).toHaveLength(1);
  });
});
