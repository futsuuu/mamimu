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

test("Tab indents before sending", async () => {
  const onSend = vi.fn();
  const screen = await render(
    <ThreadView currentFile={file} messages={[]} onSend={onSend} onBack={vi.fn()} />,
  );
  const input = screen.getByPlaceholder("Type a message...");
  await input.click();
  await userEvent.keyboard("{Tab}");
  await input.fill("hello");
  await userEvent.keyboard("{Enter}");
  expect(onSend).toHaveBeenCalledWith("hello", 1);
});

test("Shift+Tab outdents before sending", async () => {
  const onSend = vi.fn();
  const messages: Message[] = [
    { id: "st-1", text: "Parent", timestamp: 1, level: 0 },
    { id: "st-2", text: "Child", timestamp: 2, level: 1 },
  ];
  const screen = await render(
    <ThreadView currentFile={file} messages={messages} onSend={onSend} onBack={vi.fn()} />,
  );
  const input = screen.getByPlaceholder("Type a message...");
  await input.click();
  await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
  await input.fill("hello");
  await userEvent.keyboard("{Enter}");
  expect(onSend).toHaveBeenCalledWith("hello", 0);
});

test("initial level follows last message level", async () => {
  const onSend = vi.fn();
  const messages: Message[] = [
    { id: "il-1", text: "Root", timestamp: 1, level: 0 },
    { id: "il-2", text: "Child", timestamp: 2, level: 1 },
  ];
  const screen = await render(
    <ThreadView currentFile={file} messages={messages} onSend={onSend} onBack={vi.fn()} />,
  );
  const input = screen.getByPlaceholder("Type a message...");
  await input.fill("hello");
  await userEvent.keyboard("{Enter}");
  expect(onSend).toHaveBeenCalledWith("hello", 1);
});

test("clicking a message selects it", async () => {
  const messages: Message[] = [{ id: "sel-1", text: "Hello", timestamp: 1, level: 0 }];
  const screen = await render(
    <ThreadView currentFile={file} messages={messages} onSend={vi.fn()} onBack={vi.fn()} />,
  );
  const msg = screen.getByText("Hello");
  await msg.click();
  await vi.waitFor(() => {
    const el = screen.getByText("Hello").element().closest("[class*='cursor-pointer']");
    expect(el?.className).toContain("bg-neutral-100");
  });
});

test("clicking another message switches selection", async () => {
  const messages: Message[] = [
    { id: "sw-1", text: "First", timestamp: 1, level: 0 },
    { id: "sw-2", text: "Second", timestamp: 2, level: 0 },
  ];
  const screen = await render(
    <ThreadView currentFile={file} messages={messages} onSend={vi.fn()} onBack={vi.fn()} />,
  );
  const first = screen.getByText("First");
  const second = screen.getByText("Second");

  await first.click();
  await vi.waitFor(() => {
    const el = screen.getByText("First").element().closest("[class*='cursor-pointer']");
    expect(el?.className).toContain("bg-neutral-100");
  });

  await second.click();
  await vi.waitFor(() => {
    const el = screen.getByText("Second").element().closest("[class*='cursor-pointer']");
    expect(el?.className).toContain("bg-neutral-100");
  });
  await vi.waitFor(() => {
    const el = screen.getByText("First").element().closest("[class*='cursor-pointer']");
    expect(el?.className).not.toContain("bg-neutral-100");
  });
});

test("Backspace at start outdents after Tab", async () => {
  const onSend = vi.fn();
  const screen = await render(
    <ThreadView currentFile={file} messages={[]} onSend={onSend} onBack={vi.fn()} />,
  );
  const input = screen.getByPlaceholder("Type a message...");
  await input.click();
  await userEvent.keyboard("{Tab}");
  await userEvent.keyboard("{Backspace}");
  await input.fill("hello");
  await userEvent.keyboard("{Enter}");
  expect(onSend).toHaveBeenCalledWith("hello", 0);
});

test("Tab indent is capped by last message level + 1", async () => {
  const onSend = vi.fn();
  const messages: Message[] = [
    { id: "cap-1", text: "Root", timestamp: 1, level: 0 },
    { id: "cap-2", text: "Child", timestamp: 2, level: 1 },
  ];
  const screen = await render(
    <ThreadView currentFile={file} messages={messages} onSend={onSend} onBack={vi.fn()} />,
  );
  const input = screen.getByPlaceholder("Type a message...");
  await input.click();
  await userEvent.keyboard("{Tab}");
  await userEvent.keyboard("{Tab}");
  await userEvent.keyboard("{Tab}");
  await input.fill("hello");
  await userEvent.keyboard("{Enter}");
  expect(onSend).toHaveBeenCalledWith("hello", 2);
});
