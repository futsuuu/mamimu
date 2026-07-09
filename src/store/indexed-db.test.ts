import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";

import { IndexedDBStore } from "./indexed-db";
import type { ThreadData } from "./types";

function makeData(overrides: Partial<ThreadData> & { id: string }): ThreadData {
  return {
    name: "test",
    driveFileId: null,
    messages: [],
    ...overrides,
  };
}

describe("IndexedDBStore", () => {
  let store: IndexedDBStore;

  beforeEach(async () => {
    store = new IndexedDBStore();
    await store.init();
  });

  it("starts empty", async () => {
    const threads = await store.listThreads();
    expect(threads).toEqual([]);
  });

  it("creates and retrieves a thread", async () => {
    const data = makeData({ id: "1", name: "Thread A" });
    await store.putThread(data);

    const got = await store.getThread("1");
    expect(got).toEqual(data);
  });

  it("lists all threads without messages", async () => {
    await store.putThread(makeData({ id: "1", name: "A" }));
    await store.putThread(makeData({ id: "2", name: "B" }));

    const list = await store.listThreads();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("1");
    expect((list[0] as any).messages).toBeUndefined();
  });

  it("updates an existing thread", async () => {
    await store.putThread(
      makeData({
        id: "1",
        name: "A",
        messages: [{ id: "m1", text: "hi", timestamp: 1, level: 0 }],
      }),
    );

    const updated = makeData({ id: "1", name: "A edited" });
    await store.putThread(updated);

    const got = await store.getThread("1");
    expect(got).not.toBeNull();
    expect(got!.name).toBe("A edited");
  });

  it("deletes a thread", async () => {
    await store.putThread(makeData({ id: "1" }));
    await store.deleteThread("1");

    const got = await store.getThread("1");
    expect(got).toBeNull();
  });

  it("returns null for non-existent thread", async () => {
    const got = await store.getThread("nonexistent");
    expect(got).toBeNull();
  });

  it("persists driveFileId", async () => {
    await store.putThread(makeData({ id: "1", driveFileId: "drive123" }));
    const got = await store.getThread("1");
    expect(got).not.toBeNull();
    expect(got!.driveFileId).toBe("drive123");
  });
});
