import { useGoogleLogin } from "@react-oauth/google";
import { useState, useCallback, useRef, useEffect } from "react";

import { listFiles, createFile, deleteFile, saveContent, loadContent } from "./api/drive";
import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import ThreadView from "./components/ThreadView";
import type { Message } from "./types";

const TOKEN_KEY = "mamimu_token";
const SAVE_THROTTLE_MS = 1000;

function loadToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    if (Date.now() < expiresAt) return token;
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    localStorage.removeItem(TOKEN_KEY);
  }
  return null;
}

function saveToken(token: string, expiresIn: number) {
  const expiresAt = Date.now() + (expiresIn - 300) * 1000;
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function parseMessages(content: string): Message[] {
  try {
    const data = JSON.parse(content);
    if (data && Array.isArray(data.messages)) {
      return data.messages as Message[];
    }
  } catch {}
  return [];
}

function App() {
  const [token, setToken] = useState<string | null>(loadToken);
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [currentFile, setCurrentFile] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState(token ? "Signed in" : "");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentFileRef = useRef<{ id: string; name: string } | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);

  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/drive.appdata",
    onSuccess: (res) => {
      setToken(res.access_token);
      saveToken(res.access_token, res.expires_in);
      setStatus("Signed in");
      void loadFileList(res.access_token);
    },
    onError: () => {
      setStatus("Authentication failed");
    },
  });

  const recoverAuth = useCallback(() => {
    clearToken();
    setToken(null);
    setStatus("Session expired. Sign in again.");
  }, []);

  const saveMessages = useCallback(
    async (t: string, fileId: string, msgs: Message[]) => {
      try {
        await saveContent(t, fileId, JSON.stringify({ messages: msgs }));
      } catch (e) {
        if (e instanceof Error && e.message === "expired") {
          recoverAuth();
          return;
        }
        setStatus("Failed to save");
      }
    },
    [recoverAuth],
  );

  const loadFileList = useCallback(
    async (t: string) => {
      setStatus("Loading files...");
      try {
        const list = await listFiles(t);
        setFiles(list);
        if (list.length > 0) {
          const first = list[0];
          setCurrentFile(first);
          currentFileRef.current = first;
          const content = await loadContent(t, first.id);
          const parsed = parseMessages(content);
          setMessages(parsed);
          messagesRef.current = parsed;
          setStatus("Loaded");
        } else {
          setStatus("No threads. Create a new one.");
        }
      } catch (e) {
        if (e instanceof Error && e.message === "expired") {
          recoverAuth();
          return;
        }
        setStatus("Failed to load files");
      }
    },
    [recoverAuth],
  );

  const handleSelectFile = useCallback(
    async (file: { id: string; name: string }) => {
      if (!token) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      dirtyRef.current = false;

      setCurrentFile(file);
      currentFileRef.current = file;
      setMessages([]);
      messagesRef.current = [];
      setStatus("Loading...");
      setSidebarOpen(false);
      try {
        const content = await loadContent(token, file.id);
        const parsed = parseMessages(content);
        setMessages(parsed);
        messagesRef.current = parsed;
        setStatus("Loaded");
      } catch (e) {
        if (e instanceof Error && e.message === "expired") {
          recoverAuth();
          return;
        }
        setStatus("Failed to load");
      }
    },
    [token, recoverAuth],
  );

  const handleCreateFile = useCallback(async () => {
    if (!token) return;
    let n = 1;
    let name = "New Thread";
    while (files.some((f) => f.name === name)) {
      n++;
      name = `New Thread (${n})`;
    }
    setStatus("Creating...");
    try {
      const id = await createFile(token, name);
      await saveContent(token, id, JSON.stringify({ messages: [] }));
      const file = { id, name };
      setFiles((prev) => [...prev, file]);
      await handleSelectFile(file);
      setStatus("Created");
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        recoverAuth();
        return;
      }
      setStatus("Failed to create thread");
    }
  }, [token, files, handleSelectFile, recoverAuth]);

  const handleDeleteFile = useCallback(
    async (fileId: string, e: React.MouseEvent) => {
      if (!token) return;
      e.stopPropagation();
      setStatus("Deleting...");
      try {
        await deleteFile(token, fileId);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        if (currentFileRef.current?.id === fileId) {
          setCurrentFile(null);
          currentFileRef.current = null;
          setMessages([]);
          messagesRef.current = [];
          setSidebarOpen(true);
        }
        setStatus("Deleted");
      } catch (e) {
        if (e instanceof Error && e.message === "expired") {
          recoverAuth();
          return;
        }
        setStatus("Failed to delete thread");
      }
    },
    [token, recoverAuth],
  );

  const throttledSave = useCallback(() => {
    dirtyRef.current = true;

    if (saveTimerRef.current !== null || savingRef.current) return;

    const fire = async () => {
      savingRef.current = true;
      dirtyRef.current = false;
      if (token && currentFileRef.current) {
        await saveMessages(token, currentFileRef.current.id, messagesRef.current);
      }
      savingRef.current = false;

      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        if (dirtyRef.current) {
          void fire();
        }
      }, SAVE_THROTTLE_MS);
    };

    void fire();
  }, [token, saveMessages]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text || !token || !currentFileRef.current) return;

      const msg: Message = {
        id: crypto.randomUUID(),
        text,
        timestamp: Date.now(),
      };

      const updated = [...messagesRef.current, msg];
      messagesRef.current = updated;
      setMessages(updated);

      throttledSave();
    },
    [token, throttledSave],
  );

  useEffect(() => {
    if (token) {
      void loadFileList(token);
    }
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!token || !currentFileRef.current) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      dirtyRef.current = false;

      const msgs = messagesRef.current;
      if (msgs.length > 0) {
        void fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${currentFileRef.current.id}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json; charset=utf-8",
            },
            body: JSON.stringify({ messages: msgs }),
            keepalive: true,
          },
        );
        return;
      }

      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [token]);

  const hideMain = sidebarOpen || !currentFile;

  return (
    <div className="flex h-screen overflow-hidden">
      {!token ? (
        <AuthScreen onLogin={() => login()} />
      ) : (
        <>
          <Sidebar
            files={files}
            currentFile={currentFile}
            sidebarOpen={sidebarOpen}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
            onDeleteFile={handleDeleteFile}
          />
          <main
            className={`${hideMain ? "hidden md:flex" : "flex"} flex-col w-full pt-4 min-h-0 md:flex-1`}
          >
            {currentFile ? (
              <ThreadView
                currentFile={currentFile}
                messages={messages}
                onSend={handleSend}
                onBack={() => setSidebarOpen(true)}
              />
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-400 text-sm">
                <p>Select a thread or create a new one</p>
              </div>
            )}
            {status && <p className="mt-2 px-4 pb-4 text-xs text-gray-500">{status}</p>}
          </main>
        </>
      )}
    </div>
  );
}

export default App;
