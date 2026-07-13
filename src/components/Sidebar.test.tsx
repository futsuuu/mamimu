import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { ThreadMeta } from "../store/types";
import Sidebar from "./Sidebar";

const threads: ThreadMeta[] = [
  { id: "1", name: "Thread A", driveFileId: null },
  { id: "2", name: "Thread B", driveFileId: "drive2" },
];

test("renders thread list", async () => {
  const screen = await render(
    <Sidebar
      threads={threads}
      currentId={null}
      sidebarOpen={true}
      onSelectFile={vi.fn()}
      onCreateFile={vi.fn()}
      onDeleteFile={vi.fn()}
    />,
  );
  await expect.element(screen.getByText("Thread A")).toBeInTheDocument();
  await expect.element(screen.getByText("Thread B")).toBeInTheDocument();
});

test("highlights current thread", async () => {
  const screen = await render(
    <Sidebar
      threads={threads}
      currentId="1"
      sidebarOpen={true}
      onSelectFile={vi.fn()}
      onCreateFile={vi.fn()}
      onDeleteFile={vi.fn()}
    />,
  );
  const li = screen.getByText("Thread A").element().closest("li");
  expect(li).not.toBeNull();
  expect(li!.className).toContain("bg-white");
});

test("does not highlight non-current thread", async () => {
  const screen = await render(
    <Sidebar
      threads={threads}
      currentId="1"
      sidebarOpen={true}
      onSelectFile={vi.fn()}
      onCreateFile={vi.fn()}
      onDeleteFile={vi.fn()}
    />,
  );
  const item = screen.getByText("Thread B").element();
  expect(item.className.includes("bg-white")).toBe(false);
});

test("calls onSelectFile when a thread is clicked", async () => {
  const onSelectFile = vi.fn();
  const screen = await render(
    <Sidebar
      threads={threads}
      currentId={null}
      sidebarOpen={true}
      onSelectFile={onSelectFile}
      onCreateFile={vi.fn()}
      onDeleteFile={vi.fn()}
    />,
  );
  await screen.getByText("Thread A").click();
  expect(onSelectFile).toHaveBeenCalledWith("1");
});

test("calls onCreateFile when new button is clicked", async () => {
  const onCreateFile = vi.fn();
  const screen = await render(
    <Sidebar
      threads={threads}
      currentId={null}
      sidebarOpen={true}
      onSelectFile={vi.fn()}
      onCreateFile={onCreateFile}
      onDeleteFile={vi.fn()}
    />,
  );
  await screen.getByRole("button", { name: "+ New" }).click();
  expect(onCreateFile).toHaveBeenCalledOnce();
});

test("calls onDeleteFile when delete button is clicked", async () => {
  const onDeleteFile = vi.fn();
  const screen = await render(
    <Sidebar
      threads={threads}
      currentId={null}
      sidebarOpen={true}
      onSelectFile={vi.fn()}
      onCreateFile={vi.fn()}
      onDeleteFile={onDeleteFile}
    />,
  );
  await screen.getByRole("button", { name: "Delete Thread A" }).click();
  expect(onDeleteFile).toHaveBeenCalledWith("1", expect.any(Object));
});

test("sidebar is hidden when sidebarOpen is false and currentId is set", async () => {
  const screen = await render(
    <Sidebar
      threads={threads}
      currentId="1"
      sidebarOpen={false}
      onSelectFile={vi.fn()}
      onCreateFile={vi.fn()}
      onDeleteFile={vi.fn()}
    />,
  );
  const aside = screen.getByText("Thread A").element().closest("aside");
  expect(aside?.className.includes("hidden")).toBe(true);
});

test("sidebar is visible when currentId is null even if sidebarOpen is false", async () => {
  const screen = await render(
    <Sidebar
      threads={threads}
      currentId={null}
      sidebarOpen={false}
      onSelectFile={vi.fn()}
      onCreateFile={vi.fn()}
      onDeleteFile={vi.fn()}
    />,
  );
  const aside = screen.getByText("Thread A").element().closest("aside");
  expect(aside?.className.includes("hidden")).toBe(false);
});
