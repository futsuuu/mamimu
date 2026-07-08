export interface Message {
  id: string;
  text: string;
  timestamp: number;
  level: number;
}

export interface TreeNode {
  message: Message;
  children: TreeNode[];
}

export type MessageBlockMode =
  | { readonly kind: "view" }
  | { readonly kind: "edit-new" }
  | { readonly kind: "edit-existing"; readonly message: Message };
