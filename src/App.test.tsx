import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import App from "./App";

const { mockUseGoogleAuth, mockSynced } = vi.hoisted(() => {
  const synced = {
    name: "synced",
    init: vi.fn().mockResolvedValue(undefined),
    listThreads: vi.fn().mockResolvedValue([]),
    getThread: vi.fn().mockResolvedValue(null),
    putThread: vi.fn().mockImplementation((data: any) => Promise.resolve(data)),
    deleteThread: vi.fn(),
    stop: vi.fn(),
  };
  return {
    mockUseGoogleAuth: vi.fn(),
    mockSynced: synced,
  };
});

vi.mock("./store/drive", () => ({
  DriveStore: vi.fn(function () {
    return { name: "drive", init: vi.fn().mockResolvedValue(undefined) };
  }),
}));

vi.mock("./store/indexed-db", () => ({
  IndexedDBStore: vi.fn(function () {
    return { name: "indexeddb", init: vi.fn().mockResolvedValue(undefined) };
  }),
}));

vi.mock("./store/synced", () => ({
  SyncedStore: vi.fn(function () {
    return mockSynced;
  }),
}));

vi.mock("./google-api/oauth", () => ({
  useGoogleAuth: mockUseGoogleAuth,
}));

test("shows auth screen when not signed in", async () => {
  mockUseGoogleAuth.mockReturnValue({
    token: null,
    login: vi.fn(),
    recoverAuth: vi.fn(),
  });

  const screen = await render(<App />);
  await expect.element(screen.getByRole("heading", { name: "mamimu" })).toBeInTheDocument();
  await expect
    .element(screen.getByRole("button", { name: "Sign in with Google" }))
    .toBeInTheDocument();
});

test("shows empty state when signed in with no threads", async () => {
  mockUseGoogleAuth.mockReturnValue({
    token: "mock-token",
    login: vi.fn(),
    recoverAuth: vi.fn(),
  });
  mockSynced.listThreads.mockResolvedValue([]);

  const screen = await render(<App />);
  await expect.element(screen.getByText("No threads. Create a new one.")).toBeInTheDocument();
});

test("loads and displays threads when signed in", async () => {
  mockUseGoogleAuth.mockReturnValue({
    token: "mock-token",
    login: vi.fn(),
    recoverAuth: vi.fn(),
  });
  mockSynced.listThreads.mockResolvedValue([{ id: "1", name: "Thread A", driveFileId: null }]);
  mockSynced.getThread.mockResolvedValue({
    id: "1",
    name: "Thread A",
    driveFileId: null,
    messages: [{ id: "m1", text: "Hello", timestamp: 1, level: 0 }],
  });

  const screen = await render(<App />);
  await expect.element(screen.getByText("Hello")).toBeInTheDocument();
});
