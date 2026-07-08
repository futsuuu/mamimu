/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), UnoCSS()],
  test: {},
});
