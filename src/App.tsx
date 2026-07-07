import { useState, useCallback, useRef, useEffect } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { findFile, createFile, saveContent, loadContent } from "./api/drive";
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
  const [text, setText] = useState("");
  const [status, setStatus] = useState(token ? "Signed in" : "");

  const fileIdRef = useRef<string | null>(null);
  const lastContentRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef("");

  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/drive.appdata",
    onSuccess: (res) => {
      setToken(res.access_token);
      saveToken(res.access_token, res.expires_in);
      setStatus("Signed in");
      void loadNote(res.access_token);
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

  const loadNote = useCallback(async (t: string) => {
    setStatus("Loading...");
    try {
      const id = await findFile(t);
      if (!id) {
        setStatus("No saved note found");
        setText("");
        lastContentRef.current = "";
        textRef.current = "";
        fileIdRef.current = null;
        return;
      }
      fileIdRef.current = id;
      const content = await loadContent(t, id);
      setText(content);
      textRef.current = content;
      lastContentRef.current = content;
      setStatus("Loaded");
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        recoverAuth();
        return;
      }
      setStatus("Failed to load");
    }
  }, [recoverAuth]);

  const autoSave = useCallback(async (t: string, content: string) => {
    if (!t) return;
    if (content === lastContentRef.current) return;
    setStatus("Saving...");
    try {
      let id = fileIdRef.current;
      if (!id) {
        id = await findFile(t);
        fileIdRef.current = id;
      }
      if (!id) {
        id = await createFile(t);
        fileIdRef.current = id;
      }
      await saveContent(t, id, content);
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
      void loadNote(token);
    }
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (token && textRef.current !== lastContentRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [token]);

  return (
    <div className="container">
      <h1>mamimu</h1>

      {!token && (
        <button className="btn btn-auth" onClick={() => login()}>
          Sign in with Google
        </button>
      )}

      <textarea
        className="editor"
        value={text}
        onChange={handleTextChange}
        placeholder="Type your note..."
      />

      {status && <p className="status">{status}</p>}
    </div>
  );
}

export default App;
