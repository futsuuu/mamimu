import type { Store, ThreadData, ThreadMeta } from "./types";

let counter = 0;

function nextDriveId(): string {
  return `drive-${++counter}`;
}

export class MockStore implements Store {
  readonly name = "mock";
  private data = new Map<string, ThreadData>();

  constructor(private useDriveKey: boolean = false) {}

  async init(): Promise<void> {}

  async listThreads(): Promise<ThreadMeta[]> {
    return Array.from(this.data.values()).map((d) => ({
      id: d.id,
      name: d.name,
      driveFileId: d.driveFileId,
    }));
  }

  async getThread(id: string): Promise<ThreadData | null> {
    return this.data.get(id) ?? null;
  }

  async putThread(data: ThreadData): Promise<ThreadData> {
    let saved: ThreadData;
    if (!data.driveFileId && this.useDriveKey) {
      const fileId = nextDriveId();
      saved = { ...data, driveFileId: fileId };
    } else {
      saved = { ...data };
    }
    const key = this.useDriveKey && saved.driveFileId ? saved.driveFileId : saved.id;
    this.data.set(key, { ...saved });
    return saved;
  }

  hasPending(): boolean {
    return false;
  }

  async deleteThread(id: string): Promise<void> {
    this.data.delete(id);
  }

  entries(): ThreadData[] {
    return Array.from(this.data.values());
  }
}
