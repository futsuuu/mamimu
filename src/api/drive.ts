const FILE_NAME = "note.txt";
const API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

export async function findFile(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name = '${FILE_NAME}'`);
  const url = `${API_BASE}/files?spaces=appDataFolder&q=${q}&fields=files(id)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("findFile failed");

  const data: { files?: { id: string }[] } = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function createFile(token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: FILE_NAME,
      parents: ["appDataFolder"],
    }),
  });
  if (!res.ok) throw new Error("createFile failed");

  const data: { id: string } = await res.json();
  return data.id;
}

export async function saveContent(token: string, fileId: string, content: string): Promise<void> {
  const res = await fetch(`${UPLOAD_BASE}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: content,
  });
  if (!res.ok) throw new Error("saveContent failed");
}

export async function loadContent(token: string, fileId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("loadContent failed");

  return res.text();
}
