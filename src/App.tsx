import { useGoogleLogin } from "@react-oauth/google";
import { useState, useCallback, useRef, useEffect } from "react";

import { listFiles, createFile, deleteFile, saveContent, loadContent } from "./api/drive";

import "./App.css";

const TOKEN_KEY = "mamimu_token";
const SAVE_THROTTLE_MS = 1000;

interface Message {
  id: string;
  text: string;
  timestamp: number;
}

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

function App() {
  const [token, setToken] = useState<string | null>(loadToken);
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [currentFile, setCurrentFile] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState(token ? "Signed in" : "");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentFileRef = useRef<{ id: string; name: string } | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
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

  function parseMessages(content: string): Message[] {
    try {
      const data = JSON.parse(content);
      if (data && Array.isArray(data.messages)) {
        return data.messages as Message[];
      }
    } catch {}
    return [];
  }

  const saveMessages = useCallback(
    async (t: string, fileId: string, msgs: Message[]) => {
      setStatus("Saving...");
      try {
        await saveContent(t, fileId, JSON.stringify({ messages: msgs }));
        setStatus("Saved");
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

      await flushSave();

      setCurrentFile(file);
      currentFileRef.current = file;
      setInputText("");
      setStatus("Loading...");
      try {
        const content = await loadContent(token, file.id);
        const parsed = parseMessages(content);
        setMessages(parsed);
        messagesRef.current = parsed;
        setStatus("Loaded");
        setSidebarOpen(false);
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

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    dirtyRef.current = false;
    if (token && currentFileRef.current && messagesRef.current.length > 0) {
      await saveMessages(token, currentFileRef.current.id, messagesRef.current);
    }
  }, [token, saveMessages]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !token || !currentFileRef.current) return;

    const msg: Message = {
      id: crypto.randomUUID(),
      text,
      timestamp: Date.now(),
    };

    const updated = [...messagesRef.current, msg];
    messagesRef.current = updated;
    setMessages(updated);
    setInputText("");

    throttledSave();
  }, [inputText, token, throttledSave]);

  const autoResize = useCallback(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, 120)}px`;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    autoResize();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (scrollableRef.current) {
      scrollableRef.current.scrollTop = scrollableRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.max(inputRef.current.scrollHeight, 120)}px`;
    }
    const timer = setTimeout(autoResize, 0);
    return () => clearTimeout(timer);
  }, [currentFile]);

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

  const hideSidebar = !sidebarOpen && !!currentFile;
  const hideMain = sidebarOpen || !currentFile;

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  return (
    <div className="container">
      {!token ? (
        <div className="auth-screen">
          <h1>mamimu</h1>
          <button className="btn btn-auth" onClick={() => login()}>
            Sign in with Google
          </button>
        </div>
      ) : (
        <>
          <aside className={`sidebar${hideSidebar ? " hidden" : ""}`}>
            <div className="sidebar-header">
              <h1 className="sidebar-title">mamimu</h1>
              <button className="btn btn-new" onClick={() => void handleCreateFile()}>
                + New
              </button>
            </div>
            <ul className="file-list">
              {files.map((file) => (
                <li
                  key={file.id}
                  className={`file-item${currentFile?.id === file.id ? " active" : ""}`}
                  onClick={() => void handleSelectFile(file)}
                >
                  <span className="file-name">{file.name}</span>
                  <button className="btn-delete" onClick={(e) => void handleDeleteFile(file.id, e)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <main className={`main${hideMain ? " hidden" : ""}`}>
            {currentFile ? (
              <>
                <div className="toolbar">
                  <button className="btn-back" onClick={() => setSidebarOpen(true)}>
                    ←
                  </button>
                  <span className="filename">{currentFile.name}</span>
                </div>
                <div className="scrollable" ref={scrollableRef}>
                  <div className="message-list">
                    {messages.map((msg) => (
                      <div key={msg.id} className="message">
                        <div className="message-time">{formatTime(msg.timestamp)}</div>
                        <div className="message-text">{msg.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="input-area">
                    <textarea
                      ref={inputRef}
                      className="message-input"
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={handleInputKeyDown}
                      placeholder="Type a message..."
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Select a thread or create a new one</p>
              </div>
            )}
            {status && <p className="status">{status}</p>}
          </main>
        </>
      )}
    </div>
  );
}

export default App;
