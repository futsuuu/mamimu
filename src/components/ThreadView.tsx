import { useState, useRef, useEffect, useCallback } from "react";

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
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollableRef = useRef<HTMLDivElement | null>(null);

  const autoResize = useCallback(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, 120)}px`;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    autoResize();
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    onSend(text);
    setInputText("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = "120px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    setInputText("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = "120px";
    }
  }, [currentFile.id]);

  return (
    <>
      <div className="toolbar">
        <button className="btn-back" onClick={onBack}>
          ←
        </button>
        <span className="filename">{currentFile.name}</span>
      </div>
      <div className="scrollable" ref={scrollableRef}>
        <div className="message-list">
          {messages.map((msg) => (
            <div key={msg.id} className="message">
              <div className="message-time">{formatTime(msg.timestamp)}</div>
              <div className="message-text">{msg.text}</div>
            </div>
          ))}
        </div>
        <div className="input-area">
          <textarea
            ref={inputRef}
            className="message-input"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
          />
        </div>
      </div>
    </>
  );
}
