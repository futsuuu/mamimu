import type { Message, TreeNode } from "./types";

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
