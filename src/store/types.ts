import type { Message } from "../types";

export interface ThreadMeta {
  id: string;
  name: string;
  driveFileId: string | null;
}

export interface ThreadData extends ThreadMeta {
  messages: Message[];
}

export interface SyncCallbacks {
  onTokenExpired?: () => void;
  onSyncError?: (error: Error) => void;
}

export interface Store {
  readonly name: string;
  init(): Promise<void>;
  listThreads(): Promise<ThreadMeta[]>;
  getThread(id: string): Promise<ThreadData | null>;
  putThread(data: ThreadData): Promise<ThreadData>;
  deleteThread(id: string): Promise<void>;
}
