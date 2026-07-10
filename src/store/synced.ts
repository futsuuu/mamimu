import type { ThreadData, ThreadMeta } from "./types";
import type { Store, SyncCallbacks } from "./types";

interface SyncEntry {
  type: "put" | "delete";
  localId: string;
  driveFileId?: string | null;
  data?: ThreadData;
  retries: number;
}

export class SyncedStore implements Store {
  readonly name = "synced";

  maxRetries = 5;
  retryBaseMs = 1000;
  pollIntervalMs = 15000;

  private queue: SyncEntry[] = [];
  private processing = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private primary: Store,
    private secondary: Store | null,
    private callbacks?: SyncCallbacks,
  ) {}

  async init(): Promise<void> {
    await this.primary.init();
    if (this.secondary) {
      await this.secondary.init().catch(() => {});
      await this.pullFromSecondary().catch(() => {});
      this.startPeriodicSync();
    }
  }

  async listThreads(): Promise<ThreadMeta[]> {
    return this.primary.listThreads();
  }

  async getThread(id: string): Promise<ThreadData | null> {
    return this.primary.getThread(id);
  }

  async putThread(data: ThreadData): Promise<ThreadData> {
    await this.primary.putThread(data);
    if (this.secondary) {
      this.enqueue({ type: "put", localId: data.id, data, retries: 0 });
    }
    return data;
  }

  async deleteThread(id: string): Promise<void> {
    const data = await this.primary.getThread(id);

    this.queue = this.queue.filter((e) => !(e.type === "put" && e.localId === id));

    await this.primary.deleteThread(id);
    if (this.secondary && data?.driveFileId) {
      this.enqueue({
        type: "delete",
        localId: id,
        driveFileId: data.driveFileId,
        retries: 0,
      });
    }
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private enqueue(entry: SyncEntry): void {
    this.queue = this.queue.filter((e) => e.localId !== entry.localId);
    this.queue.push(entry);
    this.callbacks?.onSyncStatus?.("pending");
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    this.callbacks?.onSyncStatus?.("syncing");

    while (this.queue.length > 0) {
      const entry = this.queue[0];
      try {
        if (entry.type === "put" && entry.data) {
          const result = await this.secondary!.putThread(entry.data);
          if (!entry.data.driveFileId && result.driveFileId) {
            entry.data.driveFileId = result.driveFileId;
            await this.primary.putThread(entry.data);
          }
        } else if (entry.type === "delete" && entry.driveFileId) {
          await this.secondary!.deleteThread(entry.driveFileId);
        }
        this.queue.shift();
      } catch (e) {
        if (e instanceof Error && e.message === "expired") {
          this.callbacks?.onTokenExpired?.();
          this.queue.shift();
          continue;
        }
        entry.retries++;
        if (entry.retries >= this.maxRetries) {
          this.queue.shift();
          this.callbacks?.onSyncError?.(e instanceof Error ? e : new Error(String(e)));
        } else {
          this.queue.shift();
          this.queue.push(entry);
          await this.delay(this.retryBaseMs * 2 ** (entry.retries - 1));
        }
      }
    }

    this.processing = false;
    this.callbacks?.onSyncStatus?.(this.queue.length > 0 ? "pending" : "idle");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async flushSyncQueue(): Promise<void> {
    while (this.queue.length > 0 || this.processing) {
      await this.delay(10);
    }
  }

  private async pullFromSecondary(): Promise<void> {
    if (!this.secondary) return;

    const [remoteMetas, localMetas] = await Promise.all([
      this.secondary.listThreads(),
      this.primary.listThreads(),
    ]);

    const localByDriveId = new Map<string, ThreadMeta>();
    const localByName = new Map<string, ThreadMeta>();
    for (const local of localMetas) {
      if (local.driveFileId) {
        localByDriveId.set(local.driveFileId, local);
      } else {
        localByName.set(local.name, local);
      }
    }

    for (const remote of remoteMetas) {
      const localMeta = localByDriveId.get(remote.id) ?? localByName.get(remote.name);
      if (!localMeta) {
        const remoteData = await this.secondary.getThread(remote.id);
        if (!remoteData) continue;
        const localData: ThreadData = {
          id: crypto.randomUUID(),
          name: remoteData.name,
          driveFileId: remoteData.driveFileId,
          messages: remoteData.messages,
        };
        await this.primary.putThread(localData);
        continue;
      }

      const remoteData = await this.secondary.getThread(remote.id);
      if (!remoteData) continue;

      const localData = await this.primary.getThread(localMeta.id);
      if (!localData) continue;

      const merged = this.mergeThreads(localData, remoteData);
      if (merged !== localData || !localData.driveFileId) {
        merged.driveFileId ??= remoteData.driveFileId;
        await this.primary.putThread(merged);
      }
    }
  }

  private mergeThreads(local: ThreadData, remote: ThreadData): ThreadData {
    const localLatest =
      local.messages.length > 0 ? Math.max(...local.messages.map((m) => m.timestamp)) : 0;
    const remoteLatest =
      remote.messages.length > 0 ? Math.max(...remote.messages.map((m) => m.timestamp)) : 0;

    if (remoteLatest > localLatest) {
      return {
        ...remote,
        id: local.id,
        driveFileId: local.driveFileId,
      };
    }
    return local;
  }

  private startPeriodicSync(): void {
    this.pollTimer = setInterval(() => {
      this.pullFromSecondary().catch(() => {});
    }, this.pollIntervalMs);
  }
}
