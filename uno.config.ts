import { defineConfig, presetWind3, presetWebFonts } from "unocss";

export default defineConfig({
  presets: [
    presetWind3(),
    presetWebFonts({
      provider: "google",
      fonts: {
        sans: [
          { name: "Inter", weights: ["400", "500"] },
          { name: "Noto Sans JP", weights: ["400", "500"] },
        ],
      },
    }),
  ],
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
  font-family: 'Inter', 'Noto Sans JP', sans-serif;
  background: #f5f5f5;
  color: #333;
}
button, input, textarea, select {
  font-family: inherit;
}
`,
    },
  ],
});
