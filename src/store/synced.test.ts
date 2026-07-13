import { describe, it, expect, beforeEach } from "vitest";

import { MockStore } from "./mock";
import { SyncedStore } from "./synced";
import type { SyncStatus, ThreadData } from "./types";

function makeData(overrides: Partial<ThreadData> & { id: string }): ThreadData {
  return {
    name: "test",
    driveFileId: null,
    messages: [],
    ...overrides,
  };
}

describe("SyncedStore", () => {
  let primary: MockStore;
  let secondary: MockStore;
  let synced: SyncedStore;

  beforeEach(async () => {
    primary = new MockStore();
    secondary = new MockStore(true);
    synced = new SyncedStore(primary, secondary);
    await synced.init();
  });

  it("listThreads returns primary data", async () => {
    await primary.putThread(makeData({ id: "1", name: "A" }));
    const list = await synced.listThreads();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("A");
  });

  it("getThread returns primary data", async () => {
    await primary.putThread(
      makeData({
        id: "1",
        messages: [{ id: "m1", text: "hi", timestamp: 1, level: 0 }],
      }),
    );
    const got = await synced.getThread("1");
    expect(got?.messages).toHaveLength(1);
  });

  describe("new thread (no driveFileId)", () => {
    it("saves to primary instantly, then syncs driveFileId to primary", async () => {
      const data = makeData({ id: "1", name: "New" });
      await synced.putThread(data);

      await synced.flushSyncQueue();

      const primaryData = await primary.getThread("1");
      expect(primaryData?.driveFileId).toBeTruthy();
    });

    it("syncs to secondary asynchronously", async () => {
      const data = makeData({ id: "1", name: "New" });
      await synced.putThread(data);

      await synced.flushSyncQueue();

      const secondaryMeta = await secondary.listThreads();
      expect(secondaryMeta).toHaveLength(1);
    });

    it("works without secondary (null)", async () => {
      const local = new SyncedStore(primary, null);
      await local.init();
      const data = makeData({ id: "1", name: "Local" });
      const saved = await local.putThread(data);

      expect(saved.driveFileId).toBeNull();
      expect(await primary.getThread("1")).toBeTruthy();
    });
  });

  describe("existing thread (has driveFileId)", () => {
    it("saves to primary immediately", async () => {
      const data = makeData({ id: "1", driveFileId: "drive1" });
      await synced.putThread(data);

      const primaryData = await primary.getThread("1");
      expect(primaryData).toBeTruthy();
    });

    it("syncs to secondary asynchronously", async () => {
      const data = makeData({
        id: "1",
        driveFileId: "drive1",
        messages: [{ id: "m1", text: "hello", timestamp: 1, level: 0 }],
      });
      await synced.putThread(data);

      await synced.flushSyncQueue();

      const secondaryData = await secondary.getThread("drive1");
      expect(secondaryData?.messages).toHaveLength(1);
    });
  });

  describe("deleteThread", () => {
    it("deletes from primary and secondary", async () => {
      await primary.putThread(makeData({ id: "1", driveFileId: "drive1" }));
      await secondary.putThread(makeData({ id: "drive1", driveFileId: "drive1" }));

      await synced.deleteThread("1");
      await synced.flushSyncQueue();

      expect(await primary.getThread("1")).toBeNull();
      expect(await secondary.getThread("drive1")).toBeNull();
    });

    it("deletes only from primary when no driveFileId", async () => {
      await primary.putThread(makeData({ id: "1" }));
      await secondary.putThread(makeData({ id: "drive1", driveFileId: "drive1" }));

      await synced.deleteThread("1");

      expect(await primary.getThread("1")).toBeNull();
      expect(await secondary.getThread("drive1")).toBeTruthy();
    });

    it("cancels pending put for the same thread", async () => {
      const data = makeData({ id: "1", name: "CancelMe" });
      await synced.putThread(data);
      await synced.deleteThread("1");
      await synced.flushSyncQueue();

      expect(await primary.getThread("1")).toBeNull();
      expect(await secondary.listThreads()).toHaveLength(0);
    });
  });

  describe("init with importFromSecondary", () => {
    it("imports Drive threads not in local", async () => {
      await secondary.putThread(
        makeData({ id: "drive1", driveFileId: "drive1", name: "Imported" }),
      );

      const fresh = new SyncedStore(primary, secondary);
      await fresh.init();

      const list = await fresh.listThreads();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("Imported");
      expect(list[0].driveFileId).toBe("drive1");
    });

    it("does not duplicate already-imported threads", async () => {
      await primary.putThread(makeData({ id: "local1", name: "Existing", driveFileId: "drive1" }));
      await secondary.putThread(
        makeData({ id: "drive1", driveFileId: "drive1", name: "Imported" }),
      );

      const fresh = new SyncedStore(primary, secondary);
      await fresh.init();

      const list = await fresh.listThreads();
      expect(list).toHaveLength(1);
    });

    it("handles empty secondary", async () => {
      const fresh = new SyncedStore(primary, null);
      await fresh.init();
      expect(await fresh.listThreads()).toEqual([]);
    });

    it("does not duplicate a thread whose sync was pending before reload", async () => {
      await primary.putThread(
        makeData({
          id: "local1",
          name: "MyThread",
          driveFileId: null,
          messages: [{ id: "m1", text: "hello", timestamp: 100, level: 0 }],
        }),
      );
      await secondary.putThread(
        makeData({
          id: "drive1",
          driveFileId: "drive1",
          name: "MyThread",
          messages: [{ id: "m1", text: "hello", timestamp: 100, level: 0 }],
        }),
      );

      const fresh = new SyncedStore(primary, secondary);
      await fresh.init();

      const list = await fresh.listThreads();
      expect(list).toHaveLength(1);
      expect(list[0].driveFileId).toBe("drive1");
      expect(list[0].name).toBe("MyThread");
    });

    it("applies LWW merge when Drive has newer messages", async () => {
      await primary.putThread(
        makeData({
          id: "local1",
          name: "Thread",
          driveFileId: "drive1",
          messages: [{ id: "m1", text: "old", timestamp: 100, level: 0 }],
        }),
      );
      await secondary.putThread(
        makeData({
          id: "drive1",
          driveFileId: "drive1",
          name: "Thread",
          messages: [
            { id: "m1", text: "old", timestamp: 100, level: 0 },
            { id: "m2", text: "new", timestamp: 200, level: 0 },
          ],
        }),
      );

      const fresh = new SyncedStore(primary, secondary);
      await fresh.init();

      const data = await fresh.getThread("local1");
      expect(data?.messages).toHaveLength(2);
      expect(data?.messages[1].text).toBe("new");
    });

    it("preserves local when local has newer messages (LWW)", async () => {
      await primary.putThread(
        makeData({
          id: "local1",
          name: "Thread",
          driveFileId: "drive1",
          messages: [
            { id: "m1", text: "old", timestamp: 100, level: 0 },
            { id: "m2", text: "newer", timestamp: 300, level: 0 },
          ],
        }),
      );
      await secondary.putThread(
        makeData({
          id: "drive1",
          driveFileId: "drive1",
          name: "Thread",
          messages: [{ id: "m1", text: "old", timestamp: 100, level: 0 }],
        }),
      );

      const fresh = new SyncedStore(primary, secondary);
      await fresh.init();

      const data = await fresh.getThread("local1");
      expect(data?.messages).toHaveLength(2);
      expect(data?.messages[1].text).toBe("newer");
    });
  });

  describe("error handling", () => {
    it("calls onTokenExpired when secondary throws expired", async () => {
      const expiredSecondary = new MockStore(true);
      expiredSecondary.putThread = async () => {
        throw new Error("expired");
      };

      let expiredCalled = false;
      const store = new SyncedStore(primary, expiredSecondary, {
        onTokenExpired: () => {
          expiredCalled = true;
        },
      });
      await store.init();

      await store.putThread(makeData({ id: "1" }));
      await store.flushSyncQueue();

      expect(expiredCalled).toBe(true);
    });

    it("retries on transient errors", async () => {
      let callCount = 0;
      // oxlint-disable-next-line typescript/unbound-method
      const origPut = MockStore.prototype.putThread;
      secondary.putThread = async function (data: ThreadData) {
        callCount++;
        if (callCount <= 2) throw new Error("transient");
        return origPut.call(this, data);
      };

      await synced.putThread(makeData({ id: "1", name: "Retry" }));
      await synced.flushSyncQueue();

      expect(callCount).toBe(3);
      const meta = await secondary.listThreads();
      expect(meta).toHaveLength(1);
    });

    it("calls onSyncError after max retries", async () => {
      const failStore = new MockStore(true);
      failStore.putThread = async () => {
        throw new Error("persistent");
      };

      let errorCalled = false;
      const store = new SyncedStore(primary, failStore, {
        onSyncError: () => {
          errorCalled = true;
        },
      });
      store.maxRetries = 3;
      store.retryBaseMs = 10;
      await store.init();

      await store.putThread(makeData({ id: "1" }));
      await store.flushSyncQueue();

      expect(errorCalled).toBe(true);
    });

    it("reports sync status changes", async () => {
      const statuses: SyncStatus[] = [];
      const store = new SyncedStore(primary, secondary, {
        onSyncStatus: (s) => statuses.push(s),
      });
      await store.init();

      const promise = store.putThread(makeData({ id: "1" }));

      await promise;
      expect(store.hasPending()).toBe(true);

      await store.flushSyncQueue();

      expect(store.hasPending()).toBe(false);
      expect(statuses).toContain("pending");
      expect(statuses).toContain("syncing");
      expect(statuses).toContain("idle");
    });

    it("reports hasPending correctly", async () => {
      const store = new SyncedStore(primary, secondary);
      await store.init();

      expect(store.hasPending()).toBe(false);

      await store.putThread(makeData({ id: "1" }));
      expect(store.hasPending()).toBe(true);

      await store.flushSyncQueue();
      expect(store.hasPending()).toBe(false);
    });
  });
});
