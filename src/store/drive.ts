import {
  listFiles,
  createFile,
  deleteFile,
  saveContent,
  loadContent,
  getFileMeta,
} from "../google-api/drive";
import { parseMessages, serializeMessages } from "../serialize";
import type { ThreadData, ThreadMeta } from "./types";
import type { Store, SyncCallbacks } from "./types";

export class DriveStore implements Store {
  readonly name = "drive";

  constructor(
    private getToken: () => string,
    private callbacks?: SyncCallbacks,
  ) {}

  async init(): Promise<void> {}

  async listThreads(): Promise<ThreadMeta[]> {
    const files = await listFiles(this.getToken());
    return files.map((f) => ({
      id: f.id,
      name: f.name,
      driveFileId: f.id,
    }));
  }

  async getThread(id: string): Promise<ThreadData | null> {
    try {
      const [meta, content] = await Promise.all([
        getFileMeta(this.getToken(), id),
        loadContent(this.getToken(), id),
      ]);
      const messages = parseMessages(content);
      return {
        id,
        name: meta.name,
        driveFileId: id,
        messages,
      };
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        this.callbacks?.onTokenExpired?.();
        return null;
      }
      throw e;
    }
  }

  async putThread(data: ThreadData): Promise<ThreadData> {
    try {
      if (data.driveFileId) {
        await saveContent(this.getToken(), data.driveFileId, serializeMessages(data.messages));
        return data;
      }
      const fileId = await createFile(this.getToken(), data.name);
      await saveContent(this.getToken(), fileId, serializeMessages(data.messages));
      return { ...data, driveFileId: fileId };
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        this.callbacks?.onTokenExpired?.();
      }
      throw e;
    }
  }

  async deleteThread(id: string): Promise<void> {
    try {
      await deleteFile(this.getToken(), id);
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        this.callbacks?.onTokenExpired?.();
      }
      throw e;
    }
  }
}
