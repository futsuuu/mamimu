import type { Message } from "./types";

export { buildTree } from "./tree";

export function parseMessages(content: string): Message[] {
  try {
    const data = JSON.parse(content);
    if (data && Array.isArray(data.messages)) {
      return data.messages as Message[];
    }
  } catch {}
  return [];
}

export function serializeMessages(messages: Message[]): string {
  return JSON.stringify({ messages });
}
