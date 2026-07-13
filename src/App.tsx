import { useState, useCallback, useRef, useEffect } from "react";

import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import ThreadView from "./components/ThreadView";
import { CLIENT_ID } from "./config";
import { useGoogleAuth } from "./google-api/oauth";
import { generateId } from "./id";
import { DriveStore } from "./store/drive";
import { IndexedDBStore } from "./store/indexed-db";
import { SyncedStore } from "./store/synced";
import type { Store, ThreadData, ThreadMeta } from "./store/types";
import type { Message } from "./types";

const SAVE_THROTTLE_MS = 1000;

function App() {
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [currentMeta, setCurrentMeta] = useState<ThreadMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentIdRef = useRef<string | null>(null);
  const currentNameRef = useRef("");
  const currentDriveFileIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const storeRef = useRef<Store | null>(null);

  const selectThread = useCallback(async (id: string, s?: Store) => {
    const st = s ?? storeRef.current;
    if (!st) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    dirtyRef.current = false;

    currentIdRef.current = id;
    setSidebarOpen(false);

    try {
      const data = await st.getThread(id);
      if (data) {
        setMessages(data.messages);
        messagesRef.current = data.messages;
        currentNameRef.current = data.name;
        currentDriveFileIdRef.current = data.driveFileId;
        setCurrentMeta({ id: data.id, name: data.name, driveFileId: data.driveFileId });
        setStatus("");
      }
    } catch {
      setStatus("Failed to load");
    }
  }, []);

  const { token, login, recoverAuth } = useGoogleAuth({
    clientId: CLIENT_ID,
    scope: "https://www.googleapis.com/auth/drive.appdata",
    onInitialToken: () => {
      void initApp();
    },
    onStatus: setStatus,
  });

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const initPromiseRef = useRef<Promise<void> | null>(null);

  const initApp = useCallback(async () => {
    if (storeRef.current) return;
    if (!initPromiseRef.current) {
      initPromiseRef.current = (async () => {
        const onExpired = () => recoverAuth();

        const primary = new IndexedDBStore();
        await primary.init();
        const secondary = new DriveStore(() => tokenRef.current!, { onTokenExpired: onExpired });
        await secondary.init();
        const s = new SyncedStore(primary, secondary, {
          onTokenExpired: onExpired,
          onSyncError: () => setStatus("Sync error"),
          onDataChanged: async () => {
            const list = await s.listThreads();
            setThreads(list);
            if (currentIdRef.current && !dirtyRef.current && !savingRef.current) {
              const data = await s.getThread(currentIdRef.current);
              if (data) {
                setMessages(data.messages);
                messagesRef.current = data.messages;
                currentNameRef.current = data.name;
                currentDriveFileIdRef.current = data.driveFileId;
                setCurrentMeta({ id: data.id, name: data.name, driveFileId: data.driveFileId });
              }
            }
          },
        });
        await s.init();
        storeRef.current = s;

        try {
          const list = await s.listThreads();
          setThreads(list);
          if (list.length > 0) {
            const first = list[0];
            await selectThread(first.id, s);
          } else {
            setStatus("No threads. Create a new one.");
          }
        } catch {
          setStatus("Failed to load threads");
        }
      })();
    }
    return initPromiseRef.current;
  }, [recoverAuth, selectThread]);

  useEffect(() => {
    if (token) void initApp();
    return () => {
      if (storeRef.current && storeRef.current.name === "synced") {
        (storeRef.current as SyncedStore).stop();
      }
    };
  }, []);

  const saveMessages = useCallback(async (msgs: Message[]) => {
    const s = storeRef.current;
    const id = currentIdRef.current;
    if (!s || !id) return;

    const data: ThreadData = {
      id,
      name: currentNameRef.current,
      driveFileId: currentDriveFileIdRef.current,
      messages: msgs,
    };
    const saved = await s.putThread(data);
    currentDriveFileIdRef.current = saved.driveFileId;
    setStatus("");
  }, []);

  const throttledSave = useCallback(() => {
    dirtyRef.current = true;

    if (saveTimerRef.current !== null || savingRef.current) return;

    const fire = async () => {
      savingRef.current = true;
      dirtyRef.current = false;
      await saveMessages(messagesRef.current);
      savingRef.current = false;

      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        if (dirtyRef.current) {
          void fire();
        }
      }, SAVE_THROTTLE_MS);
    };

    void fire();
  }, [saveMessages]);

  const handleSelectFile = useCallback(
    async (id: string) => {
      await selectThread(id);
    },
    [selectThread],
  );

  const handleCreateFile = useCallback(async () => {
    const s = storeRef.current;
    if (!s) return;

    let n = 1;
    let name = "New Thread";
    while (threads.some((f) => f.name === name)) {
      n++;
      name = `New Thread (${n})`;
    }
    setStatus("Creating...");
    try {
      const data: ThreadData = {
        id: generateId(),
        name,
        driveFileId: null,
        messages: [],
      };
      const saved = await s.putThread(data);
      const meta: ThreadMeta = { id: saved.id, name: saved.name, driveFileId: saved.driveFileId };
      setThreads((prev) => [...prev, meta]);
      await selectThread(saved.id, s);
    } catch (e) {
      setStatus(`Failed to create thread: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [threads, selectThread]);

  const handleDeleteFile = useCallback(async (fileId: string, e: React.MouseEvent) => {
    const s = storeRef.current;
    if (!s) return;
    e.stopPropagation();
    setStatus("Deleting...");
    try {
      await s.deleteThread(fileId);
      setThreads((prev) => prev.filter((f) => f.id !== fileId));
      if (currentIdRef.current === fileId) {
        setCurrentMeta(null);
        currentIdRef.current = null;
        setMessages([]);
        messagesRef.current = [];
        setSidebarOpen(true);
      }
    } catch {
      setStatus("Failed to delete thread");
    }
  }, []);

  const handleEdit = useCallback(
    (id: string, text: string) => {
      if (!storeRef.current || !currentIdRef.current) return;

      const updated = messagesRef.current.map((msg) => (msg.id === id ? { ...msg, text } : msg));
      messagesRef.current = updated;
      setMessages(updated);

      throttledSave();
    },
    [throttledSave],
  );

  const handleSend = useCallback(
    (text: string, level: number) => {
      if (!text || !storeRef.current || !currentIdRef.current) return;

      const msg: Message = {
        id: generateId(),
        text,
        timestamp: Date.now(),
        level,
      };

      const updated = [...messagesRef.current, msg];
      messagesRef.current = updated;
      setMessages(updated);

      throttledSave();
    },
    [throttledSave],
  );

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden" && storeRef.current && currentIdRef.current) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        dirtyRef.current = false;

        const msgs = messagesRef.current;
        if (msgs.length > 0) {
          void storeRef.current.putThread({
            id: currentIdRef.current,
            name: currentNameRef.current,
            driveFileId: currentDriveFileIdRef.current,
            messages: msgs,
          });
        }
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const hideMain = sidebarOpen || !currentMeta;

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {!token ? (
        <AuthScreen onLogin={() => login()} />
      ) : (
        <>
          <Sidebar
            threads={threads}
            currentId={currentMeta?.id ?? null}
            sidebarOpen={sidebarOpen}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
            onDeleteFile={handleDeleteFile}
          />
          <main
            className={`${hideMain ? "hidden md:flex" : "flex"} flex-col w-full min-h-0 md:flex-1 bg-white`}
          >
            {currentMeta ? (
              <ThreadView
                currentFile={{ id: currentMeta.id, name: currentMeta.name }}
                messages={messages}
                onSend={handleSend}
                onEdit={handleEdit}
                onBack={() => setSidebarOpen(true)}
              />
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-400 text-sm">
                <p>Select a thread or create a new one</p>
              </div>
            )}
            {status && <p className="px-4 text-xs text-gray-500">{status}</p>}
          </main>
        </>
      )}
    </div>
  );
}

export default App;
