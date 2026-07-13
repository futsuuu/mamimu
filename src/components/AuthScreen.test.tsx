import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import AuthScreen from "./AuthScreen";

test("renders heading and sign-in button", async () => {
  const screen = await render(<AuthScreen onLogin={vi.fn()} />);
  await expect.element(screen.getByRole("heading", { name: "mamimu" })).toBeInTheDocument();
  await expect
    .element(screen.getByRole("button", { name: "Sign in with Google" }))
    .toBeInTheDocument();
});

test("calls onLogin on button click", async () => {
  const onLogin = vi.fn();
  const screen = await render(<AuthScreen onLogin={onLogin} />);
  await screen.getByRole("button", { name: "Sign in with Google" }).click();
  expect(onLogin).toHaveBeenCalledOnce();
});
