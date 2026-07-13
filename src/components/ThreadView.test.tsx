import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import type { Message } from "../types";
import ThreadView from "./ThreadView";

const file = { id: "1", name: "Test Thread" };

test("renders messages in tree structure", async () => {
  const messages: Message[] = [
    { id: "m1", text: "Root", timestamp: 1, level: 0 },
    { id: "m2", text: "Child", timestamp: 2, level: 1 },
  ];
  const screen = await render(
    <ThreadView currentFile={file} messages={messages} onSend={vi.fn()} onBack={vi.fn()} />,
  );
  await expect.element(screen.getByText("Root")).toBeInTheDocument();
  await expect.element(screen.getByText("Child")).toBeInTheDocument();
});

test("shows placeholder on input", async () => {
  const screen = await render(
    <ThreadView currentFile={file} messages={[]} onSend={vi.fn()} onBack={vi.fn()} />,
  );
  await expect.element(screen.getByPlaceholder("Type a message...")).toBeInTheDocument();
});

test("sends message on Enter", async () => {
  const onSend = vi.fn();
  const screen = await render(
    <ThreadView currentFile={file} messages={[]} onSend={onSend} onBack={vi.fn()} />,
  );
  const input = screen.getByPlaceholder("Type a message...");
  await input.fill("hello");
  await userEvent.keyboard("{Enter}");
  expect(onSend).toHaveBeenCalledWith("hello", 0);
});

test("does not send empty message", async () => {
  const onSend = vi.fn();
  const screen = await render(
    <ThreadView currentFile={file} messages={[]} onSend={onSend} onBack={vi.fn()} />,
  );
  const input = screen.getByPlaceholder("Type a message...");
  await input.fill("   ");
  await userEvent.keyboard("{Enter}");
  expect(onSend).not.toHaveBeenCalled();
});

test("calls onBack on back button click", async () => {
  const onBack = vi.fn();
  const screen = await render(
    <ThreadView currentFile={file} messages={[]} onSend={vi.fn()} onBack={onBack} />,
  );
  const btn = screen.getByRole("button", { name: "←" });
  await btn.click();
  expect(onBack).toHaveBeenCalledOnce();
});

test("displays the current file name", async () => {
  const screen = await render(
    <ThreadView currentFile={file} messages={[]} onSend={vi.fn()} onBack={vi.fn()} />,
  );
  await expect.element(screen.getByText("Test Thread")).toBeInTheDocument();
});
