import { useRef, useEffect, useCallback, useState } from "react";

import type { Message } from "../types";
import MessageEditor from "./MessageEditor";
import type { MessageEditorHandle } from "./MessageEditor";
import { selectMessage, MemoizedMessageView } from "./MessageView";

/**
 * Returns a style that indents content by `depth` levels and draws vertical
 * guide lines at each level boundary.
 */
function indentStyle(depth: number): React.CSSProperties {
  // Base padding (rem)
  const BASE = 0.75;
  // Per-level padding-left increment (rem)
  const INDENT = 2;
  // Distance from the left edge of the indent area to the guide line (rem)
  const GAP = 0.5;

  if (depth <= 0) {
    return { paddingLeft: `${BASE}rem`, paddingRight: `${BASE}rem` };
  }

  // The gradient repeats every `INDENT` rem; each period draws a 1px line at
  // `GAP` rem from its left edge.  `background-size` limits how many periods
  // are visible (= `depth`), and `background-position` shifts the whole
  // gradient past the base padding.
  return {
    paddingLeft: `${BASE + depth * INDENT}rem`,
    paddingRight: `${BASE}rem`,
    backgroundImage: `repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent ${GAP}rem,
      var(--guide) ${GAP}rem,
      var(--guide) calc(${GAP}rem + 1px),
      transparent calc(${GAP}rem + 1px),
      transparent ${INDENT}rem
    )`,
    backgroundSize: `${depth * INDENT}rem 100%`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: `${BASE}rem 0`,
  };
}

function IndentGuides({ level, children }: { level: number; children: React.ReactNode }) {
  return (
    <div className="min-w-0 [--guide:theme(colors.gray.200)]" style={indentStyle(level)}>
      {children}
    </div>
  );
}

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
          {messages.map((msg) => (
            <IndentGuides key={msg.id} level={msg.level}>
              <MemoizedMessageView text={msg.text} messageId={msg.id} />
            </IndentGuides>
          ))}
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
