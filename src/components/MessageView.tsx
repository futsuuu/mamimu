import { memo, useCallback, useSyncExternalStore } from "react";

let selectedMessageId: string | null = null;
const messageListeners = new Map<string, Set<() => void>>();

export function subscribeToMessage(messageId: string, listener: () => void) {
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

export function getIsSelected(messageId: string) {
  return selectedMessageId === messageId;
}

export function selectMessage(id: string | null) {
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

export function MessageView({
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
}

export const MemoizedMessageView = memo(MessageView);
