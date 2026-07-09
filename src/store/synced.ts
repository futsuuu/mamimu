import type { ThreadData, ThreadMeta } from "./types";
import type { Store, SyncCallbacks } from "./types";

export class SyncedStore implements Store {
  readonly name = "synced";

  constructor(
    private primary: Store,
    private secondary: Store | null,
    private callbacks?: SyncCallbacks,
  ) {}

  async init(): Promise<void> {
    await this.primary.init();
    if (this.secondary) {
      await this.secondary.init().catch(() => {});
      await this.importFromSecondary().catch(() => {});
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
      this.syncToSecondary(data).catch((e) => {
        if (e instanceof Error && e.message === "expired") {
          this.callbacks?.onTokenExpired?.();
        } else {
          this.callbacks?.onSyncError?.(e);
        }
      });
    }
    return data;
  }

  private async syncToSecondary(data: ThreadData): Promise<void> {
    const result = await this.secondary!.putThread(data);
    if (!data.driveFileId && result.driveFileId) {
      data.driveFileId = result.driveFileId;
      await this.primary.putThread(data);
    }
  }

  async deleteThread(id: string): Promise<void> {
    const data = await this.primary.getThread(id);
    await this.primary.deleteThread(id);
    if (this.secondary && data?.driveFileId) {
      this.secondary.deleteThread(data.driveFileId).catch(() => {});
    }
  }

  private async importFromSecondary(): Promise<void> {
    if (!this.secondary) return;

    const [remoteMetas, localMetas] = await Promise.all([
      this.secondary.listThreads(),
      this.primary.listThreads(),
    ]);

    const localByDriveId = new Map<string, boolean>();
    for (const local of localMetas) {
      if (local.driveFileId) {
        localByDriveId.set(local.driveFileId, true);
      }
    }

    for (const remote of remoteMetas) {
      if (localByDriveId.has(remote.id)) continue;
      localByDriveId.set(remote.id, true);

      const remoteData = await this.secondary.getThread(remote.id);
      if (!remoteData) continue;

      const localData: ThreadData = {
        id: crypto.randomUUID(),
        name: remoteData.name,
        driveFileId: remoteData.driveFileId,
        messages: remoteData.messages,
      };
      await this.primary.putThread(localData);
    }
  }
}
