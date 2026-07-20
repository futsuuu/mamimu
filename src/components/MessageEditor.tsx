import { useEffect, useRef, useCallback, useImperativeHandle } from "react";
import type { Ref } from "react";

interface Props {
  ref?: Ref<MessageEditorHandle>;
  onSend: (text: string) => void;
  onIndent: () => void;
  onOutdent: () => void;
  placeholder?: string;
}

export interface MessageEditorHandle {
  focus: () => void;
}

export default function MessageEditor({ ref, onSend, onIndent, onOutdent, placeholder }: Props) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const composingRef = useRef(false);

  const autoResize = useCallback(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  const handleInputChange = (_e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (composingRef.current) return;
    autoResize();
  };

  const handleSend = () => {
    const ta = inputRef.current;
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) return;
    onSend(text);
    ta.value = "";
    autoResize();
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
        onOutdent();
      } else {
        onIndent();
      }
      return;
    }
    if (e.key === " " && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      onIndent();
      return;
    }
    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      onOutdent();
      return;
    }
  };

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  useEffect(() => {
    autoResize();
  }, []);

  return (
    <div className="px-2 py-1 rounded">
      <div className="cursor-text" onClick={() => inputRef.current?.focus()}>
        <textarea
          ref={inputRef}
          rows={1}
          className="block w-full p-0 box-border border-none outline-none resize-none text-base leading-relaxed bg-transparent overflow-y-hidden"
          defaultValue=""
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
            autoResize();
          }}
          placeholder={placeholder ?? "Type a message..."}
        />
      </div>
    </div>
  );
}
