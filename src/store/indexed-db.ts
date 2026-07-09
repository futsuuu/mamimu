import type { ThreadData, ThreadMeta } from "./types";
import type { Store } from "./types";

const DB_NAME = "mamimu";
const DB_VERSION = 1;
const STORE_NAME = "threads";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export class IndexedDBStore implements Store {
  readonly name = "indexeddb";
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    this.db = await openDB();
  }

  async listThreads(): Promise<ThreadMeta[]> {
    const db = this.db!;
    const data = await new Promise<ThreadData[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
    return data.map((d) => ({
      id: d.id,
      name: d.name,
      driveFileId: d.driveFileId,
    }));
  }

  async getThread(id: string): Promise<ThreadData | null> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result ?? null);
    });
  }

  async putThread(data: ThreadData): Promise<ThreadData> {
    const db = this.db!;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
    return data;
  }

  async deleteThread(id: string): Promise<void> {
    const db = this.db!;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }
}
