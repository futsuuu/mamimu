import { useRef, useEffect, useCallback, useState, useMemo, memo } from "react";

import { buildTree } from "../tree";
import type { Message, TreeNode } from "../types";
import MessageEditor from "./MessageEditor";
import type { MessageEditorHandle } from "./MessageEditor";
import { selectMessage, MemoizedMessageView } from "./MessageView";

const MAX_GUIDE_DEPTH = 20;

function IndentGuides({ level, children }: { level: number; children: React.ReactNode }) {
  let content = children;
  for (let i = MAX_GUIDE_DEPTH - 1; i >= 0; i--) {
    const show = i < level;
    content = (
      <div
        className={show ? "border-0 border-l border-solid border-gray-200 ml-2" : ""}
        style={{ paddingLeft: show ? "1.5rem" : "0" }}
      >
        {content}
      </div>
    );
  }
  return content;
}

const MessageNode = memo(function MessageNode({ node }: { node: TreeNode }) {
  return (
    <div>
      <MemoizedMessageView text={node.message.text} messageId={node.message.id} />
      {node.children.length > 0 && (
        <div
          className="border-0 border-l border-solid border-gray-200 ml-2"
          style={{ paddingLeft: "1.5rem" }}
        >
          {node.children.map((child) => (
            <MessageNode key={child.message.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
});

interface Props {
  currentFile: { id: string; name: string };
  messages: Message[];
  onSend: (text: string, level: number) => void;
  onBack: () => void;
}

export default function ThreadView({ currentFile, messages, onSend, onBack }: Props) {
  const editorRef = useRef<MessageEditorHandle | null>(null);
  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const [level, setLevel] = useState(() => messages[messages.length - 1]?.level ?? 0);
  const [prevFileId, setPrevFileId] = useState(currentFile.id);
  const [initialized, setInitialized] = useState(false);

  const tree = useMemo(() => buildTree(messages), [messages]);

  if (currentFile.id !== prevFileId) {
    setPrevFileId(currentFile.id);
    if (messages.length > 0) {
      setLevel(messages[messages.length - 1].level);
      setInitialized(true);
    } else {
      setLevel(0);
      setInitialized(false);
    }
  }

  if (!initialized && messages.length > 0) {
    setInitialized(true);
    setLevel(messages[messages.length - 1].level);
  }

  const indent = () => {
    const lastMsg = messages[messages.length - 1];
    const prevLevel = lastMsg?.level ?? 0;
    setLevel((prev) => Math.min(prev + 1, prevLevel + 1));
  };

  const outdent = () => {
    setLevel((prev) => Math.max(prev - 1, 0));
  };

  const handleEditorSend = useCallback(
    (text: string) => {
      onSend(text, level);
    },
    [onSend, level],
  );

  useEffect(() => {
    if (scrollableRef.current) {
      scrollableRef.current.scrollTop = scrollableRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => selectMessage(null);
  }, [currentFile.id]);

  return (
    <>
      <div className="flex items-center gap-2 px-4 pb-3 border-b border-gray-200 mb-3 md:hidden">
        <button
          className="bg-transparent border-none cursor-pointer text-xl px-1 leading-none text-gray-800"
          onClick={onBack}
        >
          ←
        </button>
        <span className="font-medium text-sm">{currentFile.name}</span>
      </div>
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex flex-col pr-4"
        ref={scrollableRef}
      >
        <div className="flex flex-col flex-1 min-h-0 mx-auto w-full max-w-6xl px-4 pt-4">
          <div className="flex-none min-w-0">
            {tree.map((node) => (
              <div key={node.message.id} className="px-3 min-w-0">
                <MessageNode node={node} />
              </div>
            ))}
          </div>
          <div className="px-3">
            <IndentGuides level={level}>
              <MessageEditor
                key={currentFile.id}
                ref={editorRef}
                onSend={handleEditorSend}
                onIndent={indent}
                onOutdent={outdent}
                placeholder="Type a message..."
              />
            </IndentGuides>
          </div>
          <div
            className="flex-1 cursor-text min-h-[120px]"
            onClick={() => {
              selectMessage(null);
              editorRef.current?.focus();
            }}
          />
        </div>
      </div>
    </>
  );
}
