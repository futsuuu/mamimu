import { useRef, useEffect, useCallback } from "react";

import type { Message } from "../types";

interface Props {
  currentFile: { id: string; name: string };
  messages: Message[];
  onSend: (text: string) => void;
  onBack: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ThreadView({ currentFile, messages, onSend, onBack }: Props) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  const inputValueRef = useRef("");

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
    onSend(text);
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
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex flex-col px-4 pt-4"
        ref={scrollableRef}
      >
        <div className="flex-none">
          {messages.map((msg) => (
            <div key={msg.id} className="px-3 py-1">
              <div className="text-xs text-gray-400 mb-px">{formatTime(msg.timestamp)}</div>
              <div className="text-base leading-relaxed whitespace-pre-wrap break-words">
                {msg.text}
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 min-h-[120px]">
          <textarea
            ref={inputRef}
            className="block w-full min-h-[120px] p-3 border-none outline-none resize-none font-inherit text-base leading-relaxed bg-transparent overflow-y-hidden"
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
          />
        </div>
      </div>
    </>
  );
}
