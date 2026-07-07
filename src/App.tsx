import { useState, useCallback, useRef, useEffect } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { listFiles, createFile, deleteFile, saveContent, loadContent } from "./api/drive";
import "./App.css";

const TOKEN_KEY = "mamimu_token";

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
  const [text, setText] = useState("");
  const [status, setStatus] = useState(token ? "Signed in" : "");
  const [showNewInput, setShowNewInput] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentFileRef = useRef<{ id: string; name: string } | null>(null);
  const lastContentRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef("");

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

  const loadFileList = useCallback(async (t: string) => {
    setStatus("Loading files...");
    try {
      const list = await listFiles(t);
      setFiles(list);
      if (list.length > 0) {
        const first = list[0];
        setCurrentFile(first);
        currentFileRef.current = first;
        const content = await loadContent(t, first.id);
        setText(content);
        textRef.current = content;
        lastContentRef.current = content;
        setStatus("Loaded");
      } else {
        setStatus("No files. Create a new one.");
      }
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        recoverAuth();
        return;
      }
      setStatus("Failed to load files");
    }
  }, [recoverAuth]);

  const autoSave = useCallback(async (t: string, content: string) => {
    if (!t) return;
    const file = currentFileRef.current;
    if (!file) return;
    if (content === lastContentRef.current) return;
    setStatus("Saving...");
    try {
      await saveContent(t, file.id, content);
      lastContentRef.current = content;
      setStatus("Saved");
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        recoverAuth();
        return;
      }
      setStatus("Failed to save");
    }
  }, [recoverAuth]);

  const handleSelectFile = useCallback(async (file: { id: string; name: string }) => {
    if (!token) return;
    // Save current file if dirty before switching
    if (currentFileRef.current && textRef.current !== lastContentRef.current) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await autoSave(token, textRef.current);
    }
    // Load selected file
    setCurrentFile(file);
    currentFileRef.current = file;
    setStatus("Loading...");
    try {
      const content = await loadContent(token, file.id);
      setText(content);
      textRef.current = content;
      lastContentRef.current = content;
      setStatus("Loaded");
      setSidebarOpen(false);
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        recoverAuth();
        return;
      }
      setStatus("Failed to load");
    }
  }, [token, recoverAuth, autoSave]);

  const handleCreateFile = useCallback(async () => {
    if (!token) return;
    const name = newFileName.trim();
    if (!name) return;
    if (files.some((f) => f.name === name)) {
      setStatus("A file with that name already exists");
      return;
    }
    setStatus("Creating...");
    try {
      const id = await createFile(token, name);
      const file = { id, name };
      setFiles((prev) => [...prev, file]);
      setShowNewInput(false);
      setNewFileName("");
      await handleSelectFile(file);
      setStatus("Created");
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        recoverAuth();
        return;
      }
      setStatus("Failed to create file");
    }
  }, [token, newFileName, files, handleSelectFile, recoverAuth]);

  const handleDeleteFile = useCallback(async (fileId: string, e: React.MouseEvent) => {
    if (!token) return;
    e.stopPropagation();
    setStatus("Deleting...");
    try {
      await deleteFile(token, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (currentFileRef.current?.id === fileId) {
        setCurrentFile(null);
        currentFileRef.current = null;
        setText("");
        textRef.current = "";
        lastContentRef.current = "";
        setSidebarOpen(true);
      }
      setStatus("Deleted");
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        recoverAuth();
        return;
      }
      setStatus("Failed to delete file");
    }
  }, [token, recoverAuth]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    textRef.current = newText;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      if (token) {
        void autoSave(token, textRef.current);
      }
    }, 1500);
  };

  // useEffect is needed here because there is no DOM event
  // to hook into for "app just mounted with a cached token".
  // All other side effects (auto-save, load-on-signin) are
  // handled in event handlers (onChange / onSuccess).
  useEffect(() => {
    if (token) {
      void loadFileList(token);
    }
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!token || textRef.current === lastContentRef.current) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const id = currentFileRef.current?.id;
      if (id) {
        void fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "text/plain; charset=utf-8",
            },
            body: textRef.current,
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
              {showNewInput ? (
                <input
                  className="new-file-input"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleCreateFile();
                    } else if (e.key === "Escape") {
                      setShowNewInput(false);
                      setNewFileName("");
                    }
                  }}
                  placeholder="File name..."
                  autoFocus
                />
              ) : (
                <button className="btn btn-new" onClick={() => setShowNewInput(true)}>
                  + New
                </button>
              )}
            </div>
            <ul className="file-list">
              {files.map((file) => (
                <li
                  key={file.id}
                  className={`file-item${currentFile?.id === file.id ? " active" : ""}`}
                  onClick={() => void handleSelectFile(file)}
                >
                  <span className="file-name">{file.name}</span>
                  <button
                    className="btn-delete"
                    onClick={(e) => void handleDeleteFile(file.id, e)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <main className={`main${hideMain ? " hidden" : ""}`}>
            {currentFile ? (
              <>
                <div className="editor-toolbar">
                  <button className="btn-back" onClick={() => setSidebarOpen(true)}>
                    ←
                  </button>
                  <span className="editor-filename">{currentFile.name}</span>
                </div>
                <textarea
                  className="editor"
                  value={text}
                  onChange={handleTextChange}
                  placeholder="Type your note..."
                />
              </>
            ) : (
              <div className="empty-state">
                <p>Select a file or create a new one</p>
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
