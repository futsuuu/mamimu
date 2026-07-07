const API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

async function checkResponse(res: Response) {
  if (res.status === 401) throw new Error("expired");
  if (!res.ok) throw new Error("request failed");
}

export async function listFiles(token: string): Promise<{ id: string; name: string }[]> {
  const url = `${API_BASE}/files?spaces=appDataFolder&fields=files(id,name)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkResponse(res);

  const data: { files?: { id: string; name: string }[] } = await res.json();
  return data.files ?? [];
}

export async function findFile(token: string, fileName: string): Promise<string | null> {
  const q = encodeURIComponent(`name = '${fileName}'`);
  const url = `${API_BASE}/files?spaces=appDataFolder&q=${q}&fields=files(id)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkResponse(res);

  const data: { files?: { id: string }[] } = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function createFile(token: string, fileName: string): Promise<string> {
  const res = await fetch(`${API_BASE}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: fileName,
      parents: ["appDataFolder"],
    }),
  });
  await checkResponse(res);

  const data: { id: string } = await res.json();
  return data.id;
}

export async function deleteFile(token: string, fileId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkResponse(res);
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
  await checkResponse(res);
}

export async function loadContent(token: string, fileId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await checkResponse(res);

  return res.text();
}
