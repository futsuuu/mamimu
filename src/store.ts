import type { Message, TreeNode } from "./types";

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

export function buildTree(messages: Message[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: { node: TreeNode; level: number }[] = [];

  for (const msg of messages) {
    const node: TreeNode = { message: msg, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= msg.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, level: msg.level });
  }

  return roots;
}
