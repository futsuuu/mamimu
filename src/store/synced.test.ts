import { describe, it, expect, beforeEach } from "vitest";

import { MockStore } from "./mock";
import { SyncedStore } from "./synced";
import type { ThreadData } from "./types";

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

      // After syncToSecondary microtask completes
      await new Promise((r) => setTimeout(r, 0));

      const primaryData = await primary.getThread("1");
      expect(primaryData?.driveFileId).toBeTruthy();
    });

    it("syncs to secondary asynchronously", async () => {
      const data = makeData({ id: "1", name: "New" });
      await synced.putThread(data);

      await new Promise((r) => setTimeout(r, 0));

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

      await new Promise((r) => setTimeout(r, 0));

      const secondaryData = await secondary.getThread("drive1");
      expect(secondaryData?.messages).toHaveLength(1);
    });
  });

  describe("deleteThread", () => {
    it("deletes from primary and secondary", async () => {
      await primary.putThread(makeData({ id: "1", driveFileId: "drive1" }));
      await secondary.putThread(makeData({ id: "drive1", driveFileId: "drive1" }));

      await synced.deleteThread("1");

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

      await new Promise((r) => setTimeout(r, 0));

      expect(expiredCalled).toBe(true);
    });
  });
});
