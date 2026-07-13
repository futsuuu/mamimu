import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
  createContext,
  useContext,
} from "react";

import { buildTree } from "../tree";
import type { Message, TreeNode, MessageBlockMode } from "../types";

const MAX_GUIDE_DEPTH = 20;

interface MessageInteractionContextValue {
  selectedMessageId: string | null;
  onMessageClick: (id: string) => void;
  editingMessageId: string | null;
  editInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onEditChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onEditBlur: React.FocusEventHandler<HTMLTextAreaElement>;
  onEditCompositionStart: React.CompositionEventHandler<HTMLTextAreaElement>;
  onEditCompositionEnd: React.CompositionEventHandler<HTMLTextAreaElement>;
}

const MessageInteractionContext = createContext<MessageInteractionContextValue | null>(null);

function useMessageInteraction() {
  const ctx = useContext(MessageInteractionContext);
  if (!ctx) throw new Error("useMessageInteraction must be used within a provider");
  return ctx;
}

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

function MessageBlock({
  mode,
  text,
  inputRef,
  placeholder,
  onChange,
  onKeyDown,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  selected,
  onClick,
}: {
  mode: MessageBlockMode;
  text: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
  onCompositionStart?: React.CompositionEventHandler<HTMLTextAreaElement>;
  onCompositionEnd?: React.CompositionEventHandler<HTMLTextAreaElement>;
  selected?: boolean;
  onClick?: () => void;
}) {
  if (mode.kind === "view") {
    return (
      <div
        data-message-block=""
        className={`px-2 py-1${selected ? " bg-neutral-100 outline-1 outline-solid outline-gray-200" : ""} hover:bg-neutral-50 rounded`}
        onClick={onClick}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        <div className="text-base leading-relaxed whitespace-pre-wrap break-anywhere">{text}</div>
      </div>
    );
  }
  return (
    <div className="px-2 py-1" {...(mode.kind !== "edit-new" ? { "data-message-block": "" } : {})}>
      <div className="cursor-text" onClick={() => inputRef?.current?.focus()}>
        <textarea
          ref={inputRef}
          rows={1}
          className="block w-full p-0 box-border border-none outline-none resize-none text-base leading-relaxed bg-transparent overflow-y-hidden"
          defaultValue={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function MessageNode({ node }: { node: TreeNode }) {
  const ctx = useMessageInteraction();
  const isEditing = ctx.editingMessageId === node.message.id;
  return (
    <div>
      {isEditing ? (
        <MessageBlock
          mode={{ kind: "edit-existing", message: node.message }}
          text={node.message.text}
          inputRef={ctx.editInputRef}
          onChange={ctx.onEditChange}
          onKeyDown={ctx.onEditKeyDown}
          onBlur={ctx.onEditBlur}
          onCompositionStart={ctx.onEditCompositionStart}
          onCompositionEnd={ctx.onEditCompositionEnd}
        />
      ) : (
        <MessageBlock
          mode={{ kind: "view" }}
          text={node.message.text}
          selected={ctx.selectedMessageId === node.message.id}
          onClick={() => ctx.onMessageClick(node.message.id)}
        />
      )}
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
}

interface Props {
  currentFile: { id: string; name: string };
  messages: Message[];
  onSend: (text: string, level: number) => void;
  onEdit: (id: string, text: string) => void;
  onBack: () => void;
}

export default function ThreadView({ currentFile, messages, onSend, onEdit, onBack }: Props) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  const inputValueRef = useRef("");
  const [level, setLevel] = useState(() => messages[messages.length - 1]?.level ?? 0);
  const [prevFileId, setPrevFileId] = useState(currentFile.id);
  const [initialized, setInitialized] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement | null>(null);
  const editValueRef = useRef("");
  const editComposingRef = useRef(false);
  const editHandledRef = useRef(false);

  const cancelEditing = () => {
    setEditingMessageId(null);
    setSelectedMessageId(null);
  };

  const saveEditing = () => {
    if (editingMessageId === null) return;
    const text = editValueRef.current.trim();
    if (!text) return;
    onEdit(editingMessageId, text);
    setEditingMessageId(null);
  };

  const handleEditBlur = () => {
    if (editHandledRef.current) {
      editHandledRef.current = false;
      return;
    }
    saveEditing();
  };

  const handleMessageClick = useCallback(
    (id: string) => {
      const prev = selectedMessageId;
      if (prev === null) {
        setSelectedMessageId(id);
      } else if (prev !== id) {
        setSelectedMessageId(id);
        setEditingMessageId(null);
      } else {
        setEditingMessageId(id);
      }
    },
    [selectedMessageId],
  );

  const editAutoResize = () => {
    const ta = editInputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    editValueRef.current = e.target.value;
    if (editComposingRef.current) return;
    editAutoResize();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (editComposingRef.current) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      editHandledRef.current = true;
      saveEditing();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      editHandledRef.current = true;
      cancelEditing();
      return;
    }
  };

  const tree = buildTree(messages);

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
    if (editingMessageId === null) return;
    const ta = editInputRef.current;
    if (!ta) return;
    editValueRef.current = ta.value;
    editAutoResize();
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, [editingMessageId]);

  const contextValue = useMemo<MessageInteractionContextValue>(
    () => ({
      selectedMessageId,
      onMessageClick: handleMessageClick,
      editingMessageId,
      editInputRef,
      onEditChange: handleEditChange,
      onEditKeyDown: handleEditKeyDown,
      onEditBlur: handleEditBlur,
      onEditCompositionStart: () => {
        editComposingRef.current = true;
      },
      onEditCompositionEnd: () => {
        editComposingRef.current = false;
        editValueRef.current = editInputRef.current?.value ?? "";
        editAutoResize();
      },
    }),
    [
      selectedMessageId,
      editingMessageId,
      handleMessageClick,
      handleEditChange,
      handleEditKeyDown,
      handleEditBlur,
    ],
  );

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
        onClick={(e) => {
          if (
            selectedMessageId !== null &&
            !(e.target as Element).closest("[data-message-block]")
          ) {
            setSelectedMessageId(null);
          }
        }}
      >
        <div className="flex flex-col flex-1 min-h-0 mx-auto w-full max-w-6xl px-4 pt-4">
          <div className="flex-none min-w-0">
            <MessageInteractionContext.Provider value={contextValue}>
              {tree.map((node) => (
                <div key={node.message.id} className="px-3 min-w-0">
                  <MessageNode node={node} />
                </div>
              ))}
            </MessageInteractionContext.Provider>
          </div>
          <div className="px-3">
            <IndentGuides level={level}>
              <MessageBlock
                mode={{ kind: "edit-new" }}
                text=""
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
              setSelectedMessageId(null);
              setEditingMessageId(null);
              focusInput();
            }}
          />
        </div>
      </div>
    </>
  );
}
