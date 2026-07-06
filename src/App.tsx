import { useState, useCallback } from "react";
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

  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/drive.appdata",
    onSuccess: (res) => {
      setToken(res.access_token);
      saveToken(res.access_token, res.expires_in);
      setStatus("Authenticated");
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

  const handleLoad = useCallback(async () => {
    if (!token) return;
    setStatus("Loading...");
    try {
      const id = await findFile(token);
      if (!id) {
        setStatus("No saved note found");
        setText("");
        return;
      }
      const content = await loadContent(token, id);
      setText(content);
      setStatus("Loaded");
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        recoverAuth();
        return;
      }
      setStatus("Failed to load");
    }
  }, [token, recoverAuth]);

  const handleSave = useCallback(async () => {
    if (!token) return;
    setStatus("Saving...");
    try {
      let id = await findFile(token);
      if (!id) {
        id = await createFile(token);
      }
      await saveContent(token, id, text);
      setStatus("Saved");
    } catch (e) {
      if (e instanceof Error && e.message === "expired") {
        recoverAuth();
        return;
      }
      setStatus("Failed to save");
    }
  }, [token, text, recoverAuth]);

  return (
    <div className="container">
      <h1>mamimu</h1>

      {!token ? (
        <button className="btn btn-auth" onClick={() => login()}>
          Sign in with Google
        </button>
      ) : (
        <div className="actions">
          <button className="btn" onClick={handleLoad}>
            Load
          </button>
          <button className="btn" onClick={handleSave}>
            Save
          </button>
        </div>
      )}

      <textarea
        className="editor"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your note..."
      />

      {status && <p className="status">{status}</p>}
    </div>
  );
}

export default App;
