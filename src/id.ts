export function generateId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0];
    const v = c === "x" ? r & 0xf : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
