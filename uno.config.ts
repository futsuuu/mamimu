import { defineConfig, presetWind3 } from "unocss";

export default defineConfig({
  presets: [presetWind3()],
  preflights: [
    {
      getCSS: () => `
html, body, #root {
  height: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
}
`,
    },
  ],
});
