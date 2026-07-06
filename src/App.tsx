import { useState, useCallback } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { findFile, createFile, saveContent, loadContent } from "./api/drive";
import "./App.css";

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");

  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/drive.appdata",
    onSuccess: (res) => {
      setToken(res.access_token);
      setStatus("Authenticated");
    },
    onError: () => {
      setStatus("Authentication failed");
    },
  });

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
    } catch {
      setStatus("Failed to load");
    }
  }, [token]);

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
    } catch {
      setStatus("Failed to save");
    }
  }, [token, text]);

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
