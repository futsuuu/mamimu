import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
  memo,
  useSyncExternalStore,
} from "react";

import { buildTree } from "../tree";
import type { Message, TreeNode } from "../types";

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

let selectedMessageId: string | null = null;
const messageListeners = new Map<string, Set<() => void>>();

function subscribeToMessage(messageId: string, listener: () => void) {
  if (!messageListeners.has(messageId)) {
    messageListeners.set(messageId, new Set());
  }
  messageListeners.get(messageId)!.add(listener);
  return () => {
    const listeners = messageListeners.get(messageId);
    listeners?.delete(listener);
    if (listeners && listeners.size === 0) {
      messageListeners.delete(messageId);
    }
  };
}

function getIsSelected(messageId: string) {
  return selectedMessageId === messageId;
}

function selectMessage(id: string | null) {
  const prevId = selectedMessageId;
  if (prevId === id) return;
  selectedMessageId = id;
  if (prevId !== null) {
    messageListeners.get(prevId)?.forEach((fn) => fn());
  }
  if (id !== null) {
    messageListeners.get(id)?.forEach((fn) => fn());
  }
}

const MessageView = memo(function MessageView({
  text,
  messageId,
  onClick,
}: {
  text: string;
  messageId: string;
  onClick?: () => void;
}) {
  const isSelected = useSyncExternalStore(
    useCallback((cb: () => void) => subscribeToMessage(messageId, cb), [messageId]),
    useCallback(() => getIsSelected(messageId), [messageId]),
  );

  return (
    <div
      className={`px-2 py-1 rounded hover:bg-neutral-50 cursor-pointer${isSelected ? " bg-neutral-100 outline-1 outline-solid outline-gray-200" : ""}`}
      onClick={onClick}
    >
      <div className="text-base leading-relaxed whitespace-pre-wrap break-anywhere">{text}</div>
    </div>
  );
});

function MessageBlock({
  inputRef,
  placeholder,
  defaultValue,
  onChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
}: {
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCompositionStart?: React.CompositionEventHandler<HTMLTextAreaElement>;
  onCompositionEnd?: React.CompositionEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <div className="px-2 py-1 rounded">
      <div className="cursor-text" onClick={() => inputRef?.current?.focus()}>
        <textarea
          ref={inputRef}
          rows={1}
          className="block w-full p-0 box-border border-none outline-none resize-none text-base leading-relaxed bg-transparent overflow-y-hidden"
          defaultValue={defaultValue ?? ""}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

const MessageNode = memo(function MessageNode({
  node,
  onMessageClick,
}: {
  node: TreeNode;
  onMessageClick: (id: string) => void;
}) {
  const handleClick = useCallback(() => {
    onMessageClick(node.message.id);
  }, [onMessageClick, node.message.id]);

  return (
    <div>
      <MessageView text={node.message.text} messageId={node.message.id} onClick={handleClick} />
      {node.children.length > 0 && (
        <div
          className="border-0 border-l border-solid border-gray-200 ml-2"
          style={{ paddingLeft: "1.5rem" }}
        >
          {node.children.map((child) => (
            <MessageNode key={child.message.id} node={child} onMessageClick={onMessageClick} />
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  const inputValueRef = useRef("");
  const [level, setLevel] = useState(() => messages[messages.length - 1]?.level ?? 0);
  const [prevFileId, setPrevFileId] = useState(currentFile.id);
  const [initialized, setInitialized] = useState(false);
  const handleMessageClick = useCallback((id: string) => {
    selectMessage(id);
  }, []);

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

  const autoResize = useCallback(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    inputValueRef.current = e.target.value;
    if (composingRef.current) return;
    autoResize();
  };

  const handleSend = () => {
    const text = inputValueRef.current.trim();
    if (!text) return;
    onSend(text, level);
    inputValueRef.current = "";
    if (inputRef.current) {
      inputRef.current.value = "";
      autoResize();
    }
  };

  const indent = () => {
    const lastMsg = messages[messages.length - 1];
    const prevLevel = lastMsg?.level ?? 0;
    setLevel((prev) => Math.min(prev + 1, prevLevel + 1));
  };

  const outdent = () => {
    setLevel((prev) => Math.max(prev - 1, 0));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (composingRef.current) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    const el = e.target as HTMLTextAreaElement;
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        outdent();
      } else {
        indent();
      }
      return;
    }
    if (e.key === " " && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      indent();
      return;
    }
    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      outdent();
      return;
    }
  };

  useEffect(() => {
    if (scrollableRef.current) {
      scrollableRef.current.scrollTop = scrollableRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputValueRef.current = "";
    if (inputRef.current) {
      inputRef.current.value = "";
      autoResize();
    }
  }, [currentFile.id]);

  useEffect(() => {
    autoResize();
  }, []);

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
                <MessageNode node={node} onMessageClick={handleMessageClick} />
              </div>
            ))}
          </div>
          <div className="px-3">
            <IndentGuides level={level}>
              <MessageBlock
                inputRef={inputRef}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => {
                  composingRef.current = true;
                }}
                onCompositionEnd={() => {
                  composingRef.current = false;
                  inputValueRef.current = inputRef.current?.value ?? "";
                  autoResize();
                }}
                placeholder="Type a message..."
              />
            </IndentGuides>
          </div>
          <div
            className="flex-1 cursor-text min-h-[120px]"
            onClick={() => {
              selectMessage(null);
              focusInput();
            }}
          />
        </div>
      </div>
    </>
  );
}
