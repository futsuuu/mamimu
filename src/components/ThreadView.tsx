import { useRef, useEffect, useCallback, useState } from "react";

import type { Message } from "../types";

const MAX_LEVEL = 20;

function NestIndent({
  level,
  depth = 0,
  children,
}: {
  level: number;
  depth?: number;
  children: React.ReactNode;
}) {
  if (depth >= MAX_LEVEL) return children;
  return (
    <div
      className={depth < level ? "border-0 border-l border-solid border-gray-200" : ""}
      style={{ paddingLeft: depth < level ? "1.5rem" : "0" }}
    >
      <NestIndent level={level} depth={depth + 1}>
        {children}
      </NestIndent>
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  const inputValueRef = useRef("");
  const [level, setLevel] = useState(() => messages[messages.length - 1]?.level ?? 0);
  const messagesInitRef = useRef(false);

  const autoResize = useCallback(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, 120)}px`;
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
      inputRef.current.style.height = "120px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (composingRef.current) return;
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const lastMsg = messages[messages.length - 1];
      const prevLevel = lastMsg?.level ?? 0;
      if (e.shiftKey) {
        setLevel((prev) => Math.max(prev - 1, 0));
      } else {
        setLevel((prev) => Math.min(prev + 1, prevLevel + 1));
      }
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
      inputRef.current.style.height = "120px";
    }
    messagesInitRef.current = false;
    setLevel(0);
  }, [currentFile.id]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && !messagesInitRef.current) {
      setLevel(lastMsg.level);
      messagesInitRef.current = true;
    }
  }, [messages]);

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
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex flex-col"
        ref={scrollableRef}
      >
        <div className="flex flex-col flex-1 mx-auto w-full max-w-6xl px-4 pt-4">
          <div className="flex-none min-w-0">
            {messages.map((msg) => (
              <div key={msg.id} className="px-3 min-w-0">
                <NestIndent level={msg.level}>
                  <div className="py-1">
                    <div className="text-base leading-relaxed whitespace-pre-wrap break-anywhere">
                      {msg.text}
                    </div>
                  </div>
                </NestIndent>
              </div>
            ))}
          </div>
          <div className="flex-1 min-h-[120px]">
            <div className="pl-3 min-h-full">
              <NestIndent level={level}>
                <textarea
                  ref={inputRef}
                  className="block w-full min-h-[120px] box-border border-none outline-none resize-none text-base leading-relaxed bg-transparent overflow-y-hidden"
                  defaultValue=""
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
                  style={{ padding: "0.75rem 0.75rem 0.75rem 0" }}
                />
              </NestIndent>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
